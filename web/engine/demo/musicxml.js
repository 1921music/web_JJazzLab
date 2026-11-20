"use strict";

const musicXmlElements = (node, name) => Array.from(node?.children ?? []).filter(child => child.localName === name);
const musicXmlChild = (node, name) => musicXmlElements(node, name)[0];
const musicXmlText = (node, name) => musicXmlChild(node, name)?.textContent.trim() ?? "";

function musicXmlDocument(text) {
    const document = new DOMParser().parseFromString(text, "application/xml");
    if (document.getElementsByTagName("parsererror").length) throw new Error(t("MusicXMLを解析できません。", "The MusicXML document is invalid."));
    return document.documentElement;
}

async function musicXmlFileText(file) {
    if (file.size > 16 * 1024 * 1024) throw new Error(t("MusicXMLの上限は16MBです。", "The MusicXML file is larger than 16 MB."));
    if (!/\.mxl$/iu.test(file.name)) return file.text();
    const archive = new MemoryStyleArchive(await file.arrayBuffer(), {
        accept: path => path === "META-INF/container.xml" || /\.(musicxml|xml)$/iu.test(path),
        entryLimit: 16 * 1024 * 1024,
        notFound: t("MXLに譜面がありません。", "The MXL score is missing."),
        validate: () => {}
    });
    const container = archive.entries.find(entry => entry.path === "META-INF/container.xml");
    if (!container) throw new Error(t("MXLにコンテナー定義がありません。", "The MXL container definition is missing."));
    const decoder = new TextDecoder("utf-8");
    const root = musicXmlDocument(decoder.decode(await archive.read(container)));
    const rootfiles = musicXmlElements(musicXmlChild(root, "rootfiles"), "rootfile");
    const score = rootfiles.map(item => archive.entries.find(entry => entry !== container && entry.path === item.getAttribute("full-path"))).find(Boolean);
    if (!score) throw new Error(t("MXLに譜面がありません。", "The MXL score is missing."));
    return decoder.decode(await archive.read(score));
}

function musicXmlChord(harmony, canonicalize) {
    const pitch = (node, tag) => {
        const step = musicXmlText(node, tag + "-step");
        const alter = Number(musicXmlText(node, tag + "-alter"));
        if (!/^[A-G]$/u.test(step)) return "";
        return step + (alter === 1 ? "#" : alter === -1 ? "b" : "");
    };
    const kind = musicXmlChild(harmony, "kind");
    const type = kind?.textContent.trim() ?? "major";
    if (type === "none") return "NC";
    const root = pitch(musicXmlChild(harmony, "root"), "root");
    if (!root) return;
    const bass = pitch(musicXmlChild(harmony, "bass"), "bass");
    const slash = bass && bass !== root ? "/" + bass : "";
    const base = musicXmlChordKinds[type] ?? "";
    const degrees = musicXmlElements(harmony, "degree").map(degree => {
        const semitones = Number(musicXmlText(degree, "degree-alter"));
        const number = musicXmlText(degree, "degree-value");
        const mode = musicXmlText(degree, "degree-type");
        if (!/^\d+$/u.test(number) || mode === "subtract") return "";
        return (semitones === -1 ? "b" : semitones === 1 ? "#" : mode === "add" ? "add" : "") + number;
    }).join("");
    for (const suffix of [kind?.getAttribute("text") || undefined, degrees ? base + degrees : undefined, base, ""]) {
        if (suffix == null || /\s/u.test(suffix)) continue;
        const chord = canonicalize(root + suffix + slash);
        if (chord) return chord;
    }
}

function musicXmlPlaybackOrder(bars) {
    const ends = new Map(), starts = [];
    let nextBeginning = 0;
    for (const [index, measure] of bars.entries()) {
        if (measure.repeatStart) starts.push(index);
        if (measure.repeatEnd) {
            ends.set(index, { from: starts.pop() ?? nextBeginning, count: measure.repeatEnd });
            nextBeginning = index + 1;
        }
    }
    const counters = new Map(), ordered = [], navigate = musicXmlNavigation(bars);
    let pass = 1, cursor = 0, steps = 0;
    while (cursor < bars.length) {
        if (++steps > 8192) throw new Error(t("MusicXMLの反復が多すぎます。", "The MusicXML contains too many repeats."));
        const measure = bars[cursor];
        if (!measure.ending || measure.ending.has(pass)) {
            ordered.push(cursor);
            const jump = navigate(cursor);
            if (jump) {
                counters.clear();
                pass = 1;
                cursor = jump.bar;
                continue;
            }
        }
        const repeat = ends.get(cursor);
        if (repeat) {
            const count = (counters.get(cursor) ?? 0) + 1;
            if (count < repeat.count) {
                counters.set(cursor, count);
                pass = count + 1;
                cursor = repeat.from;
                continue;
            }
            pass = count;
            counters.delete(cursor);
        } else if (!measure.ending && cursor > 0 && bars[cursor - 1].ending) pass = 1;
        cursor++;
    }
    return ordered;
}

function readMusicXml(text, filename, rhythmForMeter, canonicalize) {
    const root = musicXmlDocument(text);
    if (root.localName !== "score-partwise") throw new Error(t("MusicXMLは score-partwise に対応しています。", "Only score-partwise MusicXML is supported."));
    const part = musicXmlElements(root, "part").find(part => musicXmlElements(part, "measure").some(measure => musicXmlChild(measure, "harmony")));
    if (!part) throw new Error(t("MusicXMLにコード記号がありません。", "The MusicXML has no chord symbols."));
    const measures = musicXmlElements(part, "measure");
    if (measures.length > 1024) throw new Error(t("MusicXMLは1,024小節まで取り込めます。", "MusicXML imports support up to 1,024 bars."));
    const meterByName = new Map(Object.entries(DesktopSongFiles.meters).map(([id, [name]]) => [name, id]));
    let meter = "FOUR_FOUR", divisions = 1, tempo, ending;
    const bars = [], chords = [], cuts = new Set([0]);
    for (const [bar, measure] of measures.entries()) {
        const attrs = musicXmlChild(measure, "attributes");
        const supplied = Number(musicXmlText(attrs, "divisions"));
        if (supplied > 0) divisions = supplied;
        const time = musicXmlChild(attrs, "time");
        if (time) {
            const requested = `${musicXmlText(time, "beats")}/${musicXmlText(time, "beat-type")}`;
            const next = meterByName.get(requested);
            if (!next) throw new Error(t(`未対応のMusicXML拍子 ${requested}。`, `Unsupported MusicXML time signature ${requested}.`));
            if (next !== meter) cuts.add(bar);
            meter = next;
        }
        const count = DesktopSongFiles.meters[meter][1];
        const compound = /_EIGHT$/u.test(meter);
        let cursor = 0, repeatStart = false, repeatEnd = 0;
        let endingStops = false;
        const local = new Map(), navigation = [];
        for (const node of measure.children) {
            const duration = Number(musicXmlText(node, "duration")) || 0;
            switch (node.localName) {
                case "note":
                    if (!musicXmlChild(node, "chord")) cursor += duration;
                    break;
                case "forward": cursor += duration; break;
                case "backup": cursor = Math.max(0, cursor - duration); break;
                case "harmony": {
                    const name = musicXmlChord(node, canonicalize);
                    const position = (cursor + (Number(musicXmlText(node, "offset")) || 0)) / divisions / (compound ? 1.5 : 1);
                    const beat = Math.min(count - 1, Math.max(0, Math.round(position)));
                    if (name) local.set(beat, { name, bar, beat });
                    break;
                }
                case "direction":
                case "sound": {
                    const sound = node.localName === "sound" ? node : musicXmlChild(node, "sound");
                    for (const mark of readMusicXmlNavigation(node, sound)) {
                        navigation.push(mark);
                        cuts.add(mark.type === "segno" || mark.type === "coda" ? bar : bar + 1);
                    }
                    const metronome = musicXmlChild(musicXmlChild(node, "direction-type"), "metronome");
                    const quarterLength = { eighth: .5, quarter: 1, half: 2, whole: 4 }[musicXmlText(metronome, "beat-unit")] ?? 1;
                    const bpm = Number(sound?.getAttribute("tempo")) || Number(musicXmlText(metronome, "per-minute")) * quarterLength
                        * (musicXmlChild(metronome, "beat-unit-dot") ? 1.5 : 1);
                    if (!tempo && bpm >= 20 && bpm <= 400) tempo = Math.round(bpm);
                    break;
                }
                case "barline": {
                    const repeat = musicXmlChild(node, "repeat"), end = musicXmlChild(node, "ending");
                    if (repeat?.getAttribute("direction") === "forward") { repeatStart = true; cuts.add(bar); }
                    if (repeat?.getAttribute("direction") === "backward") {
                        repeatEnd = Math.max(2, Math.min(16, Number(repeat.getAttribute("times")) || 2));
                        cuts.add(bar + 1);
                    }
                    if (end?.getAttribute("type") === "start") {
                        const numbers = end.getAttribute("number")?.match(/\d+/gu) ?? [];
                        ending = numbers.length ? new Set(numbers.map(Number)) : undefined;
                        cuts.add(bar);
                    }
                    if (["stop", "discontinue"].includes(end?.getAttribute("type"))) { endingStops = true; cuts.add(bar + 1); }
                    break;
                }
            }
        }
        bars.push({ meter, repeatStart, repeatEnd, ending, navigation });
        if (endingStops) ending = undefined;
        chords.push(...local.values());
    }
    if (!chords.length) throw new Error(t("MusicXMLに読み込めるコードがありません。", "The MusicXML has no readable chords."));
    const sections = [...cuts].sort((a, b) => a - b).filter(bar => bar < bars.length)
        .map((bar, index) => ({ bar, meter: bars[bar].meter, name: index < 26 ? String.fromCharCode(65 + index) : `A${index + 1}` }));
    const order = musicXmlPlaybackOrder(bars);
    const parts = order.filter(bar => cuts.has(bar)).map(bar => {
        const section = sections.findIndex(candidate => candidate.bar === bar);
        return { section, name: sections[section].name, ...rhythmForMeter(sections[section].meter), parameters: {} };
    });
    const title = musicXmlText(musicXmlChild(root, "work"), "work-title") || musicXmlText(root, "movement-title")
        || filename.replace(/\.[^.]+$/u, "");
    return DesktopSongFiles.validateSong({ title, tempo: tempo ?? 120, bars: bars.length,
        sections, chords, parts, userTracks: [] });
}
