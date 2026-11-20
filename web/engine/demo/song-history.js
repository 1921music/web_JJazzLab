"use strict";

class SongHistory {
    constructor(editor, afterOpen) {
        this.editor = editor;
        this.afterOpen = afterOpen;
        this.dialog = document.querySelector("#recent-songs");
        this.list = document.querySelector("#recent-song-list");
        this.status = document.querySelector("#recent-song-status");
        this.writes = Promise.resolve();
        this.lastUpdated = 0;
        this.sequence = 0;
        document.querySelector("#open-recent-songs").onclick = () => this.show();
        document.querySelector("#close-recent-songs").onclick = () => this.dialog.close();
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden" && this.timer) void this.flush();
        });
    }

    database() {
        this.connection ??= new Promise((resolve, reject) => {
            const request = indexedDB.open("jjazzlab-recent-songs", 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore("songs", { keyPath: "id" }).createIndex("updated", "updated");
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return this.connection;
    }

    async records() {
        const database = await this.database();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction("songs", "readonly");
            const request = transaction.objectStore("songs").getAll();
            request.onsuccess = () => resolve(request.result.sort((a, b) => b.updated - a.updated));
            request.onerror = () => reject(request.error);
        });
    }

    async store(record) {
        const database = await this.database();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction("songs", "readwrite");
            const store = transaction.objectStore("songs");
            store.put(record);
            let kept = 0;
            const request = store.index("updated").openKeyCursor(null, "prev");
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                if (++kept > 8) store.delete(cursor.primaryKey);
                cursor.continue();
            };
            transaction.oncomplete = () => resolve();
            transaction.onabort = () => reject(transaction.error);
        });
    }

    opened(remember) {
        this.current = this.editor.project;
        this.id = this.reopeningId ?? (crypto.randomUUID?.() ?? `${Date.now()}-${++this.sequence}`);
        this.reopeningId = undefined;
        if (remember) this.schedule();
    }

    schedule() {
        if (this.current !== this.editor.project) return;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => { void this.flush(); }, 100);
    }

    async flush() {
        if (!this.timer) return this.writes;
        clearTimeout(this.timer);
        this.timer = undefined;
        if (this.editor.project !== this.current) return this.writes;
        const data = structuredClone(this.editor.webData());
        const updated = this.lastUpdated = Math.max(Date.now(), this.lastUpdated + 1);
        const record = { id: this.id, updated, data };
        this.writes = this.writes.then(() => this.store(record)).catch(error => { this.writeError = error; });
        return this.writes;
    }

    reopen(record) {
        const { song, mix, style } = structuredClone(record.data);
        const project = DesktopSongFiles.validateSong(song);
        this.reopeningId = record.id;
        this.editor.open(project, mix ?? [], style, true);
        this.afterOpen();
    }

    async restore() {
        const initial = this.editor.project;
        try {
            const [latest] = await this.records();
            if (latest && this.editor.project === initial && !this.editor.fileRequest && !this.timer && !this.editor.undoStack.length) {
                this.reopen(latest);
            }
        } catch { /* Browser storage may be unavailable. */ }
    }

    async show() {
        this.status.textContent = t("最近の曲を読み込んでいます…", "Loading recent songs…");
        this.list.replaceChildren();
        this.dialog.showModal();
        try {
            await this.flush();
            const recent = await this.records();
            if (!this.dialog.open) return;
            const date = new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: "short", timeStyle: "short" });
            this.list.replaceChildren(...recent.map(record => {
                const item = document.createElement("li");
                const button = this.editor.button(record.data.song.title, () => {
                    try {
                        this.reopen(record);
                        this.dialog.close();
                    } catch (error) { this.status.textContent = error.message; }
                });
                const time = document.createElement("time");
                time.dateTime = new Date(record.updated).toISOString();
                time.textContent = date.format(record.updated);
                item.append(button, time);
                return item;
            }));
            this.status.textContent = recent.length ? "" : t("最近の曲はありません。", "There are no recent songs.");
            if (this.writeError) this.status.textContent = t("ブラウザーに保存できなかった編集があります。", "Some edits could not be stored in the browser.");
        } catch (error) { this.status.textContent = error.message; }
    }
}
