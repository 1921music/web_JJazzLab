const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createProcessor(rate = 1000) {
    const sent = [], calls = [];
    let Processor, rendered = 0, count = 0;
    const context = vm.createContext({
        AudioWorkletProcessor: class { constructor() { this.port = { postMessage: m => sent.push(m) }; } },
        sampleRate: rate, registerProcessor: (name, type) => { Processor = type; }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../../engine/demo/synth-worklet.js"), "utf8"), context);
    const processor = new Processor();
    const memory = new WebAssembly.Memory({ initial: 1 });
    processor.api = {
        memory, synth_clear_parts: () => { count = 0; }, synth_part: () => count++,
        synth_reset: i => calls.push(["reset", i, rendered]),
        synth_silence: i => calls.push(["silence", i, rendered]),
        synth_event: (...args) => calls.push(["event", ...args, rendered]),
        synth_render: n => { new Float32Array(memory.buffer).fill(.1); rendered += n; return 0; }
    };
    processor.pcm = new Float32Array(memory.buffer);
    const render = (blocks = 1) => {
        let output;
        for (let i = 0; i < blocks; i++) {
            output = [new Float32Array(128), new Float32Array(128)];
            processor.process([], [output]);
        }
        return output;
    };
    return { processor, sent, calls, render };
}

const part = { id: "Bass", name: "Bass", channel: 0, drum: false };
const settings = { volume: 1, pan: 0, mute: false, solo: false };
const event = (seconds, type, a, b = 0, p = 0) => ({ seconds, type, a, b, part: p });
const song = events => ({ duration: .512, parts: [part], events });

test("events run at their sample offsets, and non-loop playback ends exactly", async () => {
    const { processor: p, calls, render } = createProcessor();
    await p.command({ type: "song", song: song([event(.037, 0x90, 60, 100), event(.201, 0x80, 60)]), loop: { enabled: false, start: 0, end: .512 } });
    await p.command({ type: "play" }); render(5);
    const notes = calls.filter(c => c[0] === "event");
    assert.deepEqual(notes.map(c => c.at(-1)), [37, 201]);
    assert.equal(p.frame, 512); assert.equal(p.playing, false);
});

test("changing tempo keeps the playhead and changes event spacing through a loop wrap", async () => {
    const { processor: p, calls, render } = createProcessor();
    await p.command({ type: "song", song: song([event(.064, 0x90, 60, 100), event(.192, 0x90, 62, 100)]),
        loop: { enabled: true, start: 0, end: .256 } });
    await p.command({ type: "play" });
    render();
    await p.command({ type: "tempo", rate: 2 });
    assert.equal(p.frame, 128);
    render();
    assert.deepEqual(calls.filter(call => call[2] === 0x90).map(call => [call[3], call.at(-1)]), [[60, 64], [62, 160], [60, 224]]);
    assert.equal(p.frame, 128);
    await p.command({ type: "pause" });
    await p.command({ type: "tempo", rate: 1.25 });
    await p.command({ type: "play", resume: true });
    render();
    assert.deepEqual(calls.filter(call => call[2] === 0x90).map(call => call.at(-1)), [64, 160, 224, 308]);
});

test("loop restores controllers before its start, without restarting crossing notes", async () => {
    const { processor: p, calls, render } = createProcessor();
    await p.command({ type: "song", song: song([event(0, 0xc0, 33), event(.05, 0x90, 60, 100), event(.16, 0x90, 64, 100)]), loop: { enabled: true, start: .128, end: .256 } });
    await p.command({ type: "play" }); render(3);
    assert.equal(calls.filter(c => c[0] === "event" && c[2] === 0xc0).length, 3);
    assert.equal(calls.filter(c => c[0] === "event" && c[2] === 0x90 && c[3] === 60).length, 0);
    assert.equal(calls.filter(c => c[0] === "event" && c[2] === 0x90 && c[3] === 64).length, 3);
});

test("the initial pass starts before the restart bar and pause retains the playhead", async () => {
    const { processor: p, calls, render } = createProcessor();
    await p.command({ type: "song", song: song([event(.029, 0x90, 60, 100), event(.19, 0x90, 62, 100)]),
        loop: { enabled: true, start: 0, restart: .128, end: .256 } });
    await p.command({ type: "play" });
    render();
    await p.command({ type: "pause" });
    render();
    assert.equal(p.frame, 128);
    await p.command({ type: "play", resume: true });
    render(3);
    assert.deepEqual(calls.filter(call => call[2] === 0x90).map(call => call[3]), [60, 62, 62, 62]);
});

test("two-bar count-in produces clicks before the first MIDI note", async () => {
    const { processor: p, calls, render } = createProcessor();
    await p.command({ type: "song", song: { ...song([event(0, 0x90, 60, 100)]),
        beatTimes: Array.from({ length: 8 }, (_, index) => ({ seconds: index * .064, beat: index % 4 + 1 })) },
        loop: { enabled: false, start: 0, end: .512 } });
    await p.command({ type: "play", precount: true });
    assert.ok(render()[0].some(value => value !== 0));
    render(3);
    assert.equal(p.frame, 0);
    assert.ok(calls.some(call => call[2] === 0x90 && call[1] === 1 && call[3] === 37));
    assert.ok(!calls.some(call => call[2] === 0x90 && call[1] === 0));
    render();
    assert.ok(calls.some(call => call[2] === 0x90 && call[1] === 0 && call[3] === 60));
});

test("one-bar and automatic count-in respect the starting meter and tempo", async () => {
    const { processor: p } = createProcessor();
    await p.command({ type: "song", song: { ...song([]),
        beatTimes: Array.from({ length: 6 }, (_, index) => ({ seconds: index * .064, beat: index % 3 + 1 })) },
        loop: { enabled: false, start: 0, end: .512 } });
    for (const [precount, tempo, expected] of [["1", 120, 1], ["auto", 54, 1], ["auto", 55, 2]]) {
        await p.command({ type: "play", precount, tempo });
        assert.equal(p.countBeats, 3);
        assert.equal(p.countFrames, p.countStep * 3 * expected);
    }
});

test("play selection stops at its end with looping disabled", async () => {
    const { processor: p, calls, render } = createProcessor();
    await p.command({ type: "song", song: song([event(.064, 0x90, 60, 100), event(.192, 0x90, 61, 100)]),
        loop: { enabled: false, start: 0, end: .128 } });
    await p.command({ type: "play", startFromSelection: true, stopAtEnd: true });
    render(3);
    assert.equal(p.playing, false);
    assert.ok(calls.some(call => call[2] === 0x90 && call[3] === 60));
    assert.ok(!calls.some(call => call[2] === 0x90 && call[3] === 61));
});

test("external MIDI reflects note timing, drum routing and the setup flag", async () => {
    const { processor: p, sent, render } = createProcessor();
    const parts = [{ ...part, channel: 2 }, { ...part, name: "Drums", drum: true, channel: 4 }];
    await p.command({ type: "song", song: {
        duration: .512, parts,
        events: [event(0, 0xc0, 4), event(.032, 0x90, 60, 100), event(.064, 0x90, 36, 90, 1), event(.096, 0x80, 36, 0, 1)]
    }, loop: { enabled: false, start: 0, end: .512 } });
    await p.command({ type: "mix", parts: [{ ...settings, outputChannel: 5 }, { ...settings, outputChannel: 7 }], master: 1 });
    await p.command({ type: "play", midiOutput: { gmDrums: true, drumMap: [[36, 35]], sendSetup: false, monitor: false } });
    assert.ok(render()[0].every(sample => sample === 0));
    const messages = sent.filter(message => message.type === "midi").flatMap(message => message.messages);
    const notes = messages.filter(({ bytes }) => (bytes[0] & 0xf0) === 0x90 || (bytes[0] & 0xf0) === 0x80);
    assert.equal(JSON.stringify(notes), JSON.stringify([
        { bytes: [0x95, 60, 100], seconds: .032 },
        { bytes: [0x99, 35, 90], seconds: .064 },
        { bytes: [0x89, 35, 0], seconds: .096 }
    ]));
    assert.ok(!messages.some(({ bytes }) => (bytes[0] & 0xf0) === 0xc0));
    await p.command({ type: "midi-disable" });
    assert.ok(render()[0].some(sample => sample > 0));
});

test("live range changes apply at the old boundary, then use the new range", async () => {
    const { processor: p, render } = createProcessor();
    await p.command({ type: "song", song: song([]), loop: { enabled: true, start: 0, end: .256 } });
    await p.command({ type: "play" }); render();
    await p.command({ type: "loop", loop: { enabled: true, start: .256, end: .512 } });
    assert.equal(p.loop.start, 0); render(); assert.equal(p.frame, 256);
    render(); assert.equal(p.loop.start, 256); assert.equal(p.frame, 384);
});

test("disabling a partial loop continues to the song end", async () => {
    const { processor: p, render } = createProcessor();
    await p.command({ type: "song", song: song([]), loop: { enabled: true, start: 0, end: .256 } });
    await p.command({ type: "play" }); render();
    await p.command({ type: "loop", loop: { enabled: false, start: 0, end: .256 } });
    render(3); assert.equal(p.frame, 512);
    render(); assert.equal(p.playing, false);
});

test("mute kills held voices, skips new notes, and still tracks controllers", async () => {
    const { processor: p, calls, render } = createProcessor();
    await p.command({ type: "song", song: song([event(.01, 0x90, 60, 100), event(.15, 0xb0, 10, 0), event(.18, 0x90, 62, 100), event(.3, 0x90, 64, 100)]), loop: { enabled: false, start: 0, end: .512 } });
    await p.command({ type: "play" }); render();
    await p.command({ type: "mix", parts: [{ ...settings, mute: true }], master: 1 }); render();
    await p.command({ type: "mix", parts: [settings], master: 1 }); render();
    assert.equal(calls.filter(c => c[0] === "silence").length, 1);
    assert.ok(calls.some(c => c[0] === "event" && c[2] === 0xb0));
    assert.deepEqual(calls.filter(c => c[0] === "event" && c[2] === 0x90).map(c => c[3]), [60, 64]);
});

test("solo isolates parts, pan reaches the desired side, and settings survive stop", async () => {
    const { processor: p, render } = createProcessor();
    await p.command({ type: "song", song: { ...song([]), parts: [part, { ...part, id: "Piano" }] }, loop: { enabled: true, start: 0, end: .512 } });
    await p.command({ type: "mix", parts: [{ ...settings, solo: true, pan: -1, volume: .5 }, settings], master: 1 });
    assert.equal(p.parts[1].enabled, false);
    await p.command({ type: "play" });
    const output = render(20);
    assert.ok(output[0][100] > 0);
    assert.ok(Math.abs(output[1][100]) < .0001);
    await p.command({ type: "stop" });
    assert.equal(p.parts[0].pan, -1); assert.equal(p.parts[0].volume, .5);
});

test("an instrument change applies immediately, survives looping, and can be restored", async () => {
    const { processor: p, calls, render } = createProcessor();
    await p.command({ type: "song", song: song([event(0, 0xc0, 33)]), loop: { enabled: true, start: .128, end: .256 } });
    await p.command({ type: "play" });
    render();
    await p.command({ type: "mix", parts: [{ ...settings, instrumentChoice: { program: 41 } }], master: 1 });
    render(2);
    await p.command({ type: "mix", parts: [settings], master: 1 });
    assert.deepEqual(calls.filter(call => call[2] === 0xc0).map(call => call[3]), [33, 41, 41, 41, 33]);
});

test("reverb and chorus independently contribute wet audio and honor disabled sends", async () => {
    async function output(values, effects) {
        const { processor: p, render } = createProcessor(48000);
        await p.command({ type: "song", song: song([]), loop: { enabled: false, start: 0, end: .512 } });
        await p.command({ type: "mix", parts: [{ ...settings, ...values }], master: 1 });
        if (effects) await p.command({ type: "effects", effects });
        await p.command({ type: "play" });
        return render(40).map(channel => channel[30]);
    }
    const dry = await output({});
    assert.deepEqual(await output({ reverb: 127, chorus: 127, reverbEnabled: false, chorusEnabled: false }), dry);
    const room = await output({ reverb: 127, reverbEnabled: true });
    const chorus = await output({ chorus: 127, chorusEnabled: true });
    assert.ok(room.every((sample, index) => sample > dry[index]));
    assert.ok(chorus.every((sample, index) => sample > dry[index]));
    assert.notDeepEqual(room, chorus);
    const all = { reverb: 127, chorus: 127, reverbEnabled: true, chorusEnabled: true };
    assert.deepEqual(await output(all, { gain: 1, reverb: 0, chorus: 0 }), dry);
    assert.deepEqual(await output(all, { gain: 1, reverb: 0, chorus: 1 }), chorus);
    const softer = await output({}, { gain: .5, reverb: 1, chorus: 1 });
    assert.ok(softer.every((sample, index) => Math.abs(sample - dry[index] / 2) < .000001));
});

test("external patch mappings send bank and program changes without changing the internal synth", async () => {
    const { processor: p, sent, calls, render } = createProcessor();
    await p.command({ type: "song",
        song: song([event(.05, 0xc0, 33), event(.06, 0x90, 60, 90)]),
        loop: { enabled: false, start: 0, end: .512 } });
    await p.command({ type: "play", midiOutput: { sendSetup: true, patchMap: [[33, 8, 7, 42]] } });
    render();
    const messages = sent.filter(message => message.type === "midi").flatMap(message => Array.from(message.messages, item => Array.from(item.bytes)));
    const preset = messages.findIndex(bytes => bytes.join() === "192,42");
    assert.deepEqual(messages.slice(preset - 2, preset + 1), [[176, 0, 8], [176, 32, 7], [192, 42]]);
    assert.ok(calls.some(call => call[2] === 0xc0 && call[3] === 33));
});

const wasmPath = path.resolve(__dirname, "../target/synth.wasm");
const sfPath = process.env.SOUNDFONT_TEST_SF2 || path.resolve(__dirname, "../../../WSL_image/TimGM6mb.sf2");
test("the real Worklet command path initializes Wasm and renders finite stereo samples", {
    skip: !fs.existsSync(wasmPath) || !fs.existsSync(sfPath) ? "Requires built Wasm and test SF2" : false
}, async () => {
    const { processor: p, sent, render } = createProcessor(48000);
    const wasm = fs.readFileSync(wasmPath);
    const sf = fs.readFileSync(sfPath);
    await p.command({ id: 1, type: "init", wasm, soundfont: sf.buffer.slice(sf.byteOffset, sf.byteOffset + sf.byteLength) });
    assert.equal(sent.at(-1).ok, true, sent.at(-1).error);
    await p.command({ id: 2, type: "song", song: song([event(0, 0xc0, 33), event(0, 0x90, 60, 100)]), loop: { enabled: true, start: 0, end: .512 } });
    assert.equal(sent.at(-1).ok, true, sent.at(-1).error);
    await p.command({ type: "play" });
    const output = render(10);
    assert.ok(output.flatMap(a => Array.from(a)).every(Number.isFinite));
    assert.ok(output[0].some(x => Math.abs(x) > .00001));
});
