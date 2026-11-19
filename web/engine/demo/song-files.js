"use strict";

// The supported desktop formats are the XStream XML written by JJazzLab 5.2.1.
// Resolve references within the parsed document without instantiating Java objects.
const DesktopSongFiles = (() => {
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

    function readSong(xml) {
        const root = parse(xml, "Song", "4");
        const leadSheet = resolve(child(root, "spChordLeadSheet"));
        const structure = resolve(child(root, "spSongStructure"));
        const bars = number(content(leadSheet, "spSize"), "譜面の小節数", 1, 1024);
        const items = Array.from(child(leadSheet, "spItems")?.children ?? []);
        const sectionNodes = items.filter(item => attr(item, "resolves-to") === "CLI_SectionImplSP");
        const sections = sectionNodes.map(section => ({
            name: attr(section, "spName"),
            bar: number(attr(section, "spBarIndex"), "セクションの小節", 0, bars - 1),
            meter: attr(section, "spTs")
        }));
        const chords = items.filter(item => attr(item, "resolves-to") === "CLI_ChordSymbolSP").map(item => {
            const chord = resolve(child(item, "spChord"));
            const position = attr(resolve(child(item, "spPos")), "spPos");
            const match = /^\[(?:(\d+):)?(\d+(?:[.,]\d+)?)\]$/u.exec(position);
            if (!match) throw new Error("コードの拍位置を読み込めません。");
            const rendering = child(resolve(child(chord, "spRenderingInfo")), "ChordRenderingInfoSP");
            const features = resolve(child(rendering, "enum-set"))?.textContent.trim() ?? "";
            const scale = resolve(child(rendering, "StdScaleInstance"));
            const originalName = attr(chord, "spOriginalName");
            return { name: attr(chord, "spName") || originalName, bar: Number(match[1] ?? 0), beat: Number(match[2].replace(",", ".")),
                ...(originalName && originalName !== attr(chord, "spName") ? { originalName } : {}),
                ...(features ? { features } : {}), ...(scale ? { scale: { index: attr(scale, "spStdScaleIndex"), pitch: attr(scale, "spStartNotePitch") } } : {}) };
        });
        const parts = Array.from(child(structure, "spSpts")?.children ?? []).map(part => {
            const section = sectionNodes.indexOf(resolve(child(part, "spParentSection")));
            if (section < 0) throw new Error("演奏区間の参照先セクションが見つかりません。");
            const parameters = Object.fromEntries(Array.from(child(part, "spHashMapRpIdValue")?.children ?? [])
                .map(entry => Array.from(entry.children, value => resolve(value).textContent))
                .filter(pair => pair.length === 2));
            return { name: attr(part, "spName"), section, styleId: attr(part, "spRhythmId"),
                styleName: content(part, "spRhythmName"), parameters };
        });
        const userTracks = Array.from(child(root, "spMapUserPhrases")?.children ?? []).map(entry => ({
            name: resolve(entry.firstElementChild).textContent,
            phrase: content(resolve(entry.lastElementChild), "spSaveString")
        }));
        if (sections.length === 0 || sections[0].bar !== 0 || parts.length === 0) {
            throw new Error("曲に譜面セクションと演奏区間が必要です。");
        }
        return validateSong({ title: attr(root, "spName"), comments: content(root, "spComments"),
            tempo: number(attr(root, "spTempo"), "テンポ", 20, 400),
            bars, sections, chords, parts, userTracks });
    }

    function validateSong(song) {
        if (!song || typeof song.title !== "string" || !Number.isInteger(song.bars) || song.bars < 1 || song.bars > 1024
            || !Number.isInteger(song.tempo) || song.tempo < 20 || song.tempo > 400
            || !Array.isArray(song.sections) || song.sections[0]?.bar !== 0
            || !song.sections.every((section, index) => section && typeof section.name === "string" && typeof section.meter === "string"
                && Number.isInteger(section.bar) && section.bar < song.bars && (index === 0 || section.bar > song.sections[index - 1].bar))
            || !Array.isArray(song.parts) || !song.parts.length || !song.parts.every(part => part && song.sections[part.section]
                && Number.isInteger(part.section) && typeof part.name === "string" && typeof part.styleId === "string"
                && part.parameters && Object.values(part.parameters).every(value => typeof value === "string"))
            || !Array.isArray(song.chords) || !song.chords.every(chord => chord && typeof chord.name === "string"
                && Number.isInteger(chord.bar) && chord.bar >= 0 && chord.bar < song.bars && Number.isFinite(chord.beat) && chord.beat >= 0)
            || !Array.isArray(song.userTracks) || !song.userTracks.every(track => track && typeof track.name === "string" && typeof track.phrase === "string")) {
            throw new Error("曲ファイルの譜面または演奏順が不正です。");
        }
        return song;
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
                transpose: number(attr(values, "spTransposition"), "移調", -48, 48),
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

    const mixValues = ["patch", "instrumentEnabled", "volume", "pan", "transpose", "velocityShift", "reverb", "chorus",
        "volumeEnabled", "panEnabled", "reverbEnabled", "chorusEnabled"];
    const playableParameters = new Set(["rpVariationID", "rpIntensityID", "RpFillID", "RpSysMuteID", "rpSysMarkerID",
        "rpTempoID", "BassStyleId", "DrumsStyleId"]);

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
        const meter = song.sections[0].meter;
        if (song.sections.some(section => section.meter !== meter)) throw new Error("曲中の拍子変更には対応していません。");
        if (!["FOUR_FOUR", "THREE_FOUR"].includes(meter)) throw new Error("再生は4/4と3/4に対応しています。");
        if (new Set(song.parts.map(part => part.styleId)).size > 1) throw new Error("曲中のスタイル変更には対応していません。");
        return [styleBytes, styleFilename, song.title, meter, song.tempo, song.bars,
            song.sections.map(section => section.name), Int32Array.from(song.sections, section => section.bar),
            song.chords.map(chord => chord.name), Int32Array.from(song.chords, chord => chord.bar),
            Float32Array.from(song.chords, chord => chord.beat), song.parts.map(part => part.name),
            Int32Array.from(song.parts, part => part.section), song.parts.map(part => Object.entries(part.parameters)
                .filter(([id]) => playableParameters.has(id))
                .map(([id, value]) => `${id}\t${value}`).join("\n")),
            song.userTracks.map(track => track.name), song.userTracks.map(track => track.phrase),
            mix.map(track => [track.rhythmId, track.name, track.mute, ...mixValues.map(key => track[key])].join("\t"))];
    }

    const escape = value => String(value ?? "").replace(/[&<>"\r\n\t]/gu, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\r": "&#13;", "\n": "&#10;", "\t": "&#9;"
    })[char]);
    const xmlText = (tag, value) => `<${tag}>${escape(value)}</${tag}>`;

    function writeSong(song) {
        const sections = song.sections.map(section => ({ bar: section.bar, beat: -1, xml:
            `<CLI__SectionImpl resolves-to="CLI_SectionImplSP" spName="${escape(section.name)}" spTs="${escape(section.meter)}" spBarIndex="${section.bar}">`
            + '<spVERSION>4</spVERSION><spClientProperties><owner class="CLI_SectionImpl" reference="../.."/></spClientProperties></CLI__SectionImpl>' }));
        const chords = song.chords.map(chord => {
            const start = chord.name === "NC" ? '<spChord resolves-to="NCExtChordSymbolSP" spVERSION="2" spName="NC">'
                : `<spChord resolves-to="ExtChordSymbolSP" spName="${escape(chord.name)}" spOriginalName="${escape(chord.originalName ?? chord.name)}"><spVERSION>3</spVERSION>`;
            const scale = chord.scale
                ? `<StdScaleInstance resolves-to="StdScaleInstanceSP" spVERSION="2" spStdScaleIndex="${escape(chord.scale.index)}" spStartNotePitch="${escape(chord.scale.pitch)}"/>`
                : "<null/>";
            return { bar: chord.bar, beat: chord.beat, xml:
                '<CLI__ChordSymbolImpl resolves-to="CLI_ChordSymbolSP"><spVERSION>3</spVERSION>' + start
                + '<spRenderingInfo resolves-to="ChordRenderingInfoSP" serialization="custom"><ChordRenderingInfoSP><int>3</int>'
                + `<enum-set enum-type="Feature">${escape(chord.features)}</enum-set>${scale}</ChordRenderingInfoSP></spRenderingInfo></spChord>`
                + `<spPos resolves-to="PositionSP" spVERSION="2" spPos="[${chord.bar}:${chord.beat}]"/>`
                + '<spClientProperties><owner class="CLI_ChordSymbolImpl" reference="../.."/></spClientProperties></CLI__ChordSymbolImpl>' };
        });
        const items = [...sections, ...chords].sort((a, b) => a.bar - b.bar || a.beat - b.beat).map(item => item.xml);
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
                + '<spClientProperties><owner class="SongPartImpl" reference="../.."/></spClientProperties>'
                + `<spHashMapRpIdValue>${parameters}</spHashMapRpIdValue></SongPartImpl>`;
            start += length;
            return block;
        });
        const users = song.userTracks.map(track => `<entry>${xmlText("string", track.name)}<Phrase resolves-to="PhraseSP" spVERSION="2">`
            + `${xmlText("spSaveString", track.phrase)}</Phrase></entry>`);
        return `<Song resolves-to="SongSP" spName="${escape(song.title)}" spTempo="${song.tempo}">\n<spVERSION>4</spVERSION>`
            + xmlText("spComments", song.comments) + '<spTags/>'
            + '<spChordLeadSheet class="ChordLeadSheetImpl" resolves-to="ChordLeadSheetImplSP"><spVERSION>3</spVERSION>'
            + `<spItems>\n${items.join("\n")}\n</spItems><spSize>${song.bars}</spSize></spChordLeadSheet>`
            + '<spSongStructure class="SongStructureImpl" resolves-to="SongStructureImplSP"><spVERSION>3</spVERSION>'
            + `<spSpts>\n${arrangement.join("\n")}\n</spSpts><spParentCls class="ChordLeadSheetImpl" reference="../../spChordLeadSheet"/></spSongStructure>`
            + `<spMapUserPhrases>\n${users.join("\n")}\n</spMapUserPhrases><spClientPropertiesV3/></Song>\n`;
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

    return { readSong, readMix, writeSong, writeMix, engineArgs, decodeEngineMix, validateSong };
})();
