const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

test("the audio worklet plays the selected click notes during a two-bar 4/4 count and the song", async () => {
    let Processor;
    const responses = [];
    runInNewContext(readFileSync(path.join(__dirname, "../../engine/demo/synth-worklet.js"), "utf8"), {
        sampleRate: 1000,
        AudioWorkletProcessor: class { constructor() { this.port = { postMessage: response => responses.push(response) }; } },
        registerProcessor: (name, constructor) => { Processor = constructor; }
    });
    const worklet = new Processor();
    const hits = [];
    let isSounding = false, part = 0;
    worklet.pcm = new Float32Array(256);
    worklet.api = {
        synth_clear_parts: () => { part = 0; },
        synth_part: () => part++,
        synth_reset: () => { isSounding = false; },
        synth_silence: () => { isSounding = false; },
        synth_event: (channel, type, pitch, velocity) => {
            if (type === 0x90) { hits.push([channel, pitch, velocity]); isSounding = true; }
            if (type === 0x80) isSounding = false;
        },
        synth_render: () => { worklet.pcm.fill(isSounding ? .1 : 0); return 0; }
    };
    await worklet.command({ type: "song", song: {
        duration: .4, parts: [], events: [],
        beatTimes: Array.from({ length: 4 }, (_, i) => ({ seconds: i / 10, beat: i + 1 }))
    }, loop: { enabled: false, start: 0, end: .4 } });
    await worklet.command({ type: "play", click: true, precount: "2",
        clickSettings: { highPitch: 56, lowPitch: 75, highVelocity: 110, lowVelocity: 40, channel: 9, program: 0 } });
    let hadAudio = false;
    for (let block = 0; block < 10; block++) {
        const output = [new Float32Array(128), new Float32Array(128)];
        worklet.process([], [output]);
        hadAudio ||= output[0].some(sample => sample > 0);
    }
    assert.deepEqual(hits, [
        [0, 56, 110], [0, 75, 10], [0, 56, 110], [0, 75, 10],
        [0, 56, 110], [0, 75, 40], [0, 75, 40], [0, 75, 40],
        [0, 56, 110], [0, 75, 40], [0, 75, 40], [0, 75, 40]
    ]);
    assert.ok(hadAudio);
    assert.ok(responses.every(message => !message.error));
});
