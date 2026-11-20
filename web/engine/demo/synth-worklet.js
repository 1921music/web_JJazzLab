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
    constructor(options) {
        super();
        this.playing = false;
        this.parts = [];
        this.master = this.masterTarget = 0.8;
        this.tempoRate = 1;
        this.report = 0;
        this.effects = new MixerEffects(sampleRate);
        this.synthEffects = options?.processorOptions?.effects ?? { gain: 1, reverb: 1, chorus: 1 };
        this.port.onmessage = ({ data }) => this.command(data);
        this.port.onmessageerror = () => this.port.postMessage({ type: "error", error: "音源データを受け取れませんでした。再生を押して再試行してください。" });
        const offline = options?.processorOptions;
        if (offline) {
            this.loadSoundFont(offline.module, offline.soundfont);
            this.command({ type: "song", song: offline.song, loop: { enabled: false, start: 0, end: offline.song.duration } });
            this.command({ type: "mix", parts: offline.parts, master: offline.master });
            this.command({ type: "play", click: false });
        }
    }

    loadSoundFont(module, soundfont) {
        const instance = new WebAssembly.Instance(module, {
            wasi_snapshot_preview1: { proc_exit: () => { throw new Error("音源の処理が終了しました。"); } },
            env: { emscripten_notify_memory_growth() {} }
        });
        this.api = instance.exports;
        this.api._initialize?.();
        const bytes = new Uint8Array(soundfont);
        const pointer = this.api.malloc(bytes.length);
        if (!pointer) throw new Error("音源用のメモリを確保できません。");
        try {
            new Uint8Array(this.api.memory.buffer, pointer, bytes.length).set(bytes);
            if (!this.api.synth_load(pointer, bytes.length, sampleRate)) throw new Error("SoundFontを読み込めません。");
        } finally { this.api.free(pointer); }
        this.pcm = new Float32Array(this.api.memory.buffer);
    }

    async command(message) {
        const { id, type } = message;
        try {
            this.midiOffset = 0;
            if (type === "init") {
                this.loadSoundFont(await WebAssembly.compile(message.wasm), message.soundfont);
                if (message.effects) this.synthEffects = message.effects;
            } else if (type === "effects") {
                this.synthEffects = message.effects;
            } else if (type === "song") {
                this.playing = false;
                this.paused = false;
                this.preview = Boolean(message.preview);
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
                this.pendingRefresh = null;
                this.clickPart = -1;
                this.midiOutput = undefined;
                this.effects.clear();
            } else if (type === "refresh") {
                this.pendingRefresh = message.song && (this.playing || this.paused) && !this.preview
                    ? { version: message.version,
                        events: message.song.events.map(event => ({ ...event, frame: Math.round(event.seconds * sampleRate) })),
                        frame: this.beats.find(beat => beat.beat === 1 && beat.frame > this.frame)?.frame ?? this.duration }
                    : null;
            } else if (type === "mix") {
                const solo = message.parts.some(p => p.solo);
                for (let i = 0; i < this.parts.length; i++) {
                    const p = this.parts[i], settings = message.parts[i];
                    const enabled = !settings.mute && (!solo || settings.solo);
                    if (p.enabled && !enabled) this.api.synth_silence(i);
                    if (p.enabled && !enabled && (!p.drum || !this.midiOutput?.gmDrums)) this.midiSilence(p.outputChannel ?? p.channel);
                    const changedProgram = settings.instrumentChoice?.program !== p.instrumentChoice?.program
                        || settings.instrumentEnabled !== p.instrumentEnabled;
                    const changedVolume = settings.volumeEnabled !== p.volumeEnabled;
                    const changedPan = settings.panEnabled !== p.panEnabled;
                    Object.assign(p, settings, { enabled, instrumentChoice: settings.instrumentChoice });
                    if (changedProgram) this.applyProgram(i);
                    if (changedVolume) this.api.synth_event(i, 0xb0, 7, p.volumeEnabled === false ? 127 : p.midiVolume ?? 127);
                    if (changedPan) this.api.synth_event(i, 0xb0, 10, p.panEnabled === false ? 64 : p.midiPan ?? 64);
                    if (this.midiOutput) this.midiControllers(i, changedProgram);
                }
                this.masterTarget = message.master;
            } else if (type === "loop") {
                const loop = this.prepareLoop(message.loop);
                if (this.playing) this.pendingLoop = loop;
                else this.loop = loop;
            } else if (type === "tempo") {
                this.setTempoRate(message.rate);
            } else if (type === "play") {
                this.midiOutput = message.midiOutput;
                this.primaryMidiDrum = this.parts.findIndex(p => p.drum && (p.outputChannel ?? p.channel) === 9);
                if (this.primaryMidiDrum < 0) this.primaryMidiDrum = this.parts.findIndex(p => p.drum);
                this.midiDrumMap = this.midiOutput && new Map(this.midiOutput.drumMap);
                this.midiPatchMap = this.midiOutput && new Map(this.midiOutput.patchMap?.map(([key, ...patch]) => [key, patch]));
                if (message.rate !== undefined || !message.resume) this.setTempoRate(message.rate ?? 1);
                if (this.pendingLoop) { this.loop = this.pendingLoop; this.pendingLoop = null; }
                this.clickEnabled = message.click ?? this.clickEnabled;
                if (message.clickSettings) this.configureClick(message.clickSettings);
                else if ((this.clickEnabled || message.precount) && this.clickPart < 0) this.configureClick(
                    { highPitch: 37, lowPitch: 37, highVelocity: 120, lowVelocity: 90, channel: 9, program: 0 });
                if (!this.paused || !message.resume) {
                    this.effects.clear();
                    const start = this.loop.enabled || message.startFromSelection ? this.loop.start : 0;
                    this.seek(start);
                    this.playbackEnd = message.stopAtEnd ? this.loop.end : this.duration;
                    this.countFrames = 0;
                    if (message.precount) {
                        const end = this.beats.find(beat => beat.frame > start && beat.beat === 1)?.frame ?? this.duration;
                        this.countBeats = this.beats.filter(beat => beat.frame >= start && beat.frame < end).length || 4;
                        this.countStep = Math.max(1, Math.round((end - start) / this.countBeats / this.tempoRate));
                        let countBars = message.precount === "1" ? 1 : 2;
                        if (message.precount === "auto") {
                            const tempo = message.tempo || 60 * sampleRate / this.countStep;
                            const oneBarBelow = this.countBeats <= 3 ? 55 : this.countBeats <= 4 ? 100 : 120;
                            countBars = tempo < oneBarBelow ? 1 : 2;
                        }
                        this.countBars = countBars;
                        this.countFrames = this.countStep * this.countBeats * countBars;
                    }
                }
                this.paused = false;
                this.playing = true;
                if (this.midiOutput) for (let i = 0; i < this.parts.length; i++) this.midiControllers(i, true);
                this.reportPosition();
            } else if (type === "pause") {
                this.paused = this.playing;
                this.playing = false;
                this.reportPosition();
            } else if (type === "click") {
                this.clickEnabled = message.enabled;
            } else if (type === "click-settings") {
                this.configureClick(message.settings);
            } else if (type === "midi-disable") {
                this.midiOutput = undefined;
            } else if (type === "panic") {
                for (let i = 0; i < this.parts.length; i++) this.api.synth_silence(i);
                this.resetClick();
                this.effects.clear();
            } else if (type === "stop") {
                this.playing = false;
                this.paused = false;
                this.countFrames = 0;
                this.pendingRefresh = null;
                this.midiOutput = undefined;
                this.resetClick();
                for (let i = 0; i < this.parts.length; i++) this.api.synth_reset(i);
                if (this.pendingLoop) { this.loop = this.pendingLoop; this.pendingLoop = null; }
                this.frame = 0;
                this.reportPosition();
            }
            this.flushMidi();
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

    setTempoRate(rate) {
        if (!Number.isFinite(rate) || rate <= 0 || rate > 40) throw new Error("テンポ比が不正です。");
        this.tempoRate = rate;
    }

    applyProgram(index) {
        const part = this.parts[index];
        if (part.instrumentEnabled === false) {
            this.api.synth_event(index, 0xb0, 0, 0);
            this.api.synth_event(index, 0xb0, 32, 0);
            this.api.synth_event(index, 0xc0, 0, 0);
            return;
        }
        const program = part.instrumentChoice?.program;
        this.api.synth_event(index, 0xb0, 0, program === undefined ? part.bankMsb : 0);
        this.api.synth_event(index, 0xb0, 32, program === undefined ? part.bankLsb : 0);
        this.api.synth_event(index, 0xc0, program ?? part.midiProgram, 0);
    }

    queueMidi(channel, type, a, b) {
        if (!this.midiOutput || this.preview || !Number.isInteger(channel) || channel < 0 || channel > 15) return;
        const frame = typeof currentFrame === "number" ? currentFrame : 0;
        const bytes = type === 0xc0 || type === 0xd0 ? [type | channel, a] : [type | channel, a, b];
        (this.midiMessages ??= []).push({ bytes, seconds: (frame + this.midiOffset) / sampleRate });
    }

    flushMidi() {
        if (!this.midiMessages?.length) return;
        this.port.postMessage({ type: "midi", messages: this.midiMessages });
        this.midiMessages = [];
    }

    midiChannel(part) {
        return this.midiOutput.gmDrums && part.drum ? 9 : part.outputChannel ?? part.channel;
    }

    midiSilence(channel) {
        for (const control of [64, 120, 123]) this.queueMidi(channel, 0xb0, control, 0);
    }

    midiProgram(part, program, bank) {
        const channel = this.midiChannel(part);
        const mapping = this.midiPatchMap?.get(program + (part.drum ? 128 : 0));
        const selectedBank = mapping ?? bank;
        if (selectedBank) {
            this.queueMidi(channel, 0xb0, 0, selectedBank[0]);
            this.queueMidi(channel, 0xb0, 32, selectedBank[1]);
        }
        this.queueMidi(channel, 0xc0, mapping?.[2] ?? program, 0);
    }

    midiControllers(index, program = false) {
        const part = this.parts[index];
        if (!this.midiOutput.sendSetup || (part.drum && this.midiOutput.gmDrums && index !== this.primaryMidiDrum)) return;
        const channel = this.midiChannel(part);
        if (program && part.instrumentEnabled !== false) {
            const choice = part.instrumentChoice?.program;
            this.midiProgram(part, choice ?? part.midiProgram, choice === undefined ? [part.bankMsb, part.bankLsb] : [0, 0]);
        }
        const byte = value => Math.min(127, Math.max(0, Math.round(value)));
        if (part.volumeEnabled !== false) this.queueMidi(channel, 0xb0, 7, byte((part.midiVolume ?? 127) * part.volume));
        if (part.panEnabled !== false) this.queueMidi(channel, 0xb0, 10, byte((part.midiPan ?? 64) + part.pan * 64));
        if (part.reverbEnabled) this.queueMidi(channel, 0xb0, 91, part.reverb);
        if (part.chorusEnabled) this.queueMidi(channel, 0xb0, 93, part.chorus);
    }

    midiEvent(index, type, a, b) {
        if (!this.midiOutput) return;
        const part = this.parts[index], notes = type === 0x80 || type === 0x90 || type === 0xa0;
        if (part.drum && this.midiOutput.gmDrums && index !== this.primaryMidiDrum && !notes) return;
        const controller = type === 0xb0 && [0, 7, 10, 32, 39, 42, 91, 93].includes(a);
        if ((type === 0xc0 || controller) && !this.midiOutput.sendSetup) return;
        if (type === 0xc0) {
            this.midiProgram(part, a);
            return;
        }
        if (type === 0xb0 && (a === 7 || a === 10 || a === 91 || a === 93)) {
            this.midiControllers(index);
            return;
        }
        const pitch = part.drum && notes ? this.midiDrumMap?.get(a) ?? a : a;
        this.queueMidi(this.midiChannel(part), type, pitch, b);
    }

    event({ part: index, type, a, b }) {
        const part = this.parts[index];
        if (type === 0xc0) part.midiProgram = a;
        if (type === 0xb0 && a === 0) part.bankMsb = b;
        if (type === 0xb0 && a === 32) part.bankLsb = b;
        if (type === 0xb0 && a === 7) part.midiVolume = b;
        if (type === 0xb0 && a === 10) part.midiPan = b;
        if ((part.instrumentChoice || part.instrumentEnabled === false)
            && (type === 0xc0 || (type === 0xb0 && (a === 0 || a === 32)))) return;
        if (type === 0xb0 && ((part.volumeEnabled === false && (a === 7 || a === 39))
                || (part.panEnabled === false && (a === 10 || a === 42)))) return;
        if (type !== 0x90 || !b || part.enabled) {
            this.api.synth_event(index, type, a, b);
            this.midiEvent(index, type, a, b);
        }
    }

    seek(frame, chase = this.loop.chase) {
        if (this.midiOutput) {
            const channels = new Set(this.parts.map(part => this.midiChannel(part)));
            if (this.clickEnabled) channels.add(this.midiOutput.gmDrums ? 9 : this.clickSettings?.channel);
            for (const channel of channels) this.midiSilence(channel);
        }
        for (const [index, part] of this.parts.entries()) {
            this.api.synth_reset(index);
            part.midiProgram = part.bankMsb = part.bankLsb = 0;
            part.midiVolume = 127;
            part.midiPan = 64;
            if (part.instrumentChoice) this.applyProgram(index);
        }
        if (frame) for (const event of chase) {
            if (event.frame >= frame) break;
            this.event(event);
        }
        this.frame = frame;
        this.index = 0;
        while (this.index < this.events.length && this.events[this.index].frame < frame) this.index++;
        this.beatIndex = this.beats.findIndex(beat => beat.frame >= frame);
        if (this.beatIndex < 0) this.beatIndex = this.beats.length;
        this.resetClick();
        this.fadeStart = frame;
    }

    applyRefresh(frame, restarting = false) {
        const { version, events } = this.pendingRefresh;
        this.pendingRefresh = null;
        this.events = events;
        const controls = events.filter(event => [0xb0, 0xc0, 0xe0].includes(event.type));
        this.loop.chase = controls.filter(event => event.frame < this.loop.restart);
        if (this.pendingLoop) this.pendingLoop.chase = controls.filter(event => event.frame < this.pendingLoop.restart);
        this.seek(frame, controls);
        if (!restarting) {
            const sustained = new Map();
            for (const event of events) {
                if (event.frame >= frame) break;
                const key = event.part * 128 + event.a;
                if (event.type === 0x90 && event.b) sustained.set(key, event);
                else if (event.type === 0x80 || event.type === 0x90) sustained.delete(key);
            }
            for (const event of sustained.values()) this.event(event);
        }
        this.port.postMessage({ type: "refresh-applied", version });
    }

    reportPosition() {
        this.port.postMessage({ type: "position", seconds: this.frame / sampleRate, playing: this.playing,
            paused: Boolean(this.paused), counting: this.countFrames > 0, preview: this.preview });
    }

    configureClick(settings) {
        const newPart = this.clickPart < 0;
        if (newPart) this.clickPart = this.api.synth_part(1);
        if (this.clickPart >= 0 && (newPart || settings.program !== this.clickSettings?.program)) {
            this.resetClick();
            this.api.synth_event(this.clickPart, 0xc0, settings.program, 0);
        }
        this.clickSettings = settings;
    }

    resetClick() {
        if (this.clickPart >= 0) this.api.synth_silence(this.clickPart);
        this.clickNoteFrames = 0;
    }

    hitClick(strong, halfBeat, quiet = false) {
        if (this.clickPart < 0 || !this.clickSettings) return;
        if (this.clickNoteFrames) this.api.synth_event(this.clickPart, 0x80, this.clickPitch, 0);
        const { highPitch, lowPitch, highVelocity, lowVelocity } = this.clickSettings;
        const velocity = strong ? highVelocity : quiet ? Math.trunc(lowVelocity / 4) : lowVelocity;
        this.clickPitch = strong ? highPitch : lowPitch;
        this.clickNoteFrames = velocity ? Math.max(1, Math.round(halfBeat)) : 0;
        if (velocity) this.api.synth_event(this.clickPart, 0x90, this.clickPitch, velocity);
        if (velocity && this.midiOutput) this.queueMidi(this.midiOutput.gmDrums ? 9 : this.clickSettings.channel, 0x90, this.clickPitch, velocity);
    }

    releaseClick(rendered) {
        if (!this.clickNoteFrames) return;
        this.clickNoteFrames -= rendered;
        if (this.clickNoteFrames <= 0) {
            this.clickNoteFrames = 0;
            this.api.synth_event(this.clickPart, 0x80, this.clickPitch, 0);
            if (this.midiOutput) this.queueMidi(this.midiOutput.gmDrums ? 9 : this.clickSettings.channel, 0x80, this.clickPitch, 0);
        }
    }

    process(inputs, outputs) {
        const [left, right] = outputs[0];
        if (!this.playing || !this.api) return true;
        try {
            let offset = 0;
            const rate = this.tempoRate;
            while (offset < left.length && this.countFrames > 0) {
                this.midiOffset = offset;
                const remaining = this.countFrames % this.countStep;
                if (!remaining) {
                    const beat = this.countBars * this.countBeats - this.countFrames / this.countStep;
                    const special = this.countBars === 2 && this.countBeats === 4 && beat < 4;
                    this.hitClick(special ? beat % 2 === 0 : beat % this.countBeats === 0, this.countStep / 2, special);
                }
                const n = Math.min(128, left.length - offset, remaining || this.countStep, this.clickNoteFrames || Infinity);
                if (this.clickPart >= 0 && this.midiOutput?.monitor !== false) {
                    const pointer = this.api.synth_render(n) / 4 + this.clickPart * 256;
                    for (let f = 0; f < n; f++) {
                        this.master += (this.masterTarget * this.synthEffects.gain - this.master) * 0.01;
                        left[offset + f] = this.pcm[pointer + f * 2] * this.master;
                        right[offset + f] = this.pcm[pointer + f * 2 + 1] * this.master;
                    }
                }
                this.midiOffset = offset + n;
                this.releaseClick(n);
                offset += n;
                this.countFrames -= n;
                if (!this.countFrames) this.reportPosition();
            }
            while (offset < left.length && this.playing) {
                this.midiOffset = offset;
                let boundary = this.loop.enabled ? this.loop.end : this.playbackEnd;
                if (this.frame >= boundary) {
                    if (this.pendingLoop) { this.loop = this.pendingLoop; this.pendingLoop = null; }
                    if (this.loop.enabled) {
                        if (this.pendingRefresh) this.applyRefresh(this.loop.restart, true);
                        else this.seek(this.loop.restart);
                    }
                    else if (this.frame >= this.playbackEnd) {
                        this.frame = this.playbackEnd;
                        this.playing = false;
                        for (let i = 0; i < this.parts.length; i++) this.api.synth_reset(i);
                        this.reportPosition();
                        break;
                    }
                    boundary = this.loop.enabled ? this.loop.end : this.playbackEnd;
                }
                if (this.pendingRefresh && this.frame >= this.pendingRefresh.frame) this.applyRefresh(this.frame);
                while (this.index < this.events.length && this.events[this.index].frame <= this.frame) {
                    this.event(this.events[this.index++]);
                }
                while (this.beats[this.beatIndex]?.frame <= this.frame) {
                    const beat = this.beats[this.beatIndex++];
                    const next = this.beats[this.beatIndex]?.frame ?? this.duration;
                    if (this.clickEnabled) this.hitClick(beat.beat === 1, (next - beat.frame) / rate / 2);
                }
                const next = Math.min(this.events[this.index]?.frame ?? boundary, this.pendingRefresh?.frame ?? boundary,
                    this.clickEnabled ? this.beats[this.beatIndex]?.frame ?? boundary : boundary);
                const n = Math.min(128, left.length - offset, this.clickNoteFrames || Infinity,
                    Math.max(1, Math.ceil((Math.min(boundary, next) - this.frame) / rate)));
                const pointer = this.api.synth_render(n) / 4;
                for (let f = 0; f < n; f++) {
                    this.master += (this.masterTarget * this.synthEffects.gain - this.master) * 0.01;
                    let l = 0, r = 0, chorus = 0, room = 0;
                    for (let i = 0; i < this.parts.length; i++) {
                        const p = this.parts[i];
                        const volume = p.volumeEnabled === false ? 1 : p.volume;
                        p.gain += ((p.enabled ? volume : 0) - p.gain) * 0.01;
                        p.balance += ((p.panEnabled === false ? 0 : p.pan) - p.balance) * 0.01;
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
                    this.effects.process(chorus * this.synthEffects.chorus, room * this.synthEffects.reverb);
                    const playFrame = this.frame + f * rate;
                    const clickOffset = pointer + this.clickPart * 256 + f * 2;
                    const clickLeft = this.clickPart >= 0 ? this.pcm[clickOffset] : 0;
                    const clickRight = this.clickPart >= 0 ? this.pcm[clickOffset + 1] : 0;
                    const fade = Math.min(1, (playFrame - this.fadeStart) / (64 * rate), (boundary - playFrame) / (64 * rate));
                    if (this.midiOutput?.monitor !== false) {
                        left[offset + f] = ((l + this.effects.left) * fade + clickLeft) * this.master;
                        right[offset + f] = ((r + this.effects.right) * fade + clickRight) * this.master;
                    }
                }
                this.midiOffset = offset + n;
                this.releaseClick(n);
                this.frame += n * rate; offset += n;
            }
            if (++this.report >= 32) { this.report = 0; this.reportPosition(); }
            this.flushMidi();
        } catch (error) {
            this.playing = false;
            this.port.postMessage({ type: "error", error: error.message });
        }
        return true;
    }
}

registerProcessor("soundfont-synth", SoundFontProcessor);
