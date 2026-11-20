"use strict";

class SongPrintView {
    constructor(editor) {
        this.editor = editor;
        this.dialog = document.querySelector("#song-print");
        this.form = document.querySelector("#song-print-form");
        this.preview = document.querySelector("#song-print-preview");
        this.error = document.querySelector("#song-print-error");
        this.mode = document.querySelector("#song-print-mode");
        this.orientation = document.querySelector("#song-print-orientation");
        this.pageStyle = document.createElement("style");
        document.head.append(this.pageStyle);
        document.querySelector("#open-song-print").onclick = () => {
            if (!editor.project) return;
            this.dialog.showModal();
            this.render();
        };
        document.querySelector("#cancel-song-print").onclick = () => this.dialog.close();
        this.dialog.addEventListener("close", () => { this.pageStyle.textContent = ""; });
        this.mode.onchange = () => {
            this.orientation.value = this.mode.value === "structure" ? "landscape" : "portrait";
        };
        this.form.onchange = () => this.render();
        document.querySelector("#song-print-bar-height").oninput = () => this.render();
        this.form.onsubmit = event => {
            event.preventDefault();
            if (this.render()) window.print();
        };
    }

    render() {
        const structure = this.mode.value === "structure";
        const sheetOptions = document.querySelector("#song-print-sheet-options");
        sheetOptions.hidden = sheetOptions.disabled = structure;
        const size = document.querySelector("#song-print-paper").value === "letter" ? "letter" : "A4";
        const orientation = this.orientation.value === "landscape" ? "landscape" : "portrait";
        this.pageStyle.textContent = `@page { size: ${size} ${orientation}; margin: 13mm; }`;
        this.error.hidden = true;
        this.preview.replaceChildren();
        try {
            const source = this.editor.project;
            const unfolded = !structure && document.querySelector("#song-print-unfold").checked;
            const song = unfolded ? this.editor.linearizedSong() : source;
            const heading = document.createElement("h2");
            heading.textContent = source.title;
            this.preview.append(heading);
            this.preview.append(structure ? this.structure() : this.leadSheet(song));
            return true;
        } catch (error) {
            this.error.textContent = error.message;
            this.error.hidden = false;
            return false;
        }
    }

    leadSheet(song) {
        const grid = document.createElement("div");
        grid.className = "print-score";
        const columns = Number(document.querySelector("#song-print-columns").value);
        const simplify = document.querySelector("#song-print-simplify").checked;
        grid.style.setProperty("--print-columns", columns);
        grid.style.setProperty("--print-bar-height", `${2.25 * Number(document.querySelector("#song-print-bar-height").value) / 100}em`);
        const byBar = Map.groupBy(song.chords, chord => chord.bar);
        const annotations = new Map((song.annotations ?? []).map(note => [note.bar, note.text]));
        const sections = new Map(song.sections.map(section => [section.bar, section]));
        let row, count = columns, section;
        for (let bar = 0; bar < song.bars; bar++) {
            const start = sections.get(bar);
            if (start) section = start;
            if (count === columns || start?.clientProperties?.PropSectionStartOnNewLine === "true") {
                row = document.createElement("div");
                row.className = "print-score-row";
                grid.append(row);
                count = 0;
            }
            const [meter, beats] = DesktopSongFiles.meters[section.meter];
            const cell = document.createElement("div");
            cell.className = "print-measure";
            const barHeader = document.createElement("small");
            barHeader.textContent = start ? `${bar + 1} · ${start.name} · ${meter}` : bar + 1;
            const lane = document.createElement("div");
            lane.className = "print-chords";
            let chords = (byBar.get(bar) ?? []).toSorted((a, b) => a.beat - b.beat);
            if (simplify && chords.length > 1) {
                const start = chords[0], end = chords.at(-1);
                const middle = beats === 3 ? 1.5 : Math.ceil(beats / 2);
                chords = end.beat - start.beat < middle ? [{ ...start, beat: 0 }, { ...end, beat: middle }] : [start, end];
            }
            for (const [index, chord] of chords.entries()) {
                const symbol = document.createElement("span");
                symbol.textContent = this.editor.chordLabel(chord.name, true);
                symbol.style.left = `${100 * chord.beat / beats}%`;
                symbol.style.maxWidth = `${100 * ((chords[index + 1]?.beat ?? beats) - chord.beat) / beats}%`;
                lane.append(symbol);
            }
            cell.append(barHeader, lane);
            if (annotations.has(bar)) {
                const note = document.createElement("p");
                note.textContent = annotations.get(bar);
                cell.append(note);
            }
            row.append(cell);
            count++;
        }
        return grid;
    }

    structure() {
        const table = document.createElement("table");
        table.className = "print-structure";
        const head = table.createTHead().insertRow();
        for (const name of [t("演奏区間", "Song part"), t("小節", "Bars"), t("拍子", "Meter"), t("リズム", "Rhythm"), t("バリエーション")]) {
            const cell = document.createElement("th");
            cell.scope = "col";
            cell.textContent = name;
            head.append(cell);
        }
        const rows = table.createTBody();
        const { sections, parts } = this.editor.project;
        for (const { index, from, to } of this.editor.partRanges()) {
            const part = parts[index];
            const row = rows.insertRow();
            for (const value of [part.name, from === to ? from : `${from}–${to}`, DesktopSongFiles.meters[sections[part.section].meter][0],
                part.styleName, part.parameters.rpVariationID ?? ""]) row.insertCell().textContent = value;
        }
        return table;
    }
}
