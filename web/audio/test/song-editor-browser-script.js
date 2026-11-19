/* Injected into the packaged editor by browser-smoke.cjs. */
(async () => {
    const report = {};
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    async function generate() {
        form.requestSubmit();
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(song && !status.hasAttribute("data-error"), status.textContent);
    }
    try {
        document.querySelector("#new-project").click();
        const first = document.querySelector("#lead-sheet input");
        first.value = "Cmaj7 3:G7";
        first.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector("#lead-sheet > div:last-child button:last-child").click();
        document.querySelector("#add-song-part").click();
        document.querySelector("#add-song-part").click();
        const third = document.querySelector("#song-parts > li:nth-child(3) select");
        third.value = "1";
        third.dispatchEvent(new Event("change"));
        document.querySelector("#add-song-part").click();
        const fourth = document.querySelector("#song-parts > li:nth-child(4) select");
        fourth.value = "0";
        fourth.dispatchEvent(new Event("change"));
        await generate();
        check(song.barTimes.length === 11, "AABA with 3-bar A and 1-bar B must produce ten bars");
        check(editor.project.chords[1].beat === 2, "Editing the arrangement lost the second chord");
        check(editor.renderedMix.length > 0, "New song does not have a writable mix");
        document.querySelector("#song-parts > li:nth-child(2) button:last-child").click();
        document.querySelector("#lead-sheet > div:nth-child(2) button:first-child").click();
        check(loopStart.value === "5" && loopEnd.value === "6", "Sheet selection did not use the second A");
        report.newSongBars = song.barTimes.length - 1;

        const open = document.querySelector("#open-project");
        const files = new DataTransfer();
        files.items.add(new File([desktopFixture.song], "fixture.sng"));
        files.items.add(new File([desktopFixture.mix], "fixture.mix"));
        open.files = files.files;
        await editor.openFiles(open);
        check(editor.project.title.startsWith("SpeakNoEvil"), editor.status.textContent);
        await generate();
        check(engine.exports.wasImportedMixApplied(), "The matching desktop mix was not applied");
        check(song.parts.some(part => part.id === "user:User1"), "User MIDI track was not generated");
        check(song.barTimes.length === 139, "Expected 138 bars in the imported arrangement");
        const exportedSong = DesktopSongFiles.writeSong(editor.project);
        const exportedMix = DesktopSongFiles.writeMix(editor.renderedMix);
        const style = new Uint8Array(await decompress(embeddedStyle));
        const zip = packageSongFiles([["fixture.sng", exportedSong], ["fixture.mix", exportedMix], ["styles/test.sty", style]]);
        const zipBytes = await zip.arrayBuffer();
        const contents = new MemoryStyleArchive(zipBytes);
        check((await contents.read(contents.entries[0])).length === style.length, "An attached style cannot be extracted from the exported ZIP");
        const zipText = new TextDecoder().decode(zipBytes);
        check(zipText.includes("fixture.sng") && zipText.includes("fixture.mix"), "Song package did not contain both filenames");
        check(DesktopSongFiles.readSong(exportedSong).userTracks.length === 1, "User phrase disappeared in the output");
        check(DesktopSongFiles.readMix(exportedMix).length === 6, "Mix channel assignments disappeared in the output");
        const saved = JSON.stringify({ version: 1, song: editor.project, mix: editor.renderedMix });
        const webFile = new DataTransfer();
        webFile.items.add(new File([saved], "fixture.jjazzweb"));
        open.files = webFile.files;
        await editor.openFiles(open);
        await generate();
        check(engine.exports.wasImportedMixApplied(), "The Web project lost its mix on reopening");
        report.importedBars = song.barTimes.length - 1;
        if (desktopFixture.styles) {
            const bytes = Uint8Array.from(atob(desktopFixture.styles), character => character.charCodeAt(0));
            styleArchive = new MemoryStyleArchive(bytes.buffer);
        }
        report.repertoire = [];
        for (const fixture of desktopFixture.repertoire) {
            const arrangement = DesktopSongFiles.readSong(fixture.song);
            editor.open(arrangement, DesktopSongFiles.readMix(fixture.mix));
            await generate();
            check(engine.exports.wasImportedMixApplied(), `${fixture.name} did not keep its desktop mix`);
            if (fixture.name.startsWith("AllBlues")) {
                check(mixerParts.filter(part => part.source === "rhythm").every(part => part.mute), "All Blues lost its accompaniment mutes");
                check(mixerParts.some(part => part.id === "user:Drums" && part.drum && !part.mute),
                    `The independent user drums cannot play: ${JSON.stringify(mixerParts.map(({ id, channel, drum, mute }) => ({ id, channel, drum, mute })))}`);
            }
            report.repertoire.push({ title: fixture.name, bars: song.barTimes.length - 1 });
        }
        report.ok = true;
    } catch (error) { report.ok = false; report.error = error.stack || error.message; }
    console.log("JJAZZ_SMOKE_RESULT=" + JSON.stringify(report));
})();
