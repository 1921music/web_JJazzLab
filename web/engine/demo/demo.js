"use strict";

const form = document.querySelector("#midi-form");
const options = document.querySelector("#options");
const chordInput = document.querySelector("#chords");
const styleInput = document.querySelector("#style");
const tempoInput = document.querySelector("#tempo");
const rhythmEngine = document.querySelector("#rhythm-engine");
const swingBass = document.querySelector("#swing-bass");
const swingDrums = document.querySelector("#swing-drums");
const swingVariation = document.querySelector("#swing-variation");
const status = document.querySelector("#status");
const download = document.querySelector("#download");
const bundledStyle = "8Beat.T160.STY";
const stylePackUrl = "https://raw.githubusercontent.com/1921music/web_JJazzLab/923ed5dd8b6d426722bacdd951b268a049a6638a/web/engine/demo/assets/jjazzlab_user_styles.zip";
const loadStylePackButton = document.querySelector("#load-style-pack");
const stylePackStatus = document.querySelector("#style-pack-status");
const libraryStyle = document.querySelector("#library-style");
const styleCategory = document.querySelector("#style-category");
const styleSearch = document.querySelector("#style-search");
let styleArchive;
let selectedLibraryStyle;
let loadingStylePack = false;
// Tested failures in the published collection. Match the CRC as well as the
// filename so a repaired upstream file automatically becomes selectable.
const knownStyleIssues = new Map([
    ["J-PopHit1_TyPrems.S851.STY:942392629", "元ファイルのMIDIデータが不正です。"],
    ["JazzBluesSimple.S740.sty:66474411", "元ファイルのMIDIデータが不正です。"],
    ["JazzGtrTrio184 9K.s460.sty:2366308981", "元ファイルに空のスタイル区間があり、エンジンが読み込めません。"]
]);
const styleIssue = entry => knownStyleIssues.get(`${entry.name}:${entry.crc}`);

let engine;
let downloadUrl;

function showStylePackStatus(message, error = false) {
    stylePackStatus.textContent = message;
    stylePackStatus.toggleAttribute("data-error", error);
}

function renderStyleChoices() {
    const words = styleSearch.value.normalize("NFKC").toLowerCase().split(/\s+/u).filter(Boolean);
    const entries = styleArchive.entries.filter(entry => (!styleCategory.value || entry.category === styleCategory.value)
        && words.every(word => `${entry.category} ${entry.name}`.normalize("NFKC").toLowerCase().includes(word)));
    libraryStyle.replaceChildren();
    const option = (value, text) => { const node = document.createElement("option"); node.value = value; node.textContent = text; return node; };
    libraryStyle.append(option("", "選択なし（ファイルまたは8Beat）"));
    if (selectedLibraryStyle && !entries.includes(selectedLibraryStyle))
        libraryStyle.append(option(selectedLibraryStyle.path, `選択中: ${selectedLibraryStyle.category} / ${selectedLibraryStyle.name}`));
    let group;
    for (const entry of entries) {
        if (!group || group.label !== entry.category) {
            group = document.createElement("optgroup"); group.label = entry.category; libraryStyle.append(group);
        }
        const item = option(entry.path, entry.name + (styleIssue(entry) ? "（利用不可）" : ""));
        item.disabled = Boolean(styleIssue(entry)); item.title = styleIssue(entry) || entry.name;
        group.append(item);
    }
    libraryStyle.value = selectedLibraryStyle?.path || "";
    const available = entries.filter(entry => !styleIssue(entry)).length;
    document.querySelector("#style-count").textContent = `（${available}件利用可 / 表示${entries.length}件）`;
}

loadStylePackButton.addEventListener("click", async () => {
    if (loadingStylePack || styleArchive) return;
    loadingStylePack = true; loadStylePackButton.disabled = true;
    showStylePackStatus("公開スタイル集を取得しています…");
    try {
        styleArchive = await fetchStyleArchive(stylePackUrl, (bytes, total) => {
            showStylePackStatus(total ? `公開スタイル集を取得しています… ${Math.min(100, Math.round(bytes / total * 100))}%` : `公開スタイル集を取得しています… ${(bytes / 1024 / 1024).toFixed(1)}MB`);
        });
        const categories = [...new Set(styleArchive.entries.map(entry => entry.category))];
        for (const category of categories) {
            const option = document.createElement("option"); option.value = option.textContent = category; styleCategory.append(option);
        }
        renderStyleChoices(); document.querySelector("#style-library").hidden = false;
        loadStylePackButton.textContent = "公開スタイル集を読み込み済み";
        const available = styleArchive.entries.filter(entry => !styleIssue(entry)).length;
        showStylePackStatus(`${styleArchive.entries.length}件を読み込みました（${available}件利用可）。ページを開いている間は再取得しません。`);
        libraryStyle.focus();
    } catch (error) {
        loadStylePackButton.textContent = "公開スタイル集を再試行";
        showStylePackStatus(error.message, true);
    } finally { loadingStylePack = false; loadStylePackButton.disabled = Boolean(styleArchive); }
});

styleSearch.addEventListener("input", () => { if (styleArchive) renderStyleChoices(); });
styleCategory.addEventListener("change", () => { if (styleArchive) renderStyleChoices(); });
libraryStyle.addEventListener("change", () => {
    const selected = styleArchive.entries.find(entry => entry.path === libraryStyle.value);
    if (selected && styleIssue(selected)) { showStylePackStatus(styleIssue(selected), true); renderStyleChoices(); return; }
    selectedLibraryStyle = selected;
    if (selectedLibraryStyle) styleInput.value = "";
    if (song) showStatus("スタイルを変更しました。「伴奏を生成」で新しい伴奏を作ります。");
});
styleInput.addEventListener("change", () => { selectedLibraryStyle = undefined; libraryStyle.value = ""; });

rhythmEngine.addEventListener("change", () => {
    const swing = rhythmEngine.value === "jjswing";
    document.querySelector("#swing-settings").hidden = !swing;
    document.querySelector("#style-field").hidden = swing;
    styleInput.disabled = swing;
    tempoInput.placeholder = swing ? "120" : "スタイルの既定値";
});
let song;
let generating = false;
let starting = false;
let playing = false;
let mixerParts = [];
const savedMix = new Map();
const playButton = document.querySelector("#play");
const stopButton = document.querySelector("#stop");
const loopEnabled = document.querySelector("#loop-enabled");
const loopStart = document.querySelector("#loop-start");
const loopEnd = document.querySelector("#loop-end");
const masterInput = document.querySelector("#master");
const playStatus = document.querySelector("#play-status");
const loopStatus = document.querySelector("#loop-status");
const player = new AccompanimentPlayer(updatePosition, (message) => {
    playing = false; starting = false; updateButtons(); showPlayStatus(message, true);
});

function updateButtons() {
    playButton.disabled = generating || starting || playing || !song;
    stopButton.disabled = generating || starting || !playing;
    document.querySelector("#loop-controls").disabled = starting || generating;
}

function showPlayStatus(message, error = false) {
    playStatus.textContent = message;
    playStatus.toggleAttribute("data-error", error);
}

function updatePosition(position) {
    if (!song) return;
    playing = position.playing;
    let bar = song.barTimes.findIndex(time => time > position.seconds);
    if (bar < 0) bar = song.barTimes.length - 1;
    document.querySelector("#position").textContent = `${Math.max(1, bar)}小節 / ${song.barTimes.length - 1}小節`;
    updateButtons();
    if (!playing) showPlayStatus("停止中");
}

function readLoop() {
    const start = loopStart.valueAsNumber, end = loopEnd.valueAsNumber;
    const bars = song.barTimes.length - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > bars)
        throw new Error(`ループ範囲は1〜${bars}小節で、開始≦終了にしてください。`);
    return { enabled: loopEnabled.checked, start: song.barTimes[start - 1], end: song.barTimes[end] };
}

function applyMix() {
    mixerParts.forEach(part => savedMix.set(part.id, { volume: part.volume, pan: part.pan, mute: part.mute, solo: part.solo }));
    player.mix(mixerParts, Number(masterInput.value) / 100);
}

function renderMixer() {
    const container = document.querySelector("#mixer-parts");
    container.replaceChildren();
    mixerParts.forEach((part, index) => {
        const strip = document.createElement("div"); strip.className = "strip";
        const title = document.createElement("div"); title.className = "part-name"; title.textContent = part.name;
        const channel = document.createElement("small"); channel.textContent = `MIDI ch ${part.channel + 1}${part.drum ? " · Drums" : ""}`; title.append(channel);
        strip.append(title);
        const buttons = document.createElement("div"); buttons.className = "strip-buttons";
        for (const [key, label] of [["mute", "Mute"], ["solo", "Solo"]]) {
            const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = label;
            button.setAttribute("aria-label", `${part.name} ${label}`); button.setAttribute("aria-pressed", String(part[key]));
            button.addEventListener("click", () => { part[key] = !part[key]; button.setAttribute("aria-pressed", String(part[key])); applyMix(); });
            buttons.append(button);
        }
        strip.append(buttons);
        for (const [key, text, min, max] of [["volume", "音量", 0, 150], ["pan", "Pan", -100, 100]]) {
            const label = document.createElement("label"); label.htmlFor = `${key}-${index}`;
            const caption = document.createElement("span"); caption.textContent = text;
            const output = document.createElement("output");
            const input = document.createElement("input"); input.id = label.htmlFor; input.type = "range"; input.min = min; input.max = max; input.step = 1;
            input.value = Math.round(part[key] * 100); input.setAttribute("aria-label", `${part.name} ${text}`);
            const display = () => { output.textContent = key === "volume" ? `${input.value}%` : Number(input.value) === 0 ? "中央" : `${Number(input.value) < 0 ? "L" : "R"} ${Math.abs(Number(input.value))}`; };
            display(); caption.append(output); label.append(caption, input); strip.append(label);
            input.addEventListener("input", () => { part[key] = Number(input.value) / 100; display(); applyMix(); });
        }
        container.append(strip);
    });
}

playButton.addEventListener("click", async () => {
    if (!song || starting || playing) return;
    starting = true; updateButtons(); options.disabled = true;
    try {
        const loop = readLoop();
        await player.initialize(showPlayStatus);
        await player.play(song, loop, mixerParts, Number(masterInput.value) / 100);
        playing = true;
        showPlayStatus("演奏中");
    } catch (error) { showPlayStatus(error.message, true); }
    finally { starting = false; options.disabled = false; updateButtons(); }
});

stopButton.addEventListener("click", async () => {
    try { await player.stop(); playing = false; updatePosition({ seconds: 0, playing: false }); }
    catch (error) { showPlayStatus(error.message, true); }
});

document.querySelector("#loop-controls").addEventListener("input", () => {
    try {
        const loop = readLoop(); player.loop(loop);
        loopStatus.textContent = playing ? "変更は次の折り返しから適用します。" : "終了小節を含めて繰り返します。";
        loopStatus.removeAttribute("data-error");
    } catch (error) { loopStatus.textContent = error.message; loopStatus.setAttribute("data-error", ""); }
});

masterInput.addEventListener("input", () => {
    document.querySelector("#master-value").textContent = `${masterInput.value}%`; applyMix();
});
document.querySelector("#reset-mixer").addEventListener("click", () => {
    mixerParts.forEach(part => Object.assign(part, { volume: 1, pan: 0, mute: false, solo: false }));
    masterInput.value = 80; document.querySelector("#master-value").textContent = "80%";
    renderMixer(); applyMix();
});

function decompress(encoded) {
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
}

async function loadEngine() {
    const wasm = await decompress(embeddedWasm);
    const url = URL.createObjectURL(new Blob([wasm], { type: "application/wasm" }));
    try {
        return await globalThis.TeaVM.wasmGC.load(url, { nodejs: false });
    } finally {
        URL.revokeObjectURL(url);
    }
}

function clearDownload() {
    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = undefined;
    }
    download.hidden = true;
    download.removeAttribute("href");
}

function showStatus(message, error = false) {
    status.textContent = message;
    status.toggleAttribute("data-error", error);
}

async function readStyle() {
    if (selectedLibraryStyle) return { name: selectedLibraryStyle.name, bytes: new Int8Array(await styleArchive.read(selectedLibraryStyle)) };
    const file = styleInput.files[0];
    if (file) {
        return { name: file.name, bytes: new Int8Array(await file.arrayBuffer()) };
    }
    return { name: bundledStyle, bytes: new Int8Array(await decompress(embeddedStyle)) };
}

form.addEventListener("input", (event) => {
    if (event.target === styleSearch || event.target === styleCategory) return;
    if (song) showStatus("入力を変更しました。「伴奏を生成」で現在の演奏を停止し、新しい伴奏を作ります。");
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearDownload();
    const chords = chordInput.value.split(/[\s,|]+/u).filter(Boolean);
    if (!chords.length) {
        showStatus("コードを1つ以上入力してください。", true);
        chordInput.focus();
        return;
    }

    const tempo = tempoInput.valueAsNumber || 0;
    generating = true; updateButtons();
    options.disabled = true;
    showStatus("MIDIを生成しています…");
    try {
        await player.stop();
        playing = false;
        song = null;
        document.querySelector("#player").hidden = true;
        document.querySelector("#mixer").hidden = true;
        if (!engine) {
            try {
                engine = await loadEngine();
            } catch {
                throw new Error("Wasmを読み込めませんでした。WasmGCとgzip展開に対応したブラウザで開いてください。");
            }
        }
        const swing = rhythmEngine.value === "jjswing";
        const style = swing ? { name: "jjSwing" } : await readStyle();
        let midi;
        try {
            midi = swing
                ? engine.exports.generateSwingMidiWithVariation(chords, tempo, swingVariation.value, swingBass.value, swingDrums.value)
                : engine.exports.generateMidi(style.bytes, style.name, chords, tempo);
        } catch (error) {
            console.error(error);
            throw new Error(swing ? "jjSwingの伴奏を生成できませんでした。コード表記を確認してください。" : "MIDIを生成できませんでした。コード表記とスタイルファイルを確認してください。");
        }
        const metadata = engine.exports.getPartMetadata();
        song = parseMidi(midi, chords.length, metadata);
        const exportedMidi = exportGmMidi(midi, metadata);
        downloadUrl = URL.createObjectURL(new Blob([exportedMidi], { type: "audio/midi" }));
        download.href = downloadUrl;
        download.download = style.name.replace(/\.[^.]+$/u, "") + "-accompaniment.mid";
        download.hidden = false;
        mixerParts = song.parts.map(part => ({ ...part, volume: 1, pan: 0, mute: false, solo: false, ...savedMix.get(part.id) }));
        loopStart.value = 1; loopEnd.value = chords.length;
        loopStart.max = loopEnd.max = chords.length;
        loopStatus.textContent = "終了小節を含めて繰り返します。"; loopStatus.removeAttribute("data-error");
        renderMixer();
        // Do not send settings to the previous song's worklet parts while stopped.
        player.loadedSong = null;
        document.querySelector("#player").hidden = false;
        document.querySelector("#mixer").hidden = false;
        updatePosition({ seconds: 0, playing: false });
        showStatus(`${chords.length}小節・${song.parts.length}パートの伴奏を生成しました。`);
    } catch (error) {
        showStatus(error.message, true);
    } finally {
        options.disabled = false;
        generating = false; updateButtons();
    }
});
