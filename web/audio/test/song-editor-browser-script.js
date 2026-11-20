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
        const initialLanguage = (navigator.languages?.[0] ?? navigator.language).toLowerCase().startsWith("ja") ? "ja" : "en";
        check(document.documentElement.lang === initialLanguage, "Initial language did not follow the browser");
        const language = document.querySelector("#ui-language");
        language.value = "en";
        language.dispatchEvent(new Event("change"));
        check(document.querySelector(".app-menu summary").textContent === "File" && editor.selection.textContent === "Bar 1",
            "English did not apply to the menu and the live lead sheet");
        language.value = "ja";
        language.dispatchEvent(new Event("change"));
        check(document.querySelector(".app-menu summary").textContent === "ファイル" && localStorage.getItem("jjazzlab.language") === "ja",
            "Japanese did not apply or persist");
        const first = document.querySelector("#lead-sheet > div");
        check(first?.getAttribute("aria-selected") === "true" && !document.querySelector("#song-editor").hidden,
            "Startup did not open the chord sheet");
        first.dispatchEvent(new KeyboardEvent("keydown", { key: "C" }));
        check(editor.barDialog.open && editor.chordField.value === "C", "Typing a chord did not open the measure editor");
        editor.chordField.value = "Cmaj7 5:G7";
        document.querySelector("#bar-editor-form").requestSubmit();
        check(editor.barDialog.open && editor.barError.textContent, "Out-of-range beat position did not keep the editor open");
        editor.chordField.value = "Cmaj7 3:G7";
        document.querySelector("#bar-editor-form").requestSubmit();
        check(editor.grid.firstElementChild.querySelectorAll(".chord-symbol")[1]?.style.left === "50%"
            && document.activeElement === editor.grid.children[1], "Chord symbols were not placed by beat or editing did not advance");
        editor.grid.children[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true }));
        check(editor.grid.querySelectorAll('[aria-selected="true"]').length === 2, "Shift+arrow did not extend selection");
        editor.grid.lastElementChild.dispatchEvent(new MouseEvent("contextmenu"));
        check(!editor.contextMenu.hidden, "Context menu did not open");
        editor.contextMenu.querySelector('[data-action="section"]').click();
        editor.sectionField.value = "B";
        document.querySelector("#bar-editor-form").requestSubmit();
        check(editor.project.parts[1].name === "B", "Creating a section did not insert its corresponding song part");
        document.querySelector("#add-song-part").click();
        const second = document.querySelector("#song-parts > li:nth-child(2) select");
        second.value = "0";
        second.dispatchEvent(new Event("change"));
        document.querySelector("#add-song-part").click();
        const fourth = document.querySelector("#song-parts > li:nth-child(4) select");
        fourth.value = "0";
        fourth.dispatchEvent(new Event("change"));
        check(!song && !playButton.disabled && document.querySelector("#generate").hidden, "Play requires a manual generation step");
        playButton.click();
        while (starting || generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(playing, `Play did not prepare the song: ${status.textContent} ${playStatus.textContent}`);
        await player.pause();
        check(!playing && paused, "Pause did not retain the active song");
        playButton.click();
        while (starting) await new Promise(resolve => setTimeout(resolve, 20));
        check(playing && !paused, "Play did not resume from pause");
        await player.stop();

        const compact = document.querySelector("#structure-compact");
        compact.click();
        check(editor.parts.classList.contains("compact-view"), "Compact view did not switch");
        compact.click();
        const part = editor.parts.firstElementChild;
        part.dispatchEvent(new MouseEvent("contextmenu"));
        check(!editor.partMenu.hidden, "Song part context menu did not open");
        editor.partMenu.querySelector('[data-action="duplicate"]').click();
        check(editor.parts.children.length === 5, "Duplicate did not insert a song part");
        editor.undoButton.click();
        check(editor.parts.children.length === 4, "Undo did not reverse the part duplication");
        editor.grid.children[0].dispatchEvent(new MouseEvent("contextmenu"));
        editor.contextMenu.querySelector('[data-action="annotation"]').click();
        editor.annotationField.value = "Play softly";
        document.querySelector("#bar-editor-form").requestSubmit();
        editor.grid.children[1].click();
        editor.barAction("restart");
        const annotated = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
        check(annotated.annotations[0].text === "Play softly" && annotated.loopRestartBar === 1, "Annotation or restart bar did not round-trip");
        editor.undoButton.click();
        await generate();
        check(song.barTimes.length === 11, "AABA with 3-bar A and 1-bar B must produce ten bars");
        check(editor.project.chords[1].beat === 2, "Editing the arrangement lost the second chord");
        check(editor.renderedMix.length > 0, "New song does not have a writable mix");
        document.querySelector("#song-parts > li:nth-child(2) .part-controls button:last-child").click();
        document.querySelector("#lead-sheet > div:nth-child(2)").click();
        check(loopStart.value === "5" && loopEnd.value === "6", "Sheet selection did not use the second A");
        editor.grid.lastElementChild.dispatchEvent(new MouseEvent("click", { shiftKey: true }));
        check(loopStart.value === "5" && loopEnd.value === "7", "Range selection did not span two sections");
        const mixerPanel = document.querySelector("#mixer");
        const mixerToggle = document.querySelector("#toggle-mixer");
        mixerToggle.click();
        check(mixerPanel.hidden, "Mixer did not hide");
        mixerToggle.click();
        check(!mixerPanel.hidden, "Mixer did not reopen");
        const volume = document.querySelector("#volume-0");
        const pan = document.querySelector("#pan-0");
        check(getComputedStyle(volume).writingMode === "vertical-lr" && document.querySelector(".track-preview"), "No vertical fader or note preview");
        volume.value = "75"; volume.dispatchEvent(new Event("input"));
        pan.value = "-25"; pan.dispatchEvent(new Event("input"));
        check(mixerParts[0].volume === 0.75 && mixerParts[0].pan === -0.25, "Fader and pan did not reach mixer state");
        document.querySelector("#mute-all").click();
        check(mixerParts.every(part => part.mute && editor.renderedMix.find(track => track.channel === part.channel)?.mute),
            "Bulk mute did not reach the exported mix for each active channel");
        document.querySelector('.strip[data-part-index="0"] [data-mix="solo"]').click();
        check(mixerParts[0].solo, "Solo button did not set the track state");
        document.querySelector("#clear-solo").click();
        check(mixerParts.every(part => !part.solo), "Bulk solo clear did not reset the track");
        document.querySelector("#quick-mode").click();
        check(!editor.project && !document.querySelector("#quick-chords").hidden, "Quick input did not open");
        document.querySelector("#quick-mode").click();
        check(editor.project.chords[0].name === "Cmaj7", "Returning from quick input lost the draft");
        await generate();
        report.newSongBars = song.barTimes.length - 1;

        const open = document.querySelector("#open-project");
        const files = new DataTransfer();
        files.items.add(new File([desktopFixture.song], "fixture.sng"));
        files.items.add(new File([desktopFixture.mix], "fixture.mix"));
        open.files = files.files;
        await editor.openFiles(open);
        check(editor.project.title.startsWith("SpeakNoEvil"), editor.status.textContent);
        const originalVariations = editor.project.parts.map(part => part.parameters.rpVariationID);
        check(rhythmEngine.value === "jjswing", "A desktop jjSwing song did not select jjSwing");
        await generate();
        check(editor.project.parts.every((part, index) => part.parameters.rpVariationID === originalVariations[index]),
            "Generating a desktop jjSwing song changed its saved variations");
        check(engine.exports.wasImportedMixApplied(), "The matching desktop mix was not applied");
        check(song.parts.some(part => part.id === "user:User1"), "User MIDI track was not generated");
        check(song.barTimes.length === 139, "Expected 138 bars in the imported arrangement");
        const bass = mixerParts.findIndex(part => part.name === "Bass");
        const bassChannel = mixerParts[bass].channel;
        const originalBass = editor.renderedMix.find(track => track.channel === bassChannel);
        const bassButton = document.querySelector(`.strip[data-part-index="${bass}"] .channel-edit`);
        bassButton.click();
        check(channelEditor.open && document.querySelector("#channel-reverb").valueAsNumber === originalBass.reverb,
            "Channel editor did not load the imported effect values");
        const cello = mixerInstruments.find(instrument => instrument.program === 42 && !instrument.drum).desktop;
        channelInstrument.value = cello.id;
        document.querySelector("#channel-reverb").value = "96";
        document.querySelector("#channel-chorus").value = "57";
        document.querySelector("#channel-effects .effect-control:first-child input[type=checkbox]").checked = true;
        document.querySelector("#channel-effects .effect-control:last-child input[type=checkbox]").checked = false;
        document.querySelector("#channel-editor-form").requestSubmit();
        const editedBass = DesktopSongFiles.readMix(editor.desktopMixXml()).find(track => track.channel === bassChannel);
        check(editedBass.instrument === cello.id && editedBass.patch === cello.patch && editedBass.reverb === 96
            && editedBass.chorus === 57 && editedBass.reverbEnabled && !editedBass.chorusEnabled,
            "Desktop mix output lost the edited instrument, sends or enabled flags");
        check(mixerParts[bass].instrumentChoice.program === 42 && mixerParts[bass].reverb === 96
            && mixerParts[bass].chorus === 57, "Channel edits did not reach the Web playback settings");
        const originalTracks = DesktopSongFiles.readMix(desktopFixture.mix);
        check(editor.renderedMix.filter(track => track.channel !== bassChannel).every(track =>
            originalTracks.some(source => source.name === track.name && source.patch === track.patch)),
            "Editing Bass changed another instrument");
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
        check(song.events.some(event => event.channel === bassChannel && event.type === 0xc0 && event.a === 42),
            "Generating again lost the selected GM instrument");
        document.querySelector("#open-piano-roll").click();
        check(!pianoRoll.panel.hidden && pianoRoll.name === "User1" && pianoRoll.phrase.notes.length === 4,
            "The note editor did not open an imported user track");
        const originalNote = pianoRoll.phrase.notes[0];
        pianoRoll.select([originalNote]);
        document.querySelector("#roll-pitch").value = "74";
        document.querySelector("#roll-position").value = "2.5";
        document.querySelector("#roll-length").value = "3.5";
        document.querySelector("#roll-note-form").requestSubmit();
        document.querySelector("#roll-velocity").value = "104";
        document.querySelector("#roll-velocity").dispatchEvent(new Event("change"));
        check(pianoRoll.phrase.notes.some(note => note.pitch === 74 && note.position === 2.5 && note.duration === 3.5 && note.velocity === 104),
            "The piano roll did not store the selected note changes");
        editor.undoButton.click();
        check(pianoRoll.phrase.notes.some(note => note.pitch === 74 && note.velocity === originalNote.velocity),
            "Undo did not restore the velocity in the note editor");
        editor.redoButton.click();
        document.querySelector("#add-user-track").click();
        check(pianoRoll.name === "User2" && pianoRoll.tool === "draw" && editor.project.userTracks.length === 2,
            "The Mix Console add action did not open a new user track in Draw mode");
        const newNote = { pitch: 64, position: 1.25, duration: .5, velocity: 98 };
        pianoRoll.commit([newNote], [newNote]);
        pianoRoll.close();
        await generate();
        check(engine.exports.wasImportedMixApplied() && editor.renderedMix.find(track => track.name === "Bass").patch === "Cello",
            "Adding a user track replaced the existing rhythm mix");
        const tracks = new Map(song.parts.map((part, index) => [part.name, index]));
        for (const [name, pitch] of [["User1", 74], ["User2", 64]]) {
            check(song.events.some(event => event.part === tracks.get(name) && event.type === 0x90 && event.a === pitch && event.b > 0),
                `Generated MIDI does not contain the edited note for ${name}`);
        }
        const editedSong = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
        check(editedSong.userTracks.length === 2 && UserPhrase.read(editedSong.userTracks[1].phrase).notes[0].duration === .5,
            "Desktop song export did not retain the newly added note");
        report.editedMix = { instrument: editedBass.patch, reverb: editedBass.reverb, chorus: editedBass.chorus, chorusEnabled: editedBass.chorusEnabled };
        report.importedBars = song.barTimes.length - 1;

        const converted = DesktopSongFiles.readSong(desktopFixture.song);
        const variationExamples = ["Intro C-1", "Main B-1", "Main D-4", "Ending B-1"];
        for (const [index, part] of converted.parts.entries()) {
            part.styleId = index % 2 ? "ExampleSalsa.sty-ID" : "ExampleSwing.sty-ID";
            part.parameters.rpVariationID = variationExamples[index % variationExamples.length];
        }
        converted.parts[0].parameters.RpSysMuteID = "[A source instrument unavailable in jjSwing]";
        const convertedFiles = new DataTransfer();
        convertedFiles.items.add(new File([DesktopSongFiles.writeSong(converted)], "converted.sng"));
        convertedFiles.items.add(new File([desktopFixture.mix], "converted.mix"));
        open.files = convertedFiles.files;
        await editor.openFiles(open);
        rhythmEngine.value = "jjswing";
        rhythmEngine.dispatchEvent(new Event("change"));
        await generate();
        const mapped = editor.project.parts.slice(0, 4).map(part => part.parameters.rpVariationID);
        check(mapped.join() === "Intro A-1,Main B-1,Main D-1,Ending A-1", `Unexpected jjSwing variations: ${mapped}`);
        check(document.querySelector("#swing-settings").hidden, "The global variation selector is visible in the song editor");
        report.convertedVariations = mapped;

        document.querySelector("#new-project").click();
        editor.meter.value = "THREE_FOUR";
        editor.meter.dispatchEvent(new Event("change"));
        const wrongMeter = new DataTransfer();
        wrongMeter.items.add(new File([style], bundledStyle));
        styleInput.files = wrongMeter.files;
        await generate();
        check(editor.project.parts[0].styleName === bundledJazzWaltz, "A mismatched 4/4 style was not replaced for a 3/4 song");
        check(Math.abs(song.barTimes[1] - 1.5) < 0.001, "The replacement did not generate in 3/4");
        rhythmEngine.value = "jjswing";
        rhythmEngine.dispatchEvent(new Event("change"));
        await generate();
        check(editor.project.parts[0].styleName === bundledJazzWaltz && editor.status.textContent.includes("jjSwingは4/4専用"),
            "Selecting jjSwing for a 3/4 song did not explain the compatible substitution");
        report.waltzFallback = editor.project.parts[0].styleName;
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
                const drums = mixerParts.find(part => part.id === "user:Drums" && part.drum && !part.mute);
                check(drums,
                    `The independent user drums cannot play: ${JSON.stringify(mixerParts.map(({ id, channel, drum, mute }) => ({ id, channel, drum, mute })))}`);
                await player.initialize(showPlayStatus);
                const analyser = player.context.createAnalyser();
                player.compressor.connect(analyser);
                const samples = new Float32Array(analyser.fftSize);
                try {
                    const drumsOnly = mixerParts.map(part => ({ ...part, solo: part === drums }));
                    await player.play(song, { enabled: true, start: 0, end: song.barTimes[2] }, drumsOnly, 0.8);
                    let peak = 0;
                    for (let i = 0; i < 25 && peak < 0.002; i++) {
                        await new Promise(resolve => setTimeout(resolve, 60));
                        analyser.getFloatTimeDomainData(samples);
                        peak = Math.max(peak, ...samples.map(Math.abs));
                    }
                    check(peak >= 0.002, "Soloed user drums did not produce audible samples");
                    report.userDrumPeak = peak;
                } finally {
                    await player.stop();
                    player.compressor.disconnect(analyser);
                }
            }
            report.repertoire.push({ title: fixture.name, bars: song.barTimes.length - 1 });
            if (fixture.name.startsWith("BlueBossa")) {
                const savedVariations = arrangement.parts.map(part => part.parameters.rpVariationID);
                rhythmEngine.value = "jjswing";
                rhythmEngine.dispatchEvent(new Event("change"));
                await generate();
                const mapped = arrangement.parts.map(part => part.parameters.rpVariationID);
                check(mapped[0] === "Intro A-1" && mapped.slice(1).join() === savedVariations.slice(1).join(),
                    "Blue Bossa lost saved Main variations when switched to jjSwing");
                report.blueBossaSwingVariations = [...new Set(mapped)];
            }
        }
        if (desktopFixture.africa) {
            const file = new DataTransfer();
            file.items.add(new File([desktopFixture.africa], "africa.sng"));
            open.files = file.files;
            await editor.openFiles(open);
            check(editor.meter.selectedOptions[0].textContent === "曲中で変化", "Africa did not display mixed meter");
            check(Array.from(editor.grid.querySelectorAll(".measure-meter"), meter => meter.textContent).includes("24"),
                "Africa chord sheet did not show a 2/4 section");
            await generate();
            const beats = DesktopSongFiles.barBeats(editor.project);
            const shortBars = beats.flatMap((beat, bar) => beat === 2 ? [bar + 1] : []);
            check(beats.length === 102 && shortBars.join() === "12,17,22,44,49,71,76", `Unexpected Africa meters: ${shortBars}`);
            const expectedChanges = [];
            let tick = 0;
            for (const [index, beat] of beats.entries()) {
                if (!index || beats[index - 1] !== beat) expectedChanges.push({ tick, numerator: beat, denominator: 4 });
                tick += beat * 960;
            }
            check(JSON.stringify(song.meterChanges) === JSON.stringify(expectedChanges), "Africa MIDI meter changes do not match the .sng");
            check(editor.project.parts[0].styleName === "DiscoHouse.S145.prs", "Africa did not use its original Yamaha style");
            check(editor.project.parts.some(part => part.styleId === "YamahaRhythmProviderID___DiscoHouse.S145.prs-ID___2/4"),
                "Africa lost its adapted style identifier");
            const beatSeconds = 60 / editor.project.tempo;
            for (let index = 0; index < beats.length; index++) {
                check(Math.abs(song.barTimes[index + 1] - song.barTimes[index] - beats[index] * beatSeconds) < 0.00001,
                    `Africa playback time for bar ${index + 1} does not match its meter`);
            }
            loopStart.value = 11;
            loopEnd.value = 13;
            loopEnabled.checked = true;
            const loop = readLoop();
            check(Math.abs(loop.end - loop.start - 10 * beatSeconds) < 0.00002, "Africa loop length must be 4+2+4 beats");
            await player.initialize(showPlayStatus);
            const positions = [];
            const highlightedBars = new Set();
            const originalPosition = player.onPosition;
            player.onPosition = data => {
                originalPosition(data);
                if (data.playing) {
                    positions.push(data.seconds);
                    highlightedBars.add(editor.grid.querySelector(".playing-bar .measure-number")?.textContent);
                }
            };
            try {
                playButton.click();
                for (let i = 0; i < 220 && !positions.some((value, index) => index && value < positions[index - 1]); i++) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                const wrap = positions.findIndex((value, index) => index && value < positions[index - 1]);
                check(wrap > 0 && positions[wrap] < loop.start + 0.25, "Africa loop did not return to bar 11");
                check(positions.every(seconds => seconds >= loop.start - 0.01 && seconds <= loop.end + 0.01), "Playback escaped the Africa loop");
                check(positions.some(seconds => seconds >= song.barTimes[11] && seconds < song.barTimes[12]), "Playback skipped bar 12 in 2/4");
                check(highlightedBars.size > 1 && !highlightedBars.has(undefined), "Playing measures did not highlight in the chord sheet");
                report.africa = { bars: beats.length, shortBars, loopBars: [11, 13], loopSeconds: loop.end - loop.start, wraps: 1 };
            } finally {
                player.onPosition = originalPosition;
                await player.stop();
            }
        }
        report.multiStyle = [];
        for (const fixture of desktopFixture.multiStyle) {
            const arrangement = DesktopSongFiles.readSong(fixture.song);
            const originalIds = arrangement.parts.map(part => part.styleId);
            const originalVariations = arrangement.parts.map(part => part.parameters.rpVariationID);
            const pair = new DataTransfer();
            pair.items.add(new File([fixture.song], `${fixture.name}.sng`));
            pair.items.add(new File([fixture.mix], `${fixture.name}.mix`));
            open.files = pair.files;
            await editor.openFiles(open);
            check(rhythmEngine.value === "song", `${fixture.name} did not default to its saved styles`);
            await generate();
            check(engine.exports.wasImportedMixApplied(), `${fixture.name} lost its original mix`);
            check(arrangement.title === editor.project.title && originalIds.join() === editor.project.parts.map(part => part.styleId).join(),
                `${fixture.name} did not retain its saved style IDs`);
            check(originalVariations.join() === editor.project.parts.map(part => part.parameters.rpVariationID).join(),
                `${fixture.name} did not retain its saved variations`);
            check(new Set(song.parts.map(part => part.id)).size === song.parts.length, "Different styles collided in the mixer");
            const styleBars = editor.project.parts.flatMap(part => {
                const section = editor.project.sections[part.section];
                const end = editor.project.sections[part.section + 1]?.bar ?? editor.project.bars;
                return Array(end - section.bar).fill(DesktopSongFiles.sourceStyleId(part.styleId));
            });
            const boundary = styleBars.findIndex(style => style !== styleBars[0]);
            check(boundary > 0, `${fixture.name} has no style switch`);
            const start = song.barTimes[boundary - 1], middle = song.barTimes[boundary], end = song.barTimes[boundary + 1];
            const hasNotes = (styleId, from, to) => song.events.some(event => event.type === 0x90 && event.b
                && event.seconds >= from - 1e-6 && event.seconds < to - 1e-6 && song.parts[event.part].styleId === styleId);
            check(hasNotes(styleBars[boundary - 1], start, middle), `${fixture.name}: source style did not produce notes before the switch`);
            check(hasNotes(styleBars[boundary], middle, end), `${fixture.name}: destination style did not produce notes after the switch`);
            const summary = { title: fixture.name, bars: styleBars.length, switchAtBar: boundary + 1,
                styles: [...new Set(styleBars)], meters: [...new Set(song.meterChanges.map(({ numerator, denominator }) => `${numerator}/${denominator}`))] };
            const roundTrip = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
            check(roundTrip.parts.map(part => part.styleId).join() === originalIds.join(), `${fixture.name} lost its styles on export`);
            const exportedMix = DesktopSongFiles.writeMix(editor.renderedMix.map(track => ({ ...track, channel: track.sourceChannel ?? track.channel })));
            const trackKeys = mix => mix.map(track => `${track.channel}:${track.rhythmId}:${track.name}`).join();
            check(trackKeys(DesktopSongFiles.readMix(exportedMix)) === trackKeys(DesktopSongFiles.readMix(fixture.mix)),
                `${fixture.name} lost its native mix channel assignments on export`);
            loopStart.value = boundary;
            loopEnd.value = boundary + 2;
            loopEnabled.checked = true;
            const loop = readLoop();
            await player.initialize(showPlayStatus);
            const positions = [];
            const originalPosition = player.onPosition;
            player.onPosition = data => { if (data.playing) positions.push(data.seconds); originalPosition(data); };
            try {
                await player.play(song, loop, mixerParts, 0.8);
                let wrap = -1;
                for (let i = 0; i < 250 && wrap < 0; i++) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    wrap = positions.findIndex((value, index) => index && value < positions[index - 1]);
                }
                check(wrap > 0 && positions[wrap] < start + 0.25, "The style-change loop did not return to its first bar");
                check(positions.some(seconds => seconds < middle) && positions.some(seconds => seconds >= middle), "The loop skipped a side of the style switch");
                check(positions.every(seconds => seconds >= loop.start - 0.01 && seconds <= loop.end + 0.01), "Playback escaped the style-change loop");
                summary.loopBars = [boundary, boundary + 2];
                summary.loopSeconds = loop.end - loop.start;
            } finally {
                player.onPosition = originalPosition;
                await player.stop();
            }
            report.multiStyle.push(summary);
        }
        report.ok = true;
    } catch (error) { report.ok = false; report.error = error.stack || error.message; }
    console.log("JJAZZ_SMOKE_RESULT=" + JSON.stringify(report));
})();
