/* Exercises the desktop YamJJazz loader and the editor through the packaged HTML. */
(async () => {
    const report = { bundled: [], songs: [] };
    const check = (condition, message) => { if (!condition) throw new Error(message); };

    async function generate(shouldSucceed = true) {
        form.requestSubmit();
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(shouldSucceed ? song && !status.hasAttribute("data-error") : status.hasAttribute("data-error"), status.textContent);
    }

    function selectFiles(files) {
        const selection = new DataTransfer();
        for (const file of files) selection.items.add(file);
        styleInput.files = selection.files;
        styleInput.dispatchEvent(new Event("change"));
    }

    async function openSong(name, songText, mixText) {
        const selection = new DataTransfer();
        selection.items.add(new File([songText], `${name}.sng`));
        if (mixText) selection.items.add(new File([mixText], `${name}.mix`));
        const input = document.querySelector("#open-project");
        input.files = selection.files;
        await editor.openFiles(input);
    }

    try {
        bundledExtension.value = "SambaCity213.s460.yjz";
        bundledExtension.dispatchEvent(new Event("change"));
        await generate();
        check(!extendedVariationField.hidden, "The extended-style variation selector is hidden");
        for (const name of Object.keys(embeddedExtendedStyles)) {
            const style = await readBundledExtendedStyle(name);
            const descriptor = describeStyle(style);
            const baseVariations = Array.from(engine.exports.getYamahaStyleInfo(style.bytes, style.baseName)).slice(1);
            const additional = descriptor.variations.filter(variation => !baseVariations.includes(variation));
            check(additional.length > 0, `${name}: extension did not add variations`);
            for (const variation of descriptor.variations) {
                const midi = engine.exports.generateExtendedMidi(style.bytes, style.baseName, style.extension, name,
                    ["Cmaj7", "Am7", "Dm7", "G7"], 120, variation);
                const parsed = parseMidi(midi, 4, engine.exports.getPartMetadata());
                check(parsed.events.some(event => event.type === 0x90 && event.b > 0), `${name} ${variation} generated no notes`);
            }
            report.bundled.push({ name, meter: descriptor.meter, variations: descriptor.variations.length, additional: additional.length });
        }
        const samba = await readBundledExtendedStyle("SambaCity213.s460.yjz");
        const standard = new File([samba.bytes], "Custom.STY");
        const extension = new File([samba.extension], "custom.yjz");
        selectFiles([extension]);
        await generate(false);
        check(status.textContent.includes("元スタイル"), "A missing base style did not get a pairing error");
        selectFiles([extension, new File([samba.bytes], "Other.sty")]);
        await generate(false);
        check(status.textContent.includes("元スタイル"), "An unrelated base was accepted");
        selectFiles([standard, new File(["broken"], extension.name)]);
        await generate(false);
        selectFiles([standard, extension]);
        await generate();
        check(extendedVariation.dataset.style === extension.name, "The uploaded pair was not used");

        document.querySelector("#new-project").click();
        rhythmEngine.value = "yamaha";
        rhythmEngine.dispatchEvent(new Event("change"));
        selectFiles([extension, standard]);
        await generate();
        const attached = editor.attachedStyles[0];
        check(attached.name === extension.name && attached.baseName === standard.name && attached.extensionData.length === extension.size,
            "The Web project did not retain the uploaded pair");
        const webProject = JSON.stringify({ version: 1, song: editor.project, style: editor.attachedStyles, mix: editor.renderedMix });
        const webFile = new DataTransfer();
        webFile.items.add(new File([webProject], "custom.jjazzweb"));
        const input = document.querySelector("#open-project");
        input.files = webFile.files;
        await editor.openFiles(input);
        await generate();
        check(editor.project.parts[0].styleId === "custom.yjz-ID", "Reopening the Web project lost the extension");
        let download;
        const originalDownload = downloadSongFile;
        downloadSongFile = (name, data) => { download = { name, data }; };
        try { editor.export(); } finally { downloadSongFile = originalDownload; }
        const zipText = new TextDecoder().decode(await download.data.arrayBuffer());
        check(zipText.includes("styles/custom.sty") && zipText.includes("styles/custom.yjz"), "Desktop export did not preserve a usable style pair");
        report.uploadAndSave = true;

        for (const fixture of yjzFixtures) {
            const original = DesktopSongFiles.readSong(fixture.song);
            await openSong(fixture.name, fixture.song);
            await generate();
            check(original.parts.map(part => part.styleId).join() === editor.project.parts.map(part => part.styleId).join(),
                `${fixture.name}: the original extended/adapted style IDs were not retained`);
            check(original.parts.every((part, index) => part.parameters.rpVariationID === editor.project.parts[index].parameters.rpVariationID),
                `${fixture.name}: original YamJJazz variations were changed`);
            const readBack = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
            check(readBack.chords.filter(chord => chord.name === "NC").length === original.chords.filter(chord => chord.name === "NC").length,
                `${fixture.name}: no-chord markers were lost on export`);
            const summary = { name: fixture.name, bars: song.barTimes.length - 1,
                meters: [...new Set(song.meterChanges.map(({ numerator, denominator }) => `${numerator}/${denominator}`))] };
            if (fixture.name === "across-the-universe") {
                const short = DesktopSongFiles.barBeats(editor.project).flatMap((beats, bar) => beats === 2 ? [bar + 1] : []);
                check(summary.bars === 61 && short.join() === "10,44" && summary.meters.join() === "4/4,2/4", "The adapted YamJJazz bars are wrong");
                loopStart.value = 9; loopEnd.value = 11; loopEnabled.checked = true;
                const loop = readLoop();
                await player.initialize(showPlayStatus);
                const positions = [];
                const previousPosition = player.onPosition;
                player.onPosition = data => { if (data.playing) positions.push(data.seconds); previousPosition(data); };
                try {
                    await player.play(song, loop, mixerParts, 0.8);
                    for (let i = 0; i < 260 && !positions.some((value, index) => index && value < positions[index - 1]); i++) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    const wrap = positions.findIndex((value, index) => index && value < positions[index - 1]);
                    check(wrap > 0 && Math.abs(positions[wrap] - loop.start) < 0.25, "The mixed-meter YamJJazz loop did not wrap");
                    check(positions.some(seconds => seconds >= song.barTimes[9] && seconds < song.barTimes[10]), "The loop skipped its 2/4 bar");
                    summary.loopBars = [9, 11];
                } finally { player.onPosition = previousPosition; await player.stop(); }
            }
            report.songs.push(summary);
        }
        if (yjzFixtures.length) {
            const casa = DesktopSongFiles.readSong(yjzFixtures[0].song);
            for (const alternate of [{ id: "8Beat.T160.STY-ID", name: "8Beat.T160.STY" }, { id: "jjSwing-ID", name: "jjSwing" }]) {
                const [first, second] = casa.parts;
                const combined = { ...casa, parts: [first, { ...second, styleId: alternate.id, styleName: alternate.name,
                    parameters: { rpVariationID: "Main B-1" } }] };
                const xml = DesktopSongFiles.writeSong(combined);
                await openSong("combined", xml);
                await generate();
                const styles = [...new Set(song.parts.map(part => part.styleId).filter(Boolean))];
                check(styles.includes(first.styleId) && styles.includes(alternate.id), `No notes/tracks for both styles: ${styles}`);
                await openSong("combined", xml, DesktopSongFiles.writeMix(editor.renderedMix));
                await generate();
                check(engine.exports.wasImportedMixApplied(), `Mix did not survive the .yjz and ${alternate.name} arrangement`);
                (report.combinations ??= []).push(alternate.name);
            }
        }
        report.ok = true;
    } catch (error) { report.ok = false; report.error = error.stack || error.message; }
    console.log("JJAZZ_SMOKE_RESULT=" + JSON.stringify(report));
})();
