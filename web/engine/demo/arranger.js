"use strict";

class Arranger {
    constructor({ editor, recognize, hasInput, start, stop, changed, restore }) {
        this.editor = editor;
        this.recognize = recognize;
        this.hasInput = hasInput;
        this.start = start;
        this.stop = stop;
        this.changed = changed;
        this.restore = restore;
        this.keys = new Map();
        this.preference = "jjazzlab.arranger";
        this.settings = { split: 60, slashBass: true };
        try { Object.assign(this.settings, JSON.parse(localStorage.getItem(this.preference) ?? "{}")); } catch { /* Optional storage. */ }
        this.dialog = document.querySelector("#arranger");
        this.view = document.querySelector("#arranger-monitor");
        this.indicator = document.querySelector("#arranger-current-chord");
        const form = this.dialog.querySelector("form");
        const status = this.dialog.querySelector("[role=alert]");
        document.querySelector("#open-arranger").onclick = () => {
            if (!editor.project) return;
            form.elements.part.replaceChildren(...editor.project.parts.map((part, index) => new Option(`${index + 1} · ${part.name}`, index)));
            form.elements.part.value = Math.max(0, editor.selectedPart ?? 0);
            form.elements.split.value = this.settings.split;
            form.elements.slashBass.checked = this.settings.slashBass;
            status.textContent = "";
            this.dialog.showModal();
        };
        form.elements.cancelArranger.onclick = () => this.dialog.close();
        form.onsubmit = async event => {
            event.preventDefault();
            if (!this.hasInput()) {
                status.textContent = t("MIDI遠隔操作で入力機器に接続してください。", "Connect an input in MIDI Remote Control first.");
                return;
            }
            const { project } = editor;
            const range = editor.partRanges()[Number(form.elements.part.value)];
            if (!range) return;
            const first = project.chords.filter(chord => chord.bar >= range.sheetStart && chord.bar < range.sheetEnd)
                .toSorted((a, b) => a.bar - b.bar || a.beat - b.beat)[0];
            this.settings = { split: form.elements.split.valueAsNumber, slashBass: form.elements.slashBass.checked };
            try { localStorage.setItem(this.preference, JSON.stringify(this.settings)); } catch { /* Optional storage. */ }
            this.session = { project, range, chord: first?.name ?? "C", first };
            this.keys.clear();
            this.updateMonitor();
            this.dialog.close();
            await this.start(range);
            if (this.session?.project === editor.project) this.session.ready = true;
            else this.finish();
        };
        this.view.querySelector("button").onclick = () => this.stop();
    }

    snapshot(project) {
        if (!this.session || this.session.project !== project) return project;
        const { range, first, chord } = this.session;
        const chords = project.chords.filter(note => note.bar < range.sheetStart || note.bar >= range.sheetEnd);
        const initial = first?.name === chord ? first : {};
        chords.push({ ...initial, name: chord, bar: range.sheetStart, beat: 0 });
        return { ...project, chords: chords.sort((a, b) => a.bar - b.bar || a.beat - b.beat) };
    }

    receive(bytes) {
        const [status, pitch, velocity] = bytes;
        const type = status & 0xf0;
        if (!this.session || ![0x80, 0x90].includes(type) || !Number.isInteger(pitch) || pitch > this.settings.split) return false;
        if (!this.session.ready) return true;
        const key = (status & 15) * 128 + pitch;
        if (type === 0x90 && velocity) this.keys.set(key, pitch);
        else this.keys.delete(key);
        this.version = (this.version ?? 0) + 1;
        const request = this.version, session = this.session;
        clearTimeout(this.timer);
        const notes = [...this.keys.values()].sort((a, b) => a - b);
        if (notes.length >= 3 && notes.length <= 4) {
            this.timer = setTimeout(async () => {
                try {
                    const chord = await this.recognize(notes, this.settings.slashBass);
                    if (this.session !== session || request !== this.version || !chord || chord === session.chord) return;
                    session.chord = chord;
                    this.updateMonitor();
                    this.changed();
                } catch (error) { this.editor.notify(error.message, true); }
            }, 30);
        }
        return true;
    }

    updateMonitor() {
        this.view.hidden = !this.session;
        this.indicator.textContent = this.session?.chord ?? "";
    }

    resetKeys() {
        clearTimeout(this.timer);
        this.version = (this.version ?? 0) + 1;
        this.keys.clear();
    }

    finish() {
        if (!this.session) return;
        this.session = undefined;
        this.resetKeys();
        this.updateMonitor();
        this.restore();
    }
}
