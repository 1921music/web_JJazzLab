"use strict";

class SoundFontProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.playing = false;
        this.parts = [];
        this.master = this.masterTarget = 0.8;
        this.report = 0;
        this.port.onmessage = ({ data }) => this.command(data);
        this.port.onmessageerror = () => this.port.postMessage({ type: "error", error: "音源データを受け取れませんでした。再生を押して再試行してください。" });
    }

    async command(message) {
        const { id, type } = message;
        try {
            if (type === "init") {
                const { instance } = await WebAssembly.instantiate(message.wasm, {
                    wasi_snapshot_preview1: { proc_exit: () => { throw new Error("音源の処理が終了しました。"); } },
                    env: { emscripten_notify_memory_growth() {} }
                });
                this.api = instance.exports;
                this.api._initialize?.();
                const bytes = new Uint8Array(message.soundfont);
                const pointer = this.api.malloc(bytes.length);
                if (!pointer) throw new Error("音源用のメモリを確保できません。");
                try {
                    new Uint8Array(this.api.memory.buffer, pointer, bytes.length).set(bytes);
                    if (!this.api.synth_load(pointer, bytes.length, sampleRate)) throw new Error("SoundFontを読み込めません。");
                } finally { this.api.free(pointer); }
                this.pcm = new Float32Array(this.api.memory.buffer);
            } else if (type === "song") {
                this.playing = false;
                this.api.synth_clear_parts();
                this.parts = message.song.parts.map((part, i) => {
                    if (this.api.synth_part(Number(part.drum)) !== i) throw new Error("音源のパートを作成できません。");
                    return { ...part, volume: 1, pan: 0, mute: false, solo: false, enabled: true, gain: 1, balance: 0 };
                });
                this.events = message.song.events.map(e => ({ ...e, frame: Math.round(e.seconds * sampleRate) }));
                this.duration = Math.round(message.song.duration * sampleRate);
                this.frame = this.index = 0;
                this.loop = this.prepareLoop(message.loop);
                this.pendingLoop = null;
            } else if (type === "mix") {
                const solo = message.parts.some(p => p.solo);
                for (let i = 0; i < this.parts.length; i++) {
                    const p = this.parts[i], settings = message.parts[i];
                    const enabled = !settings.mute && (!solo || settings.solo);
                    if (p.enabled && !enabled) this.api.synth_silence(i);
                    Object.assign(p, settings, { enabled });
                }
                this.masterTarget = message.master;
            } else if (type === "loop") {
                const loop = this.prepareLoop(message.loop);
                if (this.playing) this.pendingLoop = loop;
                else this.loop = loop;
            } else if (type === "play") {
                if (this.pendingLoop) { this.loop = this.pendingLoop; this.pendingLoop = null; }
                this.seek(this.loop.enabled ? this.loop.start : 0);
                this.playing = true;
                this.reportPosition();
            } else if (type === "stop") {
                this.playing = false;
                for (let i = 0; i < this.parts.length; i++) this.api.synth_reset(i);
                if (this.pendingLoop) { this.loop = this.pendingLoop; this.pendingLoop = null; }
                this.frame = 0;
                this.reportPosition();
            }
            this.port.postMessage({ id, ok: true });
        } catch (error) {
            this.playing = false;
            this.port.postMessage({ id, error: error.message });
        }
    }

    prepareLoop(loop) {
        const start = Math.round(loop.start * sampleRate), end = Math.round(loop.end * sampleRate);
        if (start < 0 || end <= start || end > this.duration) throw new Error("ループ範囲が不正です。");
        return { enabled: loop.enabled, start, end,
            chase: this.events.filter(e => e.frame < start && [0xb0, 0xc0, 0xe0].includes(e.type)) };
    }

    seek(frame) {
        for (let i = 0; i < this.parts.length; i++) this.api.synth_reset(i);
        if (frame) for (const e of this.loop.chase) this.api.synth_event(e.part, e.type, e.a, e.b);
        this.frame = frame;
        this.index = 0;
        while (this.index < this.events.length && this.events[this.index].frame < frame) this.index++;
        this.fadeStart = frame;
    }

    reportPosition() {
        this.port.postMessage({ type: "position", seconds: this.frame / sampleRate, playing: this.playing });
    }

    process(inputs, outputs) {
        const [left, right] = outputs[0];
        if (!this.playing || !this.api) return true;
        try {
            let offset = 0;
            while (offset < left.length && this.playing) {
                let boundary = this.loop.enabled ? this.loop.end : this.duration;
                if (this.frame >= boundary) {
                    if (this.pendingLoop) { this.loop = this.pendingLoop; this.pendingLoop = null; }
                    if (this.loop.enabled) this.seek(this.loop.start);
                    else if (this.frame >= this.duration) {
                        this.playing = false;
                        for (let i = 0; i < this.parts.length; i++) this.api.synth_reset(i);
                        this.reportPosition();
                        break;
                    }
                    boundary = this.loop.enabled ? this.loop.end : this.duration;
                }
                while (this.index < this.events.length && this.events[this.index].frame <= this.frame) {
                    const e = this.events[this.index++];
                    if (e.type !== 0x90 || !e.b || this.parts[e.part].enabled)
                        this.api.synth_event(e.part, e.type, e.a, e.b);
                }
                const next = this.events[this.index]?.frame ?? boundary;
                const n = Math.min(128, left.length - offset, boundary - this.frame, Math.max(1, next - this.frame));
                const pointer = this.api.synth_render(n) / 4;
                for (let f = 0; f < n; f++) {
                    this.master += (this.masterTarget - this.master) * 0.01;
                    let l = 0, r = 0;
                    for (let i = 0; i < this.parts.length; i++) {
                        const p = this.parts[i];
                        p.gain += ((p.enabled ? p.volume : 0) - p.gain) * 0.01;
                        p.balance += (p.pan - p.balance) * 0.01;
                        const a = this.pcm[pointer + i * 256 + f * 2];
                        const b = this.pcm[pointer + i * 256 + f * 2 + 1];
                        // Stereo panning preserves the original stereo image at center.
                        const angle = Math.abs(p.balance) * Math.PI / 2;
                        const c = Math.cos(angle), s = Math.sin(angle);
                        l += (p.balance < 0 ? a + b * s : a * c) * p.gain;
                        r += (p.balance < 0 ? b * c : b + a * s) * p.gain;
                    }
                    const fade = Math.min(1, (this.frame + f - this.fadeStart) / 64, (boundary - this.frame - f) / 64);
                    left[offset + f] = l * this.master * fade;
                    right[offset + f] = r * this.master * fade;
                }
                this.frame += n; offset += n;
            }
            if (++this.report >= 32) { this.report = 0; this.reportPosition(); }
        } catch (error) {
            this.playing = false;
            this.port.postMessage({ type: "error", error: error.message });
        }
        return true;
    }
}

registerProcessor("soundfont-synth", SoundFontProcessor);
