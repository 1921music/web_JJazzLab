"use strict";

const soundFontUrl = "https://raw.githubusercontent.com/craffel/pretty-midi/0df351ff2949ef80e788343e952fe15e473f0cde/pretty_midi/TimGM6mb.sf2";
let synthAssets;

function loadSynthAssets(onStatus) {
    synthAssets ??= (async () => {
        onStatus("音源を準備しています。初回はSoundFontを約6MBダウンロードします…");
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 60000);
        try {
            const [wasm, response] = await Promise.all([
                decompress(embeddedSynth),
                fetch(soundFontUrl, { credentials: "omit", signal: abort.signal }).catch(() => {
                    throw new Error("SoundFontを取得できませんでした。ネット接続を確認して再生を押してください。");
                })
            ]);
            if (!response.ok) throw new Error(`SoundFontの取得に失敗しました (${response.status})。`);
            const soundfont = await response.arrayBuffer();
            const header = new DataView(soundfont);
            if (soundfont.byteLength < 12 || soundfont.byteLength > 16000000 || header.getUint32(0) !== 0x52494646
                || header.getUint32(8) !== 0x7366626b) throw new Error("取得したSoundFontが不正です。");
            return { wasm, soundfont };
        } finally { clearTimeout(timeout); }
    })().catch(error => { synthAssets = undefined; throw error; });
    return synthAssets;
}

function loadSynthWorklet(context) {
    if (!context.audioWorklet) throw new Error("AudioWorkletに対応したPC版ChromeまたはEdgeで開いてください。");
    // A data URL also works for standalone HTML documents opened from disk.
    const source = new TextEncoder().encode(embeddedWorklet);
    const url = "data:text/javascript;base64," + btoa(Array.from(source, byte => String.fromCharCode(byte)).join(""));
    return context.audioWorklet.addModule(url).catch(error => { throw new Error(`音声処理モジュールを読み込めませんでした: ${error.message}`); });
}

function connectSynthOutput(context, node) {
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -3;
    compressor.knee.value = 3;
    compressor.ratio.value = 20;
    node.connect(compressor);
    compressor.connect(context.destination);
    return compressor;
}

class AccompanimentPlayer {
    constructor(onPosition, onError) {
        this.onPosition = onPosition;
        this.onError = onError;
        this.waiting = new Map();
        this.serial = 0;
    }

    async initialize(onStatus) {
        if (!this.context) this.context = new AudioContext({ latencyHint: "interactive" });
        // Called directly from the play button, before the first asynchronous download.
        await this.context.resume();
        if (this.ready) return;
        if (!this.loading) this.loading = this.load(onStatus).then(() => { this.ready = true; }).finally(() => { this.loading = null; });
        return this.loading;
    }

    async load(onStatus) {
        try {
            const assets = await loadSynthAssets(onStatus);
            onStatus("SoundFontを読み込んでいます…");
            if (!this.workletLoaded) {
                await loadSynthWorklet(this.context);
                this.workletLoaded = true;
            }
            this.node?.disconnect();
            this.node = new AudioWorkletNode(this.context, "soundfont-synth", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
            this.node.port.onmessage = ({ data }) => {
                if (data.type === "position") {
                    if (!data.preview) this.onPosition(data);
                }
                else if (data.type === "error") { this.ready = false; this.onError(data.error); }
                else if (this.waiting.has(data.id)) {
                    const request = this.waiting.get(data.id); this.waiting.delete(data.id);
                    clearTimeout(request.timeout);
                    if (data.error) request.reject(new Error(data.error)); else request.resolve();
                }
            };
            this.node.onprocessorerror = () => {
                this.ready = false;
                for (const request of this.waiting.values()) { clearTimeout(request.timeout); request.reject(new Error("音源の処理に失敗しました。再生を押して再試行してください。")); }
                this.waiting.clear();
                this.onError("音源の処理に失敗しました。再生を押して再試行してください。");
            };
            // A single compressor catches peaks from combinations of loud parts.
            if (this.compressor) this.node.connect(this.compressor);
            else this.compressor = connectSynthOutput(this.context, this.node);
            const wasm = assets.wasm.slice(0), soundfont = assets.soundfont.slice(0);
            await this.send("init", { wasm, soundfont }, [wasm, soundfont]);
            this.loadedSong = null;
        } catch (error) {
            this.node?.disconnect();
            throw error;
        }
    }

    send(type, data = {}, transfer = []) {
        const id = ++this.serial;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => { this.waiting.delete(id); reject(new Error("音源からの応答がありません。ページを開き直してください。")); }, 30000);
            this.waiting.set(id, { resolve, reject, timeout });
            this.node.port.postMessage({ id, type, ...data }, transfer);
        });
    }

    async play(song, loop, parts, master, startFromSelection = false, settings = {}) {
        this.previewing = Boolean(settings.preview);
        if (this.loadedSong !== song) {
            await this.send("song", { song, loop, preview: this.previewing });
            this.loadedSong = song;
        }
        await this.send("loop", { loop });
        await this.send("mix", { parts, master });
        await this.send("play", { startFromSelection, ...settings });
    }

    async stop() { if (this.ready) await this.send("stop"); }
    async pause() { if (this.ready) await this.send("pause"); }
    async panic() { if (this.ready) await this.send("panic"); }
    async click(enabled) { if (this.ready) await this.send("click", { enabled }); }
    async tempo(rate) { if (this.ready && this.loadedSong && !this.previewing) await this.send("tempo", { rate }); }
    mix(parts, master) {
        if (this.ready && this.loadedSong && !this.previewing) this.send("mix", { parts, master }).catch(error => this.onError(error.message));
    }
    loop(loop) {
        if (this.ready && this.loadedSong && !this.previewing) this.send("loop", { loop }).catch(error => this.onError(error.message));
    }
}
