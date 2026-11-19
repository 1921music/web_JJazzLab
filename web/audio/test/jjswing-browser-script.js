/* Injected into the packaged file:// demo by browser-smoke.cjs. */
(async () => {
    const report = { protocol: location.protocol, cases: [] };
    const check = (value, message) => { if (!value) throw new Error(message); };
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const until = async (predicate, label) => {
        for (let i = 0; i < 600; i++) { if (predicate()) return; await pause(100); }
        throw new Error("Timed out: " + label + " / " + status.textContent + " / " + playStatus.textContent);
    };
    try {
        console.log("JJAZZ_SWING_STAGE=initial-generation");
        check(location.protocol === "file:", "Expected a file:// page");
        rhythmEngine.value = "jjswing"; rhythmEngine.dispatchEvent(new Event("change", { bubbles: true }));
        check(styleInput.disabled && !document.querySelector("#swing-settings").hidden, "Rhythm selection UI failed");
        tempoInput.value = 120;
        chordInput.value = "Cmaj7 | Am7 | Dm7 | G7 | Em7 | A7 | Dm7 | G7";
        form.requestSubmit();
        await until(() => !generating, "initial jjSwing generation");
        check(song && !status.hasAttribute("data-error"), status.textContent);
        report.parts = song.parts;
        console.log("JJAZZ_SWING_STAGE=first-playback");
        report.firstPrograms = song.events.filter(e => e.type === 0xc0).map(e => [song.parts[e.part].name, e.a]);
        let sfBytes, downloads = 0;
        const nativeFetch = globalThis.fetch;
        globalThis.fetch = async (...args) => {
            const response = await nativeFetch(...args);
            if (String(args[0]).includes("TimGM6mb.sf2")) { downloads++; sfBytes = await response.clone().arrayBuffer(); }
            return response;
        };
        loopStart.value = 2; loopEnd.value = 2;
        loopStart.dispatchEvent(new Event("input", { bubbles: true }));
        const positions = [];
        const previousPosition = player.onPosition;
        player.onPosition = data => { if (data.playing) positions.push(data.seconds); previousPosition(data); };
        playButton.click(); await until(() => playing || (!starting && playStatus.hasAttribute("data-error")), "jjSwing playback");
        check(playing, playStatus.textContent);
        const analyser = player.context.createAnalyser(); analyser.fftSize = 2048;
        player.compressor.connect(analyser);
        const samples = new Float32Array(2048);
        let peak = 0;
        for (let i = 0; i < 20; i++) { await pause(50); analyser.getFloatTimeDomainData(samples); peak = Math.max(peak, ...samples.map(Math.abs)); }
        check(peak > .00001, "jjSwing output is silent"); report.peak = peak;
        await pause(1300);
        check(positions.length > 3 && positions.every(time => time >= song.barTimes[1] && time <= song.barTimes[2]), "jjSwing loop escaped its bar");
        report.loopPositions = positions.length;
        document.querySelector(".strip button").click();
        const pan = document.querySelector("#pan-0"); pan.value = -30; pan.dispatchEvent(new Event("input"));
        check(mixerParts[0].mute && mixerParts[0].pan === -.3, "jjSwing mixer did not update");
        await player.stop(); await until(() => !playing, "stop");
        form.requestSubmit(); await until(() => !generating, "jjSwing mixer persistence");
        check(mixerParts[0].mute && mixerParts[0].pan === -.3, "jjSwing regeneration lost mixer settings");
        document.querySelector("#reset-mixer").click();

        // Load the identical pinned SF2 through the real TinySoundFont Wasm,
        // independently of the live Worklet, to inspect every generated note.
        const { instance } = await WebAssembly.instantiate(await decompress(embeddedSynth));
        const api = instance.exports; api._initialize();
        const pointer = api.malloc(sfBytes.byteLength);
        new Uint8Array(api.memory.buffer, pointer, sfBytes.byteLength).set(new Uint8Array(sfBytes));
        check(api.synth_load(pointer, sfBytes.byteLength, 48000), "Compatibility SF2 load failed"); api.free(pointer);
        const presets = new Set(), unsupported = new Set(), rendered = new Set();
        api.synth_part(0); api.synth_part(1);
        const cases = Array.from(swingDrums.options).filter(option => option.value !== "auto").map(option => ({ drums: option.value, bass: "walking", tempo: 120 }));
        console.log("JJAZZ_SWING_STAGE=compatibility-cases");
        for (const tempo of [60, 240]) for (const drums of ["brushes 1", "ride 1", "shuffle 1"]) cases.push({ drums, bass: "walking", tempo });
        for (const bass of ["2-feel", "double-note", "double-time"]) cases.push({ drums: bass === "double-time" ? "double 1" : "brushes 1", bass, tempo: 120 });
        const variations = Array.from(engine.exports.getSwingVariations());
        check(variations.length === 17 && JSON.stringify(variations) === JSON.stringify(Array.from(swingVariation.options, o => o.value)), "Variation UI and engine disagree");
        for (const variation of variations) cases.push({ variation, drums: "auto", bass: "auto", tempo: 120 });
        cases.push({ variation: "Main E-2", drums: "brushes 1", bass: "2-feel", tempo: 120 });
        for (const test of cases) {
            swingVariation.value = test.variation || "Main A-1";
            swingBass.value = test.bass; swingDrums.value = test.drums; tempoInput.value = test.tempo;
            form.requestSubmit(); await until(() => !generating, JSON.stringify(test));
            check(song && !status.hasAttribute("data-error"), "Generation failed: " + JSON.stringify(test) + " / " + status.textContent);
            const program = song.parts.map(() => 0);
            let notes = 0;
            for (const event of song.events) {
                if (event.type === 0xc0) program[event.part] = event.a;
                if (event.type !== 0x90 || !event.b) continue;
                notes++;
                const drum = song.parts[event.part].drum;
                const bank = drum ? 128 : 0, pc = program[event.part];
                const key = `${bank}/${pc}/${event.a}`;
                presets.add(`${bank}/${pc}`);
                if (!api.synth_note_supported(bank, pc, event.a, event.b)) { unsupported.add(key); continue; }
                if (!rendered.has(key)) {
                    const part = Number(drum);
                    api.synth_reset(part); api.synth_event(part, 0xc0, pc, 0); api.synth_event(part, 0x90, event.a, event.b);
                    let power = 0;
                    for (let block = 0; block < 24; block++) {
                        const start = api.synth_render(128) / 4 + part * 256;
                        const audio = new Float32Array(api.memory.buffer, start * 4, 256);
                        for (const sample of audio) { check(Number.isFinite(sample), "Invalid PCM: " + key); power += sample * sample; }
                    }
                    check(power > 1e-12, "Silent SF2 region: " + key); rendered.add(key);
                }
            }
            check(notes > 0, "Empty accompaniment");
            const midi = new Uint8Array(await (await nativeFetch(download.href)).arrayBuffer());
            const exported = parseMidi(midi, 8);
            check(exported.parts.filter(p => p.drum).every(p => p.channel === 9), "Export percussion is not channel 10");
            const bassPart = song.parts.findIndex(p => p.name === "Bass");
            const bassNotes = song.events.filter(e => e.part === bassPart && e.type === 0x90 && e.b).length;
            report.cases.push({ ...test, notes, bassNotes, seconds: song.duration });
            await pause(0);
        }
        report.presets = [...presets]; report.unsupported = [...unsupported]; report.audibleNotes = rendered.size;
        check(!unsupported.size, "TimGM6mb does not contain: " + [...unsupported].join(", "));
        check(report.cases.find(c => c.bass === "double-time").bassNotes > report.cases[0].bassNotes, "Double-time did not increase bass density");
        const automatic = variation => report.cases.find(c => c.variation === variation && c.bass === "auto");
        check(automatic("Main E-2").bassNotes > automatic("Main A-1").bassNotes, "Auto bass ignored the selected variation");
        check(report.cases.at(-1).bassNotes < automatic("Main E-2").bassNotes, "Manual bass override was ignored");
        let rejected = false;
        try { engine.exports.generateSwingMidiWithVariation(["C"], 120, "Invalid", "auto", "auto"); } catch { rejected = true; }
        check(rejected, "Invalid variations must be rejected");
        check(downloads === 1, "jjSwing regeneration downloaded SF2 again");
        chordInput.value = "NotAChord";
        console.log("JJAZZ_SWING_STAGE=invalid-chord-recovery");
        form.requestSubmit(); await until(() => !generating, "invalid chord handling");
        check(status.hasAttribute("data-error") && status.textContent.includes("コード表記"), "Invalid chords need a useful error");
        chordInput.value = "Cmaj7 | Am7 | Dm7 | G7";
        form.requestSubmit(); await until(() => !generating, "recovery after invalid chord");
        check(song && !status.hasAttribute("data-error"), "Generation did not recover after an invalid chord");
        report.downloads = downloads; report.ok = true;
    } catch (error) { report.ok = false; report.error = error.stack || error.message; }
    console.log("JJAZZ_SMOKE_RESULT=" + JSON.stringify(report));
})();
