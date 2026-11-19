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

test("loop restores controllers before its start, without restarting crossing notes", async () => {
    const { processor: p, calls, render } = createProcessor();
    await p.command({ type: "song", song: song([event(0, 0xc0, 33), event(.05, 0x90, 60, 100), event(.16, 0x90, 64, 100)]), loop: { enabled: true, start: .128, end: .256 } });
    await p.command({ type: "play" }); render(3);
    assert.equal(calls.filter(c => c[0] === "event" && c[2] === 0xc0).length, 3);
    assert.equal(calls.filter(c => c[0] === "event" && c[2] === 0x90 && c[3] === 60).length, 0);
    assert.equal(calls.filter(c => c[0] === "event" && c[2] === 0x90 && c[3] === 64).length, 3);
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
