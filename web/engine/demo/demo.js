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
    clearDownload();
    showStatus("");
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
    options.disabled = true;
    showStatus("MIDIを生成しています…");
    try {
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
        downloadUrl = URL.createObjectURL(new Blob([midi], { type: "audio/midi" }));
        download.href = downloadUrl;
        download.download = style.name.replace(/\.[^.]+$/u, "") + "-accompaniment.mid";
        download.hidden = false;
        showStatus(`${chords.length}小節のMIDIを生成しました。`);
        download.click();
    } catch (error) {
        showStatus(error.message, true);
    } finally {
        options.disabled = false;
    }
});
