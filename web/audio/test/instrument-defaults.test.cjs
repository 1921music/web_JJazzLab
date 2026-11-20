const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

test("per-instrument mappings take precedence over family mappings and leave project patches intact", () => {
    const source = readFileSync(path.join(__dirname, "../../engine/demo/instrument-defaults.js"), "utf8");
    const InstrumentDefaults = runInNewContext(source + "\nInstrumentDefaults;");
    const defaults = Object.create(InstrumentDefaults.prototype);
    const violin = { id: "violin", program: 40, drum: false };
    const cello = { id: "cello", program: 42, drum: false };
    const drums = { id: "kit", program: 8, drum: true };
    defaults.instruments = () => [violin, cello, drums];
    defaults.mappings = new Map([["family:5", violin.id], ["program:41", cello.id], ["drums", drums.id]]);
    const viola = { name: "Viola", program: 41, drum: false };
    const [mapped] = defaults.playbackMix([viola]);
    assert.equal(mapped.instrumentChoice, cello);
    assert.equal(viola.instrumentChoice, undefined);
    assert.equal(defaults.chosen({ ...viola, instrumentChoice: violin }), violin);
    assert.equal(defaults.chosen({ ...viola, program: 43 }), violin);
    assert.equal(defaults.chosen({ name: "Drums", program: 0, drum: true }), drums);
    assert.equal(defaults.chosen({ name: "Percussion", program: 0, drum: true }), undefined);
});
