"use strict";

class RhythmLibrary {
    constructor({ readFile, describe, builtins }) {
        this.readFile = readFile;
        this.describe = describe;
        this.builtins = builtins;
        this.records = new Map();
        this.defaults = {};
        try { this.defaults = JSON.parse(localStorage.getItem("web-jjazzlab.default-rhythms") ?? "{}") ?? {}; } catch { /* Optional storage. */ }
        this.dialog = document.querySelector("#rhythm-library");
        this.list = this.dialog.querySelector("tbody");
        this.status = this.dialog.querySelector("#rhythm-library-status");
        this.meter = this.dialog.querySelector("#rhythm-default-meter");
        this.rhythm = this.dialog.querySelector("#rhythm-default-style");
        this.files = this.dialog.querySelector("#rhythm-library-files");
        this.folder = this.dialog.querySelector("#rhythm-library-folder");
        this.meter.replaceChildren(...Object.entries(DesktopSongFiles.meters).map(([id, [name]]) => new Option(name, id)));
        this.meter.value = "FOUR_FOUR";
        this.meter.onchange = () => this.renderDefaults();
        this.rhythm.onchange = () => this.setDefault();
        this.files.onchange = () => this.accept(this.files, false);
        this.folder.onchange = () => this.accept(this.folder, true);
        this.dialog.querySelector("#close-rhythm-library").onclick = () => this.dialog.close();
        document.querySelector("#show-rhythm-library").onclick = async () => {
            this.dialog.showModal();
            await this.ready;
            this.render();
            if (this.loadError) this.showStatus(this.loadError.message, true);
        };
        this.ready = this.load().catch(error => { this.loadError = error; });
    }

    database() {
        this.connection ??= new Promise((resolve, reject) => {
            const request = indexedDB.open("jjazzlab-rhythm-library", 1);
            request.onupgradeneeded = () => request.result.createObjectStore("styles", { keyPath: "id" });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return this.connection;
    }

    async load() {
        const database = await this.database();
        const records = await new Promise((resolve, reject) => {
            const request = database.transaction("styles").objectStore("styles").getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        this.records = new Map(records.map(record => [record.id, record]));
    }

    async update(added, removed) {
        const database = await this.database();
        await new Promise((resolve, reject) => {
            const transaction = database.transaction("styles", "readwrite");
            const store = transaction.objectStore("styles");
            transaction.oncomplete = resolve;
            transaction.onabort = () => reject(transaction.error);
            for (const id of removed) store.delete(id);
            for (const record of added) store.put(record);
        });
        for (const id of removed) this.records.delete(id);
        for (const record of added) this.records.set(record.id, record);
    }

    async accept(input, fromFolder) {
        const files = Array.from(input.files);
        input.value = "";
        if (!files.length) return;
        this.files.disabled = this.folder.disabled = true;
        this.showStatus(t("リズムを確認しています…", "Checking rhythms…"));
        const candidates = files.filter(file => /\.(sty|sst|prs|bcs|yjz)$/iu.test(file.name));
        const directory = file => file.webkitRelativePath.slice(0, file.webkitRelativePath.lastIndexOf("/") + 1);
        const added = new Map(), errors = [];
        try {
            await this.ready;
            for (const file of candidates) {
                try {
                    const pairedFiles = fromFolder && /\.yjz$/iu.test(file.name)
                        ? candidates.filter(candidate => directory(candidate) === directory(file)) : candidates;
                    const style = await this.readFile(file, pairedFiles);
                    const { meter } = await this.describe(style);
                    if (added.has(style.id)) throw new Error(t("同じ名前のリズムがあります。", "A rhythm with this name is already present."));
                    added.set(style.id, { ...style, meter, fromFolder });
                } catch (error) {
                    errors.push(`${file.name} — ${error.message}`);
                }
            }
            const removed = fromFolder ? [...this.records.values()].filter(record => record.fromFolder && !added.has(record.id)
                && !candidates.some(file => `${file.name}-ID` === record.id)).map(record => record.id) : [];
            await this.update([...added.values()], removed);
            this.render();
            this.showStatus(t(`${added.size}件のリズムを読み込みました。`, `Loaded ${added.size} rhythms.`)
                + (errors.length ? "\n" + errors.join("\n") : ""), Boolean(errors.length));
        } catch (error) {
            this.showStatus(error.message, true);
        } finally {
            this.files.disabled = this.folder.disabled = false;
        }
    }

    showStatus(message, error = false) {
        this.status.textContent = message;
        this.status.toggleAttribute("data-error", error);
    }

    defaultFor(meter) {
        const id = this.defaults[meter];
        const style = this.records.get(id) ?? this.builtins.find(entry => entry.id === id);
        return style?.meter === meter ? style : undefined;
    }

    setDefault() {
        const meter = this.meter.value;
        const id = this.rhythm.value;
        if (id) this.defaults[meter] = id;
        else delete this.defaults[meter];
        try {
            localStorage.setItem("web-jjazzlab.default-rhythms", JSON.stringify(this.defaults));
            this.showStatus(t("既定のリズムを保存しました。", "Saved the default rhythm."));
        } catch (error) {
            this.showStatus(error.message, true);
        }
    }

    renderDefaults() {
        const meter = this.meter.value;
        this.rhythm.replaceChildren(new Option(t("標準のリズム", "Factory default"), ""),
            ...[...new Map([...this.builtins, ...this.records.values()].map(record => [record.id, record])).values()]
                .filter(record => record.meter === meter).map(record => new Option(record.name, record.id)));
        this.rhythm.value = this.defaultFor(meter)?.id ?? "";
    }

    render() {
        this.list.replaceChildren();
        for (const record of [...this.records.values()].sort((a, b) => a.name.localeCompare(b.name))) {
            const row = this.list.insertRow();
            row.insertCell().textContent = record.name;
            row.insertCell().textContent = DesktopSongFiles.meters[record.meter]?.[0] ?? "—";
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "secondary";
            remove.textContent = t("削除");
            remove.onclick = async () => {
                try {
                    await this.update([], [record.id]);
                    this.render();
                    this.showStatus(t(`${record.name} をライブラリから削除しました。`, `Removed ${record.name} from the library.`));
                } catch (error) { this.showStatus(error.message, true); }
            };
            row.insertCell().append(remove);
        }
        this.renderDefaults();
    }
}
