const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const wasmPath = path.resolve(__dirname, "../target/synth.wasm");
const sfPath = process.env.SOUNDFONT_TEST_SF2 || path.resolve(__dirname, "../../../WSL_image/TimGM6mb.sf2");

test("real Wasm synthesizes melodic and percussion parts, shares samples and resets cleanly", {
    skip: !fs.existsSync(wasmPath) || !fs.existsSync(sfPath) ? "Build synth.wasm and provide SOUNDFONT_TEST_SF2 for audio integration checks" : false
}, async () => {
    const module = await WebAssembly.compile(fs.readFileSync(wasmPath));
    assert.deepEqual(WebAssembly.Module.imports(module), []);
    const { exports: api } = await WebAssembly.instantiate(module);
    api._initialize();
    const sf = fs.readFileSync(sfPath);
    assert.equal(crypto.createHash("sha256").update(sf).digest("hex"), "82475b91a76de15cb28a104707d3247ba932e228bada3f47bba63c6b31aaf7a1");
    const pointer = api.malloc(sf.length);
    new Uint8Array(api.memory.buffer, pointer, sf.length).set(sf);
    assert.equal(api.synth_load(pointer, sf.length, 48000), 1); api.free(pointer);
    assert.equal(api.synth_part(0), 0); assert.equal(api.synth_part(1), 1);
    const pcm = new Float32Array(api.memory.buffer);
    const render = () => { const start = api.synth_render(128) / 4; return pcm.slice(start, start + 512); };
    const power = a => a.reduce((n, x) => n + x * x, 0);
    api.synth_event(0, 0xc0, 33, 0); api.synth_event(0, 0x90, 60, 100); api.synth_event(1, 0x90, 36, 100);
    const audio = render();
    assert.ok(power(audio.subarray(0, 256)) > 0);
    assert.ok(power(audio.subarray(256)) > 0);
    assert.ok(audio.every(Number.isFinite));
    api.synth_silence(0);
    const muted = render();
    assert.equal(power(muted.subarray(0, 256)), 0);
    assert.ok(power(muted.subarray(256)) > 0);
    for (let i = 0; i < 500; i++) { api.synth_reset(0); api.synth_event(0, 0x90, 60, 100); render(); }
    api.synth_reset(0); api.synth_reset(1);
    assert.equal(power(render()), 0);
    // Copies share the SF2; adding all 32 parts fits the same fixed 64 MiB memory.
    for (let i = 2; i < 32; i++) assert.equal(api.synth_part(i % 2), i);
    assert.equal(api.synth_part(0), -1);
    assert.equal(api.memory.buffer.byteLength, 64 * 1024 * 1024);
});

test("TimGM6mb contains jjSwing melodic presets and audible compatible Brush-kit notes", {
    skip: !fs.existsSync(wasmPath) || !fs.existsSync(sfPath) ? "Requires built Wasm and pinned SF2" : false
}, async () => {
    const { exports: api } = await WebAssembly.instantiate(new WebAssembly.Module(fs.readFileSync(wasmPath)));
    api._initialize();
    const sf = fs.readFileSync(sfPath), pointer = api.malloc(sf.length);
    new Uint8Array(api.memory.buffer, pointer, sf.length).set(sf);
    assert.equal(api.synth_load(pointer, sf.length, 48000), 1); api.free(pointer);
    api.synth_part(0); api.synth_part(1);
    const pcm = new Float32Array(api.memory.buffer);
    const audible = (part, program, key, velocity) => {
        api.synth_reset(part); api.synth_event(part, 0xc0, program, 0); api.synth_event(part, 0x90, key, velocity);
        let power = 0;
        for (let block = 0; block < 24; block++) {
            const start = api.synth_render(128) / 4 + part * 256;
            for (let i = 0; i < 256; i++) { const sample = pcm[start + i]; assert.ok(Number.isFinite(sample)); power += sample * sample; }
        }
        assert.ok(power > 1e-12, `Silent part=${part} program=${program} key=${key} velocity=${velocity}`);
    };
    for (const program of [0, 26, 32, 73]) for (const key of [28, 36, 48, 60, 72]) {
        assert.equal(api.synth_note_supported(0, program, key, 64), 1);
        audible(0, program, key, 64);
    }
    assert.equal(api.synth_note_supported(128, 40, 25, 90), 0, "Original XG Brush Tap is absent");
    assert.equal(api.synth_note_supported(128, 40, 26, 90), 0, "Original XG Brush Swirl is absent");
    for (const key of [31, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 55, 57, 59, 85]) {
        for (const velocity of [30, 90, 120]) {
            assert.equal(api.synth_note_supported(128, 40, key, velocity), 1, `Missing drum key ${key}`);
            audible(1, 40, key, velocity);
        }
    }
});
