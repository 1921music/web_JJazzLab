"use strict";

const guitarTuning = [40, 45, 50, 55, 59, 64];

function guitarVoicings(pitches, bass) {
    const tones = new Set(pitches.map(pitch => pitch % 12));
    if (!tones.size) return [];
    const required = Math.min(tones.size, 4);
    const accepted = new Map();
    const frets = [];
    for (let start = 1; start <= 12; start++) {
        const choices = guitarTuning.map(open => [-1, 0, start, start + 1, start + 2, start + 3]
            .filter(fret => fret < 0 || tones.has((open + fret) % 12) || (open + fret) % 12 === bass));
        const addString = index => {
            if (index < guitarTuning.length) {
                for (const fret of choices[index]) { frets[index] = fret; addString(index + 1); }
                return;
            }
            const notes = frets.flatMap((fret, string) => fret < 0 ? [] : [guitarTuning[string] + fret]);
            if (notes.length < required || Math.min(...notes) % 12 !== bass) return;
            const unique = new Set(notes.map(note => note % 12).filter(note => tones.has(note)));
            if (unique.size < required) return;
            const held = frets.filter(fret => fret > 0);
            const rank = (tones.size - unique.size) * 30 + (guitarTuning.length - notes.length) * 2
                + Math.max(0, ...held) * .6 + held.length * .35;
            accepted.set(frets.join(","), { frets: [...frets], rank });
        };
        addString(0);
    }
    return [...accepted.values()].sort((a, b) => a.rank - b.rank).slice(0, 8).map(({ frets }) => frets);
}

class ChordInspector {
    constructor({ describe, play, stop }) {
        this.describe = describe;
        this.play = play;
        this.dialog = document.querySelector("#chord-inspector");
        this.title = this.dialog.querySelector("h2");
        this.status = this.dialog.querySelector("[role=status]");
        this.scale = this.dialog.querySelector("#inspector-scale");
        this.views = [...this.dialog.querySelectorAll("[data-inspector-view]")];
        this.keyPanel = this.dialog.querySelector("#inspector-piano");
        this.fretPanel = this.dialog.querySelector("#inspector-guitars");
        this.staff = this.dialog.querySelector("#inspector-staff");
        this.preview = this.dialog.querySelector("#inspector-audition");
        this.preview.onclick = () => {
            this.play(this.chord.name, () => this.dialog.open).catch(error => { if (this.dialog.open) this.status.textContent = error.message; });
        };
        this.scale.onchange = () => this.render();
        for (const button of this.views) button.onclick = () => {
            this.view = button.dataset.inspectorView;
            this.render();
        };
        this.dialog.querySelector("#close-chord-inspector").onclick = () => this.dialog.close();
        this.dialog.addEventListener("close", stop);
    }

    async open(chord) {
        if (!chord) return;
        const request = {};
        this.request = request;
        this.chord = chord;
        this.details = undefined;
        this.guitars = undefined;
        this.view ??= "piano";
        this.title.textContent = t(`コードインスペクター · ${chord.name}`, `Chord Inspector · ${chord.name}`);
        this.status.textContent = t("構成音を読み込んでいます…", "Loading chord tones…");
        this.scale.disabled = this.preview.disabled = true;
        this.scale.replaceChildren();
        this.keyPanel.replaceChildren();
        this.fretPanel.replaceChildren();
        this.staff.hidden = true;
        this.dialog.showModal();
        try {
            const details = await this.describe(chord.name);
            if (!this.dialog.open || this.request !== request) return;
            this.details = details;
            this.scale.replaceChildren(new Option(t("構成音のみ", "Chord tones only"), ""),
                ...details.scales.map(scale => new Option(scale.name, scale.id)));
            if (chord.scale) this.scale.value = String(chord.scale.index);
            this.scale.disabled = details.scales.length === 0;
            this.preview.disabled = !details.pitches.length;
            this.status.textContent = details.tones;
            this.render();
        } catch (error) { if (this.dialog.open && this.request === request) this.status.textContent = error.message; }
    }

    render() {
        if (!this.details) return;
        const { pitches, scales, bass } = this.details;
        const scale = new Set(scales.find(scale => scale.id === this.scale.value)?.pitches);
        const tones = new Set(pitches.map(pitch => pitch % 12));
        for (const button of this.views) button.setAttribute("aria-pressed", String(button.dataset.inspectorView === this.view));
        this.keyPanel.hidden = this.view !== "piano";
        this.fretPanel.hidden = this.view !== "guitar";
        this.staff.hidden = this.view !== "staff";
        if (this.view === "piano") {
            const keys = [];
            let white = 0;
            for (let pitch = 48; pitch < 72; pitch++) {
                const step = pitch % 12, black = PITCH_NAMES[step].includes("♯");
                const key = document.createElement("span");
                key.className = black ? "inspector-black-key" : "inspector-white-key";
                key.dataset.pitch = pitch;
                key.dataset.note = tones.has(step) ? "chord" : scale.has(step) ? "scale" : "";
                key.style.left = `calc((${white} ${black ? "- .33" : ""}) * (100% / 14))`;
                key.title = pitchName(pitch);
                if (!black) {
                    key.textContent = PITCH_NAMES[step];
                    white++;
                }
                keys.push(key);
            }
            this.keyPanel.replaceChildren(...keys);
        } else if (this.view === "guitar") {
            this.guitars ??= guitarVoicings(pitches, bass);
            this.fretPanel.replaceChildren(...this.guitars.map(frets => this.drawGuitar(frets)));
            if (!this.guitars.length) this.fretPanel.textContent = t("このコードの押さえ方が見つかりません。", "No fingering was found for this chord.");
        } else {
            const ctx = this.staff.getContext("2d");
            const chordNotes = pitches.map((pitch, index) => ({ pitch, position: .35 + index * .2, duration: 1 }));
            const scaleNotes = [...scale].map(step => 60 + step).sort((a, b) => a - b)
                .map((pitch, index) => ({ pitch, position: 2 + index * .27, duration: .5 }));
            paintPianoScore(ctx, { keyWidth: 42, pixels: 75, scroll: { scrollLeft: 0 }, phrase: { notes: [...chordNotes, ...scaleNotes] },
                barAt: () => 1, boundaries: [0, 4], chords: [[]], staffMeters: ["FOUR_FOUR"],
                selection: new Set(chordNotes), scoreOctave: () => 0 }, this.staff.width);
        }
    }

    drawGuitar(frets) {
        const canvas = document.createElement("canvas");
        canvas.width = 112;
        canvas.height = 128;
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", frets.map(fret => fret < 0 ? "×" : fret).join(" "));
        const ctx = canvas.getContext("2d");
        const frame = Math.min(...frets.filter(fret => fret > 0));
        const first = frame <= 1 ? 1 : Number.isFinite(frame) ? frame : 1;
        ctx.fillStyle = "#f5eee1";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#554d43";
        ctx.fillStyle = "#554d43";
        ctx.font = "10px system-ui";
        ctx.fillText(String(first), 2, 33);
        for (let fret = 0; fret <= 4; fret++) {
            ctx.beginPath(); ctx.moveTo(19, 23 + fret * 22); ctx.lineTo(94, 23 + fret * 22); ctx.stroke();
        }
        for (const [string, fret] of frets.entries()) {
            const x = 19 + string * 15;
            ctx.beginPath(); ctx.moveTo(x, 23); ctx.lineTo(x, 111); ctx.stroke();
            if (fret <= 0) ctx.fillText(fret < 0 ? "×" : "○", x - 3, 17);
            else {
                const y = 34 + (fret - first) * 22;
                ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fill();
            }
        }
        return canvas;
    }
}
