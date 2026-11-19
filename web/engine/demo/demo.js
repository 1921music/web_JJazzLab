"use strict";

const form = document.querySelector("#midi-form");
const options = document.querySelector("#options");
const chordInput = document.querySelector("#chords");
const styleInput = document.querySelector("#style");
const tempoInput = document.querySelector("#tempo");
const status = document.querySelector("#status");
const download = document.querySelector("#download");
const bundledStyle = "8Beat.T160.STY";

let engine;
let downloadUrl;
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
    const file = styleInput.files[0];
    if (file) {
        return { name: file.name, bytes: new Int8Array(await file.arrayBuffer()) };
    }
    return { name: bundledStyle, bytes: new Int8Array(await decompress(embeddedStyle)) };
}

form.addEventListener("input", () => {
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
        const style = await readStyle();
        let midi;
        try {
            midi = engine.exports.generateMidi(style.bytes, style.name, chords, tempo);
        } catch {
            throw new Error("MIDIを生成できませんでした。コード表記とスタイルファイルを確認してください。");
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
