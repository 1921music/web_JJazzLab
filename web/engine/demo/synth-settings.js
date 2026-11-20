"use strict";

class SynthSettings {
    constructor(player, busy, status, stopPreview) {
        this.player = player;
        this.busy = busy;
        this.status = status;
        this.stopPreview = stopPreview;
        this.dialog = document.querySelector("#synth-settings");
        this.form = this.dialog.querySelector("form");
        this.current = this.dialog.querySelector("output");
        this.error = this.dialog.querySelector("[role=alert]");
        this.effectKey = "jjazzlab.synthEffects";
        this.effectNames = Object.keys(defaultSynthEffects);
        try {
            const saved = JSON.parse(localStorage.getItem(this.effectKey) ?? "{}");
            for (const name of this.effectNames) {
                if (Number.isFinite(saved[name]) && saved[name] >= 0 && saved[name] <= 1.5) synthEffects[name] = saved[name];
            }
        } catch { /* Optional storage. */ }
        const { soundfont, useDefault, cancelSynth, resetSynthEffects } = this.form.elements;
        document.querySelector("#open-synth-settings").onclick = () => {
            soundfont.value = "";
            this.error.textContent = "";
            this.render();
            this.loadEffects(synthEffects);
            this.dialog.showModal();
        };
        resetSynthEffects.onclick = () => this.loadEffects(defaultSynthEffects);
        cancelSynth.onclick = () => this.dialog.close();
        this.dialog.addEventListener("cancel", event => { if (this.switching) event.preventDefault(); });
        useDefault.onclick = () => this.select(null);
        this.form.onsubmit = event => { event.preventDefault(); void this.save(soundfont.files[0]); };
        void this.restore();
    }

    database() {
        this.opening ??= new Promise((resolve, reject) => {
            const request = indexedDB.open("jjazzlab-soundfont", 1);
            request.onupgradeneeded = () => request.result.createObjectStore("files");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
        return this.opening;
    }

    async restore() {
        try {
            const database = await this.database();
            const request = database.transaction("files").objectStore("files").get("active");
            request.onsuccess = () => {
                if (request.result && !this.busy() && !this.player.ready && !this.switching) {
                    try { this.player.setSoundFont({ ...request.result, soundfont: validateSoundFont(request.result.soundfont) }); }
                    catch { /* An unusable local copy leaves the default selected. */ }
                }
                this.render();
            };
        } catch { /* Browser storage is optional. */ }
    }

    async store(selection) {
        const database = await this.database();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction("files", "readwrite");
            const files = transaction.objectStore("files");
            if (selection) files.put(selection, "active");
            else files.delete("active");
            transaction.oncomplete = resolve;
            transaction.onabort = () => reject(transaction.error);
        });
    }

    render() {
        this.current.textContent = selectedSoundFont?.name ?? "TimGM6mb";
    }

    loadEffects(effects) {
        for (const name of this.effectNames) this.form.elements[name].value = Math.round(effects[name] * 100);
    }

    async save(file) {
        if (this.switching || !this.form.reportValidity()) return;
        if (file && !await this.select(file, false)) return;
        try {
            const effects = Object.fromEntries(this.effectNames.map(name => [name, this.form.elements[name].valueAsNumber / 100]));
            await this.player.setSynthEffects(effects);
            try { localStorage.setItem(this.effectKey, JSON.stringify(effects)); } catch { /* Optional storage. */ }
            this.dialog.close();
        } catch (error) { this.error.textContent = error.message; }
    }

    async select(file, close = true) {
        if (file === undefined || this.switching) return;
        const submit = this.form.querySelector("[type=submit]");
        const controls = [submit, this.form.elements.useDefault, this.form.elements.cancelSynth];
        this.switching = true;
        for (const control of controls) control.disabled = true;
        const previous = selectedSoundFont;
        let applied = false;
        try {
            if (file && file.size > 16000000) throw new Error(t("SoundFontは16MB以下の .sf2 を選んでください。",
                "Choose an .sf2 SoundFont of up to 16 MB."));
            const next = file ? { name: file.name, soundfont: validateSoundFont(await file.arrayBuffer()) } : null;
            if (this.busy()) throw new Error(t("再生と音声書き出しを停止してから音源を切り替えてください。",
                "Stop playback or audio export before switching the SoundFont."));
            await this.stopPreview();
            this.player.setSoundFont(next);
            applied = true;
            if (next) await this.player.initialize(this.status);
            this.render();
            try { await this.store(next); }
            catch {
                this.error.textContent = t("音源を切り替えました。ブラウザが設定を保存できなかったため、このページを開いている間だけ使えます。",
                    "The SoundFont applies to this page. Browser storage could not save the selection.");
                return;
            }
            if (close) this.dialog.close();
            return true;
        } catch (error) {
            if (applied) this.player.setSoundFont(previous);
            this.error.textContent = error.message;
        } finally {
            this.switching = false;
            for (const control of controls) control.disabled = false;
        }
    }
}
