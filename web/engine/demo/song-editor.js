"use strict";

const partMarkers = ["theme", "solo", "theme2", "theme3", "theme4", "solo2", "solo3", "solo4"];
const songTemplatePreference = "jjazzlab.songTemplate";
const compactParameterLabels = new Map([
    ["rpVariationID", "バリエーション"], ["BassStyleId", "ベースの奏法"], ["DrumsStyleId", "ドラムの奏法"],
    ["rpIntensityID", "強弱"], ["RpFillID", "フィル"], ["rpTempoID", "テンポ比"], ["rpSysMarkerID", "マーカー"],
    ["RpSysMuteID", "区間のミュート"], ["RP_SYS_DrumsTransformId", "区間のドラム変形"],
    ["RP_SYS_CustomPhraseId", "区間のカスタムフレーズ"], ["RP_SYS_OverrideTracksID", "伴奏トラックの上書き"]
]);
const compactProperty = id => `PropCompactViewModeVisibleRps_${id}`;
const flatChordNotes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const sharpChordNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const sectionColors = ["#e7ac83", "#9bb487", "#8bbab5", "#b1a7d0", "#d4c381", "#9cb5d6"];
const chordDropQuantizations = new Set(["HALF_BAR", "BEAT", "HALF_BEAT", "ONE_THIRD_BEAT", "ONE_QUARTER_BEAT", "ONE_SIXTH_BEAT", "OFF"]);

function transposeChordLabel(name, semitones) {
    if (!semitones || name === "NC") return name;
    return name.replace(/^[A-G][#b]?|(?<=\/)[A-G][#b]?$/gu, note => {
        const pitch = flatChordNotes.indexOf(note[0]) + (note[1] === "#" ? 1 : note[1] === "b" ? -1 : 0);
        return (note.endsWith("#") ? sharpChordNotes : flatChordNotes)[(pitch + semitones + 24) % 12];
    });
}

function desktopColor(value) {
    if (typeof value !== "string" || !/^-?\d+$/u.test(value)) return undefined;
    return `#${(Number(value) & 0xffffff).toString(16).padStart(6, "0")}`;
}

function downloadSongFile(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openEditorPopup(menu, x, y) {
    menu.hidden = false;
    menu.style.left = `${Math.max(0, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(0, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
    menu.querySelector("button:not([hidden]):not(:disabled)")?.focus();
}

// The song package uses uncompressed ZIP entries so no library is needed.
function packageSongFiles(files) {
    if (files.length > 0xffff) throw new Error(t("ZIPに含められるファイル数を超えています。", "The ZIP has too many files."));
    const encoder = new TextEncoder();
    const local = [], directory = [];
    let offset = 0;
    for (const [filename, value, checksum] of files) {
        const name = encoder.encode(filename);
        const bytes = value instanceof Blob ? value : typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
        const length = bytes instanceof Blob ? bytes.size : bytes.length;
        const crc = checksum ?? styleCrc32(bytes);
        if (offset + 30 + name.length + length > 0xffffffff) throw new Error(t("ZIPのサイズ上限を超えています。", "The ZIP exceeds the file size limit."));
        for (const central of [false, true]) {
            const fixed = central ? 46 : 30;
            const header = new Uint8Array(fixed + name.length);
            const view = new DataView(header.buffer);
            const u16 = (at, value) => view.setUint16(at, value, true);
            const u32 = (at, value) => view.setUint32(at, value, true);
            const extra = central ? 2 : 0;
            u32(0, central ? 0x02014b50 : 0x04034b50);
            u16(4 + extra, 20); u16(6 + extra, 0x0800);
            u16(12 + extra, 33);
            u32(14 + extra, crc); u32(18 + extra, length); u32(22 + extra, length);
            u16(26 + extra, name.length);
            header.set(name, fixed);
            if (central) { u16(4, 20); u32(42, offset); directory.push(header); }
            else local.push(header, bytes);
        }
        offset += local.at(-2).length + length;
    }
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
    const directoryLength = directory.reduce((size, entry) => size + entry.length, 0);
    if (offset + directoryLength + end.length > 0xffffffff) throw new Error(t("ZIPのサイズ上限を超えています。", "The ZIP exceeds the file size limit."));
    view.setUint32(12, directoryLength, true);
    view.setUint32(16, offset, true);
    return new Blob([...local, ...directory, end]);
}

class SongEditor {
    constructor(onOpen, onChooseBar, onPlay) {
        this.onOpen = onOpen;
        this.onChooseBar = onChooseBar;
        this.onPlay = onPlay;
        this.displayTranspose = 0;
        this.partSelection = new Set();
        this.grid = document.querySelector("#lead-sheet");
        this.parts = document.querySelector("#song-parts");
        this.title = document.querySelector("#project-title");
        this.meter = document.querySelector("#project-meter");
        const mixedMeter = new Option("曲中で変化", "");
        mixedMeter.disabled = true;
        this.meter.replaceChildren(mixedMeter, ...Object.entries(DesktopSongFiles.meters).map(([id, [label]]) => new Option(label, id)));
        this.status = document.querySelector("#project-status");
        this.exportButton = document.querySelector("#export-project");
        this.selection = document.querySelector("#sheet-selection");
        this.barDialog = document.querySelector("#bar-editor");
        this.chordField = document.querySelector("#edit-bar-chords");
        this.sectionField = document.querySelector("#edit-section-name");
        this.annotationField = document.querySelector("#edit-bar-annotation");
        this.barError = document.querySelector("#bar-editor-error");
        this.contextMenu = document.querySelector("#bar-context");
        this.partMenu = document.querySelector("#part-context");
        this.parameterMenu = document.querySelector("#parameter-context");
        this.partDialog = document.querySelector("#part-editor");
        this.sectionMeter = document.querySelector("#edit-section-meter");
        this.sectionMeter.replaceChildren(...Object.entries(DesktopSongFiles.meters).map(([id, [name]]) => new Option(name, id)));
        this.styleParameters = new Map();
        this.undoButton = document.querySelector("#undo");
        this.redoButton = document.querySelector("#redo");
        this.undoButton.onclick = () => this.restoreEdit(this.undoStack, this.redoStack);
        this.redoButton.onclick = () => this.restoreEdit(this.redoStack, this.undoStack);
        document.querySelector("#edit-bar").onclick = () => this.openBarEditor();
        document.querySelector("#edit-section").onclick = () => this.openBarEditor("section");
        document.querySelector("#halve-score").onclick = () => this.resizeScoreTime(.5);
        document.querySelector("#double-score").onclick = () => this.resizeScoreTime(2);
        document.querySelector("#cancel-bar-edit").onclick = () => this.barDialog.close();
        document.querySelector("#bar-editor-form").onsubmit = (event) => { event.preventDefault(); this.commitBarEdit(); };
        this.barDialog.addEventListener("close", () => this.grid.children[this.selectedBar]?.focus({ preventScroll: true }));
        this.contextMenu.onclick = (event) => {
            const action = event.target.closest("button")?.dataset.action;
            this.contextMenu.hidden = true;
            this.grid.children[this.selectedBar]?.focus({ preventScroll: true });
            this.barAction(action);
        };
        this.partMenu.onclick = event => {
            const action = event.target.closest("button")?.dataset.action;
            this.partMenu.hidden = true;
            const index = this.selectedPart;
            const selected = this.partIndices(index);
            if (action === "edit") this.openPartEditor(index);
            if (action === "track-overrides") void this.openTrackOverrides(index, selected);
            if (action === "drum-transforms") void this.openDrumTransforms(index, selected);
            if (action === "custom-phrase") void this.openCustomPhrases(index, selected);
            if (action === "duplicate") this.duplicatePart(index, true);
            if (action === "remove") this.removePart(index, true);
            if (action === "remove-rhythm-change") this.removeRhythmChange(index);
            if (action === "play" || action === "play-selection") this.playPart(index, action === "play");
        };
        const popupMenus = [this.contextMenu, this.partMenu, this.parameterMenu];
        document.addEventListener("pointerdown", event => {
            for (const menu of popupMenus) if (!menu.contains(event.target)) menu.hidden = true;
        });
        for (const menu of popupMenus) menu.onkeydown = event => {
            const buttons = [...menu.querySelectorAll("button:not(:disabled):not([hidden])")];
            if (event.key === "Escape") {
                event.preventDefault(); menu.hidden = true;
                const returnTo = menu === this.parameterMenu ? this.parameterField
                    : menu === this.contextMenu ? this.grid.children[this.selectedBar] : this.parts.children[this.selectedPart]?.querySelector(".part-name-button");
                returnTo?.focus();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                buttons[(buttons.indexOf(document.activeElement) + direction + buttons.length) % buttons.length]?.focus();
            }
        };
        document.querySelector("#cancel-part-edit").onclick = () => this.partDialog.close();
        document.querySelector("#new-project").onclick = () => this.newSong();
        document.querySelector("#open-project-button").onclick = () => document.querySelector("#open-project").click();
        document.querySelector("#add-bar").onclick = () => this.editArrangement(() => {
            if (this.project.bars >= 1024) throw new Error("譜面の上限は1024小節です。");
            this.project.bars++;
        });
        this.removeBar = document.querySelector("#remove-bar");
        this.removeBar.onclick = () => this.editArrangement(() => {
            const bar = this.project.bars - 1;
            if (bar < 1 || this.project.sections.at(-1).bar === bar) return;
            this.project.chords = this.project.chords.filter(chord => chord.bar < bar);
            this.trimBarExtras(bar - 1);
            this.project.bars = bar;
        });
        document.querySelector("#add-song-part").onclick = () => this.duplicatePart(this.selectedPart ?? this.project.parts.length - 1);
        document.querySelector("#edit-song-parts").onclick = () => this.openPartEditor(this.selectedPart);
        this.title.oninput = () => { this.project.title = this.title.value; this.changed(); };
        this.meter.onchange = () => {
            this.editArrangement(() => {
                for (const section of this.project.sections) section.meter = this.meter.value;
            });
            this.onMeterChange?.(this.project.sections[0].meter);
        };
        document.querySelector("#save-project").onclick = () => this.save();
        this.exportButton.onclick = () => this.onExport?.();
        this.sheetColumns = document.querySelector("#sheet-columns");
        this.sheetHeight = document.querySelector("#sheet-height");
        this.sheetColumns.oninput = () => this.grid.style.setProperty("--sheet-columns", this.sheetColumns.value);
        this.sheetColumns.onchange = () => this.setSheetProperty("PropClEditorZoomFactorX",
            String(Math.round((16 - this.sheetColumns.valueAsNumber) * 100 / 15)));
        this.sheetHeight.oninput = () => this.grid.style.setProperty("--bar-height-zoom", this.sheetHeight.valueAsNumber / 50);
        this.sheetHeight.onchange = () => this.setSheetProperty("PropClEditorZoomFactorY", this.sheetHeight.value);
        this.showAnnotations = document.querySelector("#show-bar-annotations");
        this.annotationLines = document.querySelector("#bar-annotation-lines");
        this.showAnnotations.onclick = () => this.setSheetProperty("PropBarAnnotationsVisible",
            String(this.showAnnotations.getAttribute("aria-pressed") !== "true"));
        this.annotationLines.onchange = () => {
            if (this.annotationLines.value && this.annotationLines.validity.valid) {
                this.setSheetProperty("PropBarAnnotationsNbLines", this.annotationLines.value);
            } else this.render();
        };
        this.structureCompact = document.querySelector("#structure-compact");
        const zoom = document.querySelector("#structure-zoom");
        this.structureCompact.onclick = () => this.setSheetProperty("PropViewMode",
            this.parts.classList.contains("compact-view") ? "NORMAL" : "COMPACT");
        document.querySelector("#structure-compact-settings").onclick = () => this.openCompactSettings();
        zoom.oninput = () => {
            this.parts.classList.remove("fit-view");
            this.parts.style.setProperty("--structure-zoom", zoom.valueAsNumber / 100);
        };
        document.querySelector("#structure-fit").onclick = () => this.parts.classList.toggle("fit-view");
        document.querySelector("#create-practice-song").onclick = () => this.openPracticeSong();
    }

    notify(message = "", error = false) {
        localizedText(this.status, message);
        this.status.toggleAttribute("data-error", error);
    }

    changed() {
        this.renderedMix = null;
        this.onChanged?.();
    }

    get attachedStyles() {
        return Array.isArray(this.style) ? this.style : this.style ? [this.style] : [];
    }

    editArrangement(action, mixNames = [], rhythmMixKey) {
        try {
            const before = this.captureEdit(mixNames, rhythmMixKey);
            action();
            this.rememberEdit(before);
            this.changed(); this.render();
            return true;
        }
        catch (error) { this.notify(error.message, true); return false; }
    }

    capturesMixTrack(track, mixNames, rhythmMixKey) {
        return DesktopSongFiles.isUserMixTrack(track) ? mixNames.includes(track.name)
            : Boolean(rhythmMixKey && track.rhythmId === rhythmMixKey.rhythmId && track.name === rhythmMixKey.name);
    }

    captureEdit(mixNames = [], rhythmMixKey) {
        const { bars, sections, chords, parts, annotations, comments, clientProperties, loopRestartBar, userTracks } = this.project;
        const includes = track => this.capturesMixTrack(track, mixNames, rhythmMixKey);
        return structuredClone({ bars, sections, chords, parts, annotations, comments, clientProperties, loopRestartBar, userTracks,
            mixNames, rhythmMixKey, mixEntries: this.mix.filter(includes), savedMixEntries: this.unresolvedStyleMix?.filter(includes) });
    }

    setSheetProperty(key, value) {
        this.rememberEdit(this.captureEdit());
        this.project.clientProperties = { ...this.project.clientProperties, [key]: value };
        this.render();
    }

    openScoreAppearance() {
        const dialog = document.querySelector("#score-appearance");
        const form = dialog.querySelector("form");
        const section = this.project.sections.findLast(candidate => candidate.bar <= this.selectedBar);
        if (!section) return;
        const chord = this.selectedChord;
        const keyForSection = "PropSectionColor";
        const keyForChord = "SongPropUserFontColor";
        const sectionDefault = sectionColors[this.project.sections.indexOf(section) % sectionColors.length];
        const sectionColor = form.elements.sectionColor;
        const defaultSectionColor = form.elements.defaultSectionColor;
        const chordColor = form.elements.chordColor;
        const defaultChordColor = form.elements.defaultChordColor;
        const newLine = form.elements.newLine;
        const storedSectionColor = desktopColor(section.clientProperties?.[keyForSection]);
        const storedChordColor = desktopColor(chord?.clientProperties?.[keyForChord]);
        dialog.querySelector("#score-appearance-section").textContent = section.name;
        dialog.querySelector("#score-appearance-chord").textContent = chord ? this.chordLabel(chord.name, true) : "";
        dialog.querySelector("#score-appearance-chord-fields").hidden = !chord;
        sectionColor.value = storedSectionColor ?? sectionDefault;
        chordColor.value = storedChordColor ?? "#171715";
        sectionColor.disabled = defaultSectionColor.checked = !storedSectionColor;
        chordColor.disabled = defaultChordColor.checked = !storedChordColor;
        newLine.checked = section.clientProperties?.PropSectionStartOnNewLine === "true";
        const quantization = form.elements.quantization;
        const quantizationKey = "PropSectionQuantization";
        quantization.value = section.clientProperties?.[quantizationKey] ?? "";
        if (quantization.selectedIndex < 0) quantization.value = "";
        form.elements.allSections.checked = false;
        defaultSectionColor.onchange = () => { sectionColor.disabled = defaultSectionColor.checked; };
        defaultChordColor.onchange = () => { chordColor.disabled = defaultChordColor.checked; };
        form.elements.cancel.onclick = () => dialog.close();
        form.onsubmit = event => {
            event.preventDefault();
            this.rememberEdit(this.captureEdit());
            const colorProperty = (input, reset) => reset ? undefined : String(Number.parseInt(input.value.slice(1), 16) | 0xff000000);
            const update = (item, key, value) => {
                item.clientProperties ??= {};
                if (value === undefined) delete item.clientProperties[key];
                else item.clientProperties[key] = value;
            };
            update(section, keyForSection, colorProperty(sectionColor, defaultSectionColor.checked));
            update(section, "PropSectionStartOnNewLine", newLine.checked ? "true" : undefined);
            for (const item of form.elements.allSections.checked ? this.project.sections : [section]) {
                update(item, quantizationKey, quantization.value || undefined);
            }
            if (chord) update(chord, keyForChord, colorProperty(chordColor, defaultChordColor.checked));
            this.render();
            dialog.close();
            this.grid.children[this.selectedBar]?.focus();
        };
        dialog.showModal();
    }

    rememberEdit(before) {
        this.undoStack.push(before);
        if (this.undoStack.length > 30) this.undoStack.shift();
        this.redoStack.length = 0;
        this.updateUndo();
    }

    updateUndo() {
        this.undoButton.disabled = !this.project || !this.undoStack?.length;
        this.redoButton.disabled = !this.project || !this.redoStack?.length;
    }

    restoreEdit(from, into) {
        if (!this.project || !from.length) return;
        const { mixNames, rhythmMixKey, mixEntries, savedMixEntries, ...draft } = from.pop();
        into.push(this.captureEdit(mixNames, rhythmMixKey));
        if (mixNames.length || rhythmMixKey) {
            const keep = track => !this.capturesMixTrack(track, mixNames, rhythmMixKey);
            this.mix = [...this.mix.filter(keep), ...mixEntries];
            if (this.unresolvedStyleMix) {
                this.unresolvedStyleMix = [...this.unresolvedStyleMix.filter(keep), ...(savedMixEntries ?? mixEntries)];
            }
        }
        Object.assign(this.project, draft);
        this.selectedPart = null;
        this.partSelection.clear();
        this.updateUndo();
        this.changed();
        this.render();
    }

    open(project, mix, style = null, useSavedStyles = false, view) {
        this.onBeforeOpen?.();
        this.fileRequest = null;
        this.project = project;
        this.mix = mix;
        this.openedMix = view?.openedMix ?? structuredClone(mix);
        this.unresolvedStyleMix = undefined;
        this.style = style;
        this.selectedPart = null;
        this.partSelection.clear();
        this.selectedChord = null;
        this.scoreTarget = "bar";
        this.undoStack = view?.undoStack ?? [];
        this.redoStack = view?.redoStack ?? [];
        this.styleParameters = view?.styleParameters ?? new Map();
        this.updateUndo();
        this.selectedBar = this.selectionAnchor = view?.selectedBar ?? 0;
        this.changed();
        this.notify();
        document.querySelector("#project-editor").hidden = false;
        document.querySelector("#quick-chords").hidden = true;
        document.querySelector("#chords").required = false;
        this.render();
        this.onOpen(this, useSavedStyles);
    }

    async openFiles(input) {
        const files = Array.from(input.files);
        input.value = "";
        return this.loadFiles(files);
    }

    async loadFiles(files) {
        if (!files.length) return false;
        const request = {};
        this.fileRequest = request;
        try {
            const web = files.find(file => /\.jjazzweb$/iu.test(file.name));
            const text = files.find(file => /\.txt$/iu.test(file.name));
            let filename, project, mix = [], style;
            if (web && files.length === 1) {
                const data = JSON.parse(await web.text());
                if (data.version !== 1) throw new Error(t("Web曲ファイルの形式に対応していません。", "Unsupported Web song format."));
                filename = web.name;
                project = DesktopSongFiles.validateSong(data.song);
                mix = data.mix ?? [];
                style = data.style;
            } else if (text && files.length === 1) {
                if (text.size > 2 * 1024 * 1024) throw new Error(t("テキスト譜面の上限は2MBです。", "The text lead sheet is larger than 2 MB."));
                filename = text.name;
                project = await this.onReadTextSong(await text.text());
            } else {
                const songFile = files.find(file => /\.sng$/iu.test(file.name));
                const mixFile = files.find(file => /\.mix$/iu.test(file.name));
                if (!songFile || files.length > 2 || (files.length === 2 && !mixFile)
                    || (mixFile && songFile.name.slice(0, -4).toLowerCase() !== mixFile.name.slice(0, -4).toLowerCase())) {
                    throw new Error(t(".sng と同名の .mix、または .jjazzweb / .txt を1つ選択してください。",
                        "Choose a .sng with an optional same-name .mix, or one .jjazzweb or .txt file."));
                }
                filename = songFile.name;
                project = DesktopSongFiles.readSong(await songFile.text());
                if (mixFile) mix = DesktopSongFiles.readMix(await mixFile.text());
            }
            if (request !== this.fileRequest) return false;
            this.open(project, mix, style, true);
            this.notify(t(`${filename} を開きました。`, `Opened ${filename}.`));
            return true;
        } catch (error) {
            if (request === this.fileRequest) this.notify(error.message, true);
            return false;
        }
    }

    newSong() {
        const title = t("新しい曲", "New song");
        let saved;
        try { saved = localStorage.getItem(songTemplatePreference); } catch { /* Preference storage is optional. */ }
        let templateError;
        try {
            if (saved) {
                const { song, mix, style } = JSON.parse(saved);
                this.open(DesktopSongFiles.validateSong({ ...song, title }), mix ?? [], style, true);
                return;
            }
        } catch (error) { templateError = error; }
        this.open({ title, tempo: 120, bars: 4, sections: [{ name: "A", bar: 0, meter: "FOUR_FOUR" }],
            chords: ["C", "Am7", "Dm7", "G7"].map((name, bar) => ({ name, bar, beat: 0 })),
            parts: [{ name: "A", section: 0, styleId: "jjSwing-ID", styleName: "jjSwing", parameters: {} }], userTracks: []
        }, []);
        if (templateError) {
            this.notify(t("テンプレートを読み込めなかったため、標準の曲を開きました。", "The template could not be loaded. Opened the default song."), true);
        }
    }

    saveTemplate() {
        try {
            localStorage.setItem(songTemplatePreference, JSON.stringify(this.webData()));
            this.notify(t("新規曲のテンプレートを保存しました。", "Saved the template for new songs."));
        } catch (error) { this.notify(error.message, true); }
    }

    clearTemplate() {
        try {
            localStorage.removeItem(songTemplatePreference);
            this.notify(t("標準の新規曲テンプレートに戻しました。", "Restored the default new-song template."));
        } catch (error) { this.notify(error.message, true); }
    }

    linearizedSong() {
        const original = structuredClone(this.project);
        const ranges = this.partRanges();
        const bars = ranges.at(-1).to;
        if (bars > 1024) throw new Error(t("展開後のコード譜が1024小節を超えます。", "The expanded lead sheet exceeds 1,024 bars."));
        const sections = [], chords = [], parts = [], annotations = [];
        let loopRestartBar;
        for (const range of ranges) {
            const part = original.parts[range.index];
            const source = original.sections[part.section];
            const offset = range.from - 1 - range.sheetStart;
            const contains = item => item.bar >= range.sheetStart && item.bar < range.sheetEnd;
            sections.push({ ...source, bar: range.from - 1, name: `${source.name}#${range.index + 1}` });
            parts.push({ ...part, section: range.index });
            chords.push(...original.chords.filter(contains).map(item => ({ ...item, bar: item.bar + offset })));
            annotations.push(...(original.annotations ?? []).filter(contains).map(item => ({ ...item, bar: item.bar + offset })));
            if (loopRestartBar === undefined && contains({ bar: original.loopRestartBar })) loopRestartBar = original.loopRestartBar + offset;
        }
        return DesktopSongFiles.validateSong({ ...original, bars, sections, chords, parts, annotations, loopRestartBar,
            title: `${original.title} - ${t("演奏順", "linearized")}` });
    }

    button(label, callback) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = label;
        button.onclick = callback;
        return button;
    }

    partRanges() {
        let start = 0;
        return this.project.parts.map((part, index) => {
            const sheetStart = this.project.sections[part.section].bar;
            const sheetEnd = this.project.sections[part.section + 1]?.bar ?? this.project.bars;
            const from = start + 1;
            start += sheetEnd - sheetStart;
            return { index, sheetStart, sheetEnd, from, to: start };
        });
    }

    chooseBar(bar, selectedPart = null, throughBar, toEnd = false) {
        const occurrences = this.partRanges();
        const contains = (occurrence, value) => value >= occurrence.sheetStart && value < occurrence.sheetEnd;
        const matching = occurrences.filter(occurrence => contains(occurrence, bar));
        const first = matching.find(occurrence => occurrence.index === selectedPart) ?? matching[0];
        if (!first) { this.onChooseBar(null); return; }
        const last = throughBar === undefined ? null : occurrences.find(occurrence => occurrence.index >= first.index && contains(occurrence, throughBar));
        this.onChooseBar({ from: first.from + bar - first.sheetStart,
            to: toEnd ? occurrences.at(-1).to : last ? last.from + throughBar - last.sheetStart : first.to });
    }

    selectBar(bar, extend = false, focus = false) {
        this.selectedBar = Math.min(Math.max(0, bar), this.project.bars - 1);
        this.selectedChord = null;
        this.scoreTarget = "bar";
        if (!extend) this.selectionAnchor = this.selectedBar;
        this.markSelection();
        const [first, last] = this.selectedRange();
        this.chooseBar(first, this.selectedPart, first === last ? undefined : last);
        if (focus) this.grid.children[this.selectedBar].focus();
    }

    selectedRange() {
        return [Math.min(this.selectedBar, this.selectionAnchor), Math.max(this.selectedBar, this.selectionAnchor)];
    }

    playSelection(toEnd = false) {
        const [first, last] = this.selectedRange();
        this.chooseBar(first, this.selectedPart, last, toEnd);
        this.onPlay(!toEnd);
    }

    playPart(index, toEnd) {
        const ranges = this.partRanges();
        const range = ranges[index];
        if (!range) return;
        this.selectPart(index);
        this.onChooseBar({ from: range.from, to: toEnd ? ranges.at(-1).to : range.to });
        this.onPlay(!toEnd);
    }

    markSelection() {
        const [first, last] = this.selectedRange();
        Array.from(this.grid.children).forEach((cell, index) => {
            cell.tabIndex = index === this.selectedBar ? 0 : -1;
            cell.setAttribute("aria-selected", String(index >= first && index <= last));
        });
        const selected = first === last ? String(first + 1) : `${first + 1}–${last + 1}`;
        this.selection.textContent = t(`${selected}小節`, first === last ? `Bar ${selected}` : `Bars ${selected}`);
        const selection = this.grid.querySelector(".selected-chord");
        selection?.classList.remove("selected-chord");
        if (this.selectedChord) {
            const measure = this.grid.children[this.selectedChord.bar];
            [...measure.querySelectorAll(".chord-symbol")].find(symbol => Number(symbol.dataset.beat) === this.selectedChord.beat)?.classList.add("selected-chord");
        }
        const selectedParts = new Set(this.partIndices(this.selectedPart));
        for (const [index, item] of [...this.parts.children].entries()) {
            item.classList.toggle("selected-part", selectedParts.has(index));
            item.querySelector(".part-name-button")?.setAttribute("aria-pressed", String(selectedParts.has(index)));
        }
        document.querySelector("#edit-song-parts").disabled = !selectedParts.size;
    }

    handleBarKey(event, bar) {
        if (event.key.startsWith("Arrow")) {
            event.preventDefault();
            const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
            let nextBar = bar + direction;
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                const cells = [...this.grid.children];
                const current = cells[bar];
                while (cells[nextBar] && cells[nextBar].offsetTop === current.offsetTop) nextBar += direction;
                if (!cells[nextBar]) return;
                const rowTop = cells[nextBar].offsetTop;
                for (let other = nextBar + direction; cells[other]?.offsetTop === rowTop; other += direction) {
                    if (Math.abs(cells[other].offsetLeft - current.offsetLeft) < Math.abs(cells[nextBar].offsetLeft - current.offsetLeft)) {
                        nextBar = other;
                    }
                }
            }
            this.selectBar(nextBar, event.shiftKey, true);
        } else if (event.code === "Space" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault(); this.playSelection(!event.shiftKey);
        } else if (event.key === "Enter" || (event.key === " " && !event.shiftKey)) {
            event.preventDefault(); this.openBarEditor(this.selectedChord ? "chord" : "edit");
        } else if (event.key === "Delete" || ((event.ctrlKey || event.metaKey) && /^[cxv]$/iu.test(event.key))) {
            event.preventDefault();
            const action = ({ c: "copy", x: "cut", v: "paste-clipboard" })[event.key.toLowerCase()] ?? "clear";
            this.barAction(action);
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            const rect = this.grid.children[bar].getBoundingClientRect();
            this.openContext(rect.left, rect.bottom);
        } else if (/^[a-gA-GnN]$/u.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault(); this.openBarEditor("edit", event.key.toUpperCase());
        }
    }

    openContext(x, y, menu = this.contextMenu, target = this.selectedChord ? "chord" : this.scoreTarget ?? "bar") {
        this.contextMenu.hidden = this.partMenu.hidden = this.parameterMenu.hidden = true;
        if (menu === this.contextMenu) {
            this.scoreTarget = target;
            const labels = { bar: ["小節の操作", "Bar actions"], chord: ["コードの操作", "Chord actions"],
                section: ["セクションの操作", "Section actions"], annotation: ["小節メモの操作", "Bar annotation actions"] };
            menu.setAttribute("aria-label", t(...labels[target]));
            for (const button of menu.querySelectorAll("[data-target]")) {
                button.hidden = !button.dataset.target.split(" ").includes(target);
            }
            const [first, last] = this.selectedRange();
            menu.querySelector('[data-action="paste"]').disabled = !this.canPasteScore(first);
            menu.querySelector('[data-action="paste-insert"]').disabled = this.scoreClipboard?.target !== "bar"
                || this.project.bars + this.scoreClipboard.length > 1024;
            menu.querySelector('[data-action="paste-text"]').disabled = !navigator.clipboard?.readText;
            menu.querySelector('[data-action="cut"]').disabled = target === "bar" ? last - first + 1 >= this.project.bars
                : target === "section" && (first === 0 || !this.canCutSection(first));
            menu.querySelector('[data-action="insert"]').disabled = this.project.bars >= 1024;
            menu.querySelector('[data-action="chord-progression"]').disabled = first !== last;
            for (const button of menu.querySelectorAll("[data-song-boundary]")) button.disabled = this.project.bars >= 1024;
            menu.querySelector('[data-action="remove-bars"]').disabled = last - first + 1 >= this.project.bars;
            menu.querySelector('[data-action="end"]').disabled = last === this.project.bars - 1;
            menu.querySelector('[data-action="clear"]').disabled = !this.selectedChord
                && !this.project.chords.some(chord => chord.bar >= first && chord.bar <= last);
            for (const button of menu.querySelectorAll("[data-chord-tools]")) button.disabled = !this.chordsForTools().length;
            const section = this.project.sections.findLast(item => item.bar <= this.selectedBar);
            menu.querySelector('[data-action="section-break"]').setAttribute("aria-pressed", String(section?.clientProperties?.PropSectionStartOnNewLine === "true"));
            const restart = menu.querySelector('[data-action="restart"]');
            restart.disabled = this.selectedRange()[0] !== this.selectedRange()[1];
            restart.setAttribute("aria-pressed", String(this.project.loopRestartBar === this.selectedBar));
        } else menu.querySelector('[data-action="remove"]').disabled = this.project.parts.length < 2;
        openEditorPopup(menu, x, y);
    }

    openParameterMenu(field, key, options, write, x, y) {
        this.contextMenu.hidden = this.partMenu.hidden = true;
        this.parameterField = field;
        const numbered = field.type === "number";
        const current = options?.indexOf(field.value) ?? -1;
        const valueForDirection = direction => numbered
            ? String(field.valueAsNumber + direction * (Number(field.step) || 1))
            : options?.[current + direction];
        const buttons = Object.fromEntries([...this.parameterMenu.querySelectorAll("button")].map(button => [button.dataset.action, button]));
        buttons.paste.disabled = this.parameterClipboard?.key !== key
            || Boolean(options?.length && !options.includes(this.parameterClipboard.value));
        for (const [action, direction] of [["previous", -1], ["next", 1]]) {
            const value = valueForDirection(direction);
            buttons[action].disabled = value === undefined || (numbered && (!Number.isFinite(Number(value))
                || Number(value) < Number(field.min) || Number(value) > Number(field.max)));
        }
        this.parameterMenu.onclick = event => {
            const action = event.target.closest("button")?.dataset.action;
            if (!action) return;
            this.parameterMenu.hidden = true;
            if (action === "copy") this.parameterClipboard = { key, value: field.value };
            else if (action === "paste") write(this.parameterClipboard.value);
            else if (action === "reset") write("");
            else write(valueForDirection(action === "previous" ? -1 : 1));
            field.focus();
        };
        openEditorPopup(this.parameterMenu, x, y);
    }

    openPartMute(part, choices, selected) {
        const dialog = document.querySelector("#part-mute-editor");
        const fields = document.querySelector("#part-mute-tracks");
        fields.replaceChildren(...choices.map(name => {
            const label = document.createElement("label");
            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = name;
            input.checked = selected.includes(name);
            label.append(input, " ", name);
            return label;
        }));
        document.querySelector("#cancel-part-mute").onclick = () => dialog.close();
        document.querySelector("#part-mute-form").onsubmit = () => {
            const muted = [...fields.querySelectorAll(":checked")].map(input => input.value);
            this.editArrangement(() => {
                if (muted.length) part.parameters.RpSysMuteID = `[${muted.join(",")}]`;
                else delete part.parameters.RpSysMuteID;
            });
        };
        dialog.showModal();
    }

    barAction(action) {
        const [first, last] = this.selectedRange();
        switch (action) {
            case "play": this.playSelection(true); break;
            case "play-selection": this.playSelection(); break;
            case "practice": this.openPracticeSong(); break;
            case "edit": case "section": case "chord": case "annotation": this.openBarEditor(action); break;
            case "appearance": this.openScoreAppearance(); break;
            case "chord-tools": this.openChordTools(); break;
            case "transpose-up": void this.transposeChords(1); break;
            case "transpose-down": void this.transposeChords(-1); break;
            case "section-break": {
                const section = this.project.sections.findLast(item => item.bar <= this.selectedBar);
                if (!section) break;
                this.rememberEdit(this.captureEdit());
                section.clientProperties ??= {};
                if (section.clientProperties.PropSectionStartOnNewLine === "true") delete section.clientProperties.PropSectionStartOnNewLine;
                else section.clientProperties.PropSectionStartOnNewLine = "true";
                this.render();
                break;
            }
            case "clear-annotation":
                this.editArrangement(() => {
                    this.project.annotations = (this.project.annotations ?? []).filter(note => note.bar !== this.selectedBar);
                });
                break;
            case "restart":
                this.editArrangement(() => {
                    this.project.loopRestartBar = this.project.loopRestartBar === first ? undefined : first;
                });
                break;
            case "copy": case "cut":
                this.copyScoreSelection(first, last, action === "cut");
                break;
            case "paste":
                this.pasteScore(first);
                break;
            case "paste-insert":
                if (this.scoreClipboard?.target === "bar") this.insertScoreExcerpt(first, this.scoreClipboard);
                break;
            case "paste-text": case "paste-clipboard":
                void this.pasteClipboardText(first, action === "paste-clipboard");
                break;
            case "chord-progression": this.openChordProgressions(first); break;
            case "add-intro": case "add-ending": void this.insertSongBoundary(action === "add-intro"); break;
            case "clear":
                this.editArrangement(() => {
                    this.project.chords = this.project.chords.filter(chord => this.selectedChord ? chord !== this.selectedChord : chord.bar < first || chord.bar > last);
                    this.selectedChord = null;
                });
                break;
            case "insert":
                this.editArrangement(() => {
                    if (this.project.bars >= 1024) throw new Error(t("譜面の上限は1024小節です。", "The lead sheet is limited to 1024 bars."));
                    for (const chord of this.project.chords) if (chord.bar >= first) chord.bar++;
                    for (const section of this.project.sections) if (section.bar >= first && section.bar > 0) section.bar++;
                    for (const note of this.project.annotations ?? []) if (note.bar >= first) note.bar++;
                    if (this.project.loopRestartBar >= first) this.project.loopRestartBar++;
                    this.project.bars++;
                });
                break;
            case "remove-bars":
                this.removeBars(first, last);
                break;
            case "end":
                this.editArrangement(() => {
                    const removed = this.project.sections.findIndex(section => section.bar > last);
                    this.project.bars = last + 1;
                    this.project.chords = this.project.chords.filter(chord => chord.bar <= last);
                    this.trimBarExtras(last);
                    if (removed < 0) return;
                    const keep = this.project.parts.filter(part => part.section < removed);
                    this.project.parts = keep.length ? keep : [{ ...this.project.parts[0], section: 0, name: this.project.sections[0].name }];
                    this.project.sections.splice(removed);
                });
        }
    }

    copyScoreSelection(first, last, cut) {
        const target = this.selectedChord ? "chord" : this.scoreTarget ?? "bar";
        const project = this.project;
        if (target === "bar") {
            const length = last - first + 1;
            if (cut && length >= project.bars) return;
            const relative = items => items.filter(item => item.bar >= first && item.bar <= last)
                .map(item => ({ ...item, bar: item.bar - first }));
            const initial = project.sections.findLast(section => section.bar <= first);
            const sections = [{ ...initial, bar: 0 }, ...relative(project.sections.filter(section => section.bar > first))];
            const parts = sections.map((section, index) => ({ ...project.parts.find(part => project.sections[part.section].name === section.name), section: index }));
            this.scoreClipboard = structuredClone({ target, length, sections, parts, chords: relative(project.chords), annotations: relative(project.annotations ?? []) });
            this.copyScoreText(this.scoreExcerptText(this.scoreClipboard));
            if (cut) this.removeBars(first, last);
            return;
        }
        const item = target === "chord" ? this.selectedChord : target === "section" ? project.sections.find(section => section.bar === first)
            : project.annotations?.find(note => note.bar === first);
        if (!item || (cut && target === "section" && !this.canCutSection(first))) return;
        this.scoreClipboard = structuredClone({ target, item });
        if (target === "chord") this.copyScoreText(`| ${item.originalName ?? item.name} |`);
        else if (target === "annotation") this.copyScoreText(item.text);
        else this.scoreClipboardText = undefined;
        if (!cut) return;
        this.editArrangement(() => {
            if (target === "chord") project.chords = project.chords.filter(chord => chord !== item);
            else if (target === "annotation") project.annotations = project.annotations.filter(note => note !== item);
            else {
                const index = project.sections.indexOf(item);
                project.sections.splice(index, 1);
                project.parts = project.parts.filter(part => part.section !== index);
                for (const part of project.parts) if (part.section > index) part.section--;
            }
            this.selectedChord = null;
            this.scoreTarget = "bar";
        });
    }

    canCutSection(bar) {
        const { sections, parts, chords, bars } = this.project;
        const index = sections.findIndex(section => section.bar === bar);
        if (index <= 0 || parts.every(part => part.section === index)) return false;
        const end = sections[index + 1]?.bar ?? bars;
        const beats = DesktopSongFiles.meters[sections[index - 1].meter][1];
        return !chords.some(chord => chord.bar >= bar && chord.bar < end && chord.beat >= beats);
    }

    canPasteScore(bar) {
        const clip = this.scoreClipboard;
        if (!clip) return false;
        if (clip.target === "chord") return clip.item.beat < this.beatsInBar(bar);
        if (clip.target !== "bar") return true;
        return bar + clip.length <= this.project.bars && clip.chords.every(chord => chord.beat < this.beatsInBar(chord.bar + bar));
    }

    pasteScore(bar) {
        if (!this.canPasteScore(bar)) return;
        const { target, item, length, chords, annotations } = structuredClone(this.scoreClipboard);
        const project = this.project;
        this.editArrangement(() => {
            if (target === "bar") {
                const end = bar + length;
                const outside = value => value.bar < bar || value.bar >= end;
                project.chords = [...project.chords.filter(outside), ...chords.map(chord => ({ ...chord, bar: bar + chord.bar }))];
                project.annotations = [...(project.annotations ?? []).filter(outside), ...annotations.map(note => ({ ...note, bar: bar + note.bar }))];
            } else if (target === "chord") {
                project.chords = [...project.chords.filter(chord => chord.bar !== bar || chord.beat !== item.beat), { ...item, bar }];
            } else if (target === "annotation") {
                project.annotations = [...(project.annotations ?? []).filter(note => note.bar !== bar), { ...item, bar }];
            } else {
                let name = item.name;
                for (let suffix = 2; project.sections.some(section => section.bar !== bar && section.name === name); suffix++) name = `${item.name}-${suffix}`;
                this.setSectionName(bar, name, item.meter);
                project.sections.find(section => section.bar === bar).clientProperties = item.clientProperties;
            }
        });
    }

    scoreExcerptText({ length, sections, chords }) {
        const byBar = Map.groupBy(chords, chord => chord.bar);
        const meters = new Map(sections.map(section => [section.bar, section.meter]));
        const lines = [];
        let cells = [], previous;
        for (let bar = 0; bar < length; bar++) {
            const meter = meters.get(bar);
            const names = (byBar.get(bar) ?? []).toSorted((a, b) => a.beat - b.beat).map(chord => chord.originalName ?? chord.name);
            cells.push([...(meter && meter !== previous ? [DesktopSongFiles.meters[meter][0]] : []), ...names].join(" "));
            if (meter) previous = meter;
            if (cells.length === 4 || bar === length - 1) { lines.push(`| ${cells.join(" | ")} |`); cells = []; }
        }
        return lines.join("\n");
    }

    copyScoreText(text) {
        this.scoreClipboardText = text;
        navigator.clipboard?.writeText?.(text).catch(() => {});
    }

    async pasteClipboardText(bar, preferInternal) {
        const project = this.project;
        try {
            let text;
            try { text = await navigator.clipboard?.readText(); }
            catch (error) { if (!preferInternal || !this.scoreClipboard) throw error; }
            if (this.project !== project || this.selectedRange()[0] !== bar) return;
            if (preferInternal && this.scoreClipboard && (!text || text.trim() === this.scoreClipboardText?.trim())) {
                this.pasteScore(bar);
                return;
            }
            if (!text?.trim()) return;
            const excerpt = await this.onReadTextSong(text);
            if (this.project === project && this.selectedRange()[0] === bar) this.insertScoreExcerpt(bar, { ...excerpt, length: excerpt.bars });
        } catch (error) { if (this.project === project) this.notify(error.message, true); }
    }

    insertScoreExcerpt(bar, excerpt) {
        return this.editArrangement(() => {
            const project = this.project;
            const { length, chords, annotations = [] } = excerpt;
            if (project.bars + length > 1024) throw new Error(t("譜面の上限は1024小節です。", "The lead sheet is limited to 1024 bars."));
            const shift = item => ({ ...item, bar: item.bar + (item.bar >= bar ? length : 0) });
            const oldSections = project.sections.map(shift);
            if (excerpt.breakAfter) oldSections[0].clientProperties = { ...oldSections[0].clientProperties, PropSectionStartOnNewLine: "true" };
            const names = new Set(oldSections.map(section => section.name));
            const create = (section, position) => {
                let name = section.name;
                for (let suffix = 2; names.has(name); suffix++) name = `${section.name}-${suffix}`;
                names.add(name);
                return { ...structuredClone(section), name, bar: position };
            };
            const inserted = excerpt.sections.map(section => create(section, bar + section.bar));
            const after = project.sections.findLastIndex(section => section.bar <= bar);
            const split = bar < project.bars && project.sections[after].bar < bar;
            if (split) inserted.push(create(project.sections[after], bar + length));
            const sections = [...oldSections, ...inserted].sort((a, b) => a.bar - b.bar);
            const parts = project.parts.map(part => ({ ...part, section: sections.indexOf(oldSections[part.section]) }));
            const previous = bar === project.bars ? project.parts.length - 1 : project.parts.findIndex(part => part.section === after - Number(!split));
            const fallback = project.parts[previous] ?? project.parts[0];
            parts.splice(previous + 1, 0, ...inserted.map((section, index) => {
                const saved = excerpt.parts?.find(part => part.section === index && part.styleId);
                return { ...structuredClone(saved ?? fallback), name: section.name, section: sections.indexOf(section) };
            }));
            Object.assign(project, { sections, parts, bars: project.bars + length,
                chords: [...project.chords.map(shift), ...chords.map(chord => ({ ...structuredClone(chord), bar: bar + chord.bar }))],
                annotations: [...(project.annotations ?? []).map(shift), ...annotations.map(note => ({ ...structuredClone(note), bar: bar + note.bar }))],
                loopRestartBar: project.loopRestartBar >= bar ? project.loopRestartBar + length : project.loopRestartBar });
        });
    }

    openChordProgressions(bar) {
        const project = this.project;
        const dialog = document.querySelector("#chord-progressions");
        const form = dialog.querySelector("form");
        const chooser = form.elements.progression;
        const status = document.querySelector("#chord-progressions-status");
        const submit = form.querySelector('[type="submit"]');
        chooser.replaceChildren();
        let group = chooser;
        for (const raw of embeddedChordProgressions.split(/\r?\n/u)) {
            const line = raw.replace(/\/\/.*$/u, "").trim();
            if (!line) continue;
            if (line.startsWith("|")) group.append(new Option(line, line));
            else {
                group = document.createElement("optgroup");
                group.label = line;
                chooser.append(group);
            }
        }
        status.textContent = "";
        submit.disabled = false;
        form.elements.cancelProgression.onclick = () => dialog.close();
        form.onsubmit = async event => {
            event.preventDefault();
            submit.disabled = true;
            try {
                const preset = await this.onReadTextSong(chooser.value);
                const end = bar + preset.bars;
                if (end > 1024) throw new Error(t("譜面の上限は1024小節です。", "The lead sheet is limited to 1024 bars."));
                const swing = new Map();
                const chords = [];
                for (const chord of preset.chords) {
                    const target = bar + chord.bar;
                    const section = project.sections.findLast(section => section.bar <= target);
                    const beats = DesktopSongFiles.meters[section.meter][1];
                    if (chord.beat && beats === 3 && !swing.has(section)) swing.set(section, await this.onSectionSwing(project, section));
                    const half = beats === 3 ? (swing.get(section) ? Math.fround(5 / 3) : 1.5) : Math.ceil(beats / 2);
                    chords.push({ ...chord, bar: target, beat: chord.beat ? half : 0 });
                }
                if (!dialog.open || this.project !== project) return;
                this.editArrangement(() => {
                    project.bars = Math.max(project.bars, end);
                    project.chords = [...project.chords.filter(chord => chord.bar < bar || chord.bar >= end), ...chords];
                });
                dialog.close();
                this.selectBar(bar);
                this.selectBar(end - 1, true, true);
            } catch (error) { if (dialog.open) status.textContent = error.message; }
            finally { submit.disabled = false; }
        };
        dialog.showModal();
    }

    async insertSongBoundary(intro) {
        const project = this.project;
        if (project.bars >= 1024) return;
        const bar = intro ? 0 : project.bars;
        const part = intro ? project.parts[0] : project.parts.at(-1);
        const meter = (intro ? project.sections[0] : project.sections.at(-1)).meter;
        const name = intro ? "Start" : "End";
        const preferred = intro ? "Intro A-1" : "Ending A-1";
        let variation = this.parametersFor(part.styleId).get("rpVariationID");
        if (!variation?.values.length) {
            try { variation = (await this.onDescribeRhythm(part.styleId)).parameters.get("rpVariationID"); }
            catch { /* A missing style retains its default when it becomes available. */ }
        }
        if (this.project !== project || (!intro && project.bars !== bar)) return;
        const chords = project.chords.toSorted((a, b) => a.bar - b.bar || a.beat - b.beat);
        const chord = intro ? chords[0] : chords.at(-1);
        const value = variation?.values.includes(preferred) ? preferred : variation?.fallback;
        const parameters = value ? { rpVariationID: value } : {};
        if (this.insertScoreExcerpt(bar, { length: 1, breakAfter: intro, sections: [{ name, meter, bar: 0 }],
            chords: chord ? [{ ...chord, bar: 0, beat: 0 }] : [], parts: [{ ...part, section: 0, parameters }] })) {
            this.selectBar(bar, false, true);
        }
    }

    resizeScoreTime(factor) {
        if (!this.project) return;
        const project = this.project;
        const bars = Math.ceil(project.bars * factor);
        if (bars === project.bars) return;
        this.editArrangement(() => {
            if (bars > 1024) throw new Error(t("譜面の上限は1024小節です。", "The lead sheet is limited to 1024 bars."));
            const barAt = bar => Math.floor(bar * factor);
            const beatsAt = (sections, bar) => DesktopSongFiles.meters[sections.findLast(section => section.bar <= bar).meter][1];
            const indexMap = new Map();
            const sections = [];
            for (const [index, section] of project.sections.entries()) {
                const bar = barAt(section.bar);
                if (sections.at(-1)?.bar === bar) continue;
                indexMap.set(index, sections.length);
                sections.push({ ...section, bar });
            }
            const parts = project.parts.filter(part => indexMap.has(part.section))
                .map(part => ({ ...part, section: indexMap.get(part.section) }));
            if (!parts.length) parts.push({ ...project.parts[0], section: 0, name: sections[0].name });
            const occupied = new Set();
            const chords = project.chords.map(chord => {
                const beats = beatsAt(project.sections, chord.bar);
                let bar = barAt(chord.bar);
                let beat = factor === 2 ? chord.beat * 2 : ((chord.bar % 2 ? beats : 0) + chord.beat) / 2;
                if (factor === 2 && beat >= beats) { bar++; beat -= beats; }
                beat = Math.fround(beat);
                const key = `${bar}:${beat}`;
                if (beat >= beatsAt(sections, bar) || occupied.has(key)) {
                    throw new Error(t("変換先の拍子でコードが小節からはみ出すか、同じ拍に重なります。",
                        "The conversion would put chords outside the destination meter or on the same beat."));
                }
                occupied.add(key);
                return { ...chord, bar, beat };
            });
            const annotations = new Map();
            for (const note of project.annotations ?? []) {
                const bar = barAt(note.bar);
                const previous = annotations.get(bar);
                annotations.set(bar, { ...note, bar, text: previous ? `${previous.text}\n${note.text}` : note.text });
            }
            Object.assign(project, { bars, sections, parts, chords, annotations: [...annotations.values()],
                loopRestartBar: project.loopRestartBar === undefined ? undefined : barAt(project.loopRestartBar) });
        });
    }

    chordsForTools() {
        const [first, last] = this.selectedRange();
        const chords = this.selectedChord ? [this.selectedChord] : this.project.chords.filter(chord => chord.bar >= first && chord.bar <= last);
        return chords.filter(chord => chord.name !== "NC").sort((a, b) => a.bar - b.bar || a.beat - b.beat);
    }

    async transposeChords(delta) {
        const project = this.project;
        const chords = this.chordsForTools();
        if (!chords.length) return;
        const names = chords.flatMap(chord => [chord, ...(chord.alternate?.name && chord.alternate.name !== "NC" ? [chord.alternate] : [])]);
        const original = names.map(chord => chord.originalName ?? chord.name);
        try {
            const transposed = await this.onTransposeChords(original, delta);
            if (this.project !== project || chords.some(chord => !project.chords.includes(chord))
                || names.some((chord, index) => (chord.originalName ?? chord.name) !== original[index])) return;
            this.editArrangement(() => {
                for (const [index, chord] of names.entries()) {
                    chord.name = transposed[index];
                    delete chord.originalName;
                    if (chord.scale) chord.scale.pitch = String(Math.max(0, Math.min(127, Number(chord.scale.pitch) + delta)));
                }
            });
        } catch (error) { this.notify(error.message, true); }
    }

    async openChordTools() {
        const chords = this.chordsForTools();
        if (!chords.length) return;
        const dialog = document.querySelector("#chord-tools");
        const form = dialog.querySelector("form");
        const type = form.elements.chordType;
        const preview = form.elements.previewChord;
        const apply = form.querySelector('[type="submit"]');
        const notes = document.querySelector("#chord-preview-notes");
        const status = document.querySelector("#chord-tools-status");
        const unchanged = "__unchanged__";
        const project = this.project;
        const initialTypes = new Map();
        const session = {};
        this.chordToolsSession = session;
        const valid = () => dialog.open && this.project === project && this.chordToolsSession === session;
        const withType = chord => {
            if (type.value === unchanged) return chord.name;
            const root = /^[A-G][#b]?/iu.exec(chord.name)?.[0];
            const bass = /\/[A-G][#b]?$/iu.exec(chord.name)?.[0] ?? "";
            return root ? root + type.value + bass : chord.name;
        };
        const show = chords => {
            notes.replaceChildren(...chords.map(({ name, tones }) => {
                const item = document.createElement("li");
                item.textContent = `${name} · ${tones}`;
                return item;
            }));
        };
        notes.replaceChildren();
        status.textContent = "";
        type.replaceChildren();
        preview.disabled = apply.disabled = type.disabled = true;
        form.elements.cancelChordTools.onclick = () => dialog.close();
        dialog.onclose = () => this.onStopChordAudition();
        preview.onclick = async () => {
            status.textContent = "";
            preview.disabled = true;
            try { await this.onAuditionChords(chords.map(withType), valid); }
            catch (error) { if (valid()) status.textContent = error.message; }
            finally { if (valid()) preview.disabled = false; }
        };
        form.onsubmit = event => {
            event.preventDefault();
            if (apply.disabled || !valid() || chords.some(chord => !project.chords.includes(chord))) return;
            const changed = type.value === unchanged ? [] : chords.filter(chord => initialTypes.get(chord) !== type.value);
            if (changed.length) this.editArrangement(() => {
                for (const chord of changed) {
                    chord.name = withType(chord);
                    delete chord.originalName;
                    delete chord.scale;
                }
            });
            dialog.close();
        };
        dialog.showModal();
        try {
            const data = await this.onReadChordTools(chords.map(chord => chord.name));
            if (!valid()) return;
            chords.forEach((chord, index) => initialTypes.set(chord, data.chords[index].type));
            const sameType = data.chords.every(chord => chord.type === data.chords[0].type);
            const current = sameType ? data.chords[0].type || t("メジャー", "Major") : "";
            const keep = current ? t(`現在のタイプ（${current}）`, `Current type (${current})`) : t("変更しない", "Keep current types");
            type.replaceChildren(new Option(keep, unchanged),
                ...data.types.map(name => new Option(name || t("メジャー", "Major"), name)));
            show(data.chords);
            preview.disabled = apply.disabled = type.disabled = false;
            type.onchange = async () => {
                const value = type.value;
                try {
                    const changed = await this.onReadChordTools(chords.map(withType));
                    if (valid() && type.value === value) show(changed.chords);
                } catch (error) { if (valid()) status.textContent = error.message; }
            };
        } catch (error) { if (valid()) status.textContent = error.message; }
    }

    openPracticeSong() {
        if (!this.project) return;
        const [first, last] = this.selectedRange();
        const dialog = document.querySelector("#practice-song");
        const start = document.querySelector("#practice-start");
        const end = document.querySelector("#practice-end");
        const steps = document.querySelector("#practice-steps");
        const error = document.querySelector("#practice-error");
        document.querySelector("#practice-song-range").textContent =
            t(`コード譜の ${first + 1}–${last + 1} 小節`, `Lead sheet bars ${first + 1}–${last + 1}`);
        end.value = Math.max(30, Math.min(350, this.project.tempo));
        start.value = Math.max(30, Number(end.value) - 30);
        error.textContent = "";
        document.querySelector("#cancel-practice-song").onclick = () => dialog.close();
        document.querySelector("#practice-song-form").onsubmit = event => {
            try {
                const data = this.createPracticeSong(first, last, start.valueAsNumber, end.valueAsNumber, steps.valueAsNumber);
                downloadSongFile(`${this.fileStem()}-${t("練習", "practice")}.jjazzweb`, JSON.stringify(data), "application/json");
            } catch (failure) {
                event.preventDefault();
                error.textContent = failure.message;
            }
        };
        dialog.showModal();
    }

    createPracticeSong(first, last, start, end, steps) {
        const project = this.project;
        if (Math.max(start, end) > 4 * Math.min(start, end)) {
            throw new Error(t("開始テンポと終了テンポの比を4倍以内にしてください。", "The faster tempo can be at most four times the slower tempo."));
        }
        const initial = project.sections.findLastIndex(section => section.bar <= first);
        const sections = project.sections.slice(initial).filter(section => section.bar <= last)
            .map(section => ({ ...section, bar: Math.max(0, section.bar - first) }));
        const inRange = item => item.bar >= first && item.bar <= last;
        const chordByPosition = (a, b) => a.bar - b.bar || a.beat - b.beat;
        const chords = project.chords.filter(inRange).map(chord => ({ ...chord, bar: chord.bar - first })).sort(chordByPosition);
        if (chords[0]?.bar !== 0 || chords[0]?.beat !== 0) {
            const previous = project.chords.filter(chord => chord.bar < first).sort(chordByPosition).at(-1);
            if (previous) chords.unshift({ ...previous, bar: 0, beat: 0 });
        }
        if (!chords.length) throw new Error(t("練習曲に使うコードがありません。", "The practice song has no chords."));
        const baseParts = sections.map((section, index) => {
            const part = project.parts.find(candidate => candidate.section === initial + index);
            if (!part) throw new Error(t(`「${section.name}」は曲構成にありません。`, `“${section.name}” has no song part.`));
            return { ...part, section: index };
        });
        const tempo = start >= end / 2 && start <= end * 2 ? end : Math.round(Math.max(start, end) / 2);
        const parts = Array.from({ length: steps }, (_, step) => {
            const bpm = start + (end - start) * step / (steps - 1);
            return baseParts.map(part => ({ ...part, parameters: { ...part.parameters, rpTempoID: String(Math.round(100 * bpm / tempo)) } }));
        }).flat();
        const song = DesktopSongFiles.validateSong({ title: `${project.title} – ${t("練習", "Practice")}`, tempo,
            bars: last - first + 1, sections, chords, parts, userTracks: [],
            annotations: (project.annotations ?? []).filter(inRange).map(note => ({ ...note, bar: note.bar - first })) });
        const rhythms = new Set(parts.map(part => part.styleId));
        const mix = (this.unresolvedStyleMix ?? this.mix).filter(track => rhythms.has(track.rhythmId));
        return { version: 1, song, mix, style: this.style };
    }

    removeBars(first, last) {
        const count = last - first + 1;
        if (count >= this.project.bars) return;
        this.editArrangement(() => {
            const { sections, parts, chords } = this.project;
            const replaceInitial = first === 0 && sections.some(section => section.bar === last + 1);
            const isRemoved = bar => bar >= first && bar <= last;
            const movedBar = bar => bar > last ? bar - count : bar;
            const sectionIndices = new Map();
            const nextSections = [];
            sections.forEach((section, index) => {
                if (isRemoved(section.bar) && (index !== 0 || replaceInitial)) return;
                sectionIndices.set(index, nextSections.length);
                nextSections.push({ ...section, bar: movedBar(section.bar) });
            });
            const nextChords = chords.filter(chord => !isRemoved(chord.bar))
                .map(chord => ({ ...chord, bar: movedBar(chord.bar) }));
            for (const chord of nextChords) {
                const section = nextSections.findLast(item => item.bar <= chord.bar);
                const beats = DesktopSongFiles.meters[section.meter][1];
                if (chord.beat < beats) continue;
                // A cut can remove a section boundary and put surviving chords in a shorter meter.
                const occupied = new Set(nextChords.filter(other => other.bar === chord.bar).map(other => other.beat));
                let beat = beats - 0.5;
                while (beat >= 0 && occupied.has(beat)) beat -= 0.5;
                if (beat < 0) throw new Error(t("削除後の拍子に収まらないコードがあります。", "Some chords do not fit the time signature after deletion."));
                chord.beat = beat;
            }
            const nextParts = parts.filter(part => sectionIndices.has(part.section))
                .map(part => ({ ...part, section: sectionIndices.get(part.section) }));
            const restart = this.project.loopRestartBar;
            Object.assign(this.project, {
                bars: this.project.bars - count, sections: nextSections, chords: nextChords,
                parts: nextParts.length ? nextParts : [{ ...parts[0], section: 0, name: nextSections[0].name }],
                annotations: (this.project.annotations ?? []).filter(note => !isRemoved(note.bar))
                    .map(note => ({ ...note, bar: movedBar(note.bar) })),
                loopRestartBar: restart === undefined || isRemoved(restart) ? undefined : movedBar(restart)
            });
            this.selectedBar = this.selectionAnchor = Math.min(first, this.project.bars - 1);
            this.selectedChord = this.selectedPart = null;
        });
    }

    trimBarExtras(last) {
        if (this.project.annotations) this.project.annotations = this.project.annotations.filter(note => note.bar <= last);
        if (this.project.loopRestartBar > last) this.project.loopRestartBar = undefined;
    }

    beatsInBar(bar) {
        return DesktopSongFiles.meters[this.project.sections.findLast(section => section.bar <= bar).meter][1];
    }

    openBarEditor(mode = "edit", initialChord) {
        const bar = this.selectedBar;
        this.editingSection = mode === "section";
        this.editingAnnotation = mode === "annotation";
        this.editingChord = mode === "chord" ? this.selectedChord : null;
        document.querySelector("#bar-editor-title").textContent = this.editingAnnotation ? t(`${bar + 1}小節のメモ`, `Annotation at bar ${bar + 1}`) : this.editingSection
            ? t(`${bar + 1}小節のセクション`, `Section at bar ${bar + 1}`) : t(`${bar + 1}小節のコード`, `Chords at bar ${bar + 1}`);
        document.querySelector("#bar-chords-field").hidden = this.editingSection || this.editingAnnotation;
        document.querySelector("#bar-editor-help").hidden = this.editingSection || this.editingAnnotation || Boolean(this.editingChord);
        document.querySelector("#bar-section-field").hidden = !this.editingSection;
        document.querySelector("#bar-annotation-field").hidden = !this.editingAnnotation;
        const interpretation = document.querySelector("#chord-interpretation");
        interpretation.hidden = !this.editingChord;
        this.annotationField.value = this.project.annotations?.find(note => note.bar === bar)?.text ?? "";
        this.barError.textContent = "";
        this.chordField.value = initialChord ?? this.project.chords.filter(chord => chord.bar === bar).sort((a, b) => a.beat - b.beat)
            .map(chord => chord.beat ? `${Number((chord.beat + 1).toFixed(6))}:${this.chordLabel(chord.name)}` : this.chordLabel(chord.name)).join(" ");
        if (this.editingChord) {
            this.chordField.value = this.chordLabel(this.editingChord.name);
            const features = (this.editingChord.features ?? "").split(",").map(value => value.trim());
            for (const field of interpretation.querySelectorAll("#chord-accent, #chord-duration, #chord-crash")) {
                field.value = [...field.options].find(option => features.includes(option.value))?.value ?? "";
            }
            for (const field of interpretation.querySelectorAll('input[type="checkbox"]')) field.checked = features.includes(field.value);
            const alternate = this.editingChord.alternate;
            document.querySelector("#chord-alternate").value = alternate ? this.chordLabel(alternate.name) : "";
            const condition = document.querySelector("#chord-alternate-condition");
            condition.value = alternate?.random ?? "";
            const markers = document.querySelector("#chord-alternate-markers");
            const selectedMarkers = alternate?.markers ?? ["solo"];
            markers.replaceChildren(...[...new Set([...partMarkers, ...selectedMarkers])]
                .map(marker => new Option(marker, marker, false, selectedMarkers.includes(marker))));
            condition.onchange = () => { document.querySelector("#chord-alternate-marker-field").hidden = Boolean(condition.value); };
            condition.onchange();
            this.updateChordScales(this.editingChord.scale);
            this.chordField.oninput = () => {
                const selected = document.querySelector("#chord-scale").selectedOptions[0];
                this.updateChordScales(selected?.value ? { index: selected.value } : undefined);
            };
        } else this.chordField.oninput = null;
        const sections = this.project.sections;
        let suffix = 1;
        while (sections.some(section => section.name === `S${suffix}`)) suffix++;
        this.sectionField.value = sections.find(section => section.bar === bar)?.name ?? `S${suffix}`;
        this.sectionMeter.value = sections.findLast(section => section.bar <= bar).meter;
        this.barDialog.showModal();
        const field = this.editingSection ? this.sectionField : this.editingAnnotation ? this.annotationField : this.chordField;
        field.focus();
        if (initialChord === undefined) field.select();
        else field.setSelectionRange(field.value.length, field.value.length);
    }

    async updateChordScales(preferred) {
        const select = document.querySelector("#chord-scale");
        const chord = this.editingChord;
        const name = this.concertChord(this.chordField.value.trim(), chord.name);
        const request = {};
        this.scaleRequest = request;
        let original;
        if (preferred?.pitch !== undefined) {
            original = new Option(t(`保存済みのスケール（${preferred.index}）`, `Saved scale (${preferred.index})`), preferred.index);
            original.dataset.pitch = preferred.pitch;
        }
        select.replaceChildren(new Option(t("既定", "Default"), ""), ...(original ? [original] : []));
        if (original) select.value = original.value;
        try {
            const rows = await this.onChordScales(name);
            if (this.scaleRequest !== request || this.editingChord !== chord || !this.barDialog.open) return;
            for (const row of rows) {
                const [index, pitch, label] = row.split("\t");
                const option = new Option(label.replaceAll("_", " "), index);
                option.dataset.pitch = pitch;
                if (original?.value === index) {
                    option.dataset.pitch = original.dataset.pitch;
                    original.replaceWith(option);
                    select.value = index;
                } else select.append(option);
            }
            if (preferred && [...select.options].some(option => option.value === String(preferred.index))) {
                select.value = preferred.index;
            }
        } catch {
            // Keep the imported scale available if the engine or chord is unavailable.
        }
    }

    commitBarEdit() {
        const bar = this.selectedBar;
        try {
            const before = this.captureEdit();
            if (this.editingAnnotation) {
                const text = this.annotationField.value.trim();
                const notes = this.project.annotations ?? [];
                const previous = notes.find(note => note.bar === bar);
                this.project.annotations = notes.filter(note => note.bar !== bar);
                if (text) {
                    this.project.annotations.push({ ...previous, bar, text });
                    if (!notes.length) {
                        this.project.clientProperties = { ...this.project.clientProperties, PropBarAnnotationsVisible: "true" };
                    }
                }
            } else if (this.editingSection) this.setSectionName(bar, this.sectionField.value.trim(), this.sectionMeter.value);
            else if (this.editingChord) {
                const parsed = this.parseBarChords(bar, this.chordField.value);
                if (parsed.length !== 1 || parsed[0].beat !== 0) throw new Error(t("コードを1つ入力してください。", "Enter one chord symbol."));
                const name = this.concertChord(this.chordField.value.trim().replace(/^1(?:\.0+)?:/u, ""), this.editingChord.name);
                const fields = document.querySelector("#chord-interpretation");
                const accent = fields.querySelector("#chord-accent").value;
                const duration = fields.querySelector("#chord-duration").value;
                const features = [accent || (duration ? "ACCENT" : ""), duration, fields.querySelector("#chord-crash").value,
                    ...[...fields.querySelectorAll("input:checked")].map(field => field.value)].filter(Boolean).join(",");
                const scaleChoice = fields.querySelector("#chord-scale").selectedOptions[0];
                const scale = scaleChoice?.value ? { index: scaleChoice.value, pitch: scaleChoice.dataset.pitch } : undefined;
                const alternateName = this.concertChord(fields.querySelector("#chord-alternate").value.trim(), this.editingChord.alternate?.name);
                let alternate;
                if (alternateName) {
                    if (/\s|:/u.test(alternateName)) throw new Error(t("代替コードを1つ入力してください。", "Enter one alternate chord symbol."));
                    const random = fields.querySelector("#chord-alternate-condition").value;
                    const markers = random ? [] : [...fields.querySelector("#chord-alternate-markers").selectedOptions].map(option => option.value);
                    if (!random && !markers.length) throw new Error(t("マーカーを選択してください。", "Select a marker."));
                    const previous = this.editingChord.alternate;
                    alternate = { ...(previous?.name === alternateName ? previous : {}), name: alternateName, random, markers };
                }
                this.project.chords = this.project.chords.map(chord => chord === this.editingChord
                    ? { ...chord, name, originalName: name === chord.name ? chord.originalName : name, features, scale, alternate } : chord);
            }
            else {
                const newChords = this.parseBarChords(bar, this.chordField.value);
                this.project.chords = [...this.project.chords.filter(chord => chord.bar !== bar), ...newChords]
                    .sort((a, b) => a.bar - b.bar || a.beat - b.beat);
            }
            this.rememberEdit(before);
            this.changed(); this.render();
            this.barDialog.close();
            this.selectBar(this.editingSection || this.editingChord || this.editingAnnotation ? bar : bar + 1, false, true);
        } catch (error) { this.barError.textContent = t(error.message); }
    }

    setSectionName(bar, name, meter) {
        const { sections, parts } = this.project;
        const section = sections.find(section => section.bar === bar);
        if (!name || sections.some(other => other !== section && other.name === name)) {
            throw new Error("セクション名は空欄や重複を避けてください。");
        }
        const end = sections.find(item => item.bar > bar)?.bar ?? this.project.bars;
        if (this.project.chords.some(chord => chord.bar >= bar && chord.bar < end && chord.beat >= DesktopSongFiles.meters[meter][1])) {
            throw new Error(t("新しい拍子からはみ出すコードがあります。", "Some chords fall outside the new time signature."));
        }
        if (section) {
            for (const part of parts) {
                if (sections[part.section] === section && part.name === section.name) part.name = name;
            }
            section.name = name;
            section.meter = meter;
        } else {
            const next = sections.findIndex(item => item.bar > bar);
            const insert = next < 0 ? sections.length : next;
            const previousOccurrence = parts.findIndex(part => part.section === insert - 1);
            const reference = parts[previousOccurrence] ?? parts.at(-1);
            let destination = previousOccurrence < 0 ? parts.length : previousOccurrence + 1;
            while (parts[destination]?.section === insert - 1) destination++;
            sections.splice(insert, 0, { name, bar, meter });
            for (const part of parts) if (part.section >= insert) part.section++;
            parts.splice(destination, 0, { ...reference, name, section: insert, parameters: { ...reference.parameters } });
        }
    }

    showPlayingBar(bar) {
        let offset = bar - 1;
        let row;
        let sheetBar;
        if (bar && this.project) {
            for (let index = 0; index < this.project.parts.length; index++) {
                const section = this.project.parts[index].section;
                const start = this.project.sections[section].bar;
                const length = (this.project.sections[section + 1]?.bar ?? this.project.bars) - start;
                if (offset < length) { row = index; sheetBar = start + offset; break; }
                offset -= length;
            }
        }
        for (const [container, index] of [[this.grid, sheetBar], [this.parts, row]]) {
            const current = container.children[index];
            const previous = container.querySelector(".playing-bar");
            if (current === previous) continue;
            previous?.classList.remove("playing-bar");
            current?.classList.add("playing-bar");
            if (!current || this.barDialog.open || this.partDialog.open || !this.contextMenu.hidden || !this.partMenu.hidden) continue;
            const scroll = container.parentElement;
            const bounds = scroll.getBoundingClientRect(), cell = current.getBoundingClientRect();
            if (container === this.grid && (cell.top < bounds.top || cell.bottom > bounds.bottom)) {
                scroll.scrollTop += cell.top - bounds.top;
            } else if (container === this.parts && (cell.left < bounds.left || cell.right > bounds.right)) {
                scroll.scrollLeft += cell.left - bounds.left;
            }
        }
    }

    partIndices(index) {
        const parts = this.project.parts;
        if (!parts[index]) return [];
        return this.partSelection.has(parts[index])
            ? parts.flatMap((part, i) => this.partSelection.has(part) ? [i] : []) : [index];
    }

    selectPart(index, focus = false, { extend = false, toggle = false, keep = false } = {}) {
        const ranges = this.partRanges();
        const range = ranges[index];
        if (!range) return;
        const parts = this.project.parts;
        if (extend) {
            const anchor = parts.indexOf(this.partAnchor);
            const first = anchor < 0 ? this.selectedPart ?? index : anchor;
            this.partSelection = new Set(parts.slice(Math.min(first, index), Math.max(first, index) + 1));
        } else if (toggle) {
            const current = parts[index];
            if (this.partSelection.has(current) && this.partSelection.size > 1) {
                this.partSelection.delete(current);
                index = parts.findIndex(part => this.partSelection.has(part));
            } else this.partSelection.add(current);
            this.partAnchor = parts[index];
        } else if (!keep) {
            this.partSelection = new Set([parts[index]]);
            this.partAnchor = parts[index];
        }
        const active = ranges[index];
        this.selectedPart = index;
        this.selectedBar = this.selectionAnchor = active.sheetStart;
        this.selectedChord = null;
        this.markSelection();
        const indices = this.partIndices(index);
        const first = indices[0], last = indices.at(-1);
        this.onChooseBar(last - first + 1 === indices.length ? { from: ranges[first].from, to: ranges[last].to }
            : { from: active.from, to: active.to });
        if (focus) this.parts.children[index]?.querySelector(".part-name-button").focus();
    }

    openPartContext(index, x, y) {
        if (!this.partSelection.has(this.project.parts[index])) this.selectPart(index);
        this.selectedPart = index;
        const selected = this.partIndices(index);
        const multi = selected.length > 1;
        for (const action of ["track-overrides", "drum-transforms", "custom-phrase"]) {
            this.partMenu.querySelector(`[data-action="${action}"]`).hidden = this.customParameterParts(index, selected).length !== selected.length;
        }
        this.partMenu.querySelector('[data-action="remove"]').disabled = this.partIndices(index).length === this.project.parts.length;
        this.partMenu.querySelector('[data-action="remove-rhythm-change"]').disabled = multi || !this.canRemoveRhythmChange(index);
        this.openContext(x, y, this.partMenu);
    }

    canRemoveRhythmChange(index) {
        const { parts, sections } = this.project;
        const part = parts[index], previous = parts[index - 1];
        return Boolean(previous && part.styleId !== previous.styleId && sections[part.section].meter === sections[previous.section].meter);
    }

    removeRhythmChange(index) {
        if (!this.canRemoveRhythmChange(index)) return;
        const { parts, sections } = this.project;
        const oldId = parts[index].styleId;
        const { styleId, styleName } = parts[index - 1];
        const meter = sections[parts[index].section].meter;
        this.editArrangement(() => {
            for (let i = index; parts[i]?.styleId === oldId && sections[parts[i].section].meter === meter; i++) {
                Object.assign(parts[i], { styleId, styleName });
            }
            this.onUsePartStyles?.();
        });
    }

    duplicatePart(index, grouped = false) {
        const indices = grouped ? this.partIndices(index) : [index];
        const copies = indices.map(i => structuredClone(this.project.parts[i]));
        this.editArrangement(() => {
            this.project.parts.splice(indices.at(-1) + 1, 0, ...copies);
        });
    }

    removePart(index, grouped = false) {
        const indices = grouped ? this.partIndices(index) : [index];
        if (indices.length >= this.project.parts.length) return;
        this.editArrangement(() => {
            for (const i of indices.toReversed()) this.project.parts.splice(i, 1);
            this.selectedPart = null;
            this.partSelection.clear();
        });
    }

    movePart(from, to, copy = false, grouped = false) {
        const positions = grouped ? this.partIndices(from) : [from];
        if (positions.includes(to) && !copy) return;
        const parts = this.project.parts;
        const selection = positions.map(index => parts[index]);
        const target = parts[to];
        const inserted = copy ? structuredClone(selection) : selection;
        if (this.editArrangement(() => {
            if (!copy) for (const index of positions.toReversed()) parts.splice(index, 1);
            const start = copy ? to : parts.indexOf(target) + Number(to > from);
            parts.splice(start, 0, ...inserted);
        })) {
            this.partSelection = new Set(inserted);
            this.partAnchor = inserted[0];
            this.selectPart(parts.indexOf(inserted[0]), true, { keep: true });
        }
    }

    openPartEditor(index) {
        const indices = this.partIndices(index);
        if (!indices.length) return;
        const parts = indices.map(index => this.project.parts[index]);
        const multi = parts.length > 1;
        const common = values => values.every(value => value === values[0]) ? values[0] : "";
        const name = document.querySelector("#part-name");
        const rhythm = document.querySelector("#part-rhythm");
        const choices = this.onStyleChoices?.() ?? new Map();
        for (const part of parts) {
            const source = DesktopSongFiles.sourceStyleId(part.styleId);
            choices.set(source, part.styleName || source.replace(/-ID$/u, ""));
        }
        const unchanged = t("各区間の現在の値を使用", "Keep each part’s current value");
        rhythm.replaceChildren(...(multi ? [new Option(unchanged, "")] : []),
            ...Array.from(choices, ([id, label]) => new Option(label, id)));
        rhythm.value = common(parts.map(part => DesktopSongFiles.sourceStyleId(part.styleId)));
        name.value = common(parts.map(part => part.name));
        name.placeholder = multi ? unchanged : "";
        name.required = !multi;
        const fields = document.querySelector("#part-parameter-fields");
        const edits = this.makePartEditorFields(parts, fields, unchanged);
        document.querySelector("#part-editor-title").textContent = multi ? t(`${parts.length}区間を編集`, `Edit ${parts.length} song parts`)
            : t(`演奏区間 ${index + 1}`, `Song part ${index + 1}`);
        document.querySelector("#part-editor-form").onsubmit = event => {
            event.preventDefault();
            const label = name.value.trim();
            if (!label && !multi) return;
            let changedRhythm = false;
            this.editArrangement(() => {
                for (const part of parts) {
                    if (label) part.name = label;
                    if (rhythm.value && rhythm.value !== DesktopSongFiles.sourceStyleId(part.styleId)) {
                        part.styleId = rhythm.value;
                        part.styleName = choices.get(rhythm.value);
                        changedRhythm = true;
                    }
                    const parameters = this.parametersFor(part.styleId);
                    for (const [id, apply] of edits) {
                        if (parameters.has(id)) apply(part, parameters.get(id));
                    }
                }
                if (changedRhythm) this.onUsePartStyles?.();
            });
            this.partDialog.close();
            this.selectPart(index, true, { keep: multi });
        };
        this.partDialog.showModal();
    }

    makePartEditorFields(parts, container, unchanged) {
        container.replaceChildren();
        const available = parts.map(part => this.parametersFor(part.styleId));
        const edits = new Map();
        for (const [id, first] of available[0]) {
            const parameters = available.map(row => row.get(id));
            if (first.type === "custom" || !parameters.every(item => item?.type === first.type)) continue;
            const values = parts.map((part, index) => part.parameters[id] ?? parameters[index].fallback);
            const name = t(compactParameterLabels.get(id) ?? first.name ?? id);
            const knownChoices = first.type === "number" ? [] : parameters.filter(parameter => parameter.values.length);
            const choices = knownChoices[0]?.values.filter(value => knownChoices.every(parameter => parameter.values.includes(value))) ?? [];
            if (first.type === "set") {
                if (!choices.length) continue;
                const group = document.createElement("fieldset");
                const legend = document.createElement("legend");
                legend.textContent = name;
                group.append(legend);
                const decode = value => new Set(value.slice(1, -1).split(",").map(item => item.trim()).filter(Boolean));
                const selections = values.map(decode);
                const changed = new Map();
                for (const item of choices) {
                    const label = document.createElement("label");
                    const input = document.createElement("input");
                    input.type = "checkbox";
                    input.checked = selections.every(value => value.has(item));
                    input.indeterminate = !input.checked && selections.some(value => value.has(item));
                    input.onchange = () => changed.set(item, input.checked);
                    label.append(input, " ", item);
                    group.append(label);
                }
                edits.set(id, (part, descriptor) => {
                    if (!changed.size) return;
                    const selected = decode(part.parameters[id] ?? descriptor.fallback);
                    for (const [item, checked] of changed) {
                        if (checked && descriptor.values.includes(item)) selected.add(item);
                        else selected.delete(item);
                    }
                    if (selected.size) part.parameters[id] = `[${[...selected].join(",")}]`;
                    else delete part.parameters[id];
                });
                container.append(group);
                continue;
            }
            const label = document.createElement("label");
            label.className = "field";
            const mixed = values.some(value => value !== values[0]);
            const select = first.type === "state" && knownChoices.length > 0;
            const field = document.createElement(select ? "select" : "input");
            const sentinel = "__unchanged__";
            if (select) {
                if (mixed) field.append(new Option(unchanged, sentinel));
                const options = !mixed && !choices.includes(values[0]) ? [values[0], ...choices] : choices;
                field.append(...options.map(option => new Option(option || t("なし", "None"), option)));
            } else if (first.type === "number") {
                field.type = "number";
                field.min = Math.max(...parameters.map(parameter => Number(parameter.values[0])));
                field.max = Math.min(...parameters.map(parameter => Number(parameter.values[1])));
                field.step = first.values[2];
            }
            if (!select) field.placeholder = mixed ? unchanged : "";
            field.value = mixed ? select ? sentinel : "" : values[0];
            field.dataset.parameter = id;
            const initial = field.value;
            edits.set(id, (part, descriptor) => {
                const value = field.value;
                if (value === initial || value === sentinel || (field.type === "number" && !value)) return;
                if (descriptor.type === "state" && descriptor.values.length && !descriptor.values.includes(value)) return;
                if (descriptor.type === "number") {
                    const [minimum, maximum, step] = descriptor.values.map(Number);
                    const number = Number(value);
                    if (number < minimum || number > maximum || (number - minimum) % step !== 0) return;
                }
                if (!value || value === descriptor.fallback) delete part.parameters[id];
                else part.parameters[id] = value;
            });
            label.append(name, field);
            container.append(label);
        }
        return edits;
    }

    customParameterParts(index, selected) {
        const part = this.project.parts[index];
        return selected.includes(index) && selected.every(position => this.project.parts[position]?.styleId === part.styleId) ? selected : [index];
    }

    async openTrackOverrides(index, selected = [index]) {
        const part = this.project.parts[index];
        if (!part) return;
        const targets = this.customParameterParts(index, selected).map(position => this.project.parts[position]);
        const parameter = "RP_SYS_OverrideTracksID";
        const dialog = document.querySelector("#track-overrides");
        const form = document.querySelector("#track-overrides-form");
        const status = document.querySelector("#track-overrides-status");
        const source = document.querySelector("#override-source");
        const rhythm = document.querySelector("#override-rhythm");
        const destination = document.querySelector("#override-destination");
        const variation = document.querySelector("#override-variation");
        const clear = document.querySelector("#clear-track-override");
        const apply = form.querySelector('[type="submit"]');
        apply.textContent = targets.length > 1 ? t(`${targets.length}区間に適用`, `Apply to ${targets.length} song parts`) : t("適用");
        const entries = new Map(DesktopSongFiles.readTrackOverrides(part.parameters[parameter]).map(entry => [entry.source, entry]));
        const sourceStyle = DesktopSongFiles.sourceStyleId(part.styleId);
        const choices = this.onStyleChoices();
        if (!choices.has(sourceStyle)) choices.set(sourceStyle, part.styleName || sourceStyle);
        for (const { rhythm } of entries.values()) {
            if (!choices.has(rhythm)) choices.set(rhythm, rhythm.replace(/-ID$/u, ""));
        }
        const styles = new Map();
        const describe = id => {
            if (!styles.has(id)) styles.set(id, this.onDescribeRhythm(id));
            return styles.get(id);
        };
        let base, pending = 0;
        const updateDestinations = async useSaved => {
            const request = ++pending;
            const saved = useSaved ? entries.get(source.value) : undefined;
            clear.disabled = !targets.some(position => DesktopSongFiles
                .readTrackOverrides(this.project.parts[position]?.parameters[parameter])
                .some(entry => entry.source === source.value));
            rhythm.disabled = !base;
            destination.disabled = variation.disabled = apply.disabled = true;
            destination.replaceChildren();
            variation.replaceChildren();
            status.textContent = t("リズムを読み込んでいます…", "Loading rhythm…");
            try {
                const style = await describe(rhythm.value);
                if (!dialog.open || request !== pending) return;
                const voice = base.voices.find(voice => voice.name === source.value);
                const drums = type => type === "DRUMS" || type === "PERCUSSION";
                const compatible = style.voices.filter(candidate => drums(candidate.type) === drums(voice?.type));
                destination.replaceChildren(...compatible.map(voice => new Option(voice.name, voice.name)));
                const choice = compatible.find(voice => voice.name === saved?.destination)
                    ?? compatible.find(candidate => candidate.type === voice?.type) ?? compatible[0];
                if (choice) destination.value = choice.name;
                variation.replaceChildren(new Option(t("自動", "Auto"), ""), ...style.variations.map(name => new Option(name, name)));
                variation.value = style.variations.includes(saved?.variation) ? saved.variation : "";
                destination.disabled = variation.disabled = apply.disabled = !choice;
                status.textContent = choice ? "" : t("同じ種別のトラックがありません。", "This rhythm has no compatible tracks.");
            } catch (error) {
                if (dialog.open && request === pending) status.textContent = error.message;
            }
        };
        const save = entry => {
            if (this.project.parts[index] !== part) return dialog.close();
            this.editArrangement(() => {
                for (const target of targets) {
                    if (!this.project.parts.includes(target)) continue;
                    const overrides = new Map(DesktopSongFiles.readTrackOverrides(target.parameters[parameter]).map(item => [item.source, item]));
                    if (entry) overrides.set(source.value, entry);
                    else overrides.delete(source.value);
                    const saved = DesktopSongFiles.writeTrackOverrides([...overrides.values()]);
                    if (saved) target.parameters[parameter] = saved;
                    else delete target.parameters[parameter];
                }
            });
            dialog.close();
            this.selectPart(index, true, { keep: targets.length > 1 });
        };
        source.replaceChildren();
        destination.replaceChildren();
        variation.replaceChildren();
        source.disabled = rhythm.disabled = destination.disabled = variation.disabled = apply.disabled = clear.disabled = true;
        rhythm.replaceChildren(...Array.from(choices, ([id, name]) => new Option(name, id)));
        document.querySelector("#track-override-list").replaceChildren(...Array.from(entries.values(), entry => {
            const item = document.createElement("li");
            item.textContent = `${entry.source} → ${choices.get(entry.rhythm)} / ${entry.destination}${entry.variation ? " · " + entry.variation : ""}`;
            return item;
        }));
        source.onchange = () => {
            rhythm.value = entries.get(source.value)?.rhythm ?? sourceStyle;
            void updateDestinations(true);
        };
        rhythm.onchange = () => void updateDestinations(false);
        form.onsubmit = event => {
            event.preventDefault();
            if (!apply.disabled) save({ source: source.value, rhythm: rhythm.value, destination: destination.value, variation: variation.value });
        };
        clear.onclick = () => save(null);
        document.querySelector("#close-track-overrides").onclick = () => dialog.close();
        status.textContent = t("リズムを読み込んでいます…", "Loading rhythm…");
        dialog.showModal();
        try {
            base = await describe(sourceStyle);
            if (!dialog.open || this.project.parts[index] !== part) return;
            source.replaceChildren(...base.voices.map(voice => new Option(voice.name, voice.name)));
            source.disabled = !base.voices.length;
            if (entries.size && base.voices.some(voice => voice.name === entries.keys().next().value)) source.value = entries.keys().next().value;
            rhythm.value = entries.get(source.value)?.rhythm ?? sourceStyle;
            if (!source.disabled) await updateDestinations(true);
        } catch (error) {
            if (dialog.open) status.textContent = error.message;
        }
    }

    async openDrumTransforms(index, selected = [index]) {
        const part = this.project.parts[index];
        if (!part) return;
        const targets = this.customParameterParts(index, selected).map(position => this.project.parts[position]);
        const parameter = "RP_SYS_DrumsTransformId";
        const mixId = "DrumsMixIdhidden";
        const saved = part.parameters[parameter] ?? "[]";
        const chain = saved.slice(1, -1).split("|").filter(Boolean);
        const mix = chain.find(entry => entry.split("#", 1)[0] === mixId);
        const transforms = chain.filter(entry => entry !== mix);
        const offsets = new Map((mix?.split("#")[1] ?? "").split(",").filter(Boolean).map(entry => entry.split("=")));
        const dialog = document.querySelector("#drum-transforms");
        const form = document.querySelector("#drum-transforms-form");
        const status = document.querySelector("#drum-transform-status");
        const type = document.querySelector("#drum-transform-type");
        const add = document.querySelector("#add-drum-transform");
        const list = document.querySelector("#drum-transform-chain");
        const submit = form.querySelector('[type="submit"]');
        submit.textContent = targets.length > 1 ? t(`${targets.length}区間に適用`, `Apply to ${targets.length} song parts`) : t("適用");
        const controls = document.querySelector("#drum-transform-offsets");
        const preview = document.querySelector("#preview-drum-transforms");
        const stop = document.querySelector("#stop-drum-transforms");
        const choices = new Map();
        const render = () => {
            list.replaceChildren(...transforms.map((entry, index) => {
                const [id, settings = ""] = entry.split("#");
                const row = document.createElement("div");
                const label = document.createElement("span");
                const choice = choices.get(id);
                label.textContent = choice?.name ?? id;
                row.append(label);
                if (choice?.velocity !== "" && choice?.velocity !== undefined) {
                    const properties = new Map(settings.split(",").filter(Boolean).map(value => value.split("=")));
                    const velocity = document.createElement("input");
                    velocity.type = "number"; velocity.min = -63; velocity.max = 64; velocity.required = true;
                    velocity.value = properties.get("VelocityOffset") ?? choice.velocity;
                    velocity.dataset.transformVelocity = id;
                    velocity.setAttribute("aria-label", `${choice.name} – ${t("ベロシティ補正", "Velocity offset")}`);
                    velocity.oninput = () => {
                        if (!velocity.validity.valid) return;
                        if (velocity.valueAsNumber === Number(choice.velocity)) properties.delete("VelocityOffset");
                        else properties.set("VelocityOffset", velocity.value);
                        transforms[index] = `${id}#${Array.from(properties, ([key, value]) => `${key}=${value}`).join(",")}`;
                    };
                    row.append(velocity);
                }
                const move = displacement => {
                    const target = index + displacement;
                    if (target < 0 || target >= transforms.length) return;
                    [transforms[index], transforms[target]] = [transforms[target], transforms[index]];
                    render();
                };
                const up = this.button("↑", () => move(-1));
                up.setAttribute("aria-label", t("上へ移動", "Move up"));
                up.disabled = !index;
                const down = this.button("↓", () => move(1));
                down.setAttribute("aria-label", t("下へ移動", "Move down"));
                down.disabled = index === transforms.length - 1;
                const remove = this.button(t("削除", "Delete"), () => { transforms.splice(index, 1); render(); });
                row.append(up, down, remove);
                return row;
            }));
        };
        const inputs = [["BASS", "バスドラム"], ["SNARE", "スネア"], ["HI_HAT", "ハイハット"], ["TOM", "タム"],
            ["CRASH", "クラッシュ"], ["CYMBAL", "シンバル"], ["PERCUSSION", "パーカッション"]].map(([key, name]) => {
            const label = document.createElement("label");
            label.className = "field";
            const input = document.createElement("input");
            input.type = "number"; input.min = -64; input.max = 64; input.required = true;
            input.value = offsets.get(key) ?? 0;
            input.dataset.drumOffset = key;
            label.append(t(name), input);
            return label;
        });
        controls.replaceChildren(...inputs);
        type.replaceChildren();
        add.disabled = submit.disabled = type.disabled = preview.disabled = true;
        stop.disabled = true;
        status.hidden = false;
        status.textContent = t("リズムを読み込んでいます…", "Loading rhythm…");
        document.querySelector("#cancel-drum-transforms").onclick = () => dialog.close();
        add.onclick = () => { transforms.push(type.value + "#"); render(); };
        const transformValue = () => {
            for (const field of controls.querySelectorAll("input")) {
                if (field.valueAsNumber) offsets.set(field.dataset.drumOffset, String(field.valueAsNumber));
                else offsets.delete(field.dataset.drumOffset);
            }
            const properties = Array.from(offsets, ([key, value]) => key + "=" + value).join(",");
            return transforms.length || properties ? "[" + [...transforms, mixId + "#" + properties].join("|") + "]" : "[]";
        };
        let request = 0;
        const endPreview = () => { request++; stop.disabled = true; preview.disabled = submit.disabled; this.onStopDrumPreview(); };
        stop.onclick = endPreview;
        dialog.onclose = endPreview;
        preview.onclick = async () => {
            if (!form.reportValidity()) return;
            const current = ++request;
            const valid = () => current === request && dialog.open && this.project.parts[index] === part;
            preview.disabled = true;
            stop.disabled = false;
            status.hidden = true;
            try { await this.onPreviewDrumTransforms(index, transformValue(), valid); }
            catch (error) { if (valid()) { status.textContent = error.message; status.hidden = false; } }
            finally { if (valid()) preview.disabled = false; }
        };
        form.onsubmit = event => {
            event.preventDefault();
            if (submit.disabled || this.project.parts[index] !== part) return;
            const value = transformValue();
            if (targets.some(target => (target.parameters[parameter] ?? "[]") !== value)) this.editArrangement(() => {
                for (const target of targets) {
                    if (!this.project.parts.includes(target)) continue;
                    if (value !== "[]") target.parameters[parameter] = value;
                    else delete target.parameters[parameter];
                }
            });
            dialog.close();
            this.selectPart(index, true, { keep: targets.length > 1 });
        };
        render();
        dialog.showModal();
        try {
            const style = await this.onDescribeRhythm(part.styleId);
            if (!dialog.open || this.project.parts[index] !== part) return;
            if (!style.voices.some(voice => voice.type === "DRUMS")) {
                status.textContent = t("このリズムにドラムトラックがありません。", "This rhythm has no drums track.");
                return;
            }
            const available = await this.onDrumTransformChoices();
            if (!dialog.open || this.project.parts[index] !== part) return;
            for (const [id, name, velocity] of available) choices.set(id, { name, velocity });
            type.replaceChildren(...Array.from(choices, ([id, choice]) => new Option(choice.name, id)));
            add.disabled = type.disabled = !choices.size;
            submit.disabled = preview.disabled = false;
            status.hidden = true;
            render();
        } catch (error) {
            if (dialog.open) status.textContent = error.message;
        }
    }

    async openCustomPhrases(index, selected = [index]) {
        const part = this.project.parts[index];
        if (!part) return;
        const targets = this.customParameterParts(index, selected);
        const dialog = document.querySelector("#custom-phrase");
        const form = document.querySelector("#custom-phrase-form");
        const status = document.querySelector("#custom-phrase-status");
        const track = document.querySelector("#custom-phrase-track");
        const clear = document.querySelector("#clear-custom-phrase");
        const edit = form.querySelector('[type="submit"]');
        edit.textContent = targets.length > 1 ? t(`${targets.length}区間を編集`, `Edit ${targets.length} song parts`) : t("音符を編集");
        const saved = DesktopSongFiles.readCustomPhrases(part.parameters.RP_SYS_CustomPhraseId);
        status.hidden = false;
        status.textContent = t("リズムを読み込んでいます…", "Loading rhythm…");
        track.replaceChildren();
        track.disabled = clear.disabled = edit.disabled = true;
        document.querySelector("#cancel-custom-phrase").onclick = () => dialog.close();
        track.onchange = () => {
            clear.disabled = !targets.some(position => DesktopSongFiles.readCustomPhrases(this.project.parts[position]?.parameters.RP_SYS_CustomPhraseId).has(track.value));
        };
        clear.onclick = () => {
            if (this.project.parts[index] === part) this.editArrangement(() => {
                for (const position of targets) DesktopSongFiles.setCustomPhrase(this.project.parts[position], track.value);
            });
            dialog.close();
            this.selectPart(index, true, { keep: targets.length > 1 });
        };
        form.onsubmit = event => {
            event.preventDefault();
            if (edit.disabled) return;
            const voice = track.value;
            dialog.close();
            void this.onEditCustomPhrase(index, voice, targets);
        };
        dialog.showModal();
        try {
            const style = await this.onDescribeRhythm(part.styleId);
            if (!dialog.open || this.project.parts[index] !== part) return;
            track.replaceChildren(...style.voices.map(voice => new Option(voice.name + (saved.has(voice.name) ? " ✎" : ""), voice.name)));
            if (saved.size && style.voices.some(voice => saved.has(voice.name))) track.value = style.voices.find(voice => saved.has(voice.name)).name;
            track.disabled = edit.disabled = !style.voices.length;
            track.onchange();
            status.hidden = true;
        } catch (error) {
            if (dialog.open) status.textContent = error.message;
        }
    }

    compactRows(styleId) {
        const saved = this.project.clientProperties?.[compactProperty(styleId)];
        if (saved !== undefined) return new Set(saved.split(",").filter(Boolean));
        const parts = this.project.parts.filter(part => part.styleId === styleId);
        return new Set(["rpVariationID", ...Array.from(this.parametersFor(styleId).values()).filter(parameter =>
            parts.some(part => (part.parameters[parameter.id] ?? parameter.fallback) !== parameter.fallback)).map(parameter => parameter.id)]);
    }

    parametersFor(styleId) {
        const source = DesktopSongFiles.sourceStyleId(styleId);
        const native = this.styleParameters.get(source);
        if (native) return native;
        const swing = source === "jjSwing-ID";
        const choices = selector => Array.from(document.querySelector(selector).options, option => option.value);
        const variation = swing ? choices("#swing-variation") : [];
        const descriptors = [
            ["rpVariationID", variation[0] ?? "", "state", variation],
            ["rpIntensityID", "0", "number", [-10, 10, 1]],
            ["RpFillID", "", "state", ["", "always", "random", "random_rare", "break", "fade_out"]],
            ["rpTempoID", "100", "number", [50, 200, 1]],
            ["rpSysMarkerID", "theme", "state", partMarkers],
            ["RpSysMuteID", "[]", "set", []]
        ];
        if (swing) descriptors.push(["BassStyleId", "auto", "state", choices("#swing-bass")], ["DrumsStyleId", "auto", "state", choices("#swing-drums")]);
        return new Map(descriptors.map(([id, fallback, type, values]) => [id, { id, fallback, type, values }]));
    }

    openCompactSettings() {
        const dialog = document.querySelector("#structure-compact-dialog");
        const content = document.querySelector("#structure-compact-rows");
        const rhythms = new Map(this.project.parts.map(part => [part.styleId, part.styleName || part.styleId]));
        const groups = Array.from(rhythms, ([styleId, name]) => {
            const group = document.createElement("fieldset");
            const legend = document.createElement("legend");
            legend.textContent = name;
            group.append(legend);
            const initial = this.compactRows(styleId);
            const controls = Array.from(this.parametersFor(styleId), ([key, parameter]) => {
                const field = document.createElement("label");
                field.className = "check";
                const box = document.createElement("input");
                box.type = "checkbox";
                box.checked = initial.has(key);
                box.value = key;
                field.append(box, t(compactParameterLabels.get(key) ?? parameter.name ?? key));
                group.append(field);
                return box;
            });
            const hidden = [...initial].filter(key => !controls.some(control => control.value === key));
            return { styleId, group, controls, hidden };
        });
        content.replaceChildren(...groups.map(({ group }) => group));
        document.querySelector("#cancel-structure-compact").onclick = () => dialog.close();
        document.querySelector("#structure-compact-form").onsubmit = event => {
            event.preventDefault();
            this.rememberEdit(this.captureEdit());
            const properties = { ...this.project.clientProperties, PropViewMode: "COMPACT" };
            for (const { styleId, controls, hidden } of groups) {
                properties[compactProperty(styleId)] = [...controls.filter(control => control.checked).map(control => control.value), ...hidden].join(",");
            }
            this.project.clientProperties = properties;
            dialog.close();
            this.render();
        };
        dialog.showModal();
    }

    renderPart(part, range, colors, visibleRows, compactRows) {
        const index = range.index;
        const item = document.createElement("li");
        item.style.setProperty("--section-color", colors[part.section % colors.length]);
        item.style.setProperty("--part-width", `${Math.min(177, 98 + (range.to - range.from) * 4)}px`);
        const header = document.createElement("div");
        header.className = "part-heading";
        const name = this.button(part.name, event => this.selectPart(index, false, {
            extend: event.shiftKey, toggle: event.ctrlKey || event.metaKey
        }));
        name.className = "part-name-button";
        name.title = part.name;
        name.ondblclick = () => this.openPartEditor(index);
        name.onkeydown = event => {
            if (event.code === "Space" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                this.playPart(index, !event.shiftKey);
            }
            if (event.key === "Enter" && !event.ctrlKey) { event.preventDefault(); this.openPartEditor(index); }
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                const next = index + (event.key === "ArrowLeft" ? -1 : 1);
                this.selectPart(next, true, { extend: event.shiftKey });
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
                event.preventDefault();
                event.stopPropagation();
                this.partSelection = new Set(this.project.parts);
                this.selectPart(index, true, { keep: true });
            }
            if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
                event.preventDefault();
                const bounds = name.getBoundingClientRect();
                this.openPartContext(index, bounds.left, bounds.bottom);
            }
        };
        header.draggable = true;
        header.ondragstart = event => event.dataTransfer.setData("application/x-jjazz-part", String(index));
        item.ondragover = event => {
            if (event.dataTransfer.types.some(type => type === "application/x-jjazz-part" || type === "application/x-jjazz-section")) event.preventDefault();
        };
        item.ondrop = event => {
            if (event.dataTransfer.types.includes("application/x-jjazz-section")) {
                event.preventDefault();
                const section = Number(event.dataTransfer.getData("application/x-jjazz-section"));
                if (this.project.sections[section]) {
                    this.editArrangement(() => {
                        const reference = this.project.parts.find(part => part.section === section) ?? this.project.parts[index];
                        this.project.parts.splice(index, 0, { ...reference, name: this.project.sections[section].name, section,
                            parameters: { ...reference.parameters } });
                    });
                    this.selectPart(index, true);
                }
                return;
            }
            if (!event.dataTransfer.types.includes("application/x-jjazz-part")) return;
            event.preventDefault();
            const from = Number(event.dataTransfer.getData("application/x-jjazz-part"));
            if (Number.isInteger(from) && this.project.parts[from]) this.movePart(from, index, event.ctrlKey || event.metaKey, true);
        };
        item.oncontextmenu = event => {
            event.preventDefault();
            this.openPartContext(index, event.clientX, event.clientY);
        };
        const select = document.createElement("select");
        select.className = "part-section";
        select.setAttribute("aria-label", t(`${index + 1}番目のセクション`, `Section of song part ${index + 1}`));
        select.replaceChildren(...this.project.sections.map((section, id) => new Option(`(${section.name})`, id)));
        select.value = part.section;
        select.onchange = () => {
            this.editArrangement(() => { part.section = Number(select.value); part.name = this.project.sections[part.section].name; });
            this.parts.children[index].querySelector(".part-section").focus();
        };
        const styleName = this.button(part.styleName || part.styleId.replace(/-ID$/u, ""), () => this.openPartEditor(index));
        styleName.className = "part-style";
        styleName.title = styleName.textContent;
        const span = document.createElement("span");
        span.className = "part-span";
        span.textContent = range.from === range.to ? range.from : `${range.from}–${range.to}`;
        const meter = document.createElement("span");
        meter.className = "part-meter";
        meter.textContent = DesktopSongFiles.meters[this.project.sections[part.section].meter][0];
        header.append(name, span, select, meter, styleName);
        item.append(header);

        const parameters = this.parametersFor(part.styleId);
        const special = { RP_SYS_DrumsTransformId: () => this.openDrumTransforms(index),
            RP_SYS_CustomPhraseId: () => this.openCustomPhrases(index), RP_SYS_OverrideTracksID: () => this.openTrackOverrides(index) };
        for (const [key, reference] of visibleRows) {
            const parameter = parameters.get(key);
            const { type, fallback, values } = parameter ?? reference;
            const label = compactParameterLabels.get(key) ?? reference.name ?? key;
            const row = document.createElement(type === "state" || type === "number" ? "label" : "div");
            row.className = "rp-row";
            row.classList.toggle("compact-rp", compactRows.has(key));
            row.dataset.rhythmParameter = key;
            const title = document.createElement("span");
            title.textContent = t(label);
            if (type === "set" || type === "custom") {
                const muted = type === "set" ? (part.parameters[key] ?? fallback).slice(1, -1).split(",").filter(Boolean) : [];
                const source = DesktopSongFiles.sourceStyleId(part.styleId);
                const channels = values.length ? values : (this.unresolvedStyleMix ?? this.mix)
                    .filter(track => DesktopSongFiles.sourceStyleId(track.rhythmId) === source).map(track => track.name);
                const choices = [...new Set([...channels, "UserTrack1", "UserTrack2", "UserTrack3", ...muted])];
                const edit = type === "set" && key === "RpSysMuteID" ? () => this.openPartMute(part, choices, muted) : special[key];
                const caption = type === "set" ? muted.join(", ") || t("ミュートなし") : t("編集…", "Edit…");
                const button = this.button(parameter ? caption : "–", edit);
                button.disabled = !parameter || !edit;
                button.setAttribute("aria-label", t(`${index + 1}番目の${label}`, `${t(label)} of song part ${index + 1}`));
                if (key === "RpSysMuteID") button.dataset.partMute = "";
                row.append(title, button);
                item.append(row);
                continue;
            }
            const options = type === "state" ? values : [];
            const enabled = Boolean(parameter);
            const field = document.createElement("input");
            field.disabled = !enabled;
            field.setAttribute("aria-label", t(`${index + 1}番目の${label}`, `${t(label)} of song part ${index + 1}`));
            field.value = enabled ? part.parameters[key] ?? fallback : "–";
            if (options?.length) {
                const suggestions = document.createElement("datalist");
                suggestions.id = `part-${index}-${key}`;
                suggestions.replaceChildren(...options.map(option => new Option(option)));
                field.setAttribute("list", suggestions.id);
                row.append(suggestions);
            }
            if (type === "number" && enabled) {
                field.type = "number";
                [field.min, field.max, field.step] = values;
            }
            const write = value => {
                field.value = value;
                if (!field.validity.valid || (value && options.length && !options.includes(value))) {
                    field.value = part.parameters[key] ?? fallback;
                    return;
                }
                this.rememberEdit(this.captureEdit());
                if (value === "") delete part.parameters[key];
                else part.parameters[key] = value;
                field.value = part.parameters[key] ?? fallback;
                this.changed();
            };
            field.onchange = () => write(field.value);
            field.oncontextmenu = event => {
                if (field.disabled) return;
                event.stopPropagation();
                event.preventDefault();
                this.openParameterMenu(field, key, options, write, event.clientX, event.clientY);
            };
            field.onkeydown = event => {
                if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
                event.preventDefault();
                const bounds = field.getBoundingClientRect();
                this.openParameterMenu(field, key, options, write, bounds.left, bounds.bottom);
            };
            row.append(title, field);
            item.append(row);
        }
        const controls = document.createElement("div");
        controls.className = "part-controls";
        const up = this.button("←", () => this.movePart(index, index - 1)); up.disabled = index === 0;
        const down = this.button("→", () => this.movePart(index, index + 1)); down.disabled = index === this.project.parts.length - 1;
        const remove = this.button("×", () => this.removePart(index)); remove.disabled = this.project.parts.length < 2;
        const open = this.button("⋮", event => {
            const bounds = event.currentTarget.getBoundingClientRect();
            this.openPartContext(index, bounds.left, bounds.bottom);
        });
        const focusPart = this.button("↗", () => this.selectPart(index, true));
        for (const [button, label] of [[up, t("左へ", "Move left")], [down, t("右へ", "Move right")],
            [remove, t("削除")], [open, t("曲構成の操作")], [focusPart, t("区間を選択", "Select song part")]]) {
            button.title = label;
            button.setAttribute("aria-label", label);
        }
        controls.append(up, down, remove, open, focusPart);
        item.append(controls);
        return item;
    }

    render() {
        const { title, sections, chords, parts, bars, userTracks } = this.project;
        this.title.value = title;
        this.meter.options[0].textContent = t("曲中で変化");
        this.meter.value = sections.some(section => section.meter !== sections[0].meter) ? "" : sections[0].meter;
        this.removeBar.disabled = bars < 2 || sections.at(-1).bar === bars - 1;
        const zoomX = this.project.clientProperties?.PropClEditorZoomFactorX;
        const zoomY = this.project.clientProperties?.PropClEditorZoomFactorY;
        const zoomValue = (value, fallback) => /^\d+$/u.test(value) ? Math.min(100, Number(value)) : fallback;
        this.sheetColumns.value = 16 - Math.round(15 * zoomValue(zoomX, 80) / 100);
        this.sheetHeight.value = zoomValue(zoomY, 50);
        if (zoomX == null) this.grid.style.removeProperty("--sheet-columns");
        else this.grid.style.setProperty("--sheet-columns", this.sheetColumns.value);
        this.grid.style.setProperty("--bar-height-zoom", this.sheetHeight.valueAsNumber / 50);
        const showAnnotations = this.project.clientProperties?.PropBarAnnotationsVisible === "true";
        const lines = Math.min(6, Math.max(1, Number.parseInt(this.project.clientProperties?.PropBarAnnotationsNbLines, 10) || 1));
        this.showAnnotations.setAttribute("aria-pressed", String(showAnnotations));
        this.annotationLines.value = lines;
        this.annotationLines.disabled = !showAnnotations;
        this.grid.style.setProperty("--annotation-lines", lines);
        this.grid.style.setProperty("--annotation-extra-height", `${showAnnotations ? (lines - 1) * .9 : 0}rem`);
        this.grid.replaceChildren();
        const chordsByBar = Map.groupBy(chords, chord => chord.bar);
        const colors = sections.map((section, index) =>
            desktopColor(section.clientProperties?.PropSectionColor) ?? sectionColors[index % sectionColors.length]);
        let sectionIndex = 0;
        for (let bar = 0; bar < bars; bar++) {
            if (sections[sectionIndex + 1]?.bar === bar) sectionIndex++;
            const section = sections[sectionIndex];
            const [meter, beats] = DesktopSongFiles.meters[section.meter];
            const start = section.bar === bar;
            const symbols = (chordsByBar.get(bar) ?? []).sort((a, b) => a.beat - b.beat);
            const cell = document.createElement("div");
            cell.className = "score-bar";
            cell.setAttribute("role", "option");
            cell.style.setProperty("--section-color", colors[sectionIndex]);
            cell.classList.toggle("section-start", start);
            if (start && section.clientProperties?.PropSectionStartOnNewLine === "true") cell.style.gridColumnStart = "1";
            const names = symbols.map(chord => this.chordLabel(chord.name, true)).join(", ") || t("コードなし", "no chords");
            cell.setAttribute("aria-label", t(`${bar + 1}小節、${section.name}、${meter}、${names}`, `Bar ${bar + 1}, ${section.name}, ${meter}, ${names}`));
            const number = document.createElement("span");
            number.className = "measure-number";
            number.textContent = bar + 1;
            cell.append(number);
            if (start) {
                const meterDisplay = document.createElement("span");
                meterDisplay.className = "measure-meter";
                for (const digit of meter.split("/")) {
                    const position = document.createElement("span");
                    position.textContent = digit;
                    meterDisplay.append(position);
                }
                cell.append(meterDisplay);
            }
            const lane = document.createElement("div");
            lane.className = "chord-lane";
            for (const [index, chord] of symbols.entries()) {
                const symbol = document.createElement("span");
                symbol.className = "chord-symbol";
                const color = desktopColor(chord.clientProperties?.SongPropUserFontColor);
                if (color) symbol.style.color = color;
                const next = symbols[index + 1];
                const late = !next && chord.beat / beats >= 0.75;
                const compact = symbols.length > 2 || (next && next.beat - chord.beat < 1);
                if (late) {
                    symbol.classList.add("late-chord");
                    if (symbols.length > 2 || symbols[index - 1]?.beat / beats >= 0.55) symbol.classList.add("lower-chord");
                } else {
                    symbol.style.left = `${100 * chord.beat / beats}%`;
                    symbol.style.maxWidth = `${100 * ((next?.beat ?? beats) - chord.beat) / beats}%`;
                }
                symbol.textContent = this.chordLabel(chord.name, true);
                if (compact) symbol.classList.add("compact");
                symbol.title = symbol.textContent;
                symbol.dataset.beat = chord.beat;
                symbol.draggable = true;
                const selectChord = (event) => {
                    event.stopPropagation();
                    this.selectBar(bar, false, true);
                    this.selectedChord = chord;
                    this.markSelection();
                };
                symbol.onclick = selectChord;
                symbol.ondblclick = event => { selectChord(event); this.openBarEditor("chord"); };
                symbol.oncontextmenu = event => {
                    event.preventDefault(); selectChord(event);
                    this.openContext(event.clientX, event.clientY);
                };
                symbol.ondragstart = event => {
                    event.dataTransfer.effectAllowed = "copyMove";
                    event.dataTransfer.setData("application/x-jjazz-chord", JSON.stringify([chord.bar, chord.beat]));
                };
                lane.append(symbol);
            }
            const ruler = document.createElement("div");
            ruler.className = "beat-ruler";
            for (let beat = 0; beat < beats; beat += 0.5) {
                const tick = document.createElement("i");
                tick.style.left = `${100 * beat / beats}%`;
                if (Number.isInteger(beat)) tick.className = "major";
                ruler.append(tick);
            }
            for (const chord of symbols) {
                const tick = document.createElement("i");
                tick.className = "chord-beat";
                tick.style.left = `${100 * chord.beat / beats}%`;
                ruler.append(tick);
            }
            const band = document.createElement("div");
            band.className = "section-band";
            if (start) band.textContent = section.name;
            if (start) {
                band.ondblclick = event => { event.stopPropagation(); this.selectBar(bar); this.openBarEditor("section"); };
                band.oncontextmenu = event => {
                    event.stopPropagation(); event.preventDefault();
                    this.selectBar(bar, false, true);
                    this.openContext(event.clientX, event.clientY, this.contextMenu, "section");
                };
                band.draggable = true;
                const sectionToDrag = sectionIndex;
                band.ondragstart = event => event.dataTransfer.setData("application/x-jjazz-section", String(sectionToDrag));
            }
            cell.append(lane, ruler, band);
            const annotation = this.project.annotations?.find(note => note.bar === bar);
            if (annotation) {
                const note = document.createElement("span");
                note.className = showAnnotations ? "bar-annotation" : "bar-annotation-marker";
                if (showAnnotations) note.textContent = annotation.text;
                note.title = annotation.text;
                note.ondblclick = event => { event.stopPropagation(); this.selectBar(bar); this.openBarEditor("annotation"); };
                note.oncontextmenu = event => {
                    event.stopPropagation(); event.preventDefault();
                    this.selectBar(bar, false, true);
                    this.openContext(event.clientX, event.clientY, this.contextMenu, "annotation");
                };
                cell.append(note);
            }
            if (this.project.loopRestartBar === bar) {
                const restart = document.createElement("span");
                restart.className = "restart-marker";
                restart.textContent = "↶";
                restart.title = t("ループの折り返し位置", "Loop restart bar");
                cell.append(restart);
            }
            cell.onclick = event => this.selectBar(bar, event.shiftKey, true);
            cell.ondblclick = () => this.openBarEditor();
            cell.onkeydown = event => this.handleBarKey(event, bar);
            cell.oncontextmenu = event => {
                event.preventDefault();
                const [first, last] = this.selectedRange();
                if (bar < first || bar > last || this.selectedChord) this.selectBar(bar, false, true);
                this.openContext(event.clientX, event.clientY, this.contextMenu, "bar");
            };
            cell.ondragover = event => {
                if (event.dataTransfer.types.includes("application/x-jjazz-chord")) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = event.ctrlKey || event.metaKey ? "copy" : "move";
                }
            };
            cell.ondrop = async event => {
                if (!event.dataTransfer.types.includes("application/x-jjazz-chord")) return;
                event.preventDefault();
                const [sourceBar, sourceBeat] = JSON.parse(event.dataTransfer.getData("application/x-jjazz-chord"));
                const source = chords.find(chord => chord.bar === sourceBar && chord.beat === sourceBeat);
                if (!source) return;
                const copy = event.ctrlKey || event.metaKey;
                const project = this.project;
                const width = ruler.getBoundingClientRect();
                if (!width.width) return;
                const position = (event.clientX - width.left) / width.width * beats;
                let destination, beat;
                try { [destination, beat] = await this.onQuantizeChordDrop(project, section, bar, position); }
                catch (error) { this.notify(error.message, true); return; }
                if (this.project !== project || !cell.isConnected || !chords.includes(source)
                    || chords.some(chord => chord.bar === destination && Math.fround(chord.beat) === beat)) return;
                this.editArrangement(() => {
                    if (copy) chords.push({ ...structuredClone(source), bar: destination, beat });
                    else Object.assign(source, { bar: destination, beat });
                    this.selectedChord = null;
                });
                this.selectBar(destination, false, true);
            };
            this.grid.append(cell);
        }
        this.selectedBar = Math.min(this.selectedBar, bars - 1);
        this.selectionAnchor = Math.min(this.selectionAnchor, bars - 1);
        if (this.selectedChord && !chords.includes(this.selectedChord)) this.selectedChord = null;
        const ranges = this.partRanges();
        const compact = this.project.clientProperties?.PropViewMode === "COMPACT";
        this.structureCompact.setAttribute("aria-pressed", String(compact));
        this.parts.classList.toggle("compact-view", compact);
        const compactRows = new Map(Array.from(new Set(parts.map(part => part.styleId)), id => [id, this.compactRows(id)]));
        const visibleRows = new Map(parts.flatMap(part => [...this.parametersFor(part.styleId)]));
        this.parts.replaceChildren(...parts.map((part, index) => this.renderPart(part, ranges[index], colors, visibleRows, compactRows.get(part.styleId))));
        this.markSelection();
        const users = userTracks.map(track => track.name).join(", ");
        document.querySelector("#user-track-summary").textContent = users ? t(`ユーザートラック: ${users}`, `User tracks: ${users}`) : "";
        this.onRender?.();
    }

    chordLabel(name, symbols = false) {
        const label = transposeChordLabel(name, this.displayTranspose);
        return symbols ? label.replace(/([A-G])b/gu, "$1♭").replace(/([A-G])#/gu, "$1♯") : label;
    }

    concertChord(value, previous) {
        const label = value.replaceAll("♭", "b").replaceAll("♯", "#");
        return previous && this.chordLabel(previous) === label ? previous : transposeChordLabel(label, -this.displayTranspose);
    }

    parseBarChords(bar, value) {
        const previous = this.project.chords.filter(chord => chord.bar === bar);
        const section = this.project.sections.findLast(item => item.bar <= bar);
        const beats = new Set();
        return value.trim().split(/\s+/u).filter(Boolean).map(token => {
            const match = /^(?:(\d+(?:\.\d+)?):)?(.+)$/u.exec(token);
            const beat = Number(match[1] ?? 1) - 1;
            const existing = previous.find(chord => Number((chord.beat + 1).toFixed(6)) === beat + 1);
            const name = this.concertChord(match[2], existing?.name);
            if (name.includes(":") || beat < 0 || beat >= DesktopSongFiles.meters[section.meter][1] || beats.has(beat)) {
                throw new Error(t(`${bar + 1}小節のコードの拍位置を確認してください。`, `Check the chord positions in bar ${bar + 1}.`));
            }
            beats.add(beat);
            return existing?.name === name ? existing : { name, bar, beat };
        });
    }

    fileStem(title = this.project.title) { return title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_") || "JJazzLab"; }

    webData(song = this.project) {
        return { version: 1, song, mix: this.unresolvedStyleMix ?? this.renderedMix ?? this.mix, style: this.style };
    }

    save(mode) {
        try {
            const song = mode === "linearize" ? this.linearizedSong() : mode === "duplicate"
                ? { ...this.project, title: `${this.project.title} - ${t("コピー", "copy")}` } : this.project;
            downloadSongFile(`${this.fileStem(song.title)}.jjazzweb`, JSON.stringify(this.webData(song)), "application/json");
            if (!mode) this.onSave?.();
        } catch (error) { this.notify(error.message, true); }
    }

    export() {
        try {
            if (!this.renderedMix) throw new Error("伴奏を生成してから書き出してください。");
            const stem = this.fileStem();
            downloadSongFile(`${stem}.zip`, packageSongFiles(this.desktopFiles(this.webData(), stem)), "application/zip");
            this.onSave?.();
        } catch (error) { this.notify(error.message, true); }
    }

    desktopFiles(data, stem) {
        const files = new Map([[`${stem}.sng`, DesktopSongFiles.writeSong(data.song)]]);
        if (data.mix?.length) files.set(`${stem}.mix`, DesktopSongFiles.writeMix(data.mix.map(track =>
            ({ ...track, channel: track.sourceChannel ?? track.channel }))));
        const styles = Array.isArray(data.style) ? data.style : data.style ? [data.style] : [];
        for (const style of styles) {
            if (!style.name || /[\\/\u0000]/u.test(style.name) || [".", ".."].includes(style.name)) continue;
            // On case-sensitive systems, JJazzLab expects the same basename and a lowercase base extension for .yjz.
            const baseName = style.extensionData ? `${style.name.slice(0, -4)}.${style.baseName.split(".").at(-1).toLowerCase()}` : style.name;
            if (style.data) files.set(`styles/${baseName}`, Uint8Array.from(style.data));
            if (style.extensionData) files.set(`styles/${style.name}`, Uint8Array.from(style.extensionData));
        }
        return Array.from(files);
    }

    desktopMixXml() {
        return DesktopSongFiles.writeMix(this.nativeMix.map(track => ({ ...track, channel: track.sourceChannel ?? track.channel })));
    }

    get nativeMix() { return this.unresolvedStyleMix ?? this.renderedMix ?? []; }
}
