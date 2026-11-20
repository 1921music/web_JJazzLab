"use strict";

class MixerEffects {
    constructor(rate) {
        this.chorus = new Float32Array(Math.ceil(rate * 0.04));
        this.room = [0.0297, 0.0371, 0.0411, 0.0437].map(seconds => new Float32Array(Math.round(rate * seconds)));
        this.roomPositions = new Int32Array(this.room.length);
        this.phaseStep = 2 * Math.PI * 0.32 / rate;
        this.depth = rate * 0.0035;
        this.delay = rate * 0.018;
        this.clear();
    }

    clear() {
        this.chorus.fill(0);
        this.room.forEach(delay => delay.fill(0));
        this.roomPositions.fill(0);
        this.phase = this.position = this.left = this.right = 0;
    }

    chorusTap(delay) {
        const length = this.chorus.length;
        const sample = this.position + length - delay;
        const index = Math.floor(sample);
        const fraction = sample - index;
        return this.chorus[index % length] * (1 - fraction) + this.chorus[(index + 1) % length] * fraction;
    }

    process(chorus, room) {
        this.chorus[this.position] = chorus;
        this.left = this.chorusTap(this.delay + this.depth * Math.sin(this.phase)) * 0.48;
        this.right = this.chorusTap(this.delay - this.depth * Math.sin(this.phase)) * 0.48;
        if (++this.position === this.chorus.length) this.position = 0;
        this.phase += this.phaseStep;
        if (this.phase >= 2 * Math.PI) this.phase -= 2 * Math.PI;
        for (let i = 0; i < this.room.length; i++) {
            const delay = this.room[i];
            const position = this.roomPositions[i];
            const sample = delay[position];
            delay[position] = room * 0.25 + sample * 0.68;
            this.roomPositions[i] = (position + 1) % delay.length;
            this.left += sample * (i % 2 === 0 ? 0.72 : 0.32);
            this.right += sample * (i % 2 === 0 ? 0.32 : 0.72);
        }
    }
}

class SoundFontProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.playing = false;
        this.parts = [];
        this.master = this.masterTarget = 0.8;
        this.report = 0;
        this.effects = new MixerEffects(sampleRate);
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
                this.paused = false;
                this.api.synth_clear_parts();
                this.parts = message.song.parts.map((part, i) => {
                    if (this.api.synth_part(Number(part.drum)) !== i) throw new Error("音源のパートを作成できません。");
                    return { ...part, volume: 1, pan: 0, mute: false, solo: false, enabled: true, gain: 1, balance: 0,
                        chorusSend: 0, reverbSend: 0, midiProgram: 0, bankMsb: 0, bankLsb: 0 };
                });
                this.events = message.song.events.map(e => ({ ...e, frame: Math.round(e.seconds * sampleRate) }));
                this.beats = (message.song.beatTimes ?? []).map(beat => ({ ...beat, frame: Math.round(beat.seconds * sampleRate) }));
                this.duration = Math.round(message.song.duration * sampleRate);
                this.frame = this.index = 0;
                this.loop = this.prepareLoop(message.loop);
                this.pendingLoop = null;
                this.effects.clear();
            } else if (type === "mix") {
                const solo = message.parts.some(p => p.solo);
                for (let i = 0; i < this.parts.length; i++) {
                    const p = this.parts[i], settings = message.parts[i];
                    const enabled = !settings.mute && (!solo || settings.solo);
                    if (p.enabled && !enabled) this.api.synth_silence(i);
                    const program = settings.instrumentChoice?.program;
                    const changedProgram = program !== p.instrumentChoice?.program;
                    Object.assign(p, settings, { enabled, instrumentChoice: settings.instrumentChoice });
                    if (changedProgram) this.applyProgram(i);
                }
                this.masterTarget = message.master;
            } else if (type === "loop") {
                const loop = this.prepareLoop(message.loop);
                if (this.playing) this.pendingLoop = loop;
                else this.loop = loop;
            } else if (type === "play") {
                if (this.pendingLoop) { this.loop = this.pendingLoop; this.pendingLoop = null; }
                this.clickEnabled = message.click ?? this.clickEnabled;
                if (!this.paused || !message.resume) {
                    this.effects.clear();
                    const start = this.loop.enabled || message.startFromSelection ? this.loop.start : 0;
                    this.seek(start);
                    this.playbackEnd = message.stopAtEnd ? this.loop.end : this.duration;
                    this.countFrames = 0;
                    if (message.precount) {
                        const end = this.beats.find(beat => beat.frame > start && beat.beat === 1)?.frame ?? this.duration;
                        this.countBeats = this.beats.filter(beat => beat.frame >= start && beat.frame < end).length || 4;
                        this.countStep = Math.max(1, Math.round((end - start) / this.countBeats));
                        let countBars = message.precount === "1" ? 1 : 2;
                        if (message.precount === "auto") {
                            const tempo = message.tempo || 60 * sampleRate / this.countStep;
                            const oneBarBelow = this.countBeats <= 3 ? 55 : this.countBeats <= 4 ? 100 : 120;
                            countBars = tempo < oneBarBelow ? 1 : 2;
                        }
                        this.countFrames = this.countStep * this.countBeats * countBars;
                    }
                }
                this.paused = false;
                this.playing = true;
                this.reportPosition();
            } else if (type === "pause") {
                this.paused = this.playing;
                this.playing = false;
                this.reportPosition();
            } else if (type === "click") {
                this.clickEnabled = message.enabled;
            } else if (type === "panic") {
                for (let i = 0; i < this.parts.length; i++) this.api.synth_silence(i);
                this.effects.clear();
            } else if (type === "stop") {
                this.playing = false;
                this.paused = false;
                this.countFrames = 0;
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
        const restart = Math.round((loop.restart ?? loop.start) * sampleRate);
        if (start < 0 || end <= start || end > this.duration || restart < start || restart >= end) throw new Error("ループ範囲が不正です。");
        const chase = this.events.filter(e => e.frame < restart && [0xb0, 0xc0, 0xe0].includes(e.type));
        return { enabled: loop.enabled, start, end, restart, chase };
    }

    applyProgram(index) {
        const part = this.parts[index];
        const program = part.instrumentChoice?.program;
        this.api.synth_event(index, 0xb0, 0, program === undefined ? part.bankMsb : 0);
        this.api.synth_event(index, 0xb0, 32, program === undefined ? part.bankLsb : 0);
        this.api.synth_event(index, 0xc0, program ?? part.midiProgram, 0);
    }

    event({ part: index, type, a, b }) {
        const part = this.parts[index];
        if (type === 0xc0) part.midiProgram = a;
        if (type === 0xb0 && a === 0) part.bankMsb = b;
        if (type === 0xb0 && a === 32) part.bankLsb = b;
        if (part.instrumentChoice && (type === 0xc0 || (type === 0xb0 && (a === 0 || a === 32)))) return;
        if (type !== 0x90 || !b || part.enabled) this.api.synth_event(index, type, a, b);
    }

    seek(frame) {
        for (const [index, part] of this.parts.entries()) {
            this.api.synth_reset(index);
            part.midiProgram = part.bankMsb = part.bankLsb = 0;
            if (part.instrumentChoice) this.applyProgram(index);
        }
        if (frame) for (const event of this.loop.chase) {
            if (event.frame >= frame) break;
            this.event(event);
        }
        this.frame = frame;
        this.index = 0;
        while (this.index < this.events.length && this.events[this.index].frame < frame) this.index++;
        this.beatIndex = this.beats.findIndex(beat => beat.frame >= frame);
        if (this.beatIndex < 0) this.beatIndex = this.beats.length;
        this.clickRemaining = 0;
        this.fadeStart = frame;
    }

    reportPosition() {
        this.port.postMessage({ type: "position", seconds: this.frame / sampleRate, playing: this.playing, paused: Boolean(this.paused), counting: this.countFrames > 0 });
    }

    clickSample(accent) {
        if (accent !== undefined) {
            this.clickRemaining = Math.round(sampleRate * 0.025);
            this.clickPhase = 0;
            this.clickStep = (accent ? 1600 : 1040) * 2 * Math.PI / sampleRate;
        }
        if (this.clickRemaining <= 0) return 0;
        this.clickPhase += this.clickStep;
        return Math.sin(this.clickPhase) * this.clickRemaining-- / sampleRate * 5;
    }

    process(inputs, outputs) {
        const [left, right] = outputs[0];
        if (!this.playing || !this.api) return true;
        try {
            let offset = 0;
            while (offset < left.length && this.countFrames > 0) {
                const beat = this.countFrames / this.countStep;
                const value = this.clickSample(Number.isInteger(beat) ? beat % this.countBeats === 0 : undefined);
                left[offset] = right[offset] = value * this.master;
                offset++;
                this.countFrames--;
                if (!this.countFrames) this.reportPosition();
            }
            while (offset < left.length && this.playing) {
                let boundary = this.loop.enabled ? this.loop.end : this.playbackEnd;
                if (this.frame >= boundary) {
                    if (this.pendingLoop) { this.loop = this.pendingLoop; this.pendingLoop = null; }
                    if (this.loop.enabled) this.seek(this.loop.restart);
                    else if (this.frame >= this.playbackEnd) {
                        this.playing = false;
                        for (let i = 0; i < this.parts.length; i++) this.api.synth_reset(i);
                        this.reportPosition();
                        break;
                    }
                    boundary = this.loop.enabled ? this.loop.end : this.playbackEnd;
                }
                while (this.index < this.events.length && this.events[this.index].frame <= this.frame) {
                    this.event(this.events[this.index++]);
                }
                const next = this.events[this.index]?.frame ?? boundary;
                const n = Math.min(128, left.length - offset, boundary - this.frame, Math.max(1, next - this.frame));
                const pointer = this.api.synth_render(n) / 4;
                for (let f = 0; f < n; f++) {
                    this.master += (this.masterTarget - this.master) * 0.01;
                    let l = 0, r = 0, chorus = 0, room = 0;
                    for (let i = 0; i < this.parts.length; i++) {
                        const p = this.parts[i];
                        p.gain += ((p.enabled ? p.volume : 0) - p.gain) * 0.01;
                        p.balance += (p.pan - p.balance) * 0.01;
                        const a = this.pcm[pointer + i * 256 + f * 2];
                        const b = this.pcm[pointer + i * 256 + f * 2 + 1];
                        // Stereo panning preserves the original stereo image at center.
                        const angle = Math.abs(p.balance) * Math.PI / 2;
                        const c = Math.cos(angle), s = Math.sin(angle);
                        const partLeft = (p.balance < 0 ? a + b * s : a * c) * p.gain;
                        const partRight = (p.balance < 0 ? b * c : b + a * s) * p.gain;
                        l += partLeft;
                        r += partRight;
                        const mono = (partLeft + partRight) * 0.5;
                        p.chorusSend += ((p.chorusEnabled ? p.chorus / 127 : 0) - p.chorusSend) * 0.01;
                        p.reverbSend += ((p.reverbEnabled ? p.reverb / 127 : 0) - p.reverbSend) * 0.01;
                        chorus += mono * p.chorusSend;
                        room += mono * p.reverbSend;
                    }
                    this.effects.process(chorus, room);
                    const beat = this.beats[this.beatIndex];
                    const click = beat?.frame === this.frame + f;
                    if (click) this.beatIndex++;
                    const clickSound = this.clickEnabled ? this.clickSample(click ? beat.beat === 1 : undefined) : 0;
                    const fade = Math.min(1, (this.frame + f - this.fadeStart) / 64, (boundary - this.frame - f) / 64);
                    left[offset + f] = (l + this.effects.left) * this.master * fade + clickSound * this.master;
                    right[offset + f] = (r + this.effects.right) * this.master * fade + clickSound * this.master;
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
