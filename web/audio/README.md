# Browser SoundFont synthesizer

TinySoundFont is vendored unmodified at commit
`a3621a19c6504885cd9583e6e26c35bc954fc8ec` from
https://github.com/schellingb/TinySoundFont (MIT).

`synth.c` is our adapter. Emscripten builds a standalone Wasm module, with
64 MiB of fixed memory and no filesystem, shared memory, pthreads or JS loader.
The HTML embeds this module and the AudioWorklet source (registered with a data
URL because Chrome rejects `blob:null` worklet modules from `file://`). Only the SF2 is fetched
on the first play action, using a pinned pretty-midi revision. There is no
persistent application cache; normal HTTP caching may avoid later transfers.
SoundFont provenance and license are in `vendor/TimGM6mb-LICENSE.txt`.

Each track/channel pair receives a separate synthesizer sharing the loaded
SoundFont samples. This also keeps two drum parts independent when both use
MIDI channel 10. Each part preallocates 96 synthesis voices (a note can use
multiple voices), with a maximum of 32 parts. The adapter's reset uses internal
TinySoundFont voice fields to avoid allocations and to cut notes at transport
boundaries; review this when updating the vendored header.

MIDI controller volume/expression and pan remain in the synth. The mixer
multiplies the rendered output and applies additional stereo pan; center pan
preserves the original stereo image. Muting kills existing voices and skips
new Note Ons while continuing to apply controllers and Note Offs. Unmuting
waits for the next Note On. Controls are smoothed; a master compressor catches
peaks. No per-part effects or SF2 modulators/reverb/chorus are implemented.

The demo's MIDI download uses `exportGmMidi` to route percussion to GM channel
10. Playback retains the original MIDI and independent drum parts. Downloaded
tracks remain separate, but their channel-level settings are shared: the
original channel-10 rhythm owns CC/program/pitch/channel-pressure settings
(or the first drum part if no drum part uses channel 10). Secondary drum tracks
contribute notes and polyphonic key pressure, without overriding those settings.
Original note timing and velocities are preserved; separate drum volume/pan and
browser mixer settings are not baked into the downloaded file.

Build with `bash web/audio/build.sh` in the repository's dedicated WSL distro
(Emscripten is installed by `scripts/wsl-dev.ps1`). The standard
`scripts/wsl-build.ps1 -Engine` builds both engines and packages the HTML under
the existing CPU/memory limits. Generated binaries stay in ignored `target/`.

Run the JavaScript tests with `node --test web/audio/test/*.test.cjs`.
The real-Wasm test additionally requires the built `target/synth.wasm` and the
pinned SF2 at `WSL_image/TimGM6mb.sf2` or `SOUNDFONT_TEST_SF2`; it reports a skip
when these are absent.

For a packaged browser integration check, run
`node web/audio/test/browser-smoke.cjs WSL_image/midi-demo.html`.
This launches an isolated headless Chrome (override `CHROME_BIN` as needed),
uses the real HTTPS download with normal CORS checks, verifies nonzero Web
Audio output, and exercises retry, looping and mixer controls through page
code. Its autoplay flag is specific to the automated test; the normal HTML
resumes audio from a user click. Test profiles/logs remain next to the HTML.
After a full engine build, `scripts/wsl-build.ps1 -DemoOnly` rebuilds just the
audio Wasm and HTML using the cached Java engine, under the same limits.
