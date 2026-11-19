const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseMidi, exportGmMidi } = require("../../engine/demo/midi.js");

const vlq = n => { const a = [n & 127]; while (n >>= 7) a.unshift((n & 127) | 128); return a; };
const be = (n, length) => Array.from({ length }, (_, i) => (n >>> ((length - i - 1) * 8)) & 255);
const track = events => [...Buffer.from("MTrk"), ...be(events.length, 4), ...events];
function smf(tracks, ppq = 480) { return Buffer.from([...Buffer.from("MThd"), 0, 0, 0, 6, 0, 1, ...be(tracks.length, 2), ...be(ppq, 2), ...tracks.flatMap(track)]); }
const end = [0, 255, 47, 0];

test("tempo map and 3/4 bars use musical boundaries rather than the last note", () => {
    const midi = smf([
        [0, 255, 88, 4, 3, 2, 24, 8, 0, 255, 81, 3, 7, 161, 32, ...vlq(1440), 255, 81, 3, 15, 66, 64, ...end],
        [0, 0x90, 60, 100, ...vlq(60), 0x80, 60, 0, ...end]
    ]);
    const result = parseMidi(midi, 2);
    assert.deepEqual(result.barTimes, [0, 1.5, 4.5]);
    assert.equal(result.duration, 4.5);
});

test("running status, Note On velocity zero, and metadata for non-channel-10 percussion", () => {
    const midi = smf([[0, 0x98, 70, 100, ...vlq(480), 70, 0, ...end]]);
    const result = parseMidi(midi, 1, ["drums\tSubRhythm"]);
    assert.equal(result.parts[0].name, "SubRhythm");
    assert.equal(result.parts[0].drum, true);
    assert.equal(result.events[1].b, 0);
    assert.equal(result.events[1].seconds, .5);
});

test("separate drum tracks remain independently addressable", () => {
    const midi = smf([[0, 0x99, 36, 100, ...end], [0, 0x99, 42, 80, ...end]]);
    const result = parseMidi(midi, 1, ["drums\tKick", "drums\tHiHat"]);
    assert.equal(result.parts.length, 2);
    assert.notEqual(result.parts[0].id, result.parts[1].id);
    assert.deepEqual(result.events.map(e => e.part), [0, 1]);
});

test("truncated MIDI and unsupported timing fail with a useful error", () => {
    assert.throws(() => parseMidi(Buffer.from("MThd"), 1), /途中/);
    assert.throws(() => parseMidi(smf([[...end]], 0xe728), 1), /未対応/);
    const midi = smf([[0, 0x90, 60, 100, ...end]]);
    assert.throws(() => parseMidi(midi.subarray(0, midi.length - 2), 1), /途中/);
});

test("GM download routes both percussion tracks to channel 10 without changing browser data", () => {
    const midi = smf([
        [0, 255, 81, 3, 7, 161, 32, ...end],
        [0, 0xb8, 7, 38, 0, 0x98, 70, 60, ...vlq(240), 0x88, 70, 0, ...end],
        [0, 0xb9, 7, 74, 0, 0x99, 35, 80, ...vlq(480), 0x89, 35, 0, ...end],
        [0, 0xca, 33, 0, 0x9a, 36, 100, ...vlq(480), 0x8a, 36, 0, ...end]
    ]);
    const before = Buffer.from(midi);
    const metadata = [null, "drums\tSubRhythm", "drums\tRhythm", "melodic\tBass"];
    const original = parseMidi(midi, 1, metadata);
    const exported = parseMidi(exportGmMidi(midi, metadata), 1, metadata);
    assert.deepEqual(original.parts.map(p => p.channel), [8, 9, 10]);
    assert.deepEqual(exported.parts.map(p => p.channel), [9, 9, 10]);
    assert.deepEqual(midi, before);
    const notes = song => song.events.filter(e => [0x80, 0x90].includes(e.type)).map(({ type, a, b, tick, seconds, part }) => ({ type, a, b, tick, seconds, part }));
    assert.deepEqual(notes(exported), notes(original));
    assert.deepEqual(exported.barTimes, original.barTimes);
    assert.deepEqual(exported.events.filter(e => e.type === 0xc0).map(e => [e.channel, e.a]), [[10, 33]]);
});

test("only the primary rhythm owns shared drum controls, even when secondary controls occur later", () => {
    const midi = smf([
        [0, 0x98, 70, 60, ...vlq(120), 0xb8, 7, 38, 0, 10, 0, 0, 0xc8, 5, 0, 0xe8, 0, 0, 0, 0xd8, 80, ...end],
        [0, 0xb9, 7, 74, 0, 10, 64, 0, 0xc9, 0, 0, 0x99, 35, 80, ...end]
    ]);
    const metadata = ["drums\tSubRhythm", "drums\tRhythm"];
    const result = parseMidi(exportGmMidi(midi, metadata), 1, metadata);
    assert.deepEqual(result.events.filter(e => ![0x80, 0x90, 0xa0].includes(e.type)).map(e => [e.part, e.type, e.a, e.b]), [
        [1, 0xb0, 7, 74], [1, 0xb0, 10, 64], [1, 0xc0, 0, 0]
    ]);
});

test("export preserves running-status timing, metadata, SysEx and track end after dropping controls", () => {
    const name = Buffer.from("Style-SubRhythm-channel9/16");
    const sysex = [0xf0, 3, 0x7e, 0x7f, 0xf7];
    const midi = smf([
        [0, 255, 3, name.length, ...name, 0, 0x98, 70, 60, ...vlq(100), 0xb8, 7, 38, ...vlq(140), 0x98, 70, 0, ...vlq(240), 72, 90, 0, ...sysex, ...vlq(480), 255, 47, 0],
        [0, 0x99, 35, 80, ...end]
    ]);
    const result = exportGmMidi(midi, ["drums\tSubRhythm", "drums\tRhythm"]);
    const parsed = parseMidi(result);
    assert.deepEqual(parsed.events.filter(e => e.part === 0).map(e => [e.tick, e.channel, e.a, e.b]), [[0, 9, 70, 60], [240, 9, 70, 0], [480, 9, 72, 90]]);
    assert.equal(parsed.duration, 2);
    assert.ok(Buffer.from(result).includes(Buffer.from("Style-SubRhythm-channel10/16")));
    assert.ok(Buffer.from(result).includes(Buffer.from(sysex)));
});

test("a single non-channel-10 drum part keeps its own settings; melodic-only MIDI is unchanged", () => {
    const midi = smf([[0, 0xb4, 7, 60, 0, 0x94, 60, 100, ...end]]);
    const metadata = ["drums\tPercussion"];
    const result = parseMidi(exportGmMidi(midi, metadata), 1, metadata);
    assert.ok(result.events.every(e => e.channel === 9));
    assert.equal(result.events[0].a, 7); assert.equal(result.events[0].b, 60);
    assert.deepEqual(Buffer.from(exportGmMidi(midi, ["melodic\tPiano"])), midi);
});
