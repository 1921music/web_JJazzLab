const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync(path.join(__dirname, "../../engine/demo/midi-remote.js"), "utf8");

test("MIDI Learn assigns a pedal, and only a fresh press triggers the assigned action", () => {
    const MidiRemote = runInNewContext(source + "\nMidiRemote;", { t: (ja, en) => en });
    const remote = Object.create(MidiRemote.prototype);
    const played = [];
    let stored;
    Object.assign(remote, {
        actions: ["play", "stop", "loop"].map(id => ({ id, run: () => played.push(id) })),
        bindings: { play: "note:0:24", stop: "cc:3:64", loop: "program:1:8" },
        controllers: new Map(), dialog: { open: true }, enabled: { checked: true },
        render() {}, show() {}, store() { stored = { ...this.bindings }; }, learning: "loop"
    });
    const receive = (...data) => remote.receive(Uint8Array.from(data));
    receive(0xb3, 64, 127);
    assert.deepEqual(stored, { play: "note:0:24", stop: null, loop: "cc:3:64" });
    remote.dialog.open = false;
    receive(0xb3, 64, 100);
    receive(0xb3, 64, 0);
    receive(0xb3, 64, 127);
    receive(0x80, 24, 100);
    receive(0x90, 24, 0);
    receive(0x91, 24, 100);
    receive(0x90, 24, 60);
    remote.enabled.checked = false;
    receive(0x90, 24, 100);
    assert.deepEqual(played, ["loop", "play"]);
});
