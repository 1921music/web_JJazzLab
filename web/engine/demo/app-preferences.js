"use strict";

class AppPreferences {
    constructor(canonicalize) {
        this.key = "jjazzlab.preferences";
        this.defaults = { theme: "dark", fontSize: 100, font: "system", restoreSongs: true, wheelChanges: true, aliases: [] };
        this.settings = { ...this.defaults };
        try { Object.assign(this.settings, JSON.parse(localStorage.getItem(this.key) ?? "{}")); } catch { /* Optional storage. */ }
        if (!Array.isArray(this.settings.aliases)) this.settings.aliases = [];
        this.canonicalize = canonicalize;
        this.dialog = document.querySelector("#app-preferences");
        this.form = this.dialog.querySelector("form");
        this.status = this.dialog.querySelector("[role=alert]");
        this.systemTheme = matchMedia("(prefers-color-scheme: light)");
        this.systemTheme.addEventListener("change", () => this.apply());
        this.apply();
        document.querySelector("#open-app-preferences").onclick = () => {
            this.loadForm(this.settings);
            this.status.textContent = "";
            this.dialog.showModal();
        };
        this.form.elements.cancelPreferences.onclick = () => this.dialog.close();
        this.form.elements.resetPreferences.onclick = () => this.loadForm(this.defaults);
        this.form.onsubmit = event => { event.preventDefault(); void this.save(); };
    }

    apply() {
        const { theme, font, fontSize } = this.settings;
        const root = document.documentElement;
        root.dataset.theme = theme === "system" ? (this.systemTheme.matches ? "light" : "dark") : theme;
        root.dataset.uiFont = font;
        root.style.setProperty("--ui-font-scale", String(fontSize / 100));
        this.aliases = new Map(this.settings.aliases);
    }

    loadForm(settings) {
        const { theme, font, fontSize, restoreSongs, wheelChanges, aliases } = this.form.elements;
        theme.value = settings.theme;
        font.value = settings.font;
        fontSize.value = settings.fontSize;
        restoreSongs.checked = settings.restoreSongs;
        wheelChanges.checked = settings.wheelChanges;
        aliases.value = settings.aliases.map(([alias, type]) => `C${alias}=C${type}`).join("\n");
    }

    async save() {
        const { theme, font, fontSize, restoreSongs, wheelChanges, aliases } = this.form.elements;
        const rows = aliases.value.split(/\r?\n/u).map(row => row.trim()).filter(Boolean);
        const pending = { theme: theme.value, font: font.value, fontSize: fontSize.valueAsNumber, restoreSongs: restoreSongs.checked,
            wheelChanges: wheelChanges.checked, aliases: [] };
        const submit = this.form.querySelector("[type=submit]");
        submit.disabled = true;
        this.status.textContent = "";
        try {
            for (const row of rows) {
                const match = /^C([^\s=/#b♭♯][^\s=/]*)\s*=\s*(C[^\s=/]*)$/u.exec(row);
                if (!match || /^(C#|Cb)/u.test(match[2]) || pending.aliases.some(([alias]) => alias === match[1])) {
                    throw new Error(t(`別名を「C△=CMaj7」の形式で重複なく入力してください（${row}）。`,
                        `Enter unique aliases in the form C△=CMaj7 (${row}).`));
                }
                const [, alias, target] = match;
                const canonical = await this.canonicalize(target);
                if (!canonical) throw new Error(t(`不明なコードタイプです（${target}）。`, `Unknown chord type (${target}).`));
                const existing = await this.canonicalize(`C${alias}`);
                if (existing && existing !== canonical) throw new Error(t(`既存のコードタイプを変更できません（C${alias}）。`,
                    `The alias C${alias} already means a different chord type.`));
                pending.aliases.push([alias, canonical.slice(1)]);
            }
            if (!this.dialog.open) return;
            this.settings = pending;
            this.apply();
            try { localStorage.setItem(this.key, JSON.stringify(pending)); } catch { /* Optional storage. */ }
            this.dialog.close();
        } catch (error) { this.status.textContent = error.message; }
        finally { submit.disabled = false; }
    }

    expandChord(symbol) {
        const match = /^([A-G](?:#|b)?)([^/]*)(\/.*)?$/u.exec(symbol);
        if (!match || !this.aliases.has(match[2])) return symbol;
        return match[1] + this.aliases.get(match[2]) + (match[3] ?? "");
    }
}
