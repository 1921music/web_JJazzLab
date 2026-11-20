"use strict";

// The supported desktop formats are the XStream XML written by JJazzLab 5.2.1.
// Resolve references within the parsed document without instantiating Java objects.
const DesktopSongFiles = (() => {
    // JJazzLab measures compound meters in natural beats (dotted quarters).
    const meters = Object.freeze({ TWO_FOUR: ["2/4", 2], THREE_FOUR: ["3/4", 3], FOUR_FOUR: ["4/4", 4],
        FIVE_FOUR: ["5/4", 5], SIX_FOUR: ["6/4", 6], SEVEN_FOUR: ["7/4", 7], SIX_EIGHT: ["6/8", 2], TWELVE_EIGHT: ["12/8", 4] });

    function sourceStyleId(id) {
        return /^(?:Yamaha|YamJJazz)RhythmProviderID___(.+)___\d+\/\d+$/u.exec(id)?.[1] ?? id;
    }

    function overrideStyleIds(parts) {
        const ids = new Set();
        for (const part of parts) {
            for (const { rhythm } of readTrackOverrides(part.parameters.RP_SYS_OverrideTracksID)) ids.add(sourceStyleId(rhythm));
        }
        return ids;
    }

    function readTrackOverrides(saved = "") {
        const modern = saved.includes(">>");
        return saved.split(modern ? /\s*&&\s*/u : /\s*&\s*/u).flatMap(item => {
            const columns = item.split(modern ? /\s*>>\s*/u : /\s*>\s*/u);
            const [source, rhythm, destination, variation] = columns;
            if (!source || !rhythm || !destination || columns.length > (modern ? 4 : 3)) return [];
            return [{ source, rhythm, destination, variation }];
        });
    }

    function writeTrackOverrides(entries) {
        return entries.map(({ source, rhythm, destination, variation }) =>
            [source, rhythm, destination, ...(variation ? [variation] : [])].join(">>")).join(" && ");
    }

    function readCustomPhrases(saved = "") {
        return new Map(saved.split("&").filter(entry => entry.includes("%")).map(entry => {
            const separator = entry.indexOf("%");
            return [entry.slice(0, separator), entry.slice(separator + 1)];
        }));
    }

    function setCustomPhrase(part, voice, phrase) {
        const key = "RP_SYS_CustomPhraseId";
        const phrases = readCustomPhrases(part.parameters[key]);
        if (phrase === undefined) phrases.delete(voice);
        else phrases.set(voice, phrase);
        if (phrases.size) part.parameters[key] = Array.from(phrases, ([voice, phrase]) => voice + "%" + phrase).join("&");
        else delete part.parameters[key];
    }

    function barBeats(song) {
        return song.parts.flatMap(part => {
            const section = song.sections[part.section];
            const end = song.sections[part.section + 1]?.bar ?? song.bars;
            return Array(end - section.bar).fill(meters[section.meter][1]);
        });
    }
    const child = (node, name) => Array.from(node?.children ?? []).find(element => element.localName === name);
    const content = (node, name) => child(node, name)?.textContent ?? "";
    const attr = (node, name) => node?.getAttribute(name) ?? "";

    function parse(xml, rootName, version) {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        const root = doc.documentElement;
        if (doc.doctype || doc.querySelector("parsererror") || root.localName !== rootName) {
            throw new Error(`${rootName} ファイルのXMLを読み込めません。`);
        }
        if (content(root, "spVERSION").trim() !== version) {
            throw new Error(`${rootName} の保存形式 v${version} に対応しています。`);
        }
        return root;
    }

    function resolve(node) {
        const visited = new Set();
        while (node?.hasAttribute("reference")) {
            const path = node.getAttribute("reference");
            if (visited.has(node) || !/^(?:\/)?(?:\.\.|[\w.$-]+(?:\[[1-9]\d*\])?)(?:\/(?:\.\.|[\w.$-]+(?:\[[1-9]\d*\])?))*$/u.test(path)) {
                throw new Error("曲ファイルの参照が不正です。");
            }
            visited.add(node);
            const doc = node.ownerDocument;
            node = doc.evaluate(path, node, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!node || node.nodeType !== Node.ELEMENT_NODE) throw new Error("曲ファイルの参照先が見つかりません。");
        }
        return node;
    }

    function number(value, description, min, max = Infinity) {
        const result = Number(value);
        if (!value.trim() || !Number.isFinite(result) || result < min || result > max) {
            throw new Error(`${description} が不正です。`);
        }
        return result;
    }

    function readRendering(chord) {
        const rendering = child(resolve(child(chord, "spRenderingInfo")), "ChordRenderingInfoSP");
        const features = resolve(child(rendering, "enum-set"))?.textContent.trim() ?? "";
        const scale = resolve(child(rendering, "StdScaleInstance"));
        return { ...(features ? { features } : {}),
            ...(scale ? { scale: { index: attr(scale, "spStdScaleIndex"), pitch: attr(scale, "spStartNotePitch") } } : {}) };
    }

    function readClientProperties(owner, name = "spClientProperties") {
        const properties = resolve(child(resolve(child(owner, name)), "properties"));
        const entries = [...(properties?.children ?? [])].map(entry => [...entry.children].map(value => resolve(value).textContent));
        return entries.length ? { clientProperties: Object.fromEntries(entries) } : {};
    }

    function readSong(xml) {
        const root = parse(xml, "Song", "4");
        const leadSheet = resolve(child(root, "spChordLeadSheet"));
        const structure = resolve(child(root, "spSongStructure"));
        const bars = number(content(leadSheet, "spSize"), "譜面の小節数", 1, 1024);
        const items = Array.from(child(leadSheet, "spItems")?.children ?? []);
        const annotations = items.filter(item => attr(item, "resolves-to") === "CLI_BarAnnotationImplSP").map(item => ({
            bar: number(attr(item, "spBarIndex"), "小節メモの位置", 0, bars - 1),
            text: content(item, "spAnnotation"), ...readClientProperties(item)
        }));
        const restart = items.find(item => attr(item, "resolves-to") === "CLI_LoopRestartBarImplSP");
        const sectionNodes = items.filter(item => attr(item, "resolves-to") === "CLI_SectionImplSP");
        const sections = sectionNodes.map(section => ({
            name: attr(section, "spName"),
            bar: number(attr(section, "spBarIndex"), "セクションの小節", 0, bars - 1),
            meter: attr(section, "spTs"), ...readClientProperties(section)
        }));
        const chords = items.filter(item => attr(item, "resolves-to") === "CLI_ChordSymbolSP").map(item => {
            const chord = resolve(child(item, "spChord"));
            const position = attr(resolve(child(item, "spPos")), "spPos");
            const match = /^\[(?:(\d+):)?(\d+(?:[.,]\d+)?)\]$/u.exec(position);
            if (!match) throw new Error("コードの拍位置を読み込めません。");
            const originalName = attr(chord, "spOriginalName");
            const name = attr(chord, "resolves-to") === "NCExtChordSymbolSP" ? "NC" : attr(chord, "spName") || originalName;
            const alternateNode = resolve(child(chord, "spAltChordSymbol"));
            const filter = resolve(child(chord, "spAltFilter"));
            const alternateName = attr(alternateNode, "resolves-to") === "VoidAltExtChordSymbolSP" ? "NC" : attr(alternateNode, "spName");
            const alternate = alternateName && filter ? {
                name: alternateName, ...readRendering(alternateNode),
                random: content(filter, "spRandom").trim(),
                markers: [...(resolve(child(filter, "spValues"))?.children ?? [])].map(value => resolve(value).textContent)
            } : undefined;
            return { name, bar: Number(match[1] ?? 0), beat: Number(match[2].replace(",", ".")),
                ...(originalName && originalName !== attr(chord, "spName") ? { originalName } : {}),
                ...readRendering(chord), ...(alternate ? { alternate } : {}), ...readClientProperties(item) };
        });
        const parts = Array.from(child(structure, "spSpts")?.children ?? []).map(part => {
            const section = sectionNodes.indexOf(resolve(child(part, "spParentSection")));
            if (section < 0) throw new Error("演奏区間の参照先セクションが見つかりません。");
            const parameters = Object.fromEntries(Array.from(child(part, "spHashMapRpIdValue")?.children ?? [])
                .map(entry => Array.from(entry.children, value => resolve(value).textContent))
                .filter(pair => pair.length === 2));
            return { name: attr(part, "spName"), section, styleId: attr(part, "spRhythmId"),
                styleName: content(part, "spRhythmName"), parameters, ...readClientProperties(part) };
        });
        const userTracks = Array.from(child(root, "spMapUserPhrases")?.children ?? []).map(entry => ({
            name: resolve(entry.firstElementChild).textContent,
            phrase: content(resolve(entry.lastElementChild), "spSaveString")
        }));
        if (sections.length === 0 || sections[0].bar !== 0 || parts.length === 0) {
            throw new Error("曲に譜面セクションと演奏区間が必要です。");
        }
        const tags = [...(resolve(child(root, "spTags"))?.children ?? [])].map(tag => resolve(tag).textContent);
        return validateSong({ title: attr(root, "spName"), comments: content(root, "spComments"), tags,
            ...readClientProperties(root, "spClientPropertiesV3"),
            tempo: number(attr(root, "spTempo"), "テンポ", 20, 400),
            bars, sections, chords, parts, userTracks, annotations,
            ...(restart ? { loopRestartBar: number(attr(restart, "spBarIndex"), "ループの折り返し位置", 0, bars - 1) } : {}) });
    }

    function validateSong(song) {
        if (!song || typeof song.title !== "string" || !Number.isInteger(song.bars) || song.bars < 1 || song.bars > 1024
            || !Number.isInteger(song.tempo) || song.tempo < 20 || song.tempo > 400
            || !Array.isArray(song.sections) || song.sections[0]?.bar !== 0
            || !song.sections.every((section, index) => section && typeof section.name === "string" && Object.hasOwn(meters, section.meter)
                && Number.isInteger(section.bar) && section.bar < song.bars && (index === 0 || section.bar > song.sections[index - 1].bar))
            || !Array.isArray(song.parts) || !song.parts.length || !song.parts.every(part => part && song.sections[part.section]
                && Number.isInteger(part.section) && typeof part.name === "string" && typeof part.styleId === "string"
                && part.parameters && Object.values(part.parameters).every(value => typeof value === "string"))
            || !Array.isArray(song.chords) || !song.chords.every(chord => chord && typeof chord.name === "string"
                && Number.isInteger(chord.bar) && chord.bar >= 0 && chord.bar < song.bars && Number.isFinite(chord.beat) && chord.beat >= 0)
            || (song.annotations !== undefined && (!Array.isArray(song.annotations) || !song.annotations.every(note =>
                note && Number.isInteger(note.bar) && note.bar >= 0 && note.bar < song.bars && typeof note.text === "string")))
            || (song.loopRestartBar !== undefined && (!Number.isInteger(song.loopRestartBar) || song.loopRestartBar < 0 || song.loopRestartBar >= song.bars))
            || !Array.isArray(song.userTracks) || !song.userTracks.every(track => track && typeof track.name === "string" && typeof track.phrase === "string")) {
            throw new Error("曲ファイルの譜面または演奏順が不正です。");
        }
        return song;
    }

    function readTextSong(rows, rhythmForMeter) {
        if (!rows.length) throw new Error(t("読み込めるコード譜がありません。", "The text contains no readable lead sheet."));
        if (rows.length === 1) throw new Error(rows[0]);
        const [title, tempo, bars, ...items] = Array.from(rows);
        const sections = [], chords = [];
        for (const row of items) {
            const [kind, bar, value, name, originalName] = row.split("\t");
            if (kind === "section") sections.push({ bar: Number(bar), name, meter: value });
            else chords.push({ bar: Number(bar), name, originalName, beat: Number(value) });
        }
        const parts = sections.map(({ name, meter }, section) => ({
            name, section, ...rhythmForMeter(meter), parameters: {}
        }));
        return validateSong({ title, tempo: Number(tempo), bars: Number(bars), sections, chords, parts, userTracks: [] });
    }

    function readMix(xml) {
        const root = parse(xml, "MidiMix", "5");
        const settings = Array.from(child(root, "spInsMixes")?.children ?? []);
        const keys = Array.from(child(root, "spKeys")?.children ?? []);
        if (settings.length !== 16 || keys.length !== settings.length) throw new Error("ミックスのチャンネル数が不正です。");
        return settings.flatMap((node, channel) => {
            if (node.localName === "null" && keys[channel].localName === "null") return [];
            const mix = resolve(node);
            const key = resolve(keys[channel]);
            const instrument = resolve(child(mix, "spIns"));
            const values = resolve(child(mix, "spInsSettings"));
            if (!instrument || !values || key.localName === "null") throw new Error("ミックスのパート設定が不正です。");
            return [{
                channel, rhythmId: content(key, "rhythmId"), name: content(key, "rvName"),
                instrument: attr(instrument, "spSaveString"), patch: attr(instrument, "spPatchname"),
                mute: attr(mix, "spMute") === "true", instrumentEnabled: attr(mix, "spInsEnabled") !== "false",
                volume: number(attr(values, "spVolume"), "音量", 0, 127),
                pan: number(content(values, "spPanoramic"), "パン", 0, 127),
                transpose: number(attr(values, "spTransposition"), "移調", -36, 36),
                velocityShift: number(attr(values, "spVelocityShift"), "ベロシティ補正", -64, 64),
                reverb: number(content(values, "spReverb"), "リバーブ", 0, 127),
                chorus: number(content(values, "spChorus"), "コーラス", 0, 127),
                volumeEnabled: content(values, "spVolumeEnabled") !== "false",
                panEnabled: content(values, "spPanoramicEnabled") !== "false",
                reverbEnabled: content(values, "spReverbEnabled") !== "false",
                chorusEnabled: content(values, "spChorusEnabled") !== "false"
            }];
        });
    }

    const userRhythmIds = new Set(["SpUserChannelRhythmID", "SpDrumsUserChannelRhythmID"]);
    const isUserMixTrack = track => userRhythmIds.has(track.rhythmId);
    const rhythmVoiceTypes = new Map([
        ["Rhythm", "drums"], ["Drums", "drums"], ["SubRhythm", "percussion"], ["Percussion", "percussion"],
        ["Bass", "bass"], ["Chord1", "chord1"], ["Chord2", "chord2"], ["Pad", "pad"],
        ["Phrase1", "phrase1"], ["Phrase2", "phrase2"]
    ]);

    function mergeInstrumentMixes(destination, source, exactOnly = false) {
        // MidiMix v5 stores voice names. YamJJazz and jjSwing use the AccType names;
        // the rhythm stubs use Drums and Bass.
        const available = [...destination].sort((a, b) => a.channel - b.channel);
        const matched = new Map();
        for (const incoming of [...source].sort((a, b) => a.channel - b.channel)) {
            const user = isUserMixTrack(incoming);
            const type = rhythmVoiceTypes.get(incoming.name);
            let index = available.findIndex(track => user
                ? isUserMixTrack(track) && track.name === incoming.name
                : track.rhythmId === incoming.rhythmId && track.name === incoming.name);
            if (index < 0 && !user && type && !exactOnly) {
                index = available.findIndex(track => !isUserMixTrack(track) && rhythmVoiceTypes.get(track.name) === type);
            }
            if (index >= 0) {
                const [track] = available.splice(index, 1);
                matched.set(track, incoming);
            }
        }
        if (!matched.size) return null;
        return destination.map(track => {
            const incoming = matched.get(track);
            return incoming ? { ...incoming, rhythmId: track.rhythmId, name: track.name, channel: track.channel,
                sourceChannel: track.sourceChannel ?? track.channel } : track;
        });
    }

    const mixValues = ["patch", "instrumentEnabled", "volume", "pan", "transpose", "velocityShift", "reverb", "chorus",
        "volumeEnabled", "panEnabled", "reverbEnabled", "chorusEnabled"];
    const playableParameters = new Set(["rpVariationID", "rpIntensityID", "RpFillID", "RpSysMuteID", "rpSysMarkerID",
        "rpTempoID", "BassStyleId", "DrumsStyleId", "RP_SYS_CustomPhraseId", "RP_SYS_DrumsTransformId", "RP_SYS_OverrideTracksID"]);

    function decodeEngineMix(rows) {
        return Array.from(rows, row => {
            const [channel, rhythmId, name, instrument, patch, mute, instrumentEnabled, ...values] = row.split("\t");
            const properties = mixValues.slice(2).map((key, index) => [key, index < 6 ? Number(values[index]) : values[index] === "true"]);
            return { channel: Number(channel), rhythmId, name, instrument, patch, mute: mute === "true",
                instrumentEnabled: instrumentEnabled === "true", ...Object.fromEntries(properties) };
        });
    }

    function engineArgs(song, styleBytes = new Int8Array(), styleFilename = "", mix = []) {
        validateSong(song);
        return [styleBytes, styleFilename, song.title, song.tempo, song.bars,
            song.sections.map(section => section.name), Int32Array.from(song.sections, section => section.bar),
            song.sections.map(section => section.meter),
            song.chords.map(chord => chord.name), Int32Array.from(song.chords, chord => chord.bar),
            Float32Array.from(song.chords, chord => chord.beat), song.parts.map(part => part.name),
            Int32Array.from(song.parts, part => part.section), song.parts.map(part => Object.entries(part.parameters)
                .filter(([id]) => playableParameters.has(id))
                .map(([id, value]) => `${id}\t${value}`).join("\n")),
            song.userTracks.map(track => track.name), song.userTracks.map(track => track.phrase),
            mix.map(track => [track.rhythmId, track.name, track.mute, ...mixValues.map(key => track[key]),
                track.sourceChannel ?? track.channel].join("\t"))];
    }

    function multiStyleEngineArgs(song, styles, sources, mix) {
        const lengths = Int32Array.from(styles, style => style.bytes.length);
        const extensions = Int32Array.from(styles, style => style.extension?.length ?? 0);
        const bytes = new Int8Array(styles.reduce((total, style, index) => total + lengths[index] + extensions[index], 0));
        let offset = 0;
        for (const style of styles) {
            bytes.set(style.bytes, offset);
            offset += style.bytes.length;
            if (style.extension) {
                bytes.set(style.extension, offset);
                offset += style.extension.length;
            }
        }
        const columns = engineArgs(song, bytes, "", mix);
        const encodeRendering = chord => [chord.features, chord.scale?.index, chord.scale?.pitch].join("\t");
        const rendering = song.chords.map(chord => {
            const alt = chord.alternate;
            return alt ? [encodeRendering(chord), alt.name, encodeRendering(alt), alt.random, ...alt.markers].join("\n") : encodeRendering(chord);
        });
        return [bytes, styles.map(style => style.id === "jjSwing-ID" ? "" : style.baseName ?? style.name), lengths,
            styles.map(style => style.extension ? style.name : ""), extensions, Int32Array.from(sources), ...columns.slice(2), rendering];
    }

    const escape = value => String(value ?? "").replace(/[&<>"\r\n\t]/gu, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\r": "&#13;", "\n": "&#10;", "\t": "&#9;"
    })[char]);
    const xmlText = (tag, value) => `<${tag}>${escape(value)}</${tag}>`;

    function writeClientProperties(item, ownerClass) {
        const tag = ownerClass ? "spClientProperties" : "spClientPropertiesV3";
        const entries = Object.entries(item.clientProperties ?? {}).map(([key, value]) =>
            `<entry>${xmlText("string", key)}${xmlText("string", value)}</entry>`).join("");
        const owner = ownerClass ? `<owner class="${ownerClass}" reference="../.."/>` : "";
        return `<${tag}>${entries ? `<properties>${entries}</properties>` : ""}${owner}</${tag}>`;
    }

    function writeRendering(chord) {
        const scale = chord.scale
            ? `<StdScaleInstance resolves-to="StdScaleInstanceSP" spVERSION="2" spStdScaleIndex="${escape(chord.scale.index)}" spStartNotePitch="${escape(chord.scale.pitch)}"/>`
            : "<null/>";
        return '<spRenderingInfo resolves-to="ChordRenderingInfoSP" serialization="custom"><ChordRenderingInfoSP><int>3</int>'
            + `<enum-set enum-type="Feature">${escape(chord.features)}</enum-set>${scale}</ChordRenderingInfoSP></spRenderingInfo>`;
    }

    function writeAlternate(alternate) {
        if (!alternate) return "";
        const chord = alternate.name === "NC"
            ? '<spAltChordSymbol class="VoidAltExtChordSymbol" resolves-to="VoidAltExtChordSymbolSP" spName="VoidAltExtChordSymbol"/>'
            : `<spAltChordSymbol resolves-to="AltExtChordSymbolSP" spVERSION="2" spName="${escape(alternate.name)}">${writeRendering(alternate)}</spAltChordSymbol>`;
        const condition = alternate.random ? xmlText("spRandom", alternate.random)
            : `<spValues>${alternate.markers.map(marker => xmlText("string", marker)).join("")}</spValues>`;
        return chord + `<spAltFilter resolves-to="AltDataFilterSP"><spVERSION>2</spVERSION>${condition}</spAltFilter>`;
    }

    function writeSong(song) {
        const sections = song.sections.map(section => ({ bar: section.bar, beat: -1, xml:
            `<CLI__SectionImpl resolves-to="CLI_SectionImplSP" spName="${escape(section.name)}" spTs="${escape(section.meter)}" spBarIndex="${section.bar}">`
            + '<spVERSION>4</spVERSION>' + writeClientProperties(section, "CLI_SectionImpl") + '</CLI__SectionImpl>' }));
        const chords = song.chords.map(chord => {
            const start = chord.name === "NC" ? '<spChord class="NCExtChordSymbol" resolves-to="NCExtChordSymbolSP" spVERSION="2" spName="NCExtChordSymbol">'
                : `<spChord resolves-to="ExtChordSymbolSP" spName="${escape(chord.name)}" spOriginalName="${escape(chord.originalName ?? chord.name)}"><spVERSION>3</spVERSION>`;
            return { bar: chord.bar, beat: chord.beat, xml:
                '<CLI__ChordSymbolImpl resolves-to="CLI_ChordSymbolSP"><spVERSION>3</spVERSION>' + start
                + writeRendering(chord) + writeAlternate(chord.alternate) + '</spChord>'
                + `<spPos resolves-to="PositionSP" spVERSION="2" spPos="[${chord.bar}:${chord.beat}]"/>`
                + writeClientProperties(chord, "CLI_ChordSymbolImpl") + '</CLI__ChordSymbolImpl>' };
        });
        const extras = (song.annotations ?? []).map(note => ({ bar: note.bar, beat: -0.5,
            xml: `<CLI__BarAnnotationImpl resolves-to="CLI_BarAnnotationImplSP" spVERSION="2" spBarIndex="${note.bar}">`
                + xmlText("spAnnotation", note.text)
                + writeClientProperties(note, "CLI_BarAnnotationImpl") + '</CLI__BarAnnotationImpl>' }));
        if (song.loopRestartBar !== undefined) extras.push({ bar: song.loopRestartBar, beat: -0.25,
            xml: `<CLI__LoopRestartBarImpl resolves-to="CLI_LoopRestartBarImplSP" spVERSION="1" spBarIndex="${song.loopRestartBar}"/>` });
        const items = [...sections, ...chords, ...extras].sort((a, b) => a.bar - b.bar || a.beat - b.beat).map(item => item.xml);
        let start = 0;
        const arrangement = song.parts.map(part => {
            const section = song.sections[part.section];
            const length = (song.sections[part.section + 1]?.bar ?? song.bars) - section.bar;
            const suffix = part.section === 0 ? "" : `[${part.section + 1}]`;
            const parameters = Object.entries(part.parameters).map(([key, value]) =>
                `<entry>${xmlText("string", key)}${xmlText("string", value)}</entry>`).join("");
            const block = `<SongPartImpl resolves-to="SongPartImplSP" spRhythmId="${escape(part.styleId)}" spRhythmTs="${escape(section.meter)}" spStartBarIndex="${start}" spName="${escape(part.name)}" spNbBars="${length}">`
                + '<spVERSION>3</spVERSION>' + xmlText("spRhythmName", part.styleName)
                + `<spParentSection class="CLI_SectionImpl" reference="../../../../spChordLeadSheet/spItems/CLI__SectionImpl${suffix}"/>`
                + writeClientProperties(part, "SongPartImpl")
                + `<spHashMapRpIdValue>${parameters}</spHashMapRpIdValue></SongPartImpl>`;
            start += length;
            return block;
        });
        const users = song.userTracks.map(track => `<entry>${xmlText("string", track.name)}<Phrase resolves-to="PhraseSP" spVERSION="2">`
            + `${xmlText("spSaveString", track.phrase)}</Phrase></entry>`);
        return `<Song resolves-to="SongSP" spName="${escape(song.title)}" spTempo="${song.tempo}">\n<spVERSION>4</spVERSION>`
            + xmlText("spComments", song.comments) + `<spTags>${(song.tags ?? []).map(tag => xmlText("string", tag)).join("")}</spTags>`
            + '<spChordLeadSheet class="ChordLeadSheetImpl" resolves-to="ChordLeadSheetImplSP"><spVERSION>3</spVERSION>'
            + `<spItems>\n${items.join("\n")}\n</spItems><spSize>${song.bars}</spSize></spChordLeadSheet>`
            + '<spSongStructure class="SongStructureImpl" resolves-to="SongStructureImplSP"><spVERSION>3</spVERSION>'
            + `<spSpts>\n${arrangement.join("\n")}\n</spSpts><spParentCls class="ChordLeadSheetImpl" reference="../../spChordLeadSheet"/></spSongStructure>`
            + `<spMapUserPhrases>\n${users.join("\n")}\n</spMapUserPhrases>${writeClientProperties(song)}</Song>\n`;
    }

    function writeMix(tracks) {
        const channels = new Map();
        for (const track of tracks) {
            if (!Number.isInteger(track.channel) || track.channel < 0 || track.channel > 15 || channels.has(track.channel)) {
                throw new Error("書き出すミックスのMIDIチャンネルが重複しているか範囲外です。");
            }
            channels.set(track.channel, track);
        }
        const settings = [], keys = [];
        for (let channel = 0; channel < 16; channel++) {
            const track = channels.get(channel);
            if (!track) {
                settings.push("<null/>");
                keys.push("<null/>");
                continue;
            }
            settings.push(`<InstrumentMix resolves-to="InstrumentMixSP" spVERSION="2" spInsEnabled="${track.instrumentEnabled}" spMute="${track.mute}">`
                + `<spIns resolves-to="InstrumentSP" spVERSION="2" spSaveString="${escape(track.instrument)}" spPatchname="${escape(track.patch)}"/>`
                + `<spInsSettings resolves-to="InstrumentSettingsSP" spVERSION="2" spTransposition="${track.transpose}" spVelocityShift="${track.velocityShift}" spVolume="${track.volume}">`
                + xmlText("spPanoramic", track.pan) + xmlText("spReverb", track.reverb) + xmlText("spChorus", track.chorus)
                + xmlText("spPanoramicEnabled", track.panEnabled) + xmlText("spReverbEnabled", track.reverbEnabled)
                + xmlText("spChorusEnabled", track.chorusEnabled) + xmlText("spVolumeEnabled", track.volumeEnabled)
                + '</spInsSettings></InstrumentMix>');
            keys.push(`<RvStorage>${xmlText("rhythmId", track.rhythmId)}${xmlText("rvName", track.name)}</RvStorage>`);
        }
        return '<MidiMix resolves-to="MidiMixSP"><spVERSION>5</spVERSION>'
            + `<spInsMixes>\n${settings.join("\n")}\n</spInsMixes><spKeys>\n${keys.join("\n")}\n</spKeys></MidiMix>\n`;
    }

    return { readSong, readTextSong, readMix, writeSong, writeMix, isUserMixTrack, mergeInstrumentMixes, engineArgs, multiStyleEngineArgs, decodeEngineMix, validateSong, meters,
        sourceStyleId, readTrackOverrides, writeTrackOverrides, overrideStyleIds, readCustomPhrases, setCustomPhrase, barBeats };
})();
