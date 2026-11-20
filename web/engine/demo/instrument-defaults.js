"use strict";

const gmFamilies = ["Piano", "Chromatic Percussion", "Organ", "Guitar", "Bass", "Strings", "Ensemble", "Brass",
    "Reed", "Pipe", "Synth Lead", "Synth Pad", "Synth Effects", "Ethnic", "Percussive", "Sound Effects"];

class InstrumentDefaults {
    constructor({ instruments, prepare, audition, stop, update }) {
        this.instruments = instruments;
        this.key = "jjazzlab.defaultInstruments";
        try { this.mappings = new Map(Object.entries(JSON.parse(localStorage.getItem(this.key) ?? "{}"))); }
        catch { this.mappings = new Map(); }
        const dialog = document.querySelector("#instrument-defaults");
        const form = dialog.querySelector("form");
        const status = dialog.querySelector("[role=status]");
        const { source, target, filter, preview, clear } = form.elements;
        const selection = () => this.instruments().find(instrument => instrument.id === target.value);
        const renderTargets = () => {
            const terms = filter.value.normalize("NFKC").trim().toLowerCase().split(/\s+/u);
            const chosen = this.mappings.get(source.value);
            const drums = source.value === "drums" || source.value === "percussion";
            const choices = this.instruments().filter(instrument => instrument.drum === drums
                && (instrument.id === chosen || terms.every(term => `${instrument.patch} ${instrument.program + 1}`.toLowerCase().includes(term))));
            target.replaceChildren(new Option(t("音源の既定値", "Sound source default"), ""),
                ...choices.map(instrument => new Option(instrument.patch, instrument.id)));
            target.value = choices.some(instrument => instrument.id === chosen) ? chosen : "";
            preview.disabled = !target.value;
            clear.disabled = !chosen;
        };
        const save = () => {
            try {
                localStorage.setItem(this.key, JSON.stringify(Object.fromEntries(this.mappings)));
                status.textContent = t("音色の割り当てを保存しました。", "Saved the instrument mapping.");
            } catch (error) { status.textContent = error.message; }
            update();
            renderTargets();
        };
        document.querySelector("#open-instrument-defaults").onclick = async () => {
            dialog.showModal();
            try {
                await prepare();
                const options = this.instruments().filter(instrument => !instrument.drum);
                source.replaceChildren(new Option(t("ドラムキット", "Drum kit"), "drums"),
                    new Option(t("パーカッションキット", "Percussion kit"), "percussion"),
                    ...gmFamilies.map((name, index) => new Option(`${name} · ${t("ファミリー", "Family")}`, `family:${index}`)),
                    ...options.map(instrument => new Option(`${instrument.program + 1} · ${instrument.patch}`, `program:${instrument.program}`)));
                status.textContent = "";
                filter.value = "";
                renderTargets();
            } catch (error) { status.textContent = error.message; }
        };
        source.onchange = () => { filter.value = ""; renderTargets(); };
        filter.oninput = renderTargets;
        target.onchange = () => { preview.disabled = !target.value; };
        preview.onclick = () => { const instrument = selection(); if (instrument) audition(instrument, () => dialog.open); };
        clear.onclick = () => { this.mappings.delete(source.value); save(); };
        form.onsubmit = event => {
            event.preventDefault();
            const instrument = selection();
            if (instrument) this.mappings.set(source.value, instrument.id);
            else this.mappings.delete(source.value);
            save();
        };
        form.elements.closeDialog.onclick = () => dialog.close();
        dialog.addEventListener("close", stop);
    }

    chosen(part) {
        if (part.instrumentChoice) return part.instrumentChoice;
        const id = part.drum ? this.mappings.get(/percussion|^perc\b/iu.test(part.name) ? "percussion" : "drums")
            : this.mappings.get(`program:${part.program}`) ?? this.mappings.get(`family:${Math.floor(part.program / 8)}`);
        return id && this.instruments().find(instrument => instrument.id === id && instrument.drum === part.drum) || undefined;
    }

    playbackMix(parts) {
        return parts.map(part => {
            const instrumentChoice = this.chosen(part);
            return instrumentChoice === part.instrumentChoice ? part : { ...part, instrumentChoice };
        });
    }
}
