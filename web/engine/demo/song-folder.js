"use strict";

class SongFolderIO {
    constructor(editor, prepareMix) {
        this.editor = editor;
        this.prepareMix = prepareMix;
        this.dialog = document.querySelector("#song-folder-dialog");
        this.options = document.querySelector("#song-folder-files");
        this.openButton = document.querySelector("#open-song-folder");
        this.saveButton = document.querySelector("#overwrite-song-file");
        this.copyButton = document.querySelector("#save-as-song-file");
        this.openButton.onclick = () => this.openFolder();
        this.saveButton.onclick = () => this.save(true);
        this.copyButton.onclick = () => this.save(false);
        document.querySelector("#cancel-song-folder").onclick = () => this.dialog.close();
    }

    update(busy) {
        const available = typeof window.showDirectoryPicker === "function";
        busy ||= this.saving;
        this.openButton.hidden = this.saveButton.hidden = this.copyButton.hidden = !available;
        this.openButton.disabled = busy;
        this.copyButton.disabled = busy || !this.editor.project;
        this.saveButton.disabled = this.copyButton.disabled || this.active?.project !== this.editor.project;
    }

    async fileList(directory) {
        const files = new Map();
        for await (const handle of directory.values()) {
            if (handle.kind === "file") files.set(handle.name.toLowerCase(), handle);
        }
        return files;
    }

    async openFolder() {
        try {
            const directory = await window.showDirectoryPicker({ id: "jjazzlab-songs", mode: "read" });
            const files = await this.fileList(directory);
            const songs = [...files.values()].filter(handle => /\.sng$/iu.test(handle.name))
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            if (!songs.length) throw new Error(t("フォルダーに .sng がありません。", "The folder contains no .sng files."));
            this.options.replaceChildren(...songs.map(handle => new Option(handle.name, handle.name.toLowerCase())));
            document.querySelector("#song-folder-form").onsubmit = async event => {
                event.preventDefault();
                const song = files.get(this.options.value);
                const mix = files.get(song.name.slice(0, -4).toLowerCase() + ".mix");
                this.dialog.close();
                try {
                    const sources = await Promise.all([song, ...(mix ? [mix] : [])].map(handle => handle.getFile()));
                    if (!await this.editor.loadFiles(sources)) return;
                    this.active = { project: this.editor.project, directory, song, mix, sources };
                    this.update(false);
                    this.onOpen?.();
                } catch (error) { this.editor.notify(error.message, true); }
            };
            this.dialog.showModal();
        } catch (error) {
            if (error.name !== "AbortError") this.editor.notify(error.message, true);
        }
    }

    async save(overwrite) {
        const project = this.editor.project;
        const active = overwrite ? this.active : null;
        if (this.saving || !project || (overwrite && active?.project !== project)) return;
        this.saving = true;
        this.update(true);
        try {
            const directory = active?.directory ?? await window.showDirectoryPicker({ id: "jjazzlab-songs", mode: "readwrite" });
            if (active && await directory.requestPermission({ mode: "readwrite" }) !== "granted") return;
            const name = active?.song.name ?? await this.chooseCopyName();
            if (!name || this.editor.project !== project) return;
            const snapshot = await this.prepareMix();
            if (!snapshot || this.editor.project !== project) return;
            const openFiles = await this.fileList(directory);
            const mixName = active?.mix?.name ?? name.slice(0, -4) + ".mix";
            const expected = new Map((active?.sources ?? []).map(file => [file.name.toLowerCase(), file]));
            for (const filename of [name, mixName]) {
                const key = filename.toLowerCase();
                const existing = openFiles.get(key);
                const original = expected.get(key);
                if (existing) {
                    const current = await existing.getFile();
                    if (!original || current.lastModified !== original.lastModified || current.size !== original.size) {
                        throw new Error(t(`「${filename}」は既に存在するか、開いた後に変更されました。`,
                            `“${filename}” already exists or was changed after opening it.`));
                    }
                } else if (original) {
                    throw new Error(t(`「${filename}」は開いた後に移動または削除されました。`, `“${filename}” was moved or deleted after opening it.`));
                }
            }
            const song = await directory.getFileHandle(name, { create: true });
            const mix = await directory.getFileHandle(mixName, { create: true });
            const staged = [];
            try {
                for (const [handle, data] of [[song, snapshot.song], [mix, snapshot.mix]]) {
                    const stream = await handle.createWritable();
                    staged.push(stream);
                    await stream.write(data);
                }
            } catch (error) {
                await Promise.allSettled(staged.map(stream => stream.abort()));
                throw error;
            }
            const results = await Promise.allSettled(staged.map(stream => stream.close()));
            const failed = results.findIndex(result => result.status === "rejected");
            if (failed !== -1) throw new Error(t("曲とミックスの両方を書き込めませんでした。", "The song and mix could not both be saved."));
            const sources = await Promise.all([song.getFile(), mix.getFile()]);
            if (this.editor.project !== project) return;
            this.active = { project, directory, song, mix, sources };
            this.editor.openedMix = DesktopSongFiles.readMix(snapshot.mix);
            this.editor.notify(t(`${name} と ${mixName} を保存しました。`, `Saved ${name} and ${mixName}.`));
        } catch (error) {
            if (error.name !== "AbortError") this.editor.notify(error.message, true);
        } finally {
            this.saving = false;
            this.update(false);
        }
    }

    chooseCopyName() {
        const dialog = document.querySelector("#song-folder-save-dialog");
        const name = document.querySelector("#song-folder-save-name");
        const form = document.querySelector("#song-folder-save-form");
        name.value = this.editor.fileStem();
        name.setCustomValidity("");
        name.oninput = () => name.setCustomValidity("");
        document.querySelector("#cancel-song-folder-save").onclick = () => dialog.close();
        return new Promise(resolve => {
            dialog.addEventListener("close", () => resolve(null), { once: true });
            form.onsubmit = event => {
                event.preventDefault();
                const stem = name.value.trim().replace(/\.sng$/iu, "");
                if (!stem || /[\\/:*?"<>|\u0000-\u001f]|[. ]$/u.test(stem)) {
                    name.setCustomValidity(t("ファイル名を確認してください。", "Check the filename."));
                    name.reportValidity();
                    return;
                }
                resolve(stem + ".sng");
                dialog.close();
            };
            dialog.showModal();
            name.select();
        });
    }
}
