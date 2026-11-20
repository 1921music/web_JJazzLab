"use strict";

const partMarkers = ["theme", "solo", "theme2", "theme3", "theme4", "solo2", "solo3", "solo4"];
const songTemplatePreference = "jjazzlab.songTemplate";
const flatChordNotes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const sharpChordNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

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
    const encoder = new TextEncoder();
    const local = [], directory = [];
    let offset = 0;
    for (const [filename, value] of files) {
        const name = encoder.encode(filename);
        const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
        const crc = styleCrc32(bytes);
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
            u32(14 + extra, crc); u32(18 + extra, bytes.length); u32(22 + extra, bytes.length);
            u16(26 + extra, name.length);
            header.set(name, fixed);
            if (central) { u16(4, 20); u32(42, offset); directory.push(header); }
            else local.push(header, bytes);
        }
        offset += local.at(-2).length + bytes.length;
    }
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
    view.setUint32(12, directory.reduce((size, entry) => size + entry.length, 0), true);
    view.setUint32(16, offset, true);
    return new Blob([...local, ...directory, end]);
}

class SongEditor {
    constructor(onOpen, onChooseBar, onPlay) {
        this.onOpen = onOpen;
        this.onChooseBar = onChooseBar;
        this.onPlay = onPlay;
        this.displayTranspose = 0;
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
        this.styleVariations = new Map();
        this.undoButton = document.querySelector("#undo");
        this.redoButton = document.querySelector("#redo");
        this.undoButton.onclick = () => this.restoreEdit(this.undoStack, this.redoStack);
        this.redoButton.onclick = () => this.restoreEdit(this.redoStack, this.undoStack);
        document.querySelector("#edit-bar").onclick = () => this.openBarEditor();
        document.querySelector("#edit-section").onclick = () => this.openBarEditor("section");
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
            if (action === "edit") this.openPartEditor(index);
            if (action === "track-overrides") void this.openTrackOverrides(index);
            if (action === "drum-transforms") void this.openDrumTransforms(index);
            if (action === "custom-phrase") void this.openCustomPhrases(index);
            if (action === "duplicate") this.duplicatePart(index);
            if (action === "remove") this.removePart(index);
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
        this.title.oninput = () => { this.project.title = this.title.value; this.changed(); };
        this.meter.onchange = () => {
            this.editArrangement(() => {
                for (const section of this.project.sections) section.meter = this.meter.value;
            });
            this.onMeterChange?.(this.project.sections[0].meter);
        };
        document.querySelector("#save-project").onclick = () => this.save();
        this.exportButton.onclick = () => this.onExport?.();
        document.querySelector("#sheet-columns").oninput = event => this.grid.style.setProperty("--sheet-columns", event.target.value);
        this.showAnnotations = document.querySelector("#show-bar-annotations");
        this.annotationLines = document.querySelector("#bar-annotation-lines");
        this.showAnnotations.onclick = () => this.setSheetProperty("PropBarAnnotationsVisible",
            String(this.showAnnotations.getAttribute("aria-pressed") !== "true"));
        this.annotationLines.onchange = () => {
            if (this.annotationLines.value && this.annotationLines.validity.valid) {
                this.setSheetProperty("PropBarAnnotationsNbLines", this.annotationLines.value);
            } else this.render();
        };
        const compact = document.querySelector("#structure-compact");
        const zoom = document.querySelector("#structure-zoom");
        compact.onclick = () => compact.setAttribute("aria-pressed", String(this.parts.classList.toggle("compact-view")));
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
        this.updateUndo();
        this.changed();
        this.render();
    }

    open(project, mix, style = null, useSavedStyles = false) {
        this.project = project;
        this.mix = mix;
        this.unresolvedStyleMix = undefined;
        this.style = style;
        this.selectedPart = null;
        this.selectedChord = null;
        this.undoStack = [];
        this.redoStack = [];
        this.styleVariations.clear();
        this.updateUndo();
        this.selectedBar = this.selectionAnchor = 0;
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
        if (!files.length) return;
        try {
            const web = files.find(file => /\.jjazzweb$/iu.test(file.name));
            if (web) {
                const data = JSON.parse(await web.text());
                if (files.length !== 1 || data.version !== 1 || !data.song?.parts?.length || !data.song?.sections?.length) {
                    throw new Error("Web用の曲ファイルを1つ選択してください。");
                }
                this.open(DesktopSongFiles.validateSong(data.song), data.mix ?? [], data.style, true);
                return;
            }
            const songFile = files.find(file => /\.sng$/iu.test(file.name));
            const mixFile = files.find(file => /\.mix$/iu.test(file.name));
            if (!songFile || files.length > 2 || (files.length === 2 && !mixFile)
                || (mixFile && songFile.name.slice(0, -4).toLowerCase() !== mixFile.name.slice(0, -4).toLowerCase())) {
                throw new Error(".sng と、必要に応じて同じ名前の .mix を選択してください。");
            }
            const song = DesktopSongFiles.readSong(await songFile.text());
            const mix = mixFile ? DesktopSongFiles.readMix(await mixFile.text()) : [];
            this.open(song, mix, null, true);
            this.notify(t(`${songFile.name} を開きました。`, `Opened ${songFile.name}.`));
        } catch (error) { this.notify(error.message, true); }
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
        for (const [index, item] of [...this.parts.children].entries()) item.classList.toggle("selected-part", index === this.selectedPart);
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
        } else if (event.key === "Delete" || ((event.ctrlKey || event.metaKey) && /^(c|v)$/iu.test(event.key))) {
            event.preventDefault();
            this.barAction(({ Delete: "clear", c: "copy", v: "paste" })[event.key.toLowerCase()] ?? "clear");
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            const rect = this.grid.children[bar].getBoundingClientRect();
            this.openContext(rect.left, rect.bottom);
        } else if (/^[a-gA-GnN]$/u.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault(); this.openBarEditor("edit", event.key.toUpperCase());
        }
    }

    openContext(x, y, menu = this.contextMenu) {
        this.contextMenu.hidden = this.partMenu.hidden = this.parameterMenu.hidden = true;
        if (menu === this.contextMenu) {
            menu.querySelector('[data-action="chord"]').hidden = !this.selectedChord;
            menu.querySelector('[data-action="paste"]').disabled = !this.barClipboard;
            const [first, last] = this.selectedRange();
            menu.querySelector('[data-action="remove-bars"]').disabled = last - first + 1 >= this.project.bars;
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
            ? String(field.valueAsNumber + direction)
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
            case "restart":
                this.editArrangement(() => {
                    this.project.loopRestartBar = this.project.loopRestartBar === first ? undefined : first;
                });
                break;
            case "copy":
                this.barClipboard = structuredClone(this.project.chords.filter(chord => chord.bar >= first && chord.bar <= last)
                    .map(chord => ({ ...chord, bar: chord.bar - first })));
                this.clipboardLength = last - first + 1;
                this.annotationClipboard = (this.project.annotations ?? []).filter(note => note.bar >= first && note.bar <= last)
                    .map(note => ({ ...note, bar: note.bar - first }));
                break;
            case "paste":
                if (!this.barClipboard) return;
                this.editArrangement(() => {
                    const end = first + this.clipboardLength;
                    const pasted = this.barClipboard.map(chord => ({ ...structuredClone(chord), bar: chord.bar + first }));
                    if (end > this.project.bars || pasted.some(chord => chord.beat >= this.beatsInBar(chord.bar))) {
                        throw new Error(t("貼り付け先の小節数か拍子が合いません。", "The destination bars or time signatures do not fit the copied range."));
                    }
                    this.project.chords = [...this.project.chords.filter(chord => chord.bar < first || chord.bar >= end), ...pasted];
                    this.project.annotations = [...(this.project.annotations ?? []).filter(note => note.bar < first || note.bar >= end),
                        ...this.annotationClipboard.map(note => ({ ...note, bar: note.bar + first }))];
                });
                break;
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

    selectPart(index, focus = false) {
        const range = this.partRanges()[index];
        if (!range) return;
        this.selectedPart = index;
        this.selectedBar = this.selectionAnchor = range.sheetStart;
        this.selectedChord = null;
        this.markSelection();
        this.onChooseBar({ from: range.from, to: range.to });
        if (focus) this.parts.children[index]?.querySelector(".part-name-button").focus();
    }

    duplicatePart(index) {
        this.editArrangement(() => {
            this.project.parts.splice(index + 1, 0, structuredClone(this.project.parts[index]));
        });
    }

    removePart(index) {
        if (this.project.parts.length < 2) return;
        this.editArrangement(() => {
            this.project.parts.splice(index, 1);
            this.selectedPart = null;
        });
    }

    movePart(from, to, copy = false) {
        if (from === to && !copy) return;
        this.editArrangement(() => {
            const parts = this.project.parts;
            const part = copy ? structuredClone(parts[from]) : parts.splice(from, 1)[0];
            parts.splice(to, 0, part);
            this.selectedPart = to;
        });
        this.selectPart(to, true);
    }

    openPartEditor(index) {
        const part = this.project.parts[index];
        const name = document.querySelector("#part-name");
        const rhythm = document.querySelector("#part-rhythm");
        const source = DesktopSongFiles.sourceStyleId(part.styleId);
        const choices = this.onStyleChoices?.() ?? new Map();
        choices.set(source, part.styleName || source.replace(/-ID$/u, ""));
        rhythm.replaceChildren(...Array.from(choices, ([id, label]) => new Option(label, id)));
        name.value = part.name;
        rhythm.value = source;
        document.querySelector("#part-editor-title").textContent = t(`演奏区間 ${index + 1}`, `Song part ${index + 1}`);
        document.querySelector("#part-editor-form").onsubmit = event => {
            event.preventDefault();
            if (!name.value.trim()) return;
            this.editArrangement(() => {
                part.name = name.value.trim();
                if (rhythm.value !== source) {
                    part.styleId = rhythm.value;
                    part.styleName = choices.get(rhythm.value);
                    this.onUsePartStyles?.();
                }
            });
            this.partDialog.close();
            this.selectPart(index, true);
        };
        this.partDialog.showModal();
    }

    async openTrackOverrides(index) {
        const part = this.project.parts[index];
        if (!part) return;
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
            clear.disabled = !entries.has(source.value);
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
            if (entry) entries.set(source.value, entry);
            else entries.delete(source.value);
            const saved = DesktopSongFiles.writeTrackOverrides([...entries.values()]);
            this.editArrangement(() => {
                if (saved) part.parameters[parameter] = saved;
                else delete part.parameters[parameter];
            });
            dialog.close();
            this.selectPart(index, true);
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

    async openDrumTransforms(index) {
        const part = this.project.parts[index];
        if (!part) return;
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
        const controls = document.querySelector("#drum-transform-offsets");
        const choices = new Map();
        const render = () => {
            list.replaceChildren(...transforms.map((entry, index) => {
                const id = entry.split("#", 1)[0];
                const row = document.createElement("div");
                const label = document.createElement("span");
                label.textContent = choices.get(id) ?? id;
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
                row.append(label, up, down, remove);
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
        add.disabled = submit.disabled = type.disabled = true;
        status.hidden = false;
        status.textContent = t("リズムを読み込んでいます…", "Loading rhythm…");
        document.querySelector("#cancel-drum-transforms").onclick = () => dialog.close();
        add.onclick = () => { transforms.push(type.value + "#"); render(); };
        form.onsubmit = event => {
            event.preventDefault();
            if (submit.disabled || this.project.parts[index] !== part) return;
            for (const field of controls.querySelectorAll("input")) {
                if (field.valueAsNumber) offsets.set(field.dataset.drumOffset, String(field.valueAsNumber));
                else offsets.delete(field.dataset.drumOffset);
            }
            const properties = Array.from(offsets, ([key, value]) => key + "=" + value).join(",");
            const value = "[" + [...transforms, mixId + "#" + properties].join("|") + "]";
            if (saved !== value) this.editArrangement(() => {
                if (transforms.length || properties) part.parameters[parameter] = value;
                else delete part.parameters[parameter];
            });
            dialog.close();
            this.selectPart(index, true);
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
            for (const [id, name] of available) choices.set(id, name);
            type.replaceChildren(...Array.from(choices, ([id, name]) => new Option(name, id)));
            add.disabled = type.disabled = !choices.size;
            submit.disabled = false;
            status.hidden = true;
            render();
        } catch (error) {
            if (dialog.open) status.textContent = error.message;
        }
    }

    async openCustomPhrases(index) {
        const part = this.project.parts[index];
        if (!part) return;
        const dialog = document.querySelector("#custom-phrase");
        const form = document.querySelector("#custom-phrase-form");
        const status = document.querySelector("#custom-phrase-status");
        const track = document.querySelector("#custom-phrase-track");
        const clear = document.querySelector("#clear-custom-phrase");
        const edit = form.querySelector('[type="submit"]');
        const saved = DesktopSongFiles.readCustomPhrases(part.parameters.RP_SYS_CustomPhraseId);
        status.hidden = false;
        status.textContent = t("リズムを読み込んでいます…", "Loading rhythm…");
        track.replaceChildren();
        track.disabled = clear.disabled = edit.disabled = true;
        document.querySelector("#cancel-custom-phrase").onclick = () => dialog.close();
        track.onchange = () => { clear.disabled = !saved.has(track.value); };
        clear.onclick = () => {
            if (this.project.parts[index] === part) this.editArrangement(() => DesktopSongFiles.setCustomPhrase(part, track.value));
            dialog.close();
            this.selectPart(index, true);
        };
        form.onsubmit = event => {
            event.preventDefault();
            if (edit.disabled) return;
            const voice = track.value;
            dialog.close();
            void this.onEditCustomPhrase(index, voice);
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

    renderPart(part, range, colors, visibleRows) {
        const index = range.index;
        const item = document.createElement("li");
        item.style.setProperty("--section-color", colors[part.section % colors.length]);
        item.style.setProperty("--part-width", `${Math.min(177, 98 + (range.to - range.from) * 4)}px`);
        const header = document.createElement("div");
        header.className = "part-heading";
        const name = this.button(part.name, () => this.selectPart(index));
        name.className = "part-name-button";
        name.title = part.name;
        name.ondblclick = () => this.openPartEditor(index);
        name.onkeydown = event => {
            if (event.code === "Space" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                this.playPart(index, !event.shiftKey);
            }
            if (event.key === "Enter" && !event.ctrlKey) { event.preventDefault(); this.openPartEditor(index); }
            if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
                event.preventDefault();
                this.selectPart(index);
                const bounds = name.getBoundingClientRect();
                this.openContext(bounds.left, bounds.bottom, this.partMenu);
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
            if (Number.isInteger(from) && this.project.parts[from]) this.movePart(from, index, event.ctrlKey || event.metaKey);
        };
        item.oncontextmenu = event => {
            event.preventDefault();
            this.selectPart(index);
            this.openContext(event.clientX, event.clientY, this.partMenu);
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

        const source = DesktopSongFiles.sourceStyleId(part.styleId);
        const swing = source === "jjSwing-ID";
        const variationChoices = this.styleVariations.get(source) ?? (swing ? Array.from(document.querySelector("#swing-variation").options, option => option.value) : []);
        const rows = [
            ["rpVariationID", "バリエーション", variationChoices[0] ?? "", variationChoices],
            ["BassStyleId", "ベースの奏法", "auto", swing ? Array.from(document.querySelector("#swing-bass").options, option => option.value) : []],
            ["DrumsStyleId", "ドラムの奏法", "auto", swing ? Array.from(document.querySelector("#swing-drums").options, option => option.value) : []],
            ["rpIntensityID", "強弱", "0"],
            ["RpFillID", "フィル", "", ["", "always", "random", "random_rare", "break", "fade_out"]],
            ["rpTempoID", "テンポ比", "100"],
            ["rpSysMarkerID", "マーカー", "theme", partMarkers]
        ];
        for (const [key, label, fallback, options] of rows) {
            if (!visibleRows.has(key)) continue;
            const row = document.createElement("label");
            row.className = "rp-row";
            row.classList.toggle("primary-rp", key === "rpVariationID");
            const title = document.createElement("span");
            title.textContent = t(label);
            const enabled = swing || !["BassStyleId", "DrumsStyleId"].includes(key);
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
            if (key === "rpIntensityID" || key === "rpTempoID") {
                field.type = "number";
                field.min = key === "rpIntensityID" ? -10 : 50;
                field.max = key === "rpIntensityID" ? 10 : 200;
            }
            const write = value => {
                field.value = value;
                if (!field.validity.valid) { field.value = part.parameters[key] ?? fallback; return; }
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
        const muteRow = document.createElement("div");
        muteRow.className = "rp-row";
        const muteTitle = document.createElement("span");
        muteTitle.textContent = t("区間のミュート");
        const muted = (part.parameters.RpSysMuteID ?? "[]").slice(1, -1).split(",").filter(Boolean);
        const matchStyle = track => DesktopSongFiles.sourceStyleId(track.rhythmId) === source;
        const choices = [...new Set([...(this.unresolvedStyleMix ?? this.mix).filter(matchStyle).map(track => track.name),
            "UserTrack1", "UserTrack2", "UserTrack3", ...muted])];
        const muteButton = this.button(muted.join(", ") || t("ミュートなし"), () => this.openPartMute(part, choices, muted));
        muteButton.dataset.partMute = "";
        muteButton.setAttribute("aria-label", t(`${index + 1}番目の区間のミュート`, `Mute tracks in song part ${index + 1}`));
        muteRow.append(muteTitle, muteButton);
        item.append(muteRow);
        const controls = document.createElement("div");
        controls.className = "part-controls";
        const up = this.button("←", () => this.movePart(index, index - 1)); up.disabled = index === 0;
        const down = this.button("→", () => this.movePart(index, index + 1)); down.disabled = index === this.project.parts.length - 1;
        const remove = this.button("×", () => this.removePart(index)); remove.disabled = this.project.parts.length < 2;
        const open = this.button("⋮", event => {
            this.selectPart(index);
            const bounds = event.currentTarget.getBoundingClientRect();
            this.openContext(bounds.left, bounds.bottom, this.partMenu);
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
        const showAnnotations = this.project.clientProperties?.PropBarAnnotationsVisible === "true";
        const lines = Math.min(6, Math.max(1, Number.parseInt(this.project.clientProperties?.PropBarAnnotationsNbLines, 10) || 1));
        this.showAnnotations.setAttribute("aria-pressed", String(showAnnotations));
        this.annotationLines.value = lines;
        this.annotationLines.disabled = !showAnnotations;
        this.grid.style.setProperty("--annotation-lines", lines);
        this.grid.style.setProperty("--annotation-extra-height", `${showAnnotations ? (lines - 1) * .9 : 0}rem`);
        this.grid.replaceChildren();
        const chordsByBar = Map.groupBy(chords, chord => chord.bar);
        const defaultColors = ["#e7ac83", "#9bb487", "#8bbab5", "#b1a7d0", "#d4c381", "#9cb5d6"];
        const colors = sections.map((section, index) =>
            desktopColor(section.clientProperties?.PropSectionColor) ?? defaultColors[index % defaultColors.length]);
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
                this.openContext(event.clientX, event.clientY);
            };
            cell.ondragover = event => {
                if (event.dataTransfer.types.includes("application/x-jjazz-chord")) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = event.ctrlKey || event.metaKey ? "copy" : "move";
                }
            };
            cell.ondrop = event => {
                if (!event.dataTransfer.types.includes("application/x-jjazz-chord")) return;
                event.preventDefault();
                const [sourceBar, sourceBeat] = JSON.parse(event.dataTransfer.getData("application/x-jjazz-chord"));
                const source = chords.find(chord => chord.bar === sourceBar && chord.beat === sourceBeat);
                const width = ruler.getBoundingClientRect();
                const position = (event.clientX - width.left) / width.width;
                const beat = Math.min(beats - .25, Math.max(0, Math.round(position * beats * 4) / 4));
                if (!source || chords.some(chord => chord.bar === bar && chord.beat === beat)) return;
                this.editArrangement(() => {
                    if (event.ctrlKey || event.metaKey) chords.push({ ...structuredClone(source), bar, beat });
                    else Object.assign(source, { bar, beat });
                    this.selectedChord = null;
                });
                this.selectBar(bar, false, true);
            };
            this.grid.append(cell);
        }
        this.selectedBar = Math.min(this.selectedBar, bars - 1);
        this.selectionAnchor = Math.min(this.selectionAnchor, bars - 1);
        if (this.selectedChord && !chords.includes(this.selectedChord)) this.selectedChord = null;
        const ranges = this.partRanges();
        const showSwingRows = parts.some(part => DesktopSongFiles.sourceStyleId(part.styleId) === "jjSwing-ID");
        const visibleRows = new Set(["rpVariationID", "rpIntensityID", "RpFillID", "rpTempoID", "rpSysMarkerID"]);
        if (showSwingRows) { visibleRows.add("BassStyleId"); visibleRows.add("DrumsStyleId"); }
        this.parts.replaceChildren(...parts.map((part, index) => this.renderPart(part, ranges[index], colors, visibleRows)));
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
        } catch (error) { this.notify(error.message, true); }
    }

    export() {
        try {
            if (!this.renderedMix) throw new Error("伴奏を生成してから書き出してください。");
            const stem = this.fileStem();
            const files = new Map([[`${stem}.sng`, DesktopSongFiles.writeSong(this.project)]]);
            if (this.nativeMix.length) files.set(`${stem}.mix`, this.desktopMixXml());
            for (const style of this.attachedStyles) {
                // JJazzLab looks for an exact basename and a lowercase base extension on case-sensitive filesystems.
                const baseName = style.extensionData ? `${style.name.slice(0, -4)}.${style.baseName.split(".").at(-1).toLowerCase()}` : style.name;
                if (style.data) files.set(`styles/${baseName}`, Uint8Array.from(style.data));
                if (style.extensionData) files.set(`styles/${style.name}`, Uint8Array.from(style.extensionData));
            }
            downloadSongFile(`${stem}.zip`, packageSongFiles([...files]), "application/zip");
        } catch (error) { this.notify(error.message, true); }
    }

    desktopMixXml() {
        return DesktopSongFiles.writeMix(this.nativeMix.map(track => ({ ...track, channel: track.sourceChannel ?? track.channel })));
    }

    get nativeMix() { return this.unresolvedStyleMix ?? this.renderedMix ?? []; }
}
