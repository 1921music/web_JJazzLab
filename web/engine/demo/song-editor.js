"use strict";

function downloadSongFile(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        this.barError = document.querySelector("#bar-editor-error");
        this.contextMenu = document.querySelector("#bar-context");
        document.querySelector("#edit-bar").onclick = () => this.openBarEditor();
        document.querySelector("#edit-section").onclick = () => this.openBarEditor("section");
        document.querySelector("#cancel-bar-edit").onclick = () => this.barDialog.close();
        document.querySelector("#bar-editor-form").onsubmit = (event) => { event.preventDefault(); this.commitBarEdit(); };
        this.barDialog.addEventListener("close", () => this.grid.children[this.selectedBar]?.focus({ preventScroll: true }));
        this.contextMenu.onclick = (event) => {
            const action = event.target.closest("button")?.dataset.action;
            this.contextMenu.hidden = true;
            if (action === "play") {
                this.grid.children[this.selectedBar].focus({ preventScroll: true });
                this.playSelection();
            }
            else if (action) this.openBarEditor(action);
        };
        document.addEventListener("pointerdown", event => {
            if (!this.contextMenu.contains(event.target)) this.contextMenu.hidden = true;
        });
        this.contextMenu.onkeydown = event => {
            if (event.key === "Escape") {
                event.preventDefault(); this.contextMenu.hidden = true;
                this.grid.children[this.selectedBar]?.focus({ preventScroll: true });
            }
        };
        document.querySelector("#new-project").onclick = () => this.open({
            title: "新しい曲", tempo: 120, bars: 4, sections: [{ name: "A", bar: 0, meter: "FOUR_FOUR" }],
            chords: ["C", "Am7", "Dm7", "G7"].map((name, bar) => ({ name, bar, beat: 0 })),
            parts: [{ name: "A", section: 0, styleId: "jjSwing-ID", styleName: "jjSwing", parameters: {} }], userTracks: []
        }, []);
        document.querySelector("#open-project").onchange = event => this.openFiles(event.target);
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
            this.project.bars = bar;
        });
        document.querySelector("#add-song-part").onclick = () => {
            this.editArrangement(() => {
                const part = this.project.parts.at(-1);
                this.project.parts.push({ ...part, parameters: { ...part.parameters } });
            });
        };
        this.title.oninput = () => { this.project.title = this.title.value; this.changed(); };
        this.meter.onchange = () => {
            this.editArrangement(() => {
                for (const section of this.project.sections) section.meter = this.meter.value;
            });
            this.onMeterChange?.(this.project.sections[0].meter);
        };
        document.querySelector("#save-project").onclick = () => this.save();
        this.exportButton.onclick = () => this.export();
    }

    notify(message = "", error = false) {
        this.status.textContent = message;
        this.status.toggleAttribute("data-error", error);
    }

    changed() {
        this.renderedMix = null;
        this.exportButton.disabled = true;
        this.onChanged?.();
    }

    get attachedStyles() {
        return Array.isArray(this.style) ? this.style : this.style ? [this.style] : [];
    }

    editArrangement(action) {
        try { action(); this.changed(); this.render(); }
        catch (error) { this.notify(error.message, true); }
    }

    open(project, mix, style = null) {
        this.project = project;
        this.mix = mix;
        this.style = style;
        this.selectedPart = null;
        this.selectedBar = this.selectionAnchor = 0;
        this.changed();
        this.notify();
        document.querySelector("#project-editor").hidden = false;
        document.querySelector("#quick-chords").hidden = true;
        document.querySelector("#chords").required = false;
        this.render();
        this.onOpen(this);
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
                this.open(DesktopSongFiles.validateSong(data.song), data.mix ?? [], data.style);
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
            this.open(song, mix);
            this.notify(`${songFile.name} を開きました。${song.parts[0].styleName ? ` スタイル: ${song.parts[0].styleName}` : ""}`);
        } catch (error) { this.notify(error.message, true); }
    }

    button(label, callback) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = label;
        button.onclick = callback;
        return button;
    }

    chooseBar(bar, selectedPart = null, throughBar) {
        let start = 0;
        const occurrences = [];
        for (let index = 0; index < this.project.parts.length; index++) {
            const part = this.project.parts[index];
            const from = this.project.sections[part.section].bar;
            const to = this.project.sections[part.section + 1]?.bar ?? this.project.bars;
            occurrences.push({ index, from, to, start });
            start += to - from;
        }
        const contains = (occurrence, value) => value >= occurrence.from && value < occurrence.to;
        const matching = occurrences.filter(occurrence => contains(occurrence, bar));
        const first = matching.find(occurrence => occurrence.index === selectedPart) ?? matching[0];
        if (!first) { this.onChooseBar(null); return; }
        const last = throughBar === undefined ? null : occurrences.find(occurrence => occurrence.index >= first.index && contains(occurrence, throughBar));
        this.onChooseBar({ from: first.start + bar - first.from + 1,
            to: last ? last.start + throughBar - last.from + 1 : first.start + first.to - first.from });
    }

    selectBar(bar, extend = false, focus = false) {
        this.selectedBar = Math.min(Math.max(0, bar), this.project.bars - 1);
        if (!extend) this.selectionAnchor = this.selectedBar;
        this.markSelection();
        const [first, last] = this.selectedRange();
        this.chooseBar(first, this.selectedPart, first === last ? undefined : last);
        if (focus) this.grid.children[this.selectedBar].focus();
    }

    selectedRange() {
        return [Math.min(this.selectedBar, this.selectionAnchor), Math.max(this.selectedBar, this.selectionAnchor)];
    }

    playSelection() {
        const [first, last] = this.selectedRange();
        this.chooseBar(first, this.selectedPart, first === last ? undefined : last);
        this.onPlay();
    }

    markSelection() {
        const [first, last] = this.selectedRange();
        Array.from(this.grid.children).forEach((cell, index) => {
            cell.tabIndex = index === this.selectedBar ? 0 : -1;
            cell.setAttribute("aria-selected", String(index >= first && index <= last));
        });
        this.selection.textContent = first === last ? `${first + 1}小節` : `${first + 1}–${last + 1}小節`;
    }

    handleBarKey(event, bar) {
        const columns = getComputedStyle(this.grid).gridTemplateColumns.split(" ").length;
        const motion = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
        if (motion) {
            event.preventDefault(); this.selectBar(bar + motion, event.shiftKey, true);
        } else if (event.code === "Space" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault(); this.playSelection();
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault(); this.openBarEditor();
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            const rect = this.grid.children[bar].getBoundingClientRect();
            this.openContext(rect.left, rect.bottom);
        } else if (/^[a-gA-GnN]$/u.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault(); this.openBarEditor("edit", event.key.toUpperCase());
        }
    }

    openContext(x, y) {
        this.contextMenu.hidden = false;
        this.contextMenu.style.left = `${Math.max(0, Math.min(x, innerWidth - this.contextMenu.offsetWidth - 8))}px`;
        this.contextMenu.style.top = `${Math.max(0, Math.min(y, innerHeight - this.contextMenu.offsetHeight - 8))}px`;
        this.contextMenu.querySelector("button").focus();
    }

    openBarEditor(mode = "edit", initialChord) {
        const bar = this.selectedBar;
        this.editingSection = mode === "section";
        document.querySelector("#bar-editor-title").textContent = `${bar + 1}小節の${this.editingSection ? "セクション" : "コード"}`;
        document.querySelector("#bar-chords-field").hidden = document.querySelector("#bar-editor-help").hidden = this.editingSection;
        document.querySelector("#bar-section-field").hidden = !this.editingSection;
        this.barError.textContent = "";
        this.chordField.value = initialChord ?? this.project.chords.filter(chord => chord.bar === bar).sort((a, b) => a.beat - b.beat)
            .map(chord => chord.beat ? `${Number((chord.beat + 1).toFixed(6))}:${chord.name}` : chord.name).join(" ");
        const sections = this.project.sections;
        let suffix = 1;
        while (sections.some(section => section.name === `S${suffix}`)) suffix++;
        this.sectionField.value = sections.find(section => section.bar === bar)?.name ?? `S${suffix}`;
        this.barDialog.showModal();
        const field = this.editingSection ? this.sectionField : this.chordField;
        field.focus();
        if (initialChord === undefined) field.select();
        else field.setSelectionRange(field.value.length, field.value.length);
    }

    commitBarEdit() {
        const bar = this.selectedBar;
        try {
            if (this.editingSection) this.setSectionName(bar, this.sectionField.value.trim());
            else {
                const newChords = this.parseBarChords(bar, this.chordField.value);
                this.project.chords = [...this.project.chords.filter(chord => chord.bar !== bar), ...newChords]
                    .sort((a, b) => a.bar - b.bar || a.beat - b.beat);
            }
            this.changed(); this.render();
            this.barDialog.close();
            this.selectBar(this.editingSection ? bar : bar + 1, false, true);
        } catch (error) { this.barError.textContent = error.message; }
    }

    setSectionName(bar, name) {
        const { sections, parts } = this.project;
        const section = sections.find(section => section.bar === bar);
        if (!name || sections.some(other => other !== section && other.name === name)) {
            throw new Error("セクション名は空欄や重複を避けてください。");
        }
        if (section) {
            for (const part of parts) {
                if (sections[part.section] === section && part.name === section.name) part.name = name;
            }
            section.name = name;
        } else {
            const next = sections.findIndex(item => item.bar > bar);
            const insert = next < 0 ? sections.length : next;
            sections.splice(insert, 0, { name, bar, meter: sections[insert - 1].meter });
            for (const part of parts) if (part.section >= insert) part.section++;
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
        this.grid.querySelector(".playing-bar")?.classList.remove("playing-bar");
        this.parts.querySelector(".playing-bar")?.classList.remove("playing-bar");
        this.grid.children[sheetBar]?.classList.add("playing-bar");
        this.parts.children[row]?.classList.add("playing-bar");
    }

    render() {
        const { title, sections, chords, parts, bars, userTracks } = this.project;
        this.title.value = title;
        this.meter.value = sections.some(section => section.meter !== sections[0].meter) ? "" : sections[0].meter;
        this.removeBar.disabled = bars < 2 || sections.at(-1).bar === bars - 1;
        this.grid.replaceChildren();
        const chordsByBar = Map.groupBy(chords, chord => chord.bar);
        const colors = ["#e7ac83", "#9bb487", "#8bbab5", "#b1a7d0", "#d4c381", "#9cb5d6"];
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
            cell.style.setProperty("--section-color", colors[sectionIndex % colors.length]);
            cell.classList.toggle("section-start", start);
            cell.setAttribute("aria-label", `${bar + 1}小節、${section.name}、${meter}、${symbols.map(chord => chord.name).join("、") || "コードなし"}`);
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
                const next = symbols[index + 1];
                const late = !next && chord.beat / beats >= 0.75;
                const compact = symbols.length > 2 || (next && next.beat - chord.beat < 1);
                if (late) {
                    symbol.classList.add("late-chord");
                    if (symbols[index - 1]?.beat / beats >= 0.5 || symbols.length > 2) symbol.classList.add("lower-chord");
                } else {
                    symbol.style.left = `${100 * chord.beat / beats}%`;
                    symbol.style.maxWidth = `${100 * ((next?.beat ?? beats) - chord.beat) / beats}%`;
                }
                symbol.textContent = chord.name.replace(/([A-G])b/gu, "$1♭").replace(/([A-G])#/gu, "$1♯");
                if (compact) symbol.classList.add("compact");
                symbol.title = chord.name;
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
            cell.append(lane, ruler, band);
            cell.onclick = event => this.selectBar(bar, event.shiftKey, true);
            cell.ondblclick = () => this.openBarEditor();
            cell.onkeydown = event => this.handleBarKey(event, bar);
            cell.oncontextmenu = event => {
                event.preventDefault();
                this.selectBar(bar, false, true);
                this.openContext(event.clientX, event.clientY);
            };
            this.grid.append(cell);
        }
        this.selectedBar = Math.min(this.selectedBar, bars - 1);
        this.selectionAnchor = Math.min(this.selectionAnchor, bars - 1);
        this.markSelection();
        this.parts.replaceChildren();
        let partStart = 1;
        parts.forEach((part, index) => {
            const item = document.createElement("li");
            item.style.setProperty("--section-color", colors[part.section % colors.length]);
            const partLength = (sections[part.section + 1]?.bar ?? bars) - sections[part.section].bar;
            const header = document.createElement("div");
            header.className = "part-heading";
            const row = document.createElement("div");
            row.className = "part-controls";
            const select = document.createElement("select");
            select.setAttribute("aria-label", `${index + 1}番目のセクション`);
            sections.forEach((section, id) => {
                const option = document.createElement("option"); option.value = id; option.textContent = section.name; select.append(option);
            });
            select.value = part.section;
            select.onchange = () => { part.section = Number(select.value); part.name = sections[part.section].name; this.changed(); this.render(); this.parts.children[index].querySelector("select").focus(); };
            const variation = document.createElement("input");
            variation.placeholder = "バリエーション";
            variation.setAttribute("aria-label", `${index + 1}番目のバリエーション`);
            variation.value = part.parameters.rpVariationID ?? "";
            variation.oninput = () => { part.parameters.rpVariationID = variation.value; this.changed(); };
            const styleName = document.createElement("span");
            styleName.textContent = part.styleName || part.styleId.replace(/-ID$/u, "");
            styleName.className = "part-style";
            styleName.title = styleName.textContent;
            const range = document.createElement("span");
            range.textContent = `${partStart}–${partStart + partLength - 1}`;
            partStart += partLength;
            header.append(select, range);
            const move = (destination) => {
                try {
                    [parts[index], parts[destination]] = [parts[destination], parts[index]];
                    this.selectedPart = null;
                    this.changed(); this.render();
                } catch (error) { this.notify(error.message, true); }
            };
            const up = this.button("上へ", () => move(index - 1)); up.disabled = index === 0;
            const down = this.button("下へ", () => move(index + 1)); down.disabled = index === parts.length - 1;
            const remove = this.button("削除", () => {
                try {
                    parts.splice(index, 1); this.selectedPart = null; this.changed(); this.render();
                } catch (error) { this.notify(error.message, true); }
            });
            remove.disabled = parts.length < 2;
            const focusPart = this.button("区間を選択", () => {
                this.selectedPart = index;
                this.selectBar(sections[part.section].bar, false, true);
            });
            for (const [button, label] of [[up, "←"], [down, "→"], [remove, "×"], [focusPart, "↗"]]) {
                button.title = button.textContent;
                button.setAttribute("aria-label", button.textContent);
                button.textContent = label;
            }
            row.append(up, down, remove, focusPart);
            item.append(header, styleName, variation, row); this.parts.append(item);
        });
        document.querySelector("#user-track-summary").textContent = userTracks.length ? `ユーザートラック: ${userTracks.map(track => track.name).join("、")}` : "";
    }

    parseBarChords(bar, value) {
        const previous = this.project.chords.filter(chord => chord.bar === bar);
        const section = this.project.sections.findLast(item => item.bar <= bar);
        const beats = new Set();
        return value.trim().split(/\s+/u).filter(Boolean).map(token => {
            const match = /^(?:(\d+(?:\.\d+)?):)?(.+)$/u.exec(token);
            const beat = Number(match[1] ?? 1) - 1;
            const name = match[2].replaceAll("♭", "b").replaceAll("♯", "#");
            if (name.includes(":") || beat < 0 || beat >= DesktopSongFiles.meters[section.meter][1] || beats.has(beat)) {
                throw new Error(`${bar + 1}小節のコードの拍位置を確認してください。`);
            }
            beats.add(beat);
            return previous.find(chord => Number((chord.beat + 1).toFixed(6)) === beat + 1 && chord.name === name)
                ?? { name, bar, beat };
        });
    }

    fileStem() { return this.project.title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_") || "JJazzLab"; }

    save() {
        try {
            const data = { version: 1, song: this.project, mix: this.renderedMix ?? this.mix, style: this.style };
            downloadSongFile(`${this.fileStem()}.jjazzweb`, JSON.stringify(data), "application/json");
        } catch (error) { this.notify(error.message, true); }
    }

    export() {
        try {
            if (!this.renderedMix) throw new Error("伴奏を生成してから書き出してください。");
            const stem = this.fileStem();
            const files = new Map([[`${stem}.sng`, DesktopSongFiles.writeSong(this.project)], [`${stem}.mix`, this.desktopMixXml()]]);
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
        return DesktopSongFiles.writeMix(this.renderedMix.map(track => ({ ...track, channel: track.sourceChannel ?? track.channel })));
    }
}
