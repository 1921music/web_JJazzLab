# jjSwing with TinySoundFont and TimGM6mb

The Web engine uses the original jjSwing walking-bass and drum generators,
including the bundled phrase databases and tempo-dependent swing adjustments.
The UI exposes all 17 jjSwing variations (ten Main A–E variations, five fills,
Intro and Ending), applied to the whole progression. Auto bass/drums follow the
selected variation; four bass styles and eleven drum styles can also be chosen
manually. The engine supports 4/4 only.

## Presets

The SF2 revision/hash is pinned in `vendor/TimGM6mb-LICENSE.txt`. Program numbers
below are zero-based, as they are in MIDI messages and TinySoundFont.

| Part | SF2 bank | Program | TimGM6mb preset |
| --- | ---: | ---: | --- |
| Rhythm | 128 | 40 | Brush |
| Bass | 0 | 32 | Acoustic Bass |
| Chord1 | 0 | 0 | Piano 1 |
| Chord2 | 0 | 26 | Jazz Guitar |
| Phrase1 | 0 | 73 | Flute TB |

Initial part levels/pans follow the upstream jjSwing mix. Browser controls still
multiply/offset them. TinySoundFont does not implement reverb/chorus sends, so
this is not identical to desktop FluidSynth.

## XG articulations

jjSwing's source MIDI uses JJazzLab SoundFont's XG layout. Actual TimGM6mb SF2
regions have no samples for keys 25/26; keys 27..34 contain GS-like effects
including Filter Snap, Noise Slap and Met Click. Selecting Brush alone leaves
silent or incorrect articulations.

`WebJJSwing.adaptDrumNotes` rewrites only jjSwing drum tracks after generation
and tempo/accent processing. Matching Note On, Note Off (including velocity-zero
Note On), and polyphonic pressure are changed together. Timing, duration and
velocity are retained. Downloaded MIDI contains the same compatible notes.
Yamaha input files are unaffected.

| XG key / articulation | TimGM6mb key | Approximation |
| --- | ---: | --- |
| 25 Brush Tap | 38 | Brush Snare |
| 26 Brush Swirl Low | 40 | Sweep noise (sample named Ocean Wave) |
| 27 Brush Slap | 39 | Brush Snare variation |
| 28 Brush Tap Swirl | 40 | Sweep noise |
| 29 Snare Roll; 31 Snare Soft | 38 | Brush Snare; no equivalent roll sample |
| 30 Castanets | 85 | Castanets |
| 32 Stick | 31 | Drum Stick |
| 33 Kick Soft | 36 | Bass drum |
| 34 Rim Shot Open | 37 | Rim shot |

These are practical substitutions, not exact reproductions of the JJazzLab
SoundFont articulations. The UI identifies the sounds as approximate.

## Validation

The engine build runs Java tests for the mapping and matching note ends,
preserving timing/controllers. `node --test web/audio/test/*.test.cjs` checks
real SF2 region coverage and finite, nonzero PCM across the melodic presets and
compatible drum keys at several velocities. The real-Wasm checks require the
built Wasm and pinned SF2 as documented in README.md.

In PowerShell, set `$env:JJAZZ_SMOKE_SUITE='jjswing'`, then run
`node web/audio/test/browser-smoke.cjs WSL_image/midi-demo.html`.
The isolated headless Chrome test uses file://, the real SF2 download and actual
AudioWorklet playback. Thirty-eight cases cover all eleven drum styles, four bass
styles, tempos 60/120/240 BPM, all 17 variations with Auto bass/drums, and a
manual override on Main E-2. The test verifies the exported variation list matches
the UI, rejects unknown variations, and checks that Auto and manual overrides
change bass density. Every generated note is checked against the
actual velocity layers, and every distinct preset/key pair is rendered. The
test also checks looping, mixer persistence, MIDI export and SF2 reuse.

Run the browser smoke test with JJAZZ_SMOKE_SUITE unset for the Yamaha path.
These checks establish generation, sample coverage and audible output; they do
not establish subjective equality with the desktop sound. Chrome is verified;
Edge automated launch was unavailable in the development environment.
