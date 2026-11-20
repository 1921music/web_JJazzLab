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
        const sharedFill = document.querySelector('#part-parameter-fields [data-parameter="RpFillID"]');
        check(sharedFill instanceof HTMLSelectElement && sharedFill.querySelector('[value="always"]'), "The shared Fill editor did not use rhythm choices");
        sharedFill.value = "always";
        document.querySelector("#part-editor-form").requestSubmit();
        check(editor.project.parts.slice(1, 3).every(part => part.name === "Practice" && part.styleId === bundledStyle + "-ID"
            && part.parameters.rpTempoID === "90" && part.parameters.RpFillID === "always") && editor.project.parts[0].name !== "Practice",
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
        {
            const clickContext = element => element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
            const action = id => editor.contextMenu.querySelector(`[data-action="${id}"]`);
            clickContext(editor.grid.children[0].querySelector(".bar-annotation"));
            check(!action("annotation").hidden && !action("clear-annotation").hidden && action("remove-bars").hidden,
                "The annotation menu offered bar actions or omitted annotation actions");
            action("clear-annotation").click();
            check(!editor.grid.children[0].querySelector(".bar-annotation"), "Deleting from the annotation menu did not remove the annotation");
            editor.undoButton.click();
            const later = editor.project.sections.find(section => section.bar > 0);
            clickContext(editor.grid.children[later.bar].querySelector(".section-band"));
            check(!action("section").hidden && !action("section-break").hidden && action("chord").hidden,
                "The section menu showed unrelated chord actions");
            action("section-break").click();
            check(editor.grid.children[later.bar].style.gridColumnStart === "1", "The section context menu did not apply the line break");
            editor.undoButton.click();
            clickContext(editor.grid.children[0].querySelector(".chord-symbol"));
            check(!action("chord").hidden && !action("appearance").hidden && action("section-break").hidden && action("insert").hidden,
                "The chord menu showed unrelated bar actions");
            editor.contextMenu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
            clickContext(editor.grid.children[0]);
            check(!action("insert").hidden && !action("remove-bars").hidden && action("chord").hidden,
                "The bar context did not restore bar-only actions");
            editor.contextMenu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
            report.contextTargets = true;
        }
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
            if (fixture.name.startsWith("Django")) {
                const swing = editor.project.parts.findIndex(part => DesktopSongFiles.sourceStyleId(part.styleId) === "jjSwing-ID");
                const yamaha = editor.project.parts.findIndex(part => DesktopSongFiles.sourceStyleId(part.styleId) !== "jjSwing-ID");
                const row = (index, id) => editor.parts.children[index].querySelector(`[data-rhythm-parameter="${id}"]`);
                check(!row(swing, "BassStyleId").querySelector("input").disabled && row(yamaha, "BassStyleId").querySelector("input").disabled,
                    "The Yamaha and jjSwing parts did not distinguish their native parameters");
                for (const index of [swing, yamaha]) {
                    const variationList = row(index, "rpVariationID").querySelector("datalist");
                    const native = editor.parametersFor(editor.project.parts[index].styleId).get("rpVariationID");
                    check(Array.from(variationList.options, option => option.value).join() === native.values.join(), "Variation choices differ from the native rhythm");
                    check(!row(index, "RP_SYS_OverrideTracksID").querySelector("button").disabled,
                        "The native custom parameter could not open its editor");
                }
                editor.selectPart(swing);
                editor.selectPart(yamaha, false, { toggle: true });
                editor.openPartEditor(swing);
                const fields = document.querySelector("#part-parameter-fields");
                check(fields.querySelector('[data-parameter="RpFillID"]') && !fields.querySelector('[data-parameter="BassStyleId"]'),
                    "The batch editor did not restrict editing to shared rhythm parameters");
                document.querySelector("#cancel-part-edit").click();
                report.rhythmParameterDefinitions = true;
            }
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
        const firstTab = songTabs.active;
        const firstProject = editor.project;
        const priorUndoCount = editor.undoStack.length;
        const scoreBeforeTabSwitch = DesktopSongFiles.writeSong(firstProject);
        document.querySelector("#new-project").click();
        const secondTab = songTabs.active;
        editor.title.value = "Second open song";
        editor.title.dispatchEvent(new Event("input", { bubbles: true }));
        const tabButton = entry => document.querySelectorAll('#song-tabs [role="tab"]')[songTabs.entries.indexOf(entry)];
        check(firstTab !== secondTab && tabButton(firstTab) && tabButton(secondTab).hasAttribute("data-modified"), "A new song did not keep the first tab and flag the edited second tab");
        tabButton(firstTab).click();
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(editor.project === firstProject && DesktopSongFiles.writeSong(editor.project) === scoreBeforeTabSwitch
            && editor.undoStack.length === priorUndoCount && tabButton(firstTab).getAttribute("aria-selected") === "true", "Tab switching lost score changes or its undo history");
        const confirmClose = window.confirm;
        let prompts = 0;
        try {
            window.confirm = () => { prompts++; return false; };
            tabButton(secondTab).parentElement.querySelector("button:last-child").click();
            check(songTabs.entries.includes(secondTab) && prompts === 1, "Canceling the unsaved confirmation closed the second song");
            window.confirm = () => { prompts++; return true; };
            tabButton(secondTab).parentElement.querySelector("button:last-child").click();
            check(!songTabs.entries.includes(secondTab) && editor.project === firstProject && prompts === 2, "Confirming close changed the active song or kept the closed tab");
        } finally { window.confirm = confirmClose; }
        report.songTabs = true;
        const importedForBatch = DesktopSongFiles.readSong(desktopFixture.song);
        const mixForBatch = DesktopSongFiles.readMix(desktopFixture.mix);
        importedForBatch.title = "Duplicate ZIP title";
        editor.open(importedForBatch, mixForBatch, undefined, true);
        document.querySelector("#new-project").click();
        editor.title.value = importedForBatch.title;
        editor.title.dispatchEvent(new Event("input", { bubbles: true }));
        const activeBeforeBatchSave = editor.project;
        const clickAnchor = HTMLAnchorElement.prototype.click;
        let archiveDownload;
        HTMLAnchorElement.prototype.click = function () {
            if (this.download === "JJazzLab-songs.zip") archiveDownload = fetch(this.href).then(reply => reply.arrayBuffer());
            else clickAnchor.call(this);
        };
        try { document.querySelector("#save-all-songs").click(); }
        finally { HTMLAnchorElement.prototype.click = clickAnchor; }
        check(Boolean(archiveDownload), `The open-song ZIP was not saved: ${editor.status.textContent}`);
        const batchZip = new DataView(await archiveDownload);
        const batchFiles = new Map();
        for (let offset = 0; batchZip.getUint32(offset, true) === 0x04034b50;) {
            const length = batchZip.getUint32(offset + 18, true), nameLength = batchZip.getUint16(offset + 26, true);
            const decoder = new TextDecoder();
            const name = decoder.decode(new Uint8Array(batchZip.buffer, offset + 30, nameLength));
            const start = offset + 30 + nameLength;
            if (name.endsWith(`/Duplicate ZIP title.sng`) || name.endsWith(`/Duplicate ZIP title.mix`)) {
                batchFiles.set(name, decoder.decode(new Uint8Array(batchZip.buffer, start, length)));
            }
            offset = start + length;
        }
        const exportedScores = [...batchFiles].filter(([name]) => name.endsWith(".sng"));
        check(exportedScores.length === 2 && exportedScores.every(([, xml]) => DesktopSongFiles.readSong(xml).title === importedForBatch.title),
            "Save All lost one of the songs with an identical title");
        const batchOriginalScore = exportedScores.find(([, xml]) => DesktopSongFiles.readSong(xml).bars === importedForBatch.bars);
        const batchSavedMix = batchFiles.get(batchOriginalScore?.[0].replace(/\.sng$/u, ".mix"));
        check(Boolean(batchSavedMix) && DesktopSongFiles.readMix(batchSavedMix).length === mixForBatch.length, "Save All lost the imported mix");
        check(editor.project === activeBeforeBatchSave && !songTabs.isDirty(songTabs.active), "Saving all songs changed tabs or kept a saved song marked as unsaved");
        report.allSongsArchive = true;
        {
            const [phaseDance, soul] = desktopFixture.legacySongs.map(DesktopSongFiles.readSong);
            check(phaseDance.title === "PhaseDance" && phaseDance.tempo === 191 && phaseDance.sections.length > 10
                && phaseDance.chords.some(chord => chord.features?.includes("HOLD"))
                && phaseDance.parts[0].parameters.rpVariationID === "Intro A-1"
                && phaseDance.sections.find(section => section.name === "INTRO1").clientProperties.PropSectionStartOnNewLine === "true",
                "The 2020 song did not migrate its old rhythm parameters, articulation, and layout");
            check(soul.bars === 8 && soul.tempo === 116 && soul.parts[0].styleId === "Soul.S584.prs-ID"
                && soul.parts[0].parameters.RpFillID === "always"
                && soul.sections[0].clientProperties.PropSectionQuantization === "ONE_QUARTER_BEAT", "The 2022 song did not migrate its parameters");
            for (const track of [phaseDance, soul]) {
                const latestXml = DesktopSongFiles.writeSong(track);
                const reopened = DesktopSongFiles.readSong(latestXml);
                check(latestXml.includes("<spVERSION>4</spVERSION>") && reopened.parts.map(part => part.styleId).join() === track.parts.map(part => part.styleId).join()
                    && reopened.chords.map(chord => chord.features ?? "").join() === track.chords.map(chord => chord.features ?? "").join(),
                    "A migrated song lost its rhythm IDs or chord features when saved in current form");
            }
            editor.open(soul, [], undefined, true);
            await generate();
            check(song.events.some(event => event.type === 0x90 && event.b > 0) && song.barTimes.length > soul.bars, "The older Soul arrangement could not play");
            if (desktopFixture.legacyMix) {
                const oldMix = DesktopSongFiles.readMix(desktopFixture.legacyMix);
                const latestMixXml = DesktopSongFiles.writeMix(oldMix);
                check(oldMix.length > 3 && latestMixXml.includes("<spVERSION>5</spVERSION>")
                    && JSON.stringify(DesktopSongFiles.readMix(latestMixXml)) === JSON.stringify(oldMix), "The legacy mix lost its track assignments or sound settings");
            }
            report.legacyDesktopFiles = { songVersions: [1, 2], mixFixture: Boolean(desktopFixture.legacyMix) };
        }
        {
            editor.grid.children[0].querySelector(".chord-symbol").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
            editor.contextMenu.querySelector('[data-action="chord-tools"]').click();
            const dialog = document.querySelector("#chord-tools");
            const chordTools = dialog.querySelector("form");
            const type = chordTools.elements.chordType;
            for (let attempt = 0; type.disabled && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
            check(dialog.open && type.querySelector('[value="m7"]') && document.querySelector("#chord-preview-notes").textContent.includes("E"),
                `The chord catalog or constituent notes did not load: ${document.querySelector("#chord-tools-status").textContent}`);
            type.value = "m7";
            await type.onchange();
            const playOriginal = player.play;
            let pitches;
            player.play = async (previewSong, ...args) => {
                if (args.at(-1)?.preview) pitches = [...new Set(previewSong.events.filter(event => event.type === 0x90).map(event => event.a))];
                return playOriginal.call(player, previewSong, ...args);
            };
            try {
                await chordTools.elements.previewChord.onclick();
                check(pitches?.join() === "60,63,67,70", `The audition did not play the native C minor seventh notes: ${document.querySelector("#chord-tools-status").textContent}`);
            } finally { player.play = playOriginal; }
            chordTools.requestSubmit();
            check(editor.project.chords[0].name === "Cm7", "The selected chord type was not applied");
            await pendingAudition;
            editor.undoButton.click();
            const before = editor.project.chords.map(chord => chord.name);
            editor.selectBar(4);
            editor.selectBar(5, true);
            await editor.transposeChords(1);
            check(editor.project.chords.filter(chord => chord.bar === 4 || chord.bar === 5).map(chord => chord.name).join() === "F#m7,G#7"
                && editor.project.chords[0].name === before[0], "The selected chord range did not transpose by one semitone");
            editor.undoButton.click();
            check(editor.project.chords.map(chord => chord.name).join() === before.join(), "Chord range transposition did not undo cleanly");
            report.chordTypeTransposeAndPreview = true;
        }
        {
            const right = node => node.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
            const action = id => editor.contextMenu.querySelector(`[data-action="${id}"]`).click();
            const project = editor.project;
            let text;
            const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
            Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
                writeText: async value => { text = value; }, readText: async () => text
            } });
            try {
                right(editor.grid.children[0].querySelector(".chord-symbol"));
                action("cut");
                check(!project.chords.some(chord => chord.bar === 0) && text === "| C |", "Cut did not transfer the selected chord alone");
                right(editor.grid.children[1]);
                action("paste");
                check(project.chords.some(chord => chord.bar === 1 && chord.name === "C"), "Pasted chord did not reach the selected bar");
                editor.undoButton.click(); editor.undoButton.click();
                editor.editArrangement(() => { project.annotations = [{ bar: 0, text: "Comp lightly" }]; });
                right(editor.grid.children[0].querySelector(".bar-annotation,.bar-annotation-marker"));
                action("copy");
                right(editor.grid.children[1]);
                action("paste");
                check(project.annotations.some(note => note.bar === 1 && note.text === "Comp lightly"), "Annotation copy changed the wrong bar");
                editor.editArrangement(() => editor.setSectionName(3, "New Section", "FOUR_FOUR"));
                right(editor.grid.children[3].querySelector(".section-band"));
                action("copy");
                right(editor.grid.children[6]);
                action("paste");
                check(project.sections.some(section => section.bar === 6 && section.name === "New Section-2"), "Pasted section did not get a unique name");
                editor.undoButton.click();
                right(editor.grid.children[3].querySelector(".section-band"));
                action("cut");
                check(!project.sections.some(section => section.bar === 3) && project.parts.every(part => project.sections[part.section]), "Cut left stale section references");
                editor.undoButton.click();
                editor.selectBar(0); editor.selectBar(1, true);
                editor.barAction("copy");
                check(text.startsWith("| 4/4 C |"), "The system clipboard text omitted the initial meter");
                const bars = project.bars;
                editor.selectBar(3);
                editor.barAction("paste-insert");
                check(project.bars === bars + 2 && project.sections.some(section => section.bar === 5 && section.name === "New Section")
                    && project.chords.some(chord => chord.bar === 3 && chord.name === "C"), "Inserting copied bars lost structure or shifted chords incorrectly");
                editor.undoButton.click();
                editor.selectBar(3);
                text = "| 3/4 Dm7 | G7 |";
                await editor.pasteClipboardText(3, false);
                check(project.bars === bars + 2 && project.sections.some(section => section.bar === 3 && section.meter === "THREE_FOUR")
                    && project.chords.some(chord => chord.bar === 4 && chord.name === "G7") && project.sections.some(section => section.bar === 5 && section.meter === "FOUR_FOUR"),
                    "Pasting lead-sheet text did not preserve both time signatures");
                editor.undoButton.click();
                report.scoreClipboard = true;
            } finally {
                if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
                else delete navigator.clipboard;
            }
        }
        {
            const fixture = DesktopSongFiles.readSong(desktopFixture.legacySongs[1]);
            for (const part of fixture.parts) Object.assign(part, { styleId: "jjSwing-ID", styleName: "jjSwing", parameters: {} });
            editor.open(fixture, [], undefined, true);
            const score = editor.project;
            const bars = score.bars;
            editor.selectBar(2);
            editor.barAction("chord-progression");
            const form = document.querySelector("#chord-progressions form");
            const preset = [...form.elements.progression.options].find(option => option.value.startsWith("|C7M Am"));
            check(Boolean(preset), "The desktop major presets were not available");
            form.elements.progression.value = preset.value;
            await form.onsubmit(new Event("submit", { cancelable: true }));
            check(!form.parentElement.open && score.chords.some(chord => chord.bar === 2 && chord.beat === 2 && chord.name === "Am")
                && editor.selectedRange().join() === "2,5", "The preset did not apply at the expected beat or select the resulting passage");
            await editor.insertSongBoundary(true);
            await editor.insertSongBoundary(false);
            check(score.bars === bars + 2 && score.sections[0].name === "Start" && score.sections[1].bar === 1
                && score.sections[1].clientProperties.PropSectionStartOnNewLine === "true" && score.sections.at(-1).name === "End"
                && score.parts[0].parameters.rpVariationID === "Intro A-1" && score.parts.at(-1).parameters.rpVariationID === "Ending A-1",
                "Intro and ending did not create one bar each with desktop variations");
            await generate();
            check(song.barTimes.length > score.bars && song.events.some(event => event.type === 0x90 && event.b > 0), "The intro and ending arrangement could not generate accompaniment");
            editor.undoButton.click(); editor.undoButton.click();
            check(score.bars === bars && score.sections.length === 1, "Undo did not restore both boundary inserts");
            report.chordProgressionsAndBoundaries = true;
        }
        {
            const fixture = DesktopSongFiles.readSong(desktopFixture.africa ?? desktopFixture.legacySongs[1]);
            if (!desktopFixture.africa) {
                fixture.sections.push({ name: "Waltz", bar: 4, meter: "THREE_FOUR" });
                fixture.parts[1].section = 1;
            }
            fixture.annotations = [{ bar: 1, text: "First memo" }, { bar: 2, text: "Second memo" }];
            fixture.loopRestartBar = 3;
            editor.open(fixture, [], undefined, true);
            const score = editor.project;
            const before = structuredClone(score);
            document.querySelector("#double-score").click();
            check(score.bars === before.bars * 2 && score.sections.every((section, index) => section.bar === before.sections[index].bar * 2)
                && score.loopRestartBar === 6 && score.annotations[0].bar === 2, "Doubling did not move sections, notes, and the loop marker");
            document.querySelector("#halve-score").click();
            check(score.bars === before.bars && JSON.stringify(score.sections) === JSON.stringify(before.sections)
                && JSON.stringify(score.parts) === JSON.stringify(before.parts) && JSON.stringify(score.annotations) === JSON.stringify(before.annotations)
                && score.chords.every((chord, index) => chord.bar === before.chords[index].bar && Math.abs(chord.beat - before.chords[index].beat) < .00001)
                && score.loopRestartBar === before.loopRestartBar, "Halving a doubled mixed-meter score did not restore its original form");
            editor.undoButton.click();
            check(score.bars === before.bars * 2, "Undo did not restore the doubled score");
            editor.undoButton.click();
            check(score.bars === before.bars, "Undo did not return to the original score size");
            report.halveAndDoubleScore = true;
        }
        {
            const fixture = DesktopSongFiles.readSong(desktopFixture.legacySongs[1]);
            for (const part of fixture.parts) Object.assign(part, { styleId: "jjSwing-ID", styleName: "jjSwing", parameters: {} });
            const initial = UserPhrase.write({ channel: 10, drum: false, notes: [{ pitch: 48, position: 0, duration: .5, velocity: 70 }] });
            DesktopSongFiles.setCustomPhrase(fixture.parts[0], "Bass", initial);
            editor.open(fixture, [], undefined, true);
            editor.selectPart(0);
            editor.selectPart(1, false, { extend: true });
            const openCustom = action => {
                editor.openPartContext(0, 0, 0);
                const button = editor.partMenu.querySelector(`[data-action="${action}"]`);
                check(!button.hidden, `The selected song parts did not offer ${action}`);
                button.click();
            };
            const ready = async (field, label) => {
                for (let attempt = 0; field.disabled && attempt < 120; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
                check(!field.disabled, `${label} was not ready`);
            };
            openCustom("drum-transforms");
            const add = document.querySelector("#add-drum-transform");
            await ready(add, "Drum transforms");
            document.querySelector("#drum-transform-type").value = "AddTambourineEightsId";
            add.click();
            document.querySelector("#drum-transforms-form").requestSubmit();
            const drumValue = fixture.parts[0].parameters.RP_SYS_DrumsTransformId;
            check(drumValue.includes("AddTambourineEightsId") && fixture.parts[1].parameters.RP_SYS_DrumsTransformId === drumValue
                && !fixture.parts[2].parameters.RP_SYS_DrumsTransformId, "The drum chain was not assigned only to the selected group");
            openCustom("track-overrides");
            const overrides = document.querySelector("#track-overrides-form");
            await ready(overrides.querySelector('[type="submit"]'), "Track overrides");
            overrides.requestSubmit();
            const voiceOverride = fixture.parts[0].parameters.RP_SYS_OverrideTracksID;
            check(Boolean(voiceOverride) && fixture.parts[1].parameters.RP_SYS_OverrideTracksID === voiceOverride
                && !fixture.parts[2].parameters.RP_SYS_OverrideTracksID, "The accompaniment override did not stay in the selected group");
            openCustom("custom-phrase");
            const phrases = document.querySelector("#custom-phrase-form");
            await ready(phrases.querySelector('[type="submit"]'), "Custom phrases");
            document.querySelector("#custom-phrase-track").value = "Bass";
            phrases.requestSubmit();
            check(!pianoRoll.panel.hidden && pianoRoll.custom.targets.join() === "0,1", "The piano roll did not retain the selected group");
            pianoRoll.commit([{ pitch: 55, position: 0, duration: .5, velocity: 90 }]);
            const updated = DesktopSongFiles.readCustomPhrases(fixture.parts[0].parameters.RP_SYS_CustomPhraseId).get("Bass");
            check(updated !== initial && DesktopSongFiles.readCustomPhrases(fixture.parts[1].parameters.RP_SYS_CustomPhraseId).get("Bass") === updated
                && !fixture.parts[2].parameters.RP_SYS_CustomPhraseId, "The edited phrase did not reach both selected parts");
            editor.undoButton.click();
            check(DesktopSongFiles.readCustomPhrases(fixture.parts[0].parameters.RP_SYS_CustomPhraseId).get("Bass") === initial
                && !fixture.parts[1].parameters.RP_SYS_CustomPhraseId, "Undo did not restore each original phrase");
            pianoRoll.close();
            report.batchCustomRhythmParameters = true;
        }
        {
            const fixture = DesktopSongFiles.readSong(desktopFixture.legacySongs[1]);
            const original = { id: "jjSwing-ID", name: "jjSwing" };
            Object.assign(fixture.parts[0], { styleId: original.id, styleName: original.name, parameters: {} });
            editor.open(fixture, [], undefined, true);
            editor.selectPart(0);
            editor.openPartEditor(0);
            const browse = document.querySelector("#browse-part-rhythms");
            const picker = document.querySelector("#rhythm-picker");
            const filter = picker.querySelector("#rhythm-filter");
            const provider = picker.querySelector("#rhythm-provider");
            const meter = picker.querySelector("#rhythm-meter");
            const favorites = picker.querySelector("#rhythm-favorites-only");
            const preview = picker.querySelector("#preview-rhythm");
            const vary = picker.querySelector("#rhythm-preview-variation");
            const rows = picker.querySelector("tbody");
            const choice = id => Array.from(rows.rows).find(row => row.dataset.id === id);
            const set = (field, value, event = "change") => { field.value = value; field.dispatchEvent(new Event(event)); };
            const ready = async () => {
                for (let attempt = 0; preview.disabled && attempt < 120; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
                check(!preview.disabled, picker.querySelector("#rhythm-picker-status").textContent);
            };
            const favoriteKey = "web-jjazzlab.favorite-rhythms";
            const savedFavorites = localStorage.getItem(favoriteKey);
            try {
                localStorage.removeItem(favoriteKey);
                browse.click();
                check(picker.open, "The rhythm selector did not open");
                set(provider, "Yamaha");
                set(meter, "THREE_FOUR");
                set(filter, "JazzWaltz", "input");
                const waltz = choice("JazzWaltzMed.S351.sst-ID");
                check(rows.rows.length === 1 && waltz?.cells[2].textContent === "3/4", "The provider, meter and search filters did not combine");
                waltz.cells[3].querySelector("button").click();
                picker.close();
                await new Promise(resolve => setTimeout(resolve, 30));
                browse.click();
                favorites.click();
                check(rows.rows.length === 1 && choice("JazzWaltzMed.S351.sst-ID"), "A favorite did not survive closing the selector");
                favorites.click();
                const disco = choice("DiscoHouse.S145.prs-ID");
                disco.cells[0].querySelector("button").click();
                await ready();
                const variation = Array.from(vary.options).find(option => /^Main B/u.test(option.value))?.value;
                check(Boolean(variation), "Native style variations were not available");
                set(vary, variation);
                await preview.onclick();
                check(player.previewing && !playing && player.loadedSong.events.some(event => event.type === 0x90 && event.b > 0)
                    && player.loadedSong.parts.length > 1, `The style preview did not play: ${picker.querySelector("#rhythm-picker-status").textContent}`);
                picker.querySelector("form").requestSubmit();
                document.querySelector("#part-editor-form").requestSubmit();
                check(fixture.parts[0].styleId === "DiscoHouse.S145.prs-ID" && fixture.parts[0].parameters.rpVariationID === variation
                    && fixture.parts[1].styleId !== "DiscoHouse.S145.prs-ID", "The selected rhythm and auditioned variation did not apply to the target part");
                editor.undoButton.click();
                check(fixture.parts[0].styleId === original.id, "Undo did not restore the original rhythm");
            } finally {
                if (savedFavorites === null) localStorage.removeItem(favoriteKey);
                else localStorage.setItem(favoriteKey, savedFavorites);
            }
            report.rhythmPicker = true;
        }
        {
            const dialog = document.querySelector("#rhythm-library");
            const rhythm = dialog.querySelector("#rhythm-default-style");
            const meter = dialog.querySelector("#rhythm-default-meter");
            const rows = dialog.querySelector("tbody");
            const status = dialog.querySelector("#rhythm-library-status");
            const files = dialog.querySelector("#rhythm-library-files");
            const folder = dialog.querySelector("#rhythm-library-folder");
            const libraryKey = "web-jjazzlab.default-rhythms";
            const savedDefaults = localStorage.getItem(libraryKey);
            const beat = new File([await decompress(embeddedDiscoHouse)], "Smoke beat.prs");
            const waltz = new File([await decompress(embeddedJazzWaltz)], "Smoke waltz.sst");
            const replacement = new File([await decompress(embeddedJazzWaltz)], "Smoke replacement.sst");
            for (const file of [waltz, replacement]) Object.defineProperty(file, "webkitRelativePath", { value: "Styles/Test/" + file.name });
            const select = (field, value) => { field.value = value; field.dispatchEvent(new Event("change")); };
            const upload = async (input, styles) => {
                const carrying = new DataTransfer();
                styles.forEach(style => carrying.items.add(style));
                input.files = carrying.files;
                await input.onchange();
                check(!status.hasAttribute("data-error"), status.textContent);
            };
            const id = name => name + "-ID";
            const editedIds = [beat, waltz, replacement].map(file => id(file.name));
            try {
                await document.querySelector("#show-rhythm-library").onclick();
                await upload(files, [beat]);
                await upload(folder, [waltz]);
                check(rows.textContent.includes(beat.name) && rows.textContent.includes(waltz.name)
                    && rhythm.querySelector('option[value="Smoke beat.prs-ID"]'), "The two real styles did not reach the library");
                select(rhythm, id(beat.name));
                select(meter, "THREE_FOUR");
                select(rhythm, id(waltz.name));
                dialog.close();
                editor.newSong();
                check(editor.project.parts[0].styleId === id(beat.name), "The 4/4 preference did not initialize a new song");
                await generate();
                check(song.parts.length > 1 && editor.attachedStyles.some(style => style.id === id(beat.name)),
                    "The new song could not play or attach its library rhythm");
                const waltzScore = await editor.onReadTextSong("| 3/4 C | Dm7 | G7 | C |");
                check(waltzScore.parts[0].styleId === id(waltz.name), "The 3/4 preference did not apply to a new waltz");
                const database = await rhythmLibrary.database();
                const saved = await new Promise((resolve, reject) => {
                    const request = database.transaction("styles").objectStore("styles").get(id(beat.name));
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                check(saved?.bytes instanceof Int8Array && saved.meter === "FOUR_FOUR", "Rhythm data was not saved in IndexedDB");
                await document.querySelector("#show-rhythm-library").onclick();
                await upload(folder, [replacement]);
                check(rows.textContent.includes(beat.name) && !rows.textContent.includes(waltz.name) && rows.textContent.includes(replacement.name),
                    "A rescan did not replace the folder entries independently of individual additions");
                const beatRow = Array.from(rows.rows).find(row => row.cells[0].textContent === beat.name);
                await beatRow.querySelector("button").onclick();
                check(!rhythmLibrary.records.has(id(beat.name)) && !rows.textContent.includes(beat.name)
                    && editor.attachedStyles.some(style => style.id === id(beat.name)), "Removal did not preserve the active song attachment");
            } finally {
                if (dialog.open) dialog.close();
                await rhythmLibrary.update([], editedIds);
                rhythmLibrary.defaults = JSON.parse(savedDefaults ?? "{}");
                if (savedDefaults === null) localStorage.removeItem(libraryKey);
                else localStorage.setItem(libraryKey, savedDefaults);
            }
            report.rhythmLibrary = true;
        }
        {
            const fixture = DesktopSongFiles.readSong(desktopFixture.legacySongs[1]);
            fixture.tempo = 220;
            for (const part of fixture.parts) Object.assign(part, { styleId: "jjSwing-ID", styleName: "jjSwing", parameters: {} });
            editor.open(fixture, [], undefined, true);
            await generate();
            loopEnabled.checked = true;
            loopStart.value = "1";
            loopEnd.value = "2";
            precount.setAttribute("aria-pressed", "false");
            const range = readLoop();
            const previous = song;
            const changes = [];
            const send = player.send;
            player.send = function (type, message, transfer) {
                if (type === "play" || type === "stop" || type === "refresh") changes.push([type, message]);
                return send.call(this, type, message, transfer);
            };
            try {
                await startPlayback();
                check(playing, "The practice loop did not start");
                editor.editArrangement(() => {
                    fixture.chords[0].name = "F#m7";
                    fixture.parts[0].parameters.rpVariationID = "Main B-1";
                });
                for (let attempt = 0; song === previous && attempt < 280; attempt++) await new Promise(resolve => setTimeout(resolve, 25));
                check(song !== previous && playing && !accompanimentDirty && song.events.length > 0
                    && JSON.stringify(song.events) !== JSON.stringify(previous.events)
                    && JSON.stringify(readLoop()) === JSON.stringify(range)
                    && changes.filter(([type]) => type === "play").length === 1 && !changes.some(([type]) => type === "stop"),
                `Editing the chord/rhythm interrupted the loop or never changed it: ${status.textContent} ${playStatus.textContent}`);
                const applied = song;
                editor.editArrangement(() => fixture.parts.push(structuredClone(fixture.parts.at(-1))));
                await new Promise(resolve => setTimeout(resolve, 800));
                check(song === applied && playing && accompanimentDirty && changes.filter(([type, message]) => type === "refresh" && message.song).length === 1,
                    "A structural edit replaced the playing arrangement");
            } finally {
                player.send = send;
                loopEnabled.checked = false;
                await player.stop();
            }
            report.liveAccompanimentRefresh = true;
        }
        {
            const dialog = document.querySelector("#click-settings");
            const fields = dialog.querySelector("form").elements;
            const before = { ...clickSettings.values };
            const saved = localStorage.getItem(clickSettings.key);
            const modeBefore = precountMode.value;
            const countBefore = precount.getAttribute("aria-pressed");
            const clickBefore = metronome.getAttribute("aria-pressed");
            try {
                document.querySelector("#open-click-settings").click();
                fields.highPitch.value = "56";
                fields.highVelocity.value = "110";
                fields.lowPitch.value = "75";
                fields.lowVelocity.value = "40";
                const occupied = mixerParts.find(track => !track.drum);
                fields.channel.value = String(occupied.outputChannel);
                await fields.previewClick.onclick();
                check(player.previewing && player.loadedSong.events.some(event => event.type === 0x90 && event.a === 56 && event.b === 110)
                    && player.loadedSong.events.some(event => event.type === 0x90 && event.a === 75 && event.b === 40),
                "The click preview did not play both chosen drum keys and velocities");
                dialog.querySelector("form").requestSubmit();
                check(JSON.parse(localStorage.getItem(clickSettings.key)).lowVelocity === 40 && clickSettings.resolve().channel === 9,
                    "Click settings were not persisted or did not fall back from a melodic channel");
                precountMode.value = "1";
                precount.setAttribute("aria-pressed", "true");
                metronome.setAttribute("aria-pressed", "true");
                const send = player.send;
                let configuredPlay;
                player.send = function (type, message, transfer) {
                    if (type === "play") configuredPlay = message;
                    return send.call(this, type, message, transfer);
                };
                try {
                    await startPlayback();
                    check(playing && configuredPlay?.precount === "1" && configuredPlay.clickSettings.highPitch === 56
                        && configuredPlay.clickSettings.lowVelocity === 40 && configuredPlay.clickSettings.channel === 9,
                    `Transport did not start with the configured clicks: ${playStatus.textContent}`);
                } finally {
                    player.send = send;
                    await player.stop();
                }
            } finally {
                if (dialog.open) dialog.close();
                clickSettings.values = before;
                if (saved === null) localStorage.removeItem(clickSettings.key);
                else localStorage.setItem(clickSettings.key, saved);
                precountMode.value = modeBefore;
                precount.setAttribute("aria-pressed", countBefore);
                metronome.setAttribute("aria-pressed", clickBefore);
            }
            report.clickToneSettings = true;
        }
        {
            const requestDescriptor = Object.getOwnPropertyDescriptor(navigator, "requestMIDIAccess");
            const midiInput = { id: "test-keyboard", name: "Test Keyboard", state: "connected" };
            const access = { inputs: new Map([[midiInput.id, midiInput]]) };
            Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: async options => {
                check(options.sysex === false, "Remote control requested unnecessary SysEx permissions");
                return access;
            } });
            const saved = localStorage.getItem(midiRemote.key);
            const loopWasEnabled = loopEnabled.checked;
            const dialog = document.querySelector("#midi-remote");
            const send = (...data) => midiInput.onmidimessage?.({ data: Uint8Array.from(data) });
            try {
                editor.newSong();
                editor.selectPart(0);
                const part = editor.project.parts[0];
                document.querySelector("#open-midi-remote").click();
                await document.querySelector("#midi-remote-connect").onclick();
                check(document.querySelector("#midi-remote-device").value === midiInput.id, "The browser MIDI input was not selected");
                const row = midiRemote.actions.findIndex(action => action.id === "loop");
                midiRemote.rows.rows[row].querySelector("button").click();
                send(0xb2, 64, 127);
                check(JSON.parse(localStorage.getItem(midiRemote.key)).bindings.loop === "cc:2:64", "MIDI Learn did not store the pedal");
                dialog.close();
                send(0xb2, 64, 0);
                send(0xb2, 64, 127);
                check(loopEnabled.checked !== loopWasEnabled, "The learned pedal did not toggle looping");
                send(0xb2, 64, 100);
                check(loopEnabled.checked !== loopWasEnabled, "A held pedal toggled looping twice");
                send(0x90, 16, 100);
                check(/^Main B/u.test(part.parameters.rpVariationID), "The desktop default note did not change the selected variation");
                send(0x90, 24, 100);
                for (let attempt = 0; !playing && attempt < 160; attempt++) await new Promise(resolve => setTimeout(resolve, 25));
                check(playing, "The default MIDI Play note did not start accompaniment");
                send(0x90, 26, 100);
                for (let attempt = 0; playing && attempt < 80; attempt++) await new Promise(resolve => setTimeout(resolve, 25));
                check(!playing, "The default MIDI Stop note did not stop accompaniment");
                midiInput.state = "disconnected";
                access.onstatechange();
                check(!midiInput.onmidimessage && !midiRemote.input, "A disconnected keyboard was still active");
            } finally {
                if (dialog.open) dialog.close();
                loopEnabled.checked = loopWasEnabled;
                if (saved === null) localStorage.removeItem(midiRemote.key);
                else localStorage.setItem(midiRemote.key, saved);
                if (requestDescriptor) Object.defineProperty(navigator, "requestMIDIAccess", requestDescriptor);
                else delete navigator.requestMIDIAccess;
            }
            report.midiRemote = true;
        }
        {
            await generate();
            const dialog = document.querySelector("#instrument-defaults");
            const form = dialog.querySelector("form");
            const { source, target, filter, preview, clear } = form.elements;
            const track = mixerParts.find(part => !part.drum && part.trackIndex !== undefined);
            const before = editor.desktopMixXml();
            const saved = localStorage.getItem(instrumentDefaults.key);
            const originalMappings = new Map(instrumentDefaults.mappings);
            const alternate = mixerInstruments.find(instrument => !instrument.drum && instrument.program !== track.program);
            const mapping = `program:${track.program}`;
            try {
                await document.querySelector("#open-instrument-defaults").onclick();
                source.value = mapping;
                source.dispatchEvent(new Event("change"));
                filter.value = alternate.patch;
                filter.dispatchEvent(new Event("input"));
                check(Array.from(target.options).some(option => option.value === alternate.id), "The output sound bank could not be searched");
                target.value = alternate.id;
                target.dispatchEvent(new Event("change"));
                preview.click();
                await pendingAudition;
                check(player.previewing && player.loadedSong.events[0].a === alternate.program, "The default mapping audition used the wrong program");
                form.requestSubmit();
                check(JSON.parse(localStorage.getItem(instrumentDefaults.key))[mapping] === alternate.id
                    && instrumentDefaults.chosen(track)?.program === alternate.program, "The mapping was not stored or selected");
                check(editor.desktopMixXml() === before, "The browser mapping modified the desktop .mix");
                clear.click();
                check(!instrumentDefaults.mappings.has(mapping), "Clearing the mapping did not restore the stock instrument");
            } finally {
                if (dialog.open) dialog.close();
                await pendingAudition;
                instrumentDefaults.mappings = originalMappings;
                if (saved === null) localStorage.removeItem(instrumentDefaults.key);
                else localStorage.setItem(instrumentDefaults.key, saved);
            }
            report.instrumentDefaults = true;
        }
        {
            const requestDescriptor = Object.getOwnPropertyDescriptor(navigator, "requestMIDIAccess");
            const sent = [];
            const output = { id: "external-gm", name: "Test GM output", state: "connected",
                open: async () => {}, send: (bytes, time) => sent.push({ bytes: Array.from(bytes), time }), clear: () => {} };
            const other = { ...output, id: "other-gm", name: "Second output" };
            Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: async ({ sysex }) => ({
                sysexEnabled: sysex, outputs: new Map([[output.id, output], [other.id, other]])
            }) });
            const prior = midiOutput.settings;
            const saved = localStorage.getItem(midiOutput.key);
            const dialog = midiOutput.dialog;
            const fields = midiOutput.form.elements;
            const oldCount = precount.getAttribute("aria-pressed");
            try {
                editor.newSong();
                await generate();
                const drum = song.events.find(event => song.parts[event.part].drum && event.type === 0x90 && event.b > 0);
                const drumTarget = 126;
                document.querySelector("#open-midi-output").click();
                await fields.connectSysex.onclick();
                fields.device.value = output.id;
                fields.mode.value = "xg";
                fields.drumMap.value = `${drum.a}=${drumTarget}`;
                fields.delay.value = "5";
                fields.sendSetup.checked = false;
                fields.thru.checked = true;
                await fields.testOutput.onclick();
                check(sent.length === 6 && sent[0].bytes.join() === "144,60,82"
                    && sent[5].bytes.join() === "128,67,0", "Test output did not send three timed notes");
                sent.length = 0;
                midiOutput.form.requestSubmit();
                check(!dialog.open && JSON.parse(localStorage.getItem(midiOutput.key)).device === output.id, "The output settings did not save");
                precount.setAttribute("aria-pressed", "false");
                await startPlayback();
                for (let attempt = 0; !sent.some(({ bytes }) => bytes[0] === 0x99 && bytes[1] === drumTarget) && attempt < 120; attempt++)
                    await new Promise(resolve => setTimeout(resolve, 25));
                check(playing && sent[0]?.bytes.join() === midiOutputModes.xg.join()
                    && sent.some(({ bytes, time }) => bytes[0] === 0x99 && bytes[1] === drumTarget && Number.isFinite(time)),
                "The selected output did not receive initialization and mapped drum notes during actual playback");
                check(!sent.some(({ bytes }) => (bytes[0] & 0xf0) === 0xc0), "Program changes were sent with mixer setup disabled");
                await player.stop();
                check(sent.some(({ bytes }) => bytes[0] === 0xb9 && bytes[1] === 123), "Stop did not release the drum channel");
                sent.length = 0;
                midiRemote.receive(Uint8Array.of(0x92, 62, 87));
                midiRemote.receive(Uint8Array.of(0xb2, 64, 127));
                midiRemote.receive(Uint8Array.of(0xf8));
                midiRemote.onDeviceChange();
                check(sent.map(({ bytes }) => bytes.join()).join(";") === "146,62,87;178,64,127;178,64,0;130,62,0",
                    "MIDI Thru did not relay notes and sustain or release the input on a device change");
                document.querySelector("#open-midi-output").click();
                fields.device.value = other.id;
                fields.device.dispatchEvent(new Event("change"));
                check(!fields.drumMap.value && !fields.thru.checked, "A different device inherited the first device's setup");
                fields.delay.value = "20";
                midiOutput.form.requestSubmit();
                document.querySelector("#open-midi-output").click();
                fields.device.value = output.id;
                fields.device.dispatchEvent(new Event("change"));
                check(fields.drumMap.value === `${drum.a}=${drumTarget}` && fields.thru.checked && fields.delay.value === "5",
                    "Returning to the first device did not restore its profile");
            } finally {
                await player.stop();
                if (dialog.open) dialog.close();
                midiOutput.silence(true);
                midiOutput.releaseThru();
                midiOutput.settings = prior;
                precount.setAttribute("aria-pressed", oldCount);
                if (saved === null) localStorage.removeItem(midiOutput.key);
                else localStorage.setItem(midiOutput.key, saved);
                if (requestDescriptor) Object.defineProperty(navigator, "requestMIDIAccess", requestDescriptor);
                else delete navigator.requestMIDIAccess;
            }
            report.midiOutput = true;
        }
        {
            editor.newSong();
            const phrase = UserPhrase.write({ channel: 3, drum: false, notes: [
                { pitch: 60, position: .25, duration: 1.5, velocity: 100 },
                { pitch: 66, position: 2, duration: 1 / 3, velocity: 90 }
            ] });
            editor.editArrangement(() => {
                editor.project.userTracks.push({ name: "Score test", phrase },
                    { name: "Drum names", phrase: UserPhrase.write({ channel: 9, drum: true, notes: [
                        { pitch: 25, position: 0, duration: .25, velocity: 90 }
                    ] }) });
            });
            pianoRoll.open("Score test");
            const toggle = document.querySelector("#roll-show-score");
            const staff = document.querySelector("#roll-score");
            const octave = document.querySelector("#roll-score-octave");
            toggle.click();
            await new Promise(resolve => requestAnimationFrame(resolve));
            check(!staff.hidden && staff.getContext("2d").getImageData(0, 0, 2, 2).data[3] === 255
                && scoreNoteValue(1.5).dot && scoreNoteValue(1 / 3).triplet && scoreNoteValue(.25).flags === 2,
            "The view did not draw its staff or distinguish dotted and triplet durations");
            octave.value = "2";
            octave.dispatchEvent(new Event("change"));
            const saved = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
            check(saved.clientProperties["NoteEditorScoreOctaveTransposition#3"] === "2"
                && editor.project.userTracks[0].phrase === phrase, "The staff octave did not round-trip independently of MIDI pitch");
            pianoRoll.open("Drum names");
            const map = document.querySelector("#roll-drum-map");
            map.value = "XG";
            map.dispatchEvent(new Event("change"));
            pianoRoll.select([pianoRoll.phrase.notes[0]]);
            check(staff.hidden && !map.closest("label").hidden && pianoRoll.drumKeyName(25) === "Brush Tap"
                && document.querySelector("#roll-status").textContent === "Brush Tap", "The desktop XG drum names did not reach the drum editor");
            pianoRoll.close();
            report.pianoScoreAndDrumNames = true;
        }
        {
            const leadsheet = new File([`(title Practice Waltz)
(composer Test Writer)
(meter 3 4)
(tempo 111)
(section (style waltz))
Cm7 G7 | Cm7 |
(section (style waltz))
AbM7 | G7 Cm7 |
`], "practice.ls");
            const project = (await editor.readSongFiles([leadsheet])).song;
            check(project.title === "Practice Waltz" && project.tempo === 111 && project.bars === 4
                && project.sections.length === 2 && project.sections.every(section => section.meter === "THREE_FOUR")
                && project.chords.some(chord => chord.bar === 0 && chord.beat === 1.5 && chord.name === "G7")
                && project.comments === "Composer: Test Writer", "The desktop Impro-Visor parser lost meter, sections or chord positions");
            const titleBefore = editor.project.title, projectBefore = editor.project;
            const anchorClick = HTMLAnchorElement.prototype.click;
            let downloaded;
            HTMLAnchorElement.prototype.click = function () {
                if (this.download === "JJazzLab-converted-songs.zip") downloaded = fetch(this.href).then(reply => reply.arrayBuffer());
                else anchorClick.call(this);
            };
            try {
                const files = new DataTransfer();
                for (const file of [leadsheet, new File([desktopFixture.song], "other.sng"), new File([desktopFixture.mix], "other.mix"),
                    new File(["(title Broken)"], "broken.ls")]) files.items.add(file);
                const chooser = document.querySelector("#batch-convert-input");
                chooser.files = files.files;
                await chooser.onchange();
            } finally { HTMLAnchorElement.prototype.click = anchorClick; }
            check(downloaded && editor.project === projectBefore && editor.project.title === titleBefore
                && editor.status.textContent.includes("broken.ls"), "A failing input prevented conversion or the batch changed the open tab");
            const parser = new DataView(await downloaded), decoder = new TextDecoder(), entries = new Map();
            for (let offset = 0; parser.getUint32(offset, true) === 0x04034b50;) {
                const length = parser.getUint32(offset + 18, true), nameLength = parser.getUint16(offset + 26, true);
                const begin = offset + 30 + nameLength;
                const name = decoder.decode(new Uint8Array(parser.buffer, offset + 30, nameLength));
                entries.set(name, decoder.decode(new Uint8Array(parser.buffer, begin, length)));
                offset = begin + length;
            }
            check(entries.size === 3 && DesktopSongFiles.readSong(entries.get("01-practice/practice.sng")).bars === 4
                && DesktopSongFiles.readMix(entries.get("02-other/other.mix")).length > 1,
            "The conversion ZIP did not preserve the two valid songs and the matching .mix");
            check(await editor.loadFiles([leadsheet]), "The Impro-Visor file did not open through the normal import route");
            await generate();
            check(song.barTimes.length === 5 && song.events.some(event => event.type === 0x90 && event.b > 0),
                "The imported 3/4 song did not generate playable accompaniment");
            report.improvisorAndBatchImport = true;
        }
        {
            const chord = (root, kind, bass = "") => `<harmony><root><root-step>${root}</root-step></root><kind>${kind}</kind>${bass}</harmony>`;
            const score = `<?xml version="1.0" encoding="UTF-8"?>
                <score-partwise version="4.0"><work><work-title>Repeating practice</work-title></work>
                <part id="NoChords"><measure number="1"><note><rest/><duration>8</duration></note></measure></part>
                <part id="Harmony"><measure number="1"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
                <barline location="left"><repeat direction="forward"/></barline><direction><sound tempo="138"/></direction>
                ${chord("C", "major-seventh")}<note><rest/><duration>2</duration></note>
                ${chord("D", "minor-seventh", "<bass><bass-step>F</bass-step></bass>")}</measure>
                <measure number="2"><barline location="left"><ending number="1" type="start"/></barline>${chord("G", "dominant")}
                <barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline></measure>
                <measure number="3"><attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
                <barline location="left"><ending number="2" type="start"/></barline>${chord("D", "minor")}
                <barline location="right"><ending number="2" type="stop"/></barline></measure>
                <measure number="4">${chord("C", "major")}</measure></part></score-partwise>`;
            const file = new File([score], "practice.musicxml");
            const mxl = new File([packageSongFiles([
                ["META-INF/container.xml", '<container><rootfiles><rootfile full-path="notation/practice.musicxml"/></rootfiles></container>'],
                ["notation/practice.musicxml", score]
            ])], "practice.mxl");
            const plain = (await editor.readSongFiles([file])).song;
            const zipped = (await editor.readSongFiles([mxl])).song;
            check(JSON.stringify(plain) === JSON.stringify(zipped) && plain.title === "Repeating practice" && plain.tempo === 138
                && plain.parts.map(part => part.section).join() === "0,1,0,2,3"
                && plain.sections[2].meter === "THREE_FOUR" && plain.chords.some(chord => chord.beat === 1 && chord.name === "Dm7/F")
                && plain.chords.some(chord => chord.bar === 1 && chord.name === "G7"),
            "MusicXML/MXL lost the title, tempo, meter, harmony, bass note or numbered endings");
            check(await editor.loadFiles([mxl]), "The compressed score did not open");
            await generate();
            check(song.barTimes.length === 6 && Math.abs(song.barTimes[4] - song.barTimes[3] - 3 * 60 / 138) < .002,
                "The imported arrangement did not repeat the marked measures or switch to 3/4");
            report.musicXmlAndMxl = true;
        }
        {
            // The desktop reader's original fixed-width 0xbb format.
            const data = new Uint8Array(0x285);
            const title = new TextEncoder().encode("Test BIAB Waltz");
            data.set([0xbb, title.length], 0);
            data.set(title, 2);
            data[0x3e] = 8;
            data[0x40] = 108;
            data[0x42 + 2] = 2;
            [1, 8, 3, 1].forEach((root, bar) => {
                data[0x82 + bar * 4] = 1;
                data[0x182 + bar * 4] = root;
            });
            data[0x284] = 4;
            const source = new File([data], "test.SGU");
            const importer = await editor.readSongFiles([source]);
            const project = importer.song;
            check(project.title === "Test BIAB Waltz" && project.tempo === 108 && project.bars === 4
                && project.sections.every(section => section.meter === "THREE_FOUR") && project.parts.length > project.sections.length
                && project.chords.some(chord => chord.bar === 1 && chord.name.startsWith("G"))
                && project.parts.some(part => part.parameters.rpVariationID === "Main B-1"),
            "The desktop Band-in-a-Box importer lost the meter, repeat order, chord symbols or section markers");
            check(await editor.loadFiles([source]), "The Band-in-a-Box file did not open");
            await generate();
            check(song.barTimes.length === 13 && song.events.some(event => event.type === 0x90 && event.b > 0),
                "The imported three-chorus arrangement did not generate accompaniment");
            report.bandInABox = true;
        }
        {
            const asScore = sounds => new File([`<score-partwise><part id="p1">${sounds.map((sound, index) =>
                `<measure number="${index + 1}"><harmony><root><root-step>${"CDEFG"[index]}</root-step></root><kind>major</kind></harmony>
                ${sound ? `<direction><sound ${sound}/></direction>` : ""}</measure>`).join("")}</part></score-partwise>`], "navigation.musicxml");
            const order = project => project.parts.flatMap(part => {
                const from = project.sections[part.section].bar, to = project.sections[part.section + 1]?.bar ?? project.bars;
                return Array.from({ length: to - from }, (_, index) => from + index);
            }).join();
            const dalSegno = (await editor.readSongFiles([asScore(["", 'segno="S"', 'tocoda="C"', 'dalsegno="S"', 'coda="C"'])])).song;
            const daCapo = (await editor.readSongFiles([asScore(["", 'fine="yes"', "", 'dacapo="yes"'])])).song;
            check(order(dalSegno) === "0,1,2,3,1,2,4" && order(daCapo) === "0,1,2,3,0,1",
                "MusicXML did not follow the named Segno and Coda or did not stop at Fine after D.C.");
            const roundTrip = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(dalSegno));
            check(order(roundTrip) === order(dalSegno), "Saving as .sng lost the MusicXML navigation order");
            report.musicXmlNavigation = true;
        }
        {
            editor.newSong();
            editor.editArrangement(() => { editor.project.chords[0].name = "C7/E"; });
            await document.querySelector("#open-chord-inspector").onclick();
            const dialog = chordInspector.dialog;
            const piano = dialog.querySelector("#inspector-piano");
            const scale = dialog.querySelector("#inspector-scale");
            check(dialog.open && piano.querySelectorAll('[data-note="chord"]').length === 8 && scale.options.length > 1,
                "The inspector did not display the native C7 tones and matching scales");
            scale.selectedIndex = 1;
            scale.dispatchEvent(new Event("change"));
            check(piano.querySelector('[data-note="scale"]'), "Selecting a scale did not mark its additional keys");
            dialog.querySelector('[data-inspector-view="guitar"]').click();
            const diagrams = [...dialog.querySelectorAll("#inspector-guitars canvas")];
            check(diagrams.length > 0 && diagrams.every(diagram => {
                const frets = diagram.getAttribute("aria-label").split(" ");
                const notes = frets.flatMap((fret, index) => fret === "×" ? [] : [guitarTuning[index] + Number(fret)]);
                return notes.length > 3 && Math.min(...notes) % 12 === 4;
            }), "The guitar fingerings did not preserve the slash bass");
            dialog.querySelector('[data-inspector-view="staff"]').click();
            const staff = dialog.querySelector("#inspector-staff");
            check(!staff.hidden && staff.getContext("2d").getImageData(0, 0, 2, 2).data[3] === 255,
                "The chord's staff view was not rendered");
            dialog.close();
            report.chordInspector = true;
        }
        {
            editor.newSong();
            document.querySelector("#open-song-memo").click();
            const insertion = document.querySelector("#insert-memo-link");
            const insert = insertion.querySelector("form");
            const newLink = document.querySelector("#open-memo-link-form");
            newLink.click();
            insert.elements.address.value = "https://example.org/listening";
            insert.requestSubmit();
            newLink.click();
            insert.elements.linkType.value = "local";
            insert.elements.address.value = "/music/Song Sheet.pdf";
            insert.requestSubmit();
            check(songMemo.links.querySelector("a")?.href === "https://example.org/listening"
                && songMemo.links.querySelector("button")?.textContent === "file:///music/Song%20Sheet.pdf",
            "The insert dialog did not create both web and desktop file links");
            const click = songMemo.file.click, original = HTMLAnchorElement.prototype.click;
            let requested = 0, downloaded;
            songMemo.file.click = () => { requested++; };
            HTMLAnchorElement.prototype.click = function () {
                if (this.download === "Song Sheet.pdf") downloaded = fetch(this.href).then(response => response.text());
                else original.call(this);
            };
            try {
                await songMemo.links.querySelector("button").onclick();
                check(requested === 1, "The unbound local link was not passed to the file chooser");
                const files = new DataTransfer();
                files.items.add(new File(["score"], "Song Sheet.pdf", { type: "application/pdf" }));
                songMemo.file.files = files.files;
                songMemo.file.onchange();
                check(await downloaded === "score", "The memo did not open the explicitly chosen file");
            } finally {
                songMemo.file.click = click;
                HTMLAnchorElement.prototype.click = original;
            }
            document.querySelector("#song-memo-form").requestSubmit();
            const reopened = DesktopSongFiles.readSong(DesktopSongFiles.writeSong(editor.project));
            check(reopened.comments.includes("file:///music/Song%20Sheet.pdf"), "The desktop-compatible file link was removed from .sng");
            editor.undoButton.click();
            check(!editor.project.comments, "Undo did not remove the inserted links");
            report.songMemoLinks = true;
        }
        {
            const baseline = improvisationHalfBars("easy", 4, 120, () => 0);
            check(baseline.join() === "rest,rest,play,play,rest,rest,play,play"
                && improvisationHalfBars("easy", 4, 210, () => 0).join() === "rest,rest,rest,rest,play,play,play,play",
            "The practice phrases did not use the desktop sequence or high-tempo scaling");
            editor.newSong();
            const before = DesktopSongFiles.writeSong(editor.project);
            document.querySelector("#open-improvisation-guide").click();
            const form = improvisationGuide.dialog.querySelector("form");
            form.elements.mode.value = "density";
            const random = Math.random;
            try {
                Math.random = () => 0;
                form.requestSubmit();
            } finally { Math.random = random; }
            check(editor.grid.querySelectorAll(".improvisation-guide-cells").length === 4
                && editor.grid.querySelector('[data-guide="rest"]') && editor.grid.querySelector('[data-guide="sparse"]'),
            "The density guide did not mark both rest and play on the score");
            improvisationGuide.position(1, .3);
            check(improvisationGuide.cue.dataset.guide === "rest", "The practice view did not cue rest on the first bar");
            improvisationGuide.position(2, .3);
            check(improvisationGuide.cue.dataset.guide === "sparse" && DesktopSongFiles.writeSong(editor.project) === before,
                "The cue did not follow the playhead or changed the song data");
            document.querySelector("#open-improvisation-guide").click();
            form.elements.clearGuide.click();
            check(improvisationGuide.cue.hidden && !editor.grid.querySelector(".improvisation-guide-cells"), "The guide could not be cleared");
            report.improvisationGuide = true;
        }
        {
            const requestDescriptor = Object.getOwnPropertyDescriptor(navigator, "requestMIDIAccess");
            const keyboard = { id: "arranger-keys", name: "Arranger keys", state: "connected" };
            Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: async () => ({
                inputs: new Map([[keyboard.id, keyboard]])
            }) });
            const saved = localStorage.getItem(arranger.preference);
            const originalMode = loopEnabled.checked;
            const originalAccess = midiRemote.access, originalInput = midiRemote.inputId;
            try {
                editor.newSong();
                const written = DesktopSongFiles.writeSong(editor.project);
                midiRemote.access = undefined;
                midiRemote.inputId = null;
                document.querySelector("#open-midi-remote").click();
                await midiRemote.connectButton.onclick();
                midiRemote.dialog.close();
                document.querySelector("#open-arranger").click();
                arranger.dialog.querySelector("form").requestSubmit();
                for (let attempt = 0; !arranger.session?.ready && attempt < 200; attempt++) await new Promise(resolve => setTimeout(resolve, 25));
                check(playing && arranger.session?.ready && loopEnabled.checked && arranger.indicator.textContent === "C",
                    `The arranger loop did not start: ${playStatus.textContent}`);
                const before = song;
                for (const note of [45, 48, 52, 72]) keyboard.onmidimessage({ data: Uint8Array.from([0x90, note, 100]) });
                for (let attempt = 0; song === before && attempt < 320; attempt++) await new Promise(resolve => setTimeout(resolve, 25));
                check(playing && song !== before && arranger.indicator.textContent === "Am"
                    && JSON.stringify(song.events) !== JSON.stringify(before.events),
                `The split keyboard chord did not change the running accompaniment: ${status.textContent}`);
                check(DesktopSongFiles.writeSong(editor.project) === written, "Arranger mode wrote the held chord into the original lead sheet");
                check(await arranger.recognize([43, 48, 52], true) === "C/G", "The desktop recognizer did not preserve an inversion");
                await player.stop();
                check(!arranger.session && arranger.view.hidden && loopEnabled.checked === originalMode, "Stopping the arranger did not restore loop controls");
            } finally {
                await player.stop();
                if (arranger.dialog.open) arranger.dialog.close();
                if (midiRemote.dialog.open) midiRemote.dialog.close();
                keyboard.onmidimessage = null;
                midiRemote.input = undefined;
                midiRemote.access = originalAccess;
                midiRemote.inputId = originalInput;
                arranger.finish();
                if (saved === null) localStorage.removeItem(arranger.preference);
                else localStorage.setItem(arranger.preference, saved);
                if (requestDescriptor) Object.defineProperty(navigator, "requestMIDIAccess", requestDescriptor);
                else delete navigator.requestMIDIAccess;
            }
            report.arranger = true;
        }
        {
            const before = HTMLAnchorElement.prototype.click;
            let output;
            HTMLAnchorElement.prototype.click = function () {
                if (this.download === "Practice rhythm.zip") output = fetch(this.href).then(response => response.arrayBuffer());
                else before.call(this);
            };
            const form = yjzWizard.form;
            try {
                document.querySelector("#open-yjz-wizard").click();
                form.elements.baseStyle.value = "8Beat.T160.STY-ID";
                form.elements.title.value = "Practice rhythm";
                form.elements.mainA.value = "3";
                form.elements.mainB.value = "0";
                form.elements.mainC.value = "0";
                form.elements.mainD.value = "0";
                form.elements.phrases.value = "2";
                form.elements.includeIntros.checked = false;
                form.elements.includeFills.checked = false;
                await form.onsubmit(new Event("submit", { cancelable: true }));
                check(output, `The wizard did not export a ZIP: ${yjzWizard.dialog.querySelector("[role=status]").textContent}`);
                const zip = new MemoryStyleArchive(await output, { accept: name => /\.(sty|yjz)$/iu.test(name) });
                const extension = zip.entries.find(entry => entry.name === "Practice rhythm.yjz");
                const base = zip.entries.find(entry => entry.name === "Practice rhythm.sty");
                check(base && extension && zip.entries.length === 2, "The wizard did not pair the renamed base and extended files");
                const wasm = (await getEngine()).exports;
                const args = [new Int8Array(await zip.read(base)), base.name, new Int8Array(await zip.read(extension)), extension.name];
                const [, ...parameters] = Array.from(wasm.getRhythmParameters(...args));
                check(parameters.find(row => row.startsWith("rpVariationID\t"))?.split("\t").includes("Main A-3"),
                    "The desktop rhythm engine could not load the third generated variation");
                const generated = wasm.generateExtendedMidi(...args, ["C", "G7"], 120, "Main A-3");
                check(parseMidi(generated, 2, wasm.getPartMetadata()).events.some(event => event.type === 0x90 && event.b > 0),
                    "The generated YJZ variation did not play");
            } finally {
                HTMLAnchorElement.prototype.click = before;
                if (yjzWizard.dialog.open) yjzWizard.dialog.close();
            }
            report.yjzWizard = true;
        }
        {
            const original = appPreferences.settings;
            const stored = localStorage.getItem(appPreferences.key);
            const { form, dialog } = appPreferences;
            const fields = form.elements;
            editor.newSong();
            try {
                document.querySelector("#open-app-preferences").click();
                fields.theme.value = "light";
                fields.font.value = "serif";
                fields.fontSize.value = "115";
                fields.restoreSongs.checked = false;
                fields.wheelChanges.checked = false;
                fields.aliases.value = "Cm=C7";
                await appPreferences.save();
                check(dialog.open && dialog.querySelector("[role=alert]").textContent, "Reassigning a native chord alias was allowed");
                fields.aliases.value = "CpracticeMajor=CMaj7";
                await appPreferences.save();
                const expected = (await getEngine()).exports.transposeChordSymbols(["DMaj7/A"], 0)[0];
                const parsed = editor.parseBarChords(0, "DpracticeMajor/A")[0];
                check(!dialog.open && parsed.name === expected, "A custom chord alias did not expand in the editor");
                check(document.documentElement.dataset.theme === "light" && document.documentElement.dataset.uiFont === "serif"
                    && getComputedStyle(document.documentElement).colorScheme === "light", "The light theme or serif font preference was not applied");
                const prefs = JSON.parse(localStorage.getItem(appPreferences.key));
                check(prefs.fontSize === 115 && !prefs.restoreSongs && !prefs.wheelChanges, "The preferences were not stored");
            } finally {
                if (dialog.open) dialog.close();
                appPreferences.settings = original;
                appPreferences.apply();
                if (stored === null) localStorage.removeItem(appPreferences.key);
                else localStorage.setItem(appPreferences.key, stored);
            }
            report.appPreferences = true;
        }
        {
            const { form, dialog, key, settings } = windowLayout;
            const saved = localStorage.getItem(key);
            const button = document.querySelector("#toggle-fullscreen");
            const request = document.documentElement.requestFullscreen;
            const exit = document.exitFullscreen;
            const property = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
            let active = null;
            const update = element => { active = element; document.dispatchEvent(new Event("fullscreenchange")); };
            try {
                document.querySelector("#open-window-layout").click();
                form.elements.mixerSide.value = "right";
                form.elements.mixerWidth.value = "40";
                form.elements.scoreHeight.value = "70";
                form.requestSubmit();
                check(!dialog.open && workspace.dataset.mixerSide === "right" && workspace.style.getPropertyValue("--mixer-width") === "40%"
                    && workspace.style.getPropertyValue("--score-height") === "70vh" && JSON.parse(localStorage.getItem(key)).mixerSide === "right",
                "Panel layout did not apply and persist");
                document.querySelector("#reset-window-layout").click();
                check(workspace.dataset.mixerSide === "left" && !workspace.style.getPropertyValue("--score-height")
                    && !localStorage.getItem(key), "Panel layout reset did not restore the default");
                Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => active });
                document.documentElement.requestFullscreen = async () => update(document.documentElement);
                document.exitFullscreen = async () => update(null);
                await button.onclick();
                check(active && button.getAttribute("aria-pressed") === "true", "The fullscreen command did not enter fullscreen");
                await button.onclick();
                check(!active && button.getAttribute("aria-pressed") === "false", "The fullscreen command did not restore the window");
            } finally {
                if (dialog.open) dialog.close();
                windowLayout.settings = settings;
                windowLayout.apply();
                document.documentElement.requestFullscreen = request;
                document.exitFullscreen = exit;
                if (property) Object.defineProperty(document, "fullscreenElement", property);
                else delete document.fullscreenElement;
                if (saved === null) localStorage.removeItem(key);
                else localStorage.setItem(key, saved);
            }
            report.windowLayout = true;
        }
        {
            const originalClick = HTMLAnchorElement.prototype.click;
            const { dialog } = appDiagnostics;
            let downloaded;
            HTMLAnchorElement.prototype.click = function () {
                if (this.download === "jjazzlab-web-diagnostics.json") downloaded = fetch(this.href).then(response => response.json());
                else originalClick.call(this);
            };
            try {
                const privateText = "private chord title for diagnostics test";
                showPlayStatus(privateText, true);
                document.querySelector("#open-app-diagnostics").click();
                const displayed = JSON.parse(dialog.querySelector("pre").textContent);
                check(dialog.open && /^[0-9a-f]{12}$/u.test(displayed.build.buildId) && displayed.build.engineBytes > 0
                    && displayed.events.at(-1).event === "playback-error" && !JSON.stringify(displayed).includes(privateText),
                "The diagnostics dialog did not identify the build and omit document-specific error text");
                dialog.querySelector("#save-diagnostics").click();
                const exported = await downloaded;
                check(exported.build.buildId === displayed.build.buildId && exported.capabilities.audioWorklet,
                    "The diagnostic download did not include build and browser capabilities");
                dialog.querySelector("#clear-diagnostics").click();
                check(JSON.parse(dialog.querySelector("pre").textContent).events.length === 0, "The diagnostic log did not clear");
            } finally {
                if (dialog.open) dialog.close();
                HTMLAnchorElement.prototype.click = originalClick;
                showPlayStatus("");
            }
            report.appDiagnostics = true;
        }
        {
            const { dialog } = synthSettings;
            const data = (await loadSynthAssets(() => {})).soundfont;
            try {
                document.querySelector("#open-synth-settings").click();
                await synthSettings.select(new File(["this is not a SoundFont"], "invalid.sf2"));
                check(dialog.open && !selectedSoundFont && synthSettings.error.textContent, "An invalid local SoundFont was accepted");
                await synthSettings.select(new File([data], "Local Test GM.sf2"));
                check(!dialog.open && selectedSoundFont?.name === "Local Test GM.sf2" && player.ready,
                    "The local SoundFont did not initialize in the live AudioWorklet");
                const database = await synthSettings.database();
                const saved = await new Promise((resolve, reject) => {
                    const request = database.transaction("files").objectStore("files").get("active");
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                check(saved?.name === selectedSoundFont.name && saved.soundfont.byteLength === data.byteLength, "The local SoundFont did not persist");
                const part = { drum: false, volume: 1, pan: 0 };
                const preview = { parts: [part], duration: .6, events: [
                    { seconds: 0, part: 0, type: 0x90, a: 60, b: 90 },
                    { seconds: .3, part: 0, type: 0x80, a: 60, b: 0 }
                ] };
                const rendered = await renderSongAudio(preview, [part], .5, () => {});
                check(rendered.getChannelData(0).some(value => Math.abs(value) > .0001), "The selected local SoundFont produced no exported audio");
                document.querySelector("#open-synth-settings").click();
                await synthSettings.select(null);
                check(!dialog.open && !selectedSoundFont && !player.ready, "Resetting the local SoundFont did not restore TimGM6mb");
            } finally {
                if (dialog.open) dialog.close();
                if (selectedSoundFont) {
                    player.setSoundFont(null);
                    await synthSettings.store(null);
                }
            }
            report.localSoundFont = true;
        }
        {
            editor.newSong();
            editor.editArrangement(() => {
                const { project } = editor;
                const originalPart = project.parts[0];
                project.sections = [
                    { name: "A", bar: 0, meter: "FOUR_FOUR" },
                    { name: "B", bar: 3, meter: "FOUR_FOUR" },
                    { name: "C", bar: 6, meter: "FOUR_FOUR" }
                ];
                project.parts = ["A", "B", "C"].map((name, section) => ({ ...originalPart, name, section }));
                project.chords = [{ name: "Dm7", bar: 0, beat: .5 }, { name: "G7", bar: 2, beat: 3 },
                    { name: "C", bar: 3, beat: 2 }, { name: "F", bar: 7, beat: 0 }];
            });
            const before = JSON.stringify(editor.project.chords);
            try {
                check(appPreferences.settings.fixSectionChords && editor.fixMissingSectionChords({ from: 4, to: 6 }),
                    "The selected range did not repair its section");
                check(editor.project.chords.find(chord => chord.bar === 3 && chord.beat === 0)?.name === "G7"
                    && !editor.project.chords.some(chord => (chord.bar === 0 || chord.bar === 6) && chord.beat === 0),
                "Section repair did not copy the anticipated chord or changed unplayed sections");
                document.querySelector("#undo").click();
                check(JSON.stringify(editor.project.chords) === before, "Section repair could not be undone");
                await startPlayback();
                check(editor.project.chords.find(chord => chord.bar === 0)?.beat === 0
                    && editor.project.chords.find(chord => chord.bar === 6)?.name === "F",
                "Starting playback did not repair the early chord and copy the nearest chord");
            } finally { await player.stop(); }
            report.missingSectionChords = true;
        }
        report.ok = true;
    } catch (error) { report.ok = false; report.error = error.stack || error.message; }
    console.log("JJAZZ_SMOKE_RESULT=" + JSON.stringify(report));
})();
