"use strict";

class YjzWizard {
    constructor({ choices, resolve, readFile, build, cleanName }) {
        this.dialog = document.querySelector("#yjz-wizard");
        this.form = this.dialog.querySelector("form");
        const { baseStyle, baseFile, title, phrases, includeIntros, includeFills, closeWizard } = this.form.elements;
        const lanes = ["mainA", "mainB", "mainC", "mainD"].map(name => this.form.elements[name]);
        const status = this.dialog.querySelector("[role=status]");
        const submit = this.form.querySelector('[type="submit"]');
        document.querySelector("#open-yjz-wizard").onclick = () => {
            const styles = Array.from(choices()).filter(([id]) => /\.(sty|sst|prs|bcs)-ID$/iu.test(id));
            baseStyle.replaceChildren(...styles.map(([id, name]) => new Option(name, id)));
            baseFile.value = "";
            title.value = "";
            status.textContent = "";
            this.dialog.showModal();
        };
        closeWizard.onclick = () => this.dialog.close();
        this.form.onsubmit = async event => {
            event.preventDefault();
            const file = baseFile.files[0];
            if (file && !/\.(sty|sst|prs|bcs)$/iu.test(file.name)) {
                status.textContent = t("元のYamahaスタイルを選択してください。", "Choose the original Yamaha style file.");
                return;
            }
            submit.disabled = true;
            status.textContent = t("スタイルを作成しています…", "Creating the style…");
            try {
                const style = file ? await readFile(file, [file]) : await resolve(baseStyle.value);
                if (!style || style.extension) throw new Error(t("元のYamahaスタイルを選択してください。", "Choose the original Yamaha style file."));
                const ext = style.name.split(".").at(-1).toLowerCase();
                const stem = cleanName(title.value.trim() || style.name.replace(/\.[^.]+$/u, "") + "-ext");
                const base = stem + "." + ext;
                const extension = await build(style, lanes.map(field => field.valueAsNumber), includeIntros.checked, includeFills.checked, phrases.valueAsNumber);
                if (!this.dialog.open) return;
                downloadSongFile(stem + ".zip", packageSongFiles([[base, new Uint8Array(style.bytes.buffer, style.bytes.byteOffset, style.bytes.byteLength)],
                    [stem + ".yjz", new Uint8Array(extension.buffer, extension.byteOffset, extension.byteLength)]]), "application/zip");
                status.textContent = t("元スタイルと .yjz をZIPに保存しました。", "Saved the base style and .yjz in a ZIP file.");
            } catch (error) {
                if (this.dialog.open) status.textContent = error.message;
            } finally { submit.disabled = false; }
        };
    }
}
