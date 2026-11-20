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
        const setDisplayKey = semitones => {
            document.querySelector("#open-chord-display-key").click();
            document.querySelector("#chord-display-semitones").value = semitones;
            document.querySelector("#chord-display-form").requestSubmit();
        };
        const originalScore = DesktopSongFiles.writeSong(editor.project);
        setDisplayKey(2);
        showReader(true);
        check(editor.grid.querySelector(".chord-symbol").textContent === "D" && readerCurrent.textContent === "D"
            && localStorage.getItem("jjazzlab.chordDisplayTranspose") === "2", "Display transposition did not reach the score and reader");
        check(DesktopSongFiles.writeSong(editor.project) === originalScore && editor.chordLabel("G7/B") === "A7/Db"
            && editor.chordLabel("NC") === "NC", "Display transposition affected the saved song or slash-chord notation");
        editor.openBarEditor();
        check(editor.chordField.value === "D", "The chord entry dialog used a different display key");
        editor.chordField.value = "E7/B";
        document.querySelector("#bar-editor-form").requestSubmit();
        check(editor.project.chords[0].name === "D7/A", "Editing a transposed chord did not save at concert pitch");
        editor.undoButton.click();
        setDisplayKey(0);
        showReader(false);
        editor.selectBar(0);
        report.chordDisplayTranspose = true;
        const first = document.querySelector("#lead-sheet > div");
        check(first?.getAttribute("aria-selected") === "true" && !document.querySelector("#song-editor").hidden,
            "Startup did not open the chord sheet");
        const editMemo = document.querySelector("#open-song-memo");
        const memo = document.querySelector("#song-memo-text");
        editMemo.click();
        memo.value = "Practice slowly\nhttps://example.org/reference";
        memo.dispatchEvent(new Event("input"));
        check(document.querySelector("#song-memo-links a")?.href === "https://example.org/reference", "Song memo did not expose its link");
        document.querySelector("#song-memo-form").requestSubmit();
        check(DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project)).comments === memo.value, "Song memo did not round-trip");
        editor.undoButton.click();
        check(!editor.project.comments, "Undo did not restore the previous song memo");
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
        editor.grid.children[1].dispatchEvent(new MouseEvent("contextmenu"));
        editor.contextMenu.querySelector('[data-action="remove-bars"]').click();
        check(editor.project.bars === 3 && editor.project.sections[1].bar === 2,
            "Deleting a middle bar did not move the following section");
        editor.undoButton.click();
        check(editor.project.bars === 4 && editor.project.sections[1].bar === 3,
            "Undo did not restore the deleted bar and section position");
        document.querySelector("#add-song-part").click();
        const second = document.querySelector("#song-parts > li:nth-child(2) select");
        second.value = "0";
        second.dispatchEvent(new Event("change"));
        document.querySelector("#add-song-part").click();
        const fourth = document.querySelector("#song-parts > li:nth-child(4) select");
        fourth.value = "0";
        fourth.dispatchEvent(new Event("change"));
        const selectPartButton = (index, options = {}) => editor.parts.children[index].querySelector(".part-name-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, ...options }));
        const openPartMenuAt = index => editor.parts.children[index].dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
        const originalParts = JSON.stringify(editor.project.parts);
        const originalRhythmMode = rhythmEngine.value;
        const originalPartRange = chosenRange;
        selectPartButton(1);
        selectPartButton(2, { shiftKey: true });
        check(editor.parts.querySelectorAll(".selected-part").length === 2
            && chosenRange.from === editor.partRanges()[1].from && chosenRange.to === editor.partRanges()[2].to,
            "Shift did not select a continuous song-part range");
        document.querySelector("#edit-song-parts").click();
        document.querySelector("#part-name").value = "Practice";
        document.querySelector("#part-rhythm").value = bundledStyle + "-ID";
        document.querySelector('[data-parameter="rpTempoID"]').value = "90";
        document.querySelector("#part-editor-form").requestSubmit();
        check(editor.project.parts.slice(1, 3).every(part => part.name === "Practice" && part.styleId === bundledStyle + "-ID"
            && part.parameters.rpTempoID === "90") && editor.project.parts[0].name !== "Practice",
            "Batch edits did not reach exactly the selected song parts");
        selectPartButton(1);
        openPartMenuAt(1);
        editor.partMenu.querySelector('[data-action="remove-rhythm-change"]').click();
        check(editor.project.parts.slice(1, 3).every(part => part.styleId === editor.project.parts[0].styleId),
            "Removing a rhythm change did not cover the consecutive parts");
        editor.undoButton.click();
        editor.undoButton.click();
        check(JSON.stringify(editor.project.parts) === originalParts, "Undo did not restore the song parts after batch editing");
        selectPartButton(0);
        selectPartButton(2, { ctrlKey: true });
        openPartMenuAt(2);
        editor.partMenu.querySelector('[data-action="duplicate"]').click();
        check(editor.project.parts.length === 6 && editor.project.parts[3].section === editor.project.parts[0].section
            && editor.project.parts[4].section === editor.project.parts[2].section, "Duplicating the selection changed its order");
        editor.undoButton.click();
        selectPartButton(0);
        selectPartButton(2, { ctrlKey: true });
        openPartMenuAt(2);
        editor.partMenu.querySelector('[data-action="remove"]').click();
        check(editor.project.parts.length === 2, "Deleting a disjoint selection did not remove both parts");
        editor.undoButton.click();
        rhythmEngine.value = originalRhythmMode;
        rhythmEngine.dispatchEvent(new Event("change"));
        chosenRange = originalPartRange;
        check(JSON.stringify(editor.project.parts) === originalParts, "Undo did not restore the original structure");
        report.batchSongParts = true;
        check(!song && !playButton.disabled && document.querySelector("#generate").hidden, "Play requires a manual generation step");
        playButton.click();
        while (starting || generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(playing, `Play did not prepare the song: ${status.textContent} ${playStatus.textContent}`);
        const liveSong = song;
        const oldTempo = tempoInput.value;
        const oldSend = player.send;
        let updatedRate;
        player.send = function (type, message, transfer) {
            if (type === "tempo") updatedRate = message.rate;
            return oldSend.call(this, type, message, transfer);
        };
        try {
            tempoInput.value = "90";
            tempoInput.dispatchEvent(new Event("input", { bubbles: true }));
            check(playing && !generating && song === liveSong && editor.project.tempo === 90 && updatedRate === .75,
                "Changing the toolbar tempo stopped playback or regenerated the whole song");
            tempoInput.value = oldTempo;
            tempoInput.dispatchEvent(new Event("input", { bubbles: true }));
        } finally { player.send = oldSend; }
        report.liveTempo = true;
        await player.pause();
        check(!playing && paused, "Pause did not retain the active song");
        playButton.click();
        while (starting) await new Promise(resolve => setTimeout(resolve, 20));
        check(playing && !paused, "Play did not resume from pause");
        await player.stop();

        const compact = document.querySelector("#structure-compact");
        compact.click();
        check(editor.parts.classList.contains("compact-view"), "Compact view did not switch");
        document.querySelector("#structure-compact-settings").click();
        const compactSettings = document.querySelector("#structure-compact-dialog");
        compactSettings.querySelector('[value="rpVariationID"]').checked = false;
        compactSettings.querySelector('[value="rpIntensityID"]').checked = true;
        document.querySelector("#structure-compact-form").requestSubmit();
        const compactRows = editor.parts.firstElementChild.querySelectorAll(".compact-rp");
        const compactSaved = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project)).clientProperties;
        check(compactRows.length === 1 && compactRows[0].dataset.rhythmParameter === "rpIntensityID"
            && compactSaved.PropCompactViewModeVisibleRps_jjSwing === undefined
            && compactSaved["PropCompactViewModeVisibleRps_jjSwing-ID"] === "rpIntensityID" && compactSaved.PropViewMode === "COMPACT",
            "Compact-view settings did not affect the visible rows or round-trip through the song");
        check(getComputedStyle(editor.parts.querySelector(".part-heading")).position === "sticky", "Part headings did not stick during scrolling");
        editor.undoButton.click();
        compact.click();
        report.compactStructureSettings = true;
        const variation = index => document.querySelector(`input[list="part-${index}-rpVariationID"]`);
        const context = action => document.querySelector(`#parameter-context [data-action="${action}"]`);
        const firstVariation = variation(0).value;
        variation(0).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
        context("next").click();
        check(variation(0).value !== firstVariation, "Next rhythm parameter value did not apply");
        variation(0).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
        context("copy").click();
        variation(1).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
        context("paste").click();
        check(variation(1).value === variation(0).value, "Pasting the variation to another song part did not apply");
        variation(0).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
        context("reset").click();
        check(variation(0).value === firstVariation && !Object.hasOwn(editor.project.parts[0].parameters, "rpVariationID"),
            "Reset did not return the variation to the rhythm default");
        editor.undoButton.click();
        editor.undoButton.click();
        editor.undoButton.click();
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
        check(editor.grid.querySelector(".bar-annotation")?.textContent === "Play softly",
            "The first annotation was not made visible");
        const annotationLines = document.querySelector("#bar-annotation-lines");
        annotationLines.value = "3";
        annotationLines.dispatchEvent(new Event("change"));
        document.querySelector("#show-bar-annotations").click();
        const annotationView = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project)).clientProperties;
        check(editor.grid.querySelector(".bar-annotation-marker")?.title === "Play softly"
            && annotationView.PropBarAnnotationsVisible === "false" && annotationView.PropBarAnnotationsNbLines === "3",
            "Annotation markers or native view settings were not saved");
        editor.undoButton.click();
        editor.undoButton.click();
        editor.grid.children[1].click();
        editor.barAction("restart");
        const annotated = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
        check(annotated.annotations[0].text === "Play softly" && annotated.loopRestartBar === 1, "Annotation or restart bar did not round-trip");
        const decorated = structuredClone(annotated);
        decorated.tags = ["Practice & rehearsal"];
        decorated.clientProperties = { PropClEditorZoomFactorY: "62" };
        decorated.sections[0].clientProperties = { PropSectionStartOnNewLine: "true" };
        decorated.chords[0].clientProperties = { SongPropUserFontColor: "-65536" };
        decorated.annotations[0].clientProperties = { TestAnnotationProperty: "<memo>" };
        decorated.parts[0].clientProperties = { TestPartProperty: "1" };
        const restored = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(decorated));
        check(restored.tags[0] === decorated.tags[0] && restored.clientProperties.PropClEditorZoomFactorY === "62"
            && restored.sections[0].clientProperties.PropSectionStartOnNewLine === "true"
            && restored.chords[0].clientProperties.SongPropUserFontColor === "-65536"
            && restored.annotations[0].clientProperties.TestAnnotationProperty === "<memo>"
            && restored.parts[0].clientProperties.TestPartProperty === "1", "Native display properties or tags did not round-trip");
        editor.undoButton.click();
        await generate();
        check(song.barTimes.length === 11, "AABA with 3-bar A and 1-bar B must produce ten bars");
        check(editor.project.chords[1].beat === 2, "Editing the arrangement lost the second chord");
        check(editor.renderedMix.length > 0, "New song does not have a writable mix");
        const testAnnotation = editor.project.annotations[0];
        const originalAnnotation = testAnnotation.text;
        testAnnotation.text = "Always\n# Verse one\n# Verse two";
        document.querySelector("#toggle-reader").click();
        updateReader(1, 0);
        check(!reader.hidden && readerCurrent.textContent === "Cmaj7" && readerNext.textContent === "G7"
            && readerAnnotation.textContent === "Always\nVerse one", "Easy Reader did not display the current and next chord");
        updateReader(4, 0);
        check(readerAnnotation.textContent === "Always\nVerse two", "Easy Reader did not switch lyrics on a repeated section");
        document.querySelector("#close-reader").click();
        testAnnotation.text = originalAnnotation;
        editor.selectBar(1);
        editor.selectBar(3, true);
        document.querySelector("#create-practice-song").click();
        document.querySelector("#practice-start").value = "60";
        document.querySelector("#practice-end").value = "120";
        document.querySelector("#practice-steps").value = "3";
        const previousDownload = downloadSongFile;
        let practice;
        try {
            downloadSongFile = (_name, data) => { practice = JSON.parse(data).song; };
            document.querySelector("#practice-song-form").requestSubmit();
        } finally { downloadSongFile = previousDownload; }
        check(practice?.bars === 3 && practice.sections[1].bar === 2
            && practice.parts.map(part => part.parameters.rpTempoID).join() === "50,50,75,75,100,100"
            && editor.project.bars === 4, "Practice song did not preserve the source and repeat the selection at stepped tempos");
        const practiceStyles = [{ id: "jjSwing-ID", name: "jjSwing", bytes: new Int8Array() }];
        const practiceMidi = engine.exports.generateSongMidiWithChordRendering(
            ...DesktopSongFiles.multiStyleEngineArgs(practice, practiceStyles, Array(practice.parts.length).fill(0), []));
        const practiceBeats = DesktopSongFiles.barBeats(practice);
        const practiceTimeline = parseMidi(practiceMidi, practiceBeats.length, [], practiceBeats);
        for (const [index, expected] of [[3, 12], [6, 20], [9, 26]]) {
            check(Math.abs(practiceTimeline.barTimes[index] - expected) < 0.015,
                `Practice excerpt tempo ramp did not reach the expected time: ${practiceTimeline.barTimes[index]} vs ${expected}`);
        }
        editor.selectBar(0);
        const customBass = editor.renderedMix.find(track => /bass/iu.test(track.name));
        check(customBass, "The rhythm does not expose a bass voice for the custom phrase test");
        document.querySelector("[data-part-mute]").click();
        const mute = [...document.querySelectorAll("#part-mute-tracks input")].find(field => field.value === customBass.name);
        check(mute, "The bass voice did not appear in song part mute");
        mute.checked = true;
        document.querySelector("#part-mute-form").requestSubmit();
        await generate();
        const bassNotes = song.events.filter(event => event.type === 0x90 && event.b && song.parts[event.part].name === customBass.name);
        check(bassNotes.length && bassNotes.every(note => note.seconds >= song.barTimes[3] - 1e-6),
            "Song part mute did not silence just the chosen song part");
        editor.undoButton.click();
        const customPhrase = `${customBass.name}%[0|95,61,0.5:0.5]`;
        editor.project.parts[0].parameters.RP_SYS_CustomPhraseId = customPhrase;
        editor.changed();
        await generate();
        const customNote = song.events.find(event => event.type === 0x90 && event.a === 95 && event.b === 61
            && song.parts[event.part].name === customBass.name);
        check(customNote && customNote.seconds > song.barTimes[0] && customNote.seconds < song.barTimes[1],
            "Native custom phrase did not replace the chosen voice in its song part");
        check(DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project)).parts[0].parameters.RP_SYS_CustomPhraseId === customPhrase,
            "Native custom phrase did not round-trip");
        delete editor.project.parts[0].parameters.RP_SYS_CustomPhraseId;
        editor.changed();
        editor.grid.firstElementChild.querySelector(".chord-symbol").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
        editor.contextMenu.querySelector('[data-action="chord"]').click();
        check(editor.barDialog.open && !document.querySelector("#chord-interpretation").hidden, "Chord interpretation editor did not open");
        const scale = document.querySelector("#chord-scale");
        for (let attempt = 0; scale.options.length < 2 && attempt < 50; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        check(scale.options.length > 1, "JJazzLab scales were not available for the current chord");
        scale.selectedIndex = 1;
        document.querySelector("#chord-duration").value = "SHOT";
        document.querySelector("#chord-alternate").value = "NC";
        document.querySelector("#chord-alternate-condition").value = "RANDOM_OFTEN";
        document.querySelector("#bar-editor-form").requestSubmit();
        const interpreted = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project)).chords[0];
        check(interpreted.features === "ACCENT,SHOT" && interpreted.scale?.pitch && interpreted.alternate?.name === "NC"
            && interpreted.alternate?.random === "RANDOM_OFTEN", "Chord interpretation or alternative did not round-trip");
        await generate();
        editor.undoButton.click();
        await generate();
        document.querySelector("#song-parts > li:nth-child(2) .part-controls button:last-child").click();
        document.querySelector("#lead-sheet > div:nth-child(2)").click();
        check(loopStart.value === "5" && loopEnd.value === "6", "Sheet selection did not use the second A");
        editor.grid.lastElementChild.dispatchEvent(new MouseEvent("click", { shiftKey: true }));
        check(loopStart.value === "5" && loopEnd.value === "7", "Range selection did not span two sections");
        const startSelection = editor.onPlay;
        try {
            editor.onPlay = () => {};
            editor.grid.children[1].click();
            editor.grid.children[1].dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", ctrlKey: true, bubbles: true }));
            check(loopStart.value === "5" && loopEnd.value === "10", "Play from here did not include the remainder of the song");
            editor.grid.children[1].dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", ctrlKey: true, shiftKey: true, bubbles: true }));
            check(loopStart.value === "5" && loopEnd.value === "5", "Play selection did not restrict a one-bar selection");
        } finally { editor.onPlay = startSelection; }
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
        check(rhythmEngine.value === "song", "A desktop jjSwing song did not default to the saved rhythm");
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
        const instrumentSearch = document.querySelector("#channel-instrument-search");
        instrumentSearch.value = "ｃｅｌｌｏ";
        instrumentSearch.dispatchEvent(new Event("input", { bubbles: true }));
        check(channelInstrument.options.length === 2 && [...channelInstrument.options].some(option => option.value === cello.id),
            "Instrument search did not find the requested patch");
        channelInstrument.value = cello.id;
        document.querySelector("#channel-preview").click();
        await pendingAudition;
        check(player.previewing && !playing && player.loadedSong.events[0].a === 42
            && player.loadedSong.events.filter(event => event.type === 0x90).length === 4, "The instrument preview did not use the selected patch");
        report.instrumentSearch = true;
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
        saveRhythmMix.click();
        await restoreFactoryMix.onclick();
        check(editor.mix.find(track => track.name === "Bass").patch !== "Cello" && editor.mix.find(track => track.name === "Bass").channel === bassChannel,
            "Factory reset did not restore the default sound while keeping the channel");
        await loadRhythmMix.onclick();
        check(editor.mix.find(track => track.name === "Bass").patch === "Cello"
            && editor.mix.find(track => track.name === "Bass").reverb === 96, "Loading the rhythm preset did not restore the saved settings");
        await reloadSongMix.onclick();
        check(editor.mix.find(track => track.name === "Bass").patch === originalBass.patch
            && editor.mix.find(track => track.name === "Bass").reverb === originalBass.reverb, "Reloading the opened mix used the wrong baseline");
        await loadRhythmMix.onclick();
        localStorage.removeItem(rhythmMixPreference);
        report.mixerPresets = true;
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
        const originalZoom = [pianoRoll.pixels, pianoRoll.rowHeight];
        const zoomWheel = options => pianoRoll.scroll.dispatchEvent(new WheelEvent("wheel", {
            ctrlKey: true, deltaY: -100, cancelable: true, ...options
        }));
        zoomWheel({});
        check(pianoRoll.pixels > originalZoom[0] && pianoRoll.rowHeight === originalZoom[1], "Ctrl+wheel did not zoom horizontally");
        zoomWheel({ shiftKey: true });
        check(pianoRoll.rowHeight > originalZoom[1], "Ctrl+Shift+wheel did not zoom vertically");
        pianoRoll.select([pianoRoll.phrase.notes[0]]);
        pianoRoll.scroll.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, shiftKey: true, key: "I", cancelable: true }));
        check(pianoRoll.selection.size === 3 && !pianoRoll.selection.has(pianoRoll.phrase.notes[0]), "Selection inversion missed notes");
        document.querySelector("#roll-fit").click();
        const visibleNotes = pianoRoll.phrase.notes.every(note =>
            note.position * pianoRoll.pixels >= pianoRoll.scroll.scrollLeft - 1
            && (note.position + note.duration) * pianoRoll.pixels <= pianoRoll.scroll.scrollLeft + pianoRoll.scroll.clientWidth - PIANO_KEYS + 1
            && (127 - note.pitch) * pianoRoll.rowHeight >= pianoRoll.scroll.scrollTop - 1
            && (128 - note.pitch) * pianoRoll.rowHeight <= pianoRoll.scroll.scrollTop + pianoRoll.scroll.clientHeight - PIANO_RULER + 1);
        check(visibleNotes, "Fit did not place all notes in the viewport");
        pianoRoll.zoom(...originalZoom);
        report.pianoRollNavigation = true;
        const beforeHumanize = pianoRoll.saved;
        const untouched = pianoRoll.phrase.notes.slice(1);
        const affected = pianoRoll.phrase.notes[0];
        pianoRoll.select([affected]);
        document.querySelector("#roll-humanize").click();
        document.querySelector("#humanize-timing").value = "0";
        document.querySelector("#humanize-bias").value = "50";
        document.querySelector("#humanize-velocity").value = "0";
        document.querySelector("#roll-humanize-form").requestSubmit();
        for (let attempt = 0; pianoRoll.saved === beforeHumanize && attempt < 50; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        check(pianoRoll.phrase.notes.some(note => note.pitch === affected.pitch && note.velocity === affected.velocity
            && Math.abs(note.position - affected.position - .1) < .0001)
            && untouched.every(original => pianoRoll.phrase.notes.some(note =>
                note.pitch === original.pitch && note.position === original.position && note.velocity === original.velocity)),
            `Humanize did not apply timing bias only to the selection: ${editor.status.textContent}`);
        editor.undoButton.click();
        check(pianoRoll.saved === beforeHumanize, "Undo did not restore the original humanized phrase");
        report.humanize = true;
        await pianoRoll.onSolo("User1");
        check(mixerParts.find(part => part.name === "User1").solo && pianoRoll.soloButton.getAttribute("aria-pressed") === "true",
            "The piano roll Solo did not reach the Mix Console");
        document.querySelector("#clear-solo").click();
        check(pianoRoll.soloButton.getAttribute("aria-pressed") === "false", "The piano roll did not track a Mixer Solo change");
        pianoRoll.scroll.scrollLeft = 0;
        pianoRoll.followButton.click();
        pianoRoll.position(100, .25, true);
        check(pianoRoll.scroll.scrollLeft === 0 && Number.isFinite(pianoRoll.playhead), "Disabling follow hid the playhead or scrolled the roll");
        pianoRoll.followButton.click();
        pianoRoll.position(100, .25, true);
        check(pianoRoll.scroll.scrollLeft > 0, "Enabling follow did not scroll to the playhead");
        pianoRoll.position(1, 0, false);
        pianoRoll.scroll.scrollLeft = 0;
        pianoRoll.select([pianoRoll.phrase.notes[0]]);
        pianoRoll.auditionButton.click();
        await pendingAudition;
        check(player.previewing && !playing && player.loadedSong.events.some(event => event.type === 0x90 && event.a === affected.pitch),
            "Audition did not send the selected note without starting the song transport");
        pianoRoll.auditionButton.click();
        report.pianoRollPlayback = true;
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
        const midiInput = document.querySelector("#roll-midi-file");
        if (midiInput) {
            const userMidi = Uint8Array.of(77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96, 77, 84, 114, 107, 0, 0, 0, 12,
                24, 0x92, 67, 97, 48, 0x82, 67, 0, 0, 0xff, 0x2f, 0);
            const midiFiles = new DataTransfer();
            midiFiles.items.add(new File([userMidi], "phrase.mid", { type: "audio/midi" }));
            midiInput.files = midiFiles.files;
            midiInput.dispatchEvent(new Event("change"));
            for (let i = 0; i < 50 && pianoRoll.phrase.notes.length !== 5; i++) {
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            const imported = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project)).userTracks[0];
            check(UserPhrase.read(imported.phrase).notes.some(note => note.pitch === 67 && note.position === .25
                && note.duration === .5 && note.velocity === 97), "MIDI import did not reach the saved user phrase");
            editor.undoButton.click();
            check(pianoRoll.phrase.notes.length === 4, "Undo did not remove the imported MIDI notes");
            report.midiPhraseImport = true;
        }
        document.querySelector("#add-user-track").click();
        document.querySelector("#user-track-form").requestSubmit();
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
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

        const findMixTrack = name => editor.mix.find(track => track.name === name);
        const trackDialog = document.querySelector("#user-track-form");
        const trackName = document.querySelector("#user-track-name");
        document.querySelector("#add-user-track").click();
        trackName.value = "Hand Drums";
        document.querySelector("#user-track-type").value = "drums";
        trackDialog.requestSubmit();
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(pianoRoll.name === "Hand Drums" && pianoRoll.phrase.drum
            && findMixTrack("Hand Drums")?.rhythmId === "SpDrumsUserChannelRhythmID", "The named drums track was not created");
        const drumNote = { position: 0, pitch: 42, velocity: 96, duration: .25 };
        pianoRoll.commit([drumNote], [drumNote]);
        document.querySelector("#roll-rename-track").click();
        trackName.value = "Practice Hi-Hat";
        trackDialog.requestSubmit();
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(!findMixTrack("Hand Drums") && findMixTrack("Practice Hi-Hat")?.rhythmId === "SpDrumsUserChannelRhythmID"
            && pianoRoll.phrase.notes[0].pitch === 42, "Renaming lost the drum phrase or its mix");
        document.querySelector("#roll-remove-track").click();
        trackDialog.requestSubmit();
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(!findMixTrack("Practice Hi-Hat") && pianoRoll.panel.hidden, "Deleting a track did not close its editor or remove its mix");
        editor.undoButton.click();
        await generate();
        check(findMixTrack("Practice Hi-Hat")?.rhythmId === "SpDrumsUserChannelRhythmID"
            && editor.project.userTracks.some(track => track.name === "Practice Hi-Hat"), "Undo did not restore the track and its mix");
        const rhythmBass = mixerParts.find(part => part.name === "Bass");
        const rhythmPhrase = UserPhrase.read(engine.exports.getRhythmTrackPhrase(rhythmBass.channel));
        await cloneRhythmTrack(rhythmBass);
        const cloned = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project)).userTracks.find(track => track.name === "Bass-1");
        const clonedMix = DesktopSongFiles.readMix(editor.desktopMixXml());
        check(cloned && rhythmPhrase.notes.length > 0 && cloned.phrase === UserPhrase.write(rhythmPhrase)
            && clonedMix.find(track => track.name === "Bass-1")?.patch === "Cello"
            && clonedMix.find(track => track.name === "Bass")?.mute, "The cloned track lost its phrase or mixer settings");
        editor.undoButton.click();
        await generate();
        check(!findMixTrack("Bass-1") && !findMixTrack("Bass").mute, "Undo did not restore the original accompaniment");
        editor.redoButton.click();
        await generate();
        check(findMixTrack("Bass-1")?.patch === "Cello" && findMixTrack("Bass").mute, "Redo did not restore clone settings");
        report.userTrackManagement = true;

        const sourceIndex = mixerParts.findIndex(part => part.name === "Bass");
        const sourceStrip = document.querySelector(`.strip[data-part-index="${sourceIndex}"]`);
        pianoRoll.open("User2");
        const dropData = new DataTransfer();
        sourceStrip.querySelector(".part-name").dispatchEvent(new DragEvent("dragstart", { dataTransfer: dropData }));
        const dragged = UserPhrase.read(dropData.getData(rhythmPhraseDragType)).notes;
        const countBeforeDrop = pianoRoll.phrase.notes.length;
        pianoRoll.scroll.dispatchEvent(new DragEvent("drop", { dataTransfer: dropData, cancelable: true }));
        check(dragged.length && pianoRoll.phrase.notes.length === countBeforeDrop + dragged.length
            && pianoRoll.phrase.notes.some(note => note.pitch === dragged[0].pitch && note.position === dragged[0].position),
            "Dragging the mixer track did not copy its notes at their original beats");
        editor.undoButton.click();
        check(pianoRoll.phrase.notes.length === countBeforeDrop, "Undo did not remove the dragged notes");
        await generate();
        let isolated;
        const originalDownload = downloadSongFile;
        try {
            downloadSongFile = (name, bytes) => { isolated = { name, bytes }; };
            await exportRhythmTrack(mixerParts.find(part => part.name === "Bass"));
        } finally { downloadSongFile = originalDownload; }
        const parsedTrack = parseMidi(isolated.bytes, song.barTimes.length - 1);
        check(isolated.name.endsWith("-Bass.mid") && parsedTrack.parts.length === 1
            && parsedTrack.events.some(event => event.type === 0xc0 && event.a === 42)
            && parsedTrack.barTimes.length === song.barTimes.length
            && parsedTrack.barTimes.every((time, index) => Math.abs(time - song.barTimes[index]) < 1e-6),
            `Isolated MIDI lost its channel, patch or tempo: ${isolated.name}, ${parsedTrack.parts.length} tracks, `
            + `programs ${parsedTrack.events.filter(event => event.type === 0xc0).map(event => event.a)}, `
            + `last bar ${parsedTrack.barTimes.at(-1)} vs ${song.barTimes.at(-1)}`);
        report.mixerTrackMidi = true;

        const userIndex = mixerParts.findIndex(part => part.name === "User2");
        const oldUserChannel = mixerParts[userIndex].channel;
        document.querySelector(`.strip[data-part-index="${userIndex}"] .channel-edit`).click();
        const userOutput = document.querySelector("#channel-output");
        const newChannel = Number([...userOutput.options].find(option => Number(option.value) !== oldUserChannel).value);
        userOutput.value = String(newChannel);
        document.querySelector("#channel-transpose").value = "2";
        document.querySelector("#channel-velocity-shift").value = "-10";
        for (const id of ["channel-program-enabled", "channel-volume-enabled", "channel-pan-enabled"]) {
            document.getElementById(id).checked = false;
        }
        document.querySelector("#channel-editor-form").requestSubmit();
        const advancedMix = DesktopSongFiles.readMix(editor.desktopMixXml()).find(track => track.name === "User2");
        check(advancedMix.channel === newChannel && advancedMix.transpose === 2 && advancedMix.velocityShift === -10
            && !advancedMix.instrumentEnabled && !advancedMix.volumeEnabled && !advancedMix.panEnabled,
            "Advanced channel settings did not reach the .mix file");
        await generate();
        const userPart = song.parts.findIndex(part => part.name === "User2");
        const userEvents = song.events.filter(event => event.part === userPart);
        check(song.parts[userPart].channel === newChannel && userEvents.some(event => event.type === 0x90 && event.a === 66 && event.b === 88)
            && !userEvents.some(event => event.type === 0xc0 || (event.type === 0xb0 && [7, 10].includes(event.a))),
            `Edited channel assignment, note changes or disabled controllers were missing from playback: ${JSON.stringify(userEvents.slice(0, 8))}`);
        report.advancedMixer = true;

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
            const missingStyle = "MissingExampleForRoundTrip.sty-ID";
            const saved = DesktopSongFiles.readSong(desktopFixture.song);
            const savedMix = DesktopSongFiles.readMix(desktopFixture.mix).map(track =>
                track.rhythmId === "jjSwing-ID" ? { ...track, rhythmId: missingStyle } : track);
            for (const part of saved.parts) part.styleId = missingStyle;
            saved.parts[0].parameters.rpVariationID = "Uninstalled style variation";
            editor.open(saved, savedMix, null, true);
            await generate();
            check(song.parts.some(part => part.styleId !== missingStyle) && editor.status.textContent.includes("MissingExampleForRoundTrip"),
                "Unavailable native rhythm did not produce a temporary accompaniment");
            const roundTrip = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
            check(roundTrip.parts.every(part => part.styleId === missingStyle)
                && roundTrip.parts[0].parameters.rpVariationID === "Uninstalled style variation",
                "Temporary playback replaced the saved native rhythm or variation");
            check(DesktopSongFiles.readMix(editor.desktopMixXml()).some(track => track.rhythmId === missingStyle),
                "Temporary playback replaced the saved native mix");
            await generate();
            check(editor.nativeMix.some(track => track.rhythmId === missingStyle), "Regenerating the substitute lost the native mix");
            report.missingStyleRoundTrip = true;
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
            if (!report.standaloneMix) {
                check(!song && !playing && !document.querySelector("#import-mix-button").disabled,
                    "Standalone mix import required prior playback or generation");
                const incoming = DesktopSongFiles.readMix(desktopFixture.mix).map(track =>
                    track.name === "Bass" ? { ...track, reverb: 91 } : track);
                const selection = new DataTransfer();
                selection.items.add(new File([DesktopSongFiles.writeMix(incoming)], "cross-rhythm.mix"));
                importMix.files = selection.files;
                await importMix.onchange();
                const destination = DesktopSongFiles.readMix(fixture.mix).find(track => track.name === "Bass");
                const merged = DesktopSongFiles.readMix(editor.desktopMixXml());
                check(!playing && engine.exports.wasImportedMixApplied()
                    && incoming.find(track => track.name === "Bass").rhythmId !== destination.rhythmId
                    && merged.some(track => track.name === "Bass" && track.rhythmId === destination.rhythmId
                        && track.channel === destination.channel && track.reverb === 91)
                    && merged.every(track => DesktopSongFiles.readMix(fixture.mix).some(original =>
                        original.name === track.name && original.rhythmId === track.rhythmId && original.channel === track.channel)),
                    "Standalone import failed to map the bass by voice type or changed destination track assignments");
                report.standaloneMix = true;
                const originalPair = new DataTransfer();
                originalPair.items.add(new File([fixture.song], `${fixture.name}.sng`));
                originalPair.items.add(new File([fixture.mix], `${fixture.name}.mix`));
                open.files = originalPair.files;
                await open.onchange();
                while (generating) await new Promise(resolve => setTimeout(resolve, 20));
                check(song && !playing && mixerParts.length, "The Mix Console did not open when loading a song before playback");
                const visible = () => [...document.querySelectorAll("#mixer-parts .strip")]
                    .map(strip => mixerParts[Number(strip.dataset.partIndex)]);
                check(!mixerRhythm.hidden && mixerRhythm.options.length > 2, "The mixer did not offer both song rhythms");
                mixerRhythm.value = mixerRhythm.options[1].value;
                mixerRhythm.dispatchEvent(new Event("change"));
                check(visible().length < mixerParts.length && visible().every(part =>
                    part.source === "user" || part.styleId === mixerRhythm.value), "Filtering changed the wrong mixer tracks");
                mixerRhythm.value = "";
                mixerRhythm.dispatchEvent(new Event("change"));
                check(visible().length === mixerParts.length, "The Mix Console could not restore all tracks");
                report.prePlaybackMixer = true;
            }
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
            if (fixture.name.startsWith("PetiteFleur")) {
                const originalProject = editor.project;
                const expanded = [];
                const savedFile = downloadSongFile;
                try {
                    downloadSongFile = (name, contents) => expanded.push({ name, ...JSON.parse(contents) });
                    document.querySelector("#duplicate-song").click();
                    document.querySelector("#linearize-song").click();
                } finally { downloadSongFile = savedFile; }
                const [copy, linear] = expanded;
                const sourceBars = DesktopSongFiles.barBeats(originalProject);
                check(editor.project === originalProject && copy.song.title !== originalProject.title
                    && JSON.stringify(copy.song.parts) === JSON.stringify(originalProject.parts)
                    && JSON.stringify(copy.mix) === JSON.stringify(editor.mix), "Saving a copy affected the open song or its mix");
                const roundTrip = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(linear.song));
                check(roundTrip.bars === sourceBars.length && roundTrip.parts.length === roundTrip.sections.length
                    && DesktopSongFiles.barBeats(roundTrip).join() === sourceBars.join()
                    && roundTrip.parts.every((part, index) => part.section === index && part.styleId === originalProject.parts[index].styleId),
                    "The unfolded .sng did not retain the original order, rhythms or meters");
                const printPreview = document.querySelector("#song-print-preview");
                const printDialog = document.querySelector("#song-print");
                document.querySelector("#open-song-print").click();
                check(printDialog.open && printPreview.querySelectorAll(".print-measure").length === originalProject.bars,
                    "The print dialog did not preview the original lead sheet");
                const unfold = document.querySelector("#song-print-unfold");
                unfold.checked = true;
                unfold.dispatchEvent(new Event("change", { bubbles: true }));
                check(printPreview.querySelectorAll(".print-measure").length === sourceBars.length, "Printing did not unfold the score");
                const printMode = document.querySelector("#song-print-mode");
                printMode.value = "structure";
                printMode.dispatchEvent(new Event("change", { bubbles: true }));
                check(printPreview.querySelectorAll("tbody tr").length === originalProject.parts.length
                    && document.querySelector("#song-print-orientation").value === "landscape",
                    "The print preview did not show the arrangement in landscape");
                const systemPrint = window.print;
                let printCalled = false;
                try {
                    window.print = () => { printCalled = true; };
                    document.querySelector("#song-print-form").requestSubmit();
                } finally { window.print = systemPrint; }
                check(printCalled && editor.project === originalProject, "Printing changed the open song or did not invoke the browser");
                printDialog.close();
                report.songPrintPreview = true;
                document.querySelector("#save-song-template").click();
                document.querySelector("#new-project").click();
                check(editor.project.title !== originalProject.title && editor.project.parts.length === originalProject.parts.length
                    && editor.mix.length === copy.mix.length, "New song did not load the saved template structure and mix");
                document.querySelector("#clear-song-template").click();
                document.querySelector("#new-project").click();
                check(editor.project.bars === 4 && editor.project.parts.length === 1, "Clearing the template did not restore the default song");
                report.songCopiesAndTemplates = true;
            }
        }
        if (desktopFixture.styles) {
            const speak = DesktopSongFiles.readSong(desktopFixture.song);
            const speakMix = DesktopSongFiles.readMix(desktopFixture.mix);
            const external = speak.parts.find(part => part.parameters.RP_SYS_OverrideTracksID?.includes("16BeatBallad.T547"));
            const sameRhythm = speak.parts.find(part => part.parameters.RP_SYS_OverrideTracksID?.includes("jjSwing-ID"));
            check(external && sameRhythm, "The Speak No Evil fixture has lost its track override examples");
            async function renderFixture(project, mix) {
                editor.open(structuredClone(project), structuredClone(mix), null, true);
                await generate();
                return song;
            }
            const notesIn = (timeline, partIndex, predicate) => {
                const { from, to } = editor.partRanges()[partIndex];
                const start = timeline.barTimes[from - 1], end = timeline.barTimes[to];
                return timeline.events.filter(event => event.type === 0x90 && event.b && event.seconds >= start - 1e-7
                    && event.seconds < end - 1e-7 && predicate(timeline.parts[event.part]))
                    .map(event => [event.tick, event.a, event.b]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
            };
            const noteDigest = async notes => [...new Uint8Array(await crypto.subtle.digest("SHA-256",
                new TextEncoder().encode(notes.map(note => note.join(",")).join("\n"))))]
                .map(byte => byte.toString(16).padStart(2, "0")).join("");
            const sameIndex = speak.parts.indexOf(sameRhythm);
            const externalIndex = speak.parts.indexOf(external);
            const nativeSpeak = await renderFixture(speak, speakMix);
            const bass = track => track.name === "Bass";
            const sameNotes = notesIn(nativeSpeak, sameIndex, bass);
            check(sameNotes.length && editor.status.textContent.includes("16BeatBallad.T547"),
                "The unavailable original donor was not reported or the same-rhythm override produced no notes");
            const neutral = structuredClone(speak);
            delete neutral.parts[sameIndex].parameters.RP_SYS_OverrideTracksID;
            const neutralSame = notesIn(await renderFixture(neutral, speakMix), sameIndex, bass);
            check(neutralSame.length > 0 && JSON.stringify(sameNotes) !== JSON.stringify(neutralSame),
                "The saved same-rhythm override did not change the Bass track");
            check(sameNotes.some((note, position) => position && note[0] === sameNotes[position - 1][0]
                && note[1] !== sameNotes[position - 1][1]), "Overridden Bass did not use the saved polyphonic Chord2 voice");

            const override = DesktopSongFiles.readTrackOverrides(external.parameters.RP_SYS_OverrideTracksID)
                .find(entry => entry.rhythm === "16BeatBallad.T547.prs-ID");
            await editor.openTrackOverrides(externalIndex);
            const replacement = document.querySelector("#override-rhythm");
            const destination = document.querySelector("#override-destination");
            const variation = document.querySelector("#override-variation");
            const overrideForm = document.querySelector("#track-overrides-form");
            replacement.value = "16BeatBallad2.S014.prs-ID";
            replacement.dispatchEvent(new Event("change"));
            for (let attempt = 0; destination.disabled && attempt < 100; attempt++) {
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            check(!destination.disabled, document.querySelector("#track-overrides-status").textContent);
            destination.value = override.destination;
            variation.value = override.variation ?? "";
            check(destination.value === override.destination, "The replacement style did not offer the saved destination voice");
            overrideForm.requestSubmit();
            const crossStyle = structuredClone(editor.project);
            await generate();
            const crossNotes = notesIn(song, externalIndex, bass);
            check(crossNotes.length > 0 && JSON.stringify(crossNotes) !== JSON.stringify(notesIn(nativeSpeak, externalIndex, bass)),
                "A donor that is absent from the song structure did not replace the Bass track");
            check(!mixerParts.some(track => track.styleId === "16BeatBallad2.S014.prs-ID")
                && engine.exports.wasImportedMixApplied(), "The donor used a new mix channel or invalidated the saved mix");
            const roundTripSpeak = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
            check(roundTripSpeak.parts[externalIndex].parameters.RP_SYS_OverrideTracksID
                === crossStyle.parts[externalIndex].parameters.RP_SYS_OverrideTracksID, "The external override did not round-trip");
            await editor.openTrackOverrides(externalIndex);
            document.querySelector("#clear-track-override").click();
            check(!DesktopSongFiles.readTrackOverrides(editor.project.parts[externalIndex].parameters.RP_SYS_OverrideTracksID)
                .some(entry => entry.source === override.source), "Clearing an override did not remove the selected mapping");
            editor.undoButton.click();
            check(editor.project.parts[externalIndex].parameters.RP_SYS_OverrideTracksID ===
                crossStyle.parts[externalIndex].parameters.RP_SYS_OverrideTracksID, "Undo did not restore the override");
            report.overrides = { sameRhythmNotes: sameNotes.length, externalStyleNotes: crossNotes.length,
                sameRhythmNoteDigest: await noteDigest(sameNotes), externalStyleNoteDigest: await noteDigest(crossNotes),
                editedInUi: true };

            await editor.openCustomPhrases(sameIndex);
            document.querySelector("#custom-phrase-track").value = "Bass";
            document.querySelector("#custom-phrase-form").requestSubmit();
            for (let attempt = 0; !pianoRoll.custom && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
            const partRange = editor.partRanges()[sameIndex];
            check(pianoRoll.custom?.index === sameIndex && pianoRoll.name === "Bass"
                && pianoRoll.boundaries.length === partRange.to - partRange.from + 2 && pianoRoll.phrase.notes.length,
                `The custom phrase did not open at the start of the selected song part: ${editor.status.textContent}`);
            const originalPhrase = pianoRoll.saved;
            const accentNote = { position: .25, duration: .25, pitch: 93, velocity: 117 };
            pianoRoll.commit([...pianoRoll.phrase.notes, accentNote], [accentNote]);
            const reopened = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
            const custom = DesktopSongFiles.readCustomPhrases(reopened.parts[sameIndex].parameters.RP_SYS_CustomPhraseId);
            check(UserPhrase.read(custom.get("Bass")).notes.some(note => note.pitch === 93 && note.position === .25),
                "The custom phrase was lost in .sng output");
            await generate();
            check(notesIn(song, sameIndex, bass).some(note => note[1] === 93)
                && !notesIn(song, externalIndex, bass).some(note => note[1] === 93),
                "The edited note did not play only in its selected song part");
            editor.undoButton.click();
            check(pianoRoll.saved === originalPhrase, "Undo did not restore the starting phrase");
            editor.redoButton.click();
            pianoRoll.close();
            await editor.openCustomPhrases(sameIndex);
            document.querySelector("#custom-phrase-track").value = "Bass";
            document.querySelector("#custom-phrase-track").dispatchEvent(new Event("change"));
            document.querySelector("#clear-custom-phrase").click();
            check(!DesktopSongFiles.readCustomPhrases(editor.project.parts[sameIndex].parameters.RP_SYS_CustomPhraseId).has("Bass"),
                "Restoring the original phrase did not remove the Bass replacement");
            report.customPhraseEditing = true;

            const petite = desktopFixture.multiStyle.find(fixture => fixture.name.startsWith("PetiteFleur"));
            if (petite) {
                const score = DesktopSongFiles.readSong(petite.song), mix = DesktopSongFiles.readMix(petite.mix);
                const index = score.parts.findIndex(part => part.parameters.RP_SYS_DrumsTransformId?.includes("SNARE=-41"));
                check(index >= 0, "The Petite Fleur fixture has lost its drum transform example");
                const drums = track => track.drum;
                const transformed = notesIn(await renderFixture(score, mix), index, drums);
                const neutralDrums = structuredClone(score);
                delete neutralDrums.parts[index].parameters.RP_SYS_DrumsTransformId;
                const baseline = notesIn(await renderFixture(neutralDrums, mix), index, drums);
                check(transformed.length && baseline.length && transformed.some(note => baseline.some(other =>
                    note[0] === other[0] && note[1] === other[1] && note[2] < other[2])), "Saved drum mix did not reduce note velocity");
                await editor.openDrumTransforms(index);
                const type = document.querySelector("#drum-transform-type");
                type.value = "AddTambourineEightsId";
                check(type.value === "AddTambourineEightsId", document.querySelector("#drum-transform-status").textContent);
                document.querySelector("#add-drum-transform").click();
                const velocity = document.querySelector('[data-transform-velocity="AddTambourineEightsId"]');
                check(velocity?.value === "0", "The selected drum transform did not expose its desktop default");
                velocity.value = "-20";
                velocity.dispatchEvent(new Event("input"));
                document.querySelector('[data-drum-offset="SNARE"]').value = "-20";
                const originalPlay = player.play;
                const originalStop = player.stop;
                const beforePreview = song;
                const savedTransform = editor.project.parts[index].parameters.RP_SYS_DrumsTransformId;
                let previewNotes, stoppedPreview = false;
                player.play = async (previewSong, ...args) => {
                    if (args.at(-1)?.preview) previewNotes = previewSong.events;
                    return originalPlay.call(player, previewSong, ...args);
                };
                player.stop = async () => { stoppedPreview = true; return originalStop.call(player); };
                try {
                    await document.querySelector("#preview-drum-transforms").onclick();
                    check(previewNotes?.some(note => note.type === 0x90 && note.a === 54 && note.b > 0),
                        `The preview did not play the unsaved pattern: ${document.querySelector("#drum-transform-status").textContent}`);
                    check(song === beforePreview && editor.project.parts[index].parameters.RP_SYS_DrumsTransformId === savedTransform,
                        "Preview changed the project or replaced the prepared accompaniment");
                    document.querySelector("#stop-drum-transforms").click();
                    await pendingAudition;
                    check(stoppedPreview, "Stop did not stop the drum preview");
                } finally { player.play = originalPlay; player.stop = originalStop; }
                document.querySelector("#drum-transforms-form").requestSubmit();
                const layered = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
                check(layered.parts[index].parameters.RP_SYS_DrumsTransformId === "[AddTambourineEightsId#VelocityOffset=-20|DrumsMixIdhidden#SNARE=-20]",
                    "The drum transform edit lost its pattern or velocity offset in the saved song");
                await generate();
                const tambourine = notesIn(song, index, drums);
                check(tambourine.filter(note => note[1] === 54).length > baseline.filter(note => note[1] === 54).length,
                    "The built-in Tambourine pattern was not applied from the edited transform chain");
                check(tambourine.some(note => note[1] === 54 && previewNotes.some(event => event.type === 0x90 && event.a === 54 && event.b === note[2])),
                    "The tambourine velocity did not match between preview and saved playback");
                // The desktop AccentProcessor may insert or choose a crash at random.
                const withoutCrash = notes => notes.filter(note => ![49, 52, 55, 57].includes(note[1]));
                report.drumsTransform = { originalNotes: transformed.length, addedTambourineNotes: tambourine.length - baseline.length,
                    originalNonCrashDigest: await noteDigest(withoutCrash(transformed)),
                    tambourineNonCrashDigest: await noteDigest(withoutCrash(tambourine)) };
            }
        }
        const gridText = ["title=X", "tempoBPM=96", "| Cmaj7 | F7 G7 | % | 3/4 Dm7 | G7 |"].join("\n");
        const textFiles = new DataTransfer();
        textFiles.items.add(new File([gridText], "practice-grid.txt", { type: "text/plain" }));
        workspace.dispatchEvent(new DragEvent("drop", { dataTransfer: textFiles, bubbles: true, cancelable: true }));
        for (let attempt = 0; editor.project.title !== "X" && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(editor.project.title === "X" && editor.project.tempo === 96 && editor.project.bars === 5
            && editor.project.sections[1].meter === "THREE_FOUR" && song.barTimes.length === 6,
            `The dropped text chart did not retain its title, tempo, sections, or meter: ${editor.status.textContent} ${status.textContent}`);
        check(editor.project.chords.filter(chord => chord.bar === 2).map(chord => chord.name).join() === "F7,G7",
            "The imported percent repeat did not keep both chords");
        const beatText = await editor.onReadTextSong("useBase1\n1, 1, C\n3, 2.5, G7/B");
        check(beatText.bars === 3 && beatText.chords.some(chord => chord.bar === 2 && chord.beat === 1.5 && chord.name === "G7/B"),
            "Beat-based text positions were not imported");
        const timed = await editor.onReadTextSong("tempo=120\n0, C\n2.5, G7");
        check(timed.bars === 2 && timed.chords.some(chord => chord.bar === 1 && chord.beat === 1 && chord.name === "G7"),
            "Timestamp-based positions were not converted using the tempo");
        const mixedFiles = new DataTransfer();
        mixedFiles.items.add(new File([desktopFixture.song], "drop.sng"));
        mixedFiles.items.add(new File([desktopFixture.mix], "drop.mix"));
        workspace.dispatchEvent(new DragEvent("drop", { dataTransfer: mixedFiles, bubbles: true, cancelable: true }));
        for (let attempt = 0; !editor.project.title.startsWith("SpeakNoEvil") && attempt < 100; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(editor.project.title.startsWith("SpeakNoEvil") && engine.exports.wasImportedMixApplied(),
            "Dropping a desktop song with its mix did not keep the paired mix");
        report.textAndDropImport = true;
        if (location.protocol !== "file:") {
            const privateFiles = await navigator.storage.getDirectory();
            const songDirectory = await privateFiles.getDirectoryHandle("desktop-song-file-test", { create: true });
            const writeFixture = async (name, contents) => {
                const handle = await songDirectory.getFileHandle(name, { create: true });
                const stream = await handle.createWritable();
                await stream.write(contents);
                await stream.close();
            };
            await writeFixture("original.sng", desktopFixture.song);
            await writeFixture("ORIGINAL.mix", desktopFixture.mix);
            const directoryPicker = window.showDirectoryPicker;
            try {
                window.showDirectoryPicker = async () => songDirectory;
                await folderIO.openButton.onclick();
                check(folderIO.dialog.open && folderIO.options.options.length === 1,
                    "The folder dialog did not find the native song");
                await document.querySelector("#song-folder-form").onsubmit({ preventDefault() {} });
                while (generating) await new Promise(resolve => setTimeout(resolve, 20));
                check(folderIO.active?.song.name === "original.sng" && folderIO.active.mix?.name === "ORIGINAL.mix"
                    && engine.exports.wasImportedMixApplied(), "Folder open did not locate the same-name mix");
                editor.title.value = "Edited on the Web";
                editor.title.dispatchEvent(new Event("input", { bubbles: true }));
                await folderIO.saveButton.onclick();
                const readLocal = async name => (await (await songDirectory.getFileHandle(name)).getFile()).text();
                check(DesktopSongFiles.readSong(await readLocal("original.sng")).title === "Edited on the Web"
                    && DesktopSongFiles.readMix(await readLocal("ORIGINAL.mix")).length === editor.nativeMix.length,
                    `Overwriting the pair did not reflect the current song and mix: ${editor.status.textContent}`);
                const savingCopy = folderIO.copyButton.onclick();
                const nameDialog = document.querySelector("#song-folder-save-dialog");
                for (let attempt = 0; !nameDialog.open && attempt < 50; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
                document.querySelector("#song-folder-save-name").value = "Separate Copy";
                document.querySelector("#song-folder-save-form").requestSubmit();
                await savingCopy;
                check(DesktopSongFiles.readSong(await readLocal("Separate Copy.sng")).title === "Edited on the Web"
                    && DesktopSongFiles.readMix(await readLocal("Separate Copy.mix")).length === editor.nativeMix.length,
                    "Save As did not create the independently named pair");
            } finally { window.showDirectoryPicker = directoryPicker; }
            report.songFolderAccess = true;
        }
        const recovering = "Recoverable working copy";
        editor.title.value = recovering;
        editor.title.dispatchEvent(new Event("input", { bubbles: true }));
        const savedNotes = editor.project.userTracks.map(track => track.phrase);
        const storedId = recentSongs.id;
        await recentSongs.flush();
        check((await recentSongs.records())[0]?.id === storedId, "The working copy did not reach browser storage");
        document.querySelector("#new-project").click();
        await recentSongs.restore();
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(editor.project.title === recovering && recentSongs.id === storedId
            && editor.project.userTracks.map(track => track.phrase).join() === savedNotes.join(), "Startup restore did not recover the working copy");
        document.querySelector("#new-project").click();
        await document.querySelector("#open-recent-songs").onclick();
        const recent = [...document.querySelectorAll("#recent-song-list button")].find(button => button.textContent === recovering);
        check(Boolean(recent), "The recovered song was missing from Recent Songs");
        recent.click();
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(editor.project.title === recovering && !document.querySelector("#recent-songs").open, "Recent Songs did not reopen the selected project");
        report.recentSongsAndRecovery = true;
        const sectionForAppearance = editor.project.sections.find(section => section.bar > 0 && editor.grid.children[section.bar].querySelector(".chord-symbol"));
        check(Boolean(sectionForAppearance), "The real song has no later section with an opening chord");
        const appearanceBar = sectionForAppearance.bar;
        editor.grid.children[appearanceBar].querySelector(".chord-symbol").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        document.querySelector('#bar-context [data-action="appearance"]').click();
        const appearance = document.querySelector("#score-appearance form");
        check(appearance.parentElement.open && !document.querySelector("#score-appearance-chord-fields").hidden, "Chord appearance did not open from the context menu");
        for (const [name, value] of [["Section", "#226633"], ["Chord", "#5d1634"]]) {
            const reset = appearance.elements[`default${name}Color`];
            if (reset.checked) reset.click();
            appearance.elements[`${name.toLowerCase()}Color`].value = value;
        }
        appearance.elements.newLine.checked = true;
        appearance.requestSubmit();
        editor.sheetColumns.value = 6;
        editor.sheetColumns.dispatchEvent(new Event("change"));
        editor.sheetHeight.value = 85;
        editor.sheetHeight.dispatchEvent(new Event("change"));
        const scoreWithAppearance = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
        const renderedBar = editor.grid.children[appearanceBar];
        check(scoreWithAppearance.sections.find(section => section.bar === appearanceBar).clientProperties.PropSectionStartOnNewLine === "true"
            && renderedBar.style.gridColumnStart === "1" && renderedBar.style.getPropertyValue("--section-color") === "#226633"
            && renderedBar.querySelector(".chord-symbol").style.color === "rgb(93, 22, 52)", "Section and chord appearance did not display and round-trip");
        check(scoreWithAppearance.clientProperties.PropClEditorZoomFactorX === "67" && scoreWithAppearance.clientProperties.PropClEditorZoomFactorY === "85"
            && editor.grid.style.getPropertyValue("--sheet-columns") === "6" && editor.grid.style.getPropertyValue("--bar-height-zoom") === "1.7", "Native zoom factors did not display and round-trip");
        report.sheetAppearance = true;
        editor.openScoreAppearance();
        appearance.elements.quantization.value = "HALF_BEAT";
        appearance.elements.allSections.checked = true;
        appearance.requestSubmit();
        const savedQuantization = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
        check(savedQuantization.sections.every(section => section.clientProperties.PropSectionQuantization === "HALF_BEAT"),
            "Applying quantization to every section did not save the native setting");
        const origin = editor.project.chords[0];
        const target = Array.from({ length: editor.project.bars }, (_, bar) => bar)
            .find(bar => !editor.project.chords.some(chord => chord.bar === bar && chord.beat === .5));
        const meter = editor.project.sections.findLast(section => section.bar <= target).meter;
        const beatCount = DesktopSongFiles.meters[meter][1];
        const destinationCell = editor.grid.children[target];
        const rulerBounds = destinationCell.querySelector(".beat-ruler").getBoundingClientRect();
        const payload = new DataTransfer();
        payload.setData("application/x-jjazz-chord", JSON.stringify([origin.bar, origin.beat]));
        await destinationCell.ondrop(new DragEvent("drop", { dataTransfer: payload, ctrlKey: true, clientX: rulerBounds.left + rulerBounds.width * .62 / beatCount }));
        check(editor.project.chords.some(chord => chord.bar === target && chord.beat === .5 && chord.name === origin.name),
            "Dragging with half-beat quantization did not copy the chord to beat 1.5");
        const swingGrid = structuredClone(editor.project);
        swingGrid.sections[0].meter = "FOUR_FOUR";
        delete swingGrid.sections[0].clientProperties.PropSectionQuantization;
        swingGrid.parts[0].section = 0;
        swingGrid.parts[0].styleId = "jjSwing-ID";
        const [, beatOnSwingGrid] = await editor.onQuantizeChordDrop(swingGrid, swingGrid.sections[0], 0, .34);
        check(Math.abs(beatOnSwingGrid - 1 / 3) < .0001, "Automatic chord quantization did not follow jjSwing's ternary division");
        report.chordDropQuantization = true;
        await generate();
        const downloads = [];
        const realAnchorClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
            if (/\.(wav|mp3)$/u.test(this.download)) downloads.push({ name: this.download, data: fetch(this.href).then(reply => reply.arrayBuffer()) });
            else realAnchorClick.call(this);
        };
        try {
            const renderStatus = () => document.querySelector("#status").textContent;
            await document.querySelector("#export-wave").onclick();
            check(downloads.length === 1, `Whole-song WAV download was not created: ${renderStatus()}`);
            const track = mixerParts.find(part => part.trackIndex !== undefined && song.events.some(event => song.parts[event.part]?.id === part.id
                && event.type === 0x90 && event.b > 0));
            check(Boolean(track), "The working song has no rendered track to export");
            await exportAudio("wav", track.id);
            check(downloads.length === 2 && downloads[1].name.includes(track.name), `Track WAV download was not created: ${renderStatus()}`);
            const excerpt = editor.createPracticeSong(0, 3, editor.project.tempo, editor.project.tempo, 2);
            editor.open(excerpt.song, excerpt.mix, excerpt.style, true);
            while (generating) await new Promise(resolve => setTimeout(resolve, 20));
            await generate();
            await document.querySelector("#export-mp3").onclick();
            check(downloads.length === 3 && downloads[2].name.endsWith(".mp3"), `Whole-song MP3 download was not created: ${renderStatus()}`);
            const excerptTrack = mixerParts.find(part => part.trackIndex !== undefined && song.events.some(event => song.parts[event.part]?.id === part.id
                && event.type === 0x90 && event.b > 0));
            check(Boolean(excerptTrack), "The MP3 excerpt has no rendered track to export");
            await exportAudio("mp3", excerptTrack.id);
            check(downloads.length === 4 && downloads[3].name.includes(excerptTrack.name), `Track MP3 download was not created: ${renderStatus()}`);
        } finally { HTMLAnchorElement.prototype.click = realAnchorClick; }
        const [wave, trackWave] = await Promise.all(downloads.slice(0, 2).map(async file => new DataView(await file.data)));
        for (const file of [wave, trackWave]) {
            check(file.getUint32(0) === 0x52494646 && file.getUint32(8) === 0x57415645 && file.getUint32(24, true) === 44100
                && file.getUint16(22, true) === 2 && file.getUint16(34, true) === 16 && file.getUint32(40, true) === file.byteLength - 44,
                "The downloaded file does not have a valid stereo PCM WAV header");
        }
        const outputEnergy = file => {
            let energy = 0;
            for (let byte = 44; byte < file.byteLength; byte += 148) energy += file.getInt16(byte, true) ** 2;
            return energy;
        };
        check(outputEnergy(wave) > 0 && outputEnergy(trackWave) > 0 && outputEnergy(wave) !== outputEnergy(trackWave),
            "The full song and its isolated track did not render distinct audible WAV files");
        report.wavExport = { songBytes: wave.byteLength, trackBytes: trackWave.byteLength, channels: 2, sampleRate: 44100 };
        const decoder = new OfflineAudioContext(2, 1, 44100);
        const mp3 = await Promise.all(downloads.slice(2).map(async file => decoder.decodeAudioData(await file.data)));
        const peaks = mp3.map(audio => audio.getChannelData(0).reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0));
        check(mp3.every(audio => audio.numberOfChannels === 2 && Math.abs(audio.duration - song.duration) < .25)
            && peaks.every(peak => peak > .001) && peaks[0] !== peaks[1], "Chrome did not decode distinct audible MP3 files at the expected duration");
        report.mp3Export = { seconds: mp3[0].duration, channels: 2 };
        report.ok = true;
    } catch (error) { report.ok = false; report.error = error.stack || error.message; }
    console.log("JJAZZ_SMOKE_RESULT=" + JSON.stringify(report));
})();
