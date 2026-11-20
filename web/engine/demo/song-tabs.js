"use strict";

class SongTabs {
    constructor(editor, history, isBusy, newSong) {
        this.editor = editor;
        this.history = history;
        this.isBusy = isBusy;
        this.newSong = newSong;
        this.list = document.querySelector("#song-tabs");
        this.entries = [];
        this.restoring = true;
        try { this.startup = JSON.parse(localStorage.getItem("jjazzlab.openSongs") ?? "null"); }
        catch { this.startup = null; }
        document.querySelector("#close-current-song").onclick = () => this.close(this.active);
        document.querySelector("#save-all-songs").onclick = () => this.saveAll();
    }

    suspend(useSavedStyles) {
        if (!this.active || this.active.project !== this.editor.project) return;
        const { mix, unresolvedStyleMix, style, openedMix, undoStack, redoStack, styleParameters, selectedBar } = this.editor;
        Object.assign(this.active, { mix: unresolvedStyleMix ?? mix, style, useSavedStyles, view: { openedMix, undoStack, redoStack,
            styleParameters: new Map(styleParameters), selectedBar } });
        this.active.dirty = this.isDirty(this.active);
        if (this.active.placeholder && !this.active.dirty) this.entries = this.entries.filter(entry => entry !== this.active);
    }

    opened(useSavedStyles, placeholder) {
        const { project } = this.editor;
        this.active = this.entries.find(entry => entry.project === project || entry.id === this.history.id);
        if (this.active) this.active.project = project;
        else {
            this.active = { id: this.history.id, project, useSavedStyles, placeholder, saved: JSON.stringify(project),
                mixChanged: Boolean(this.history.reopeningRecord?.dirty) };
            this.entries.push(this.active);
        }
        this.refresh();
    }

    isDirty(entry) {
        if (!entry) return false;
        if (entry !== this.active) return Boolean(entry.dirty);
        return entry.mixChanged || JSON.stringify(entry.project) !== entry.saved;
    }

    saved() {
        if (!this.active || this.active.project !== this.editor.project) return;
        this.active.saved = JSON.stringify(this.active.project);
        this.active.mixChanged = false;
        this.active.placeholder = false;
        this.refresh();
    }

    mixEdited() {
        if (!this.active || this.active.project !== this.editor.project) return;
        this.active.mixChanged = true;
        this.refresh();
    }

    rememberSession() {
        if (this.restoring) return;
        const ids = this.entries.filter(entry => !entry.placeholder || this.isDirty(entry)).map(entry => entry.id);
        const session = JSON.stringify({ ids, current: this.active?.id });
        if (session === this.session) return;
        try { localStorage.setItem("jjazzlab.openSongs", session); this.session = session; }
        catch { /* Browser storage is optional. */ }
    }

    async restore() {
        try {
            const records = await this.history.records();
            for (const id of this.startup?.ids ?? []) {
                if (this.entries.some(entry => entry.id === id)) continue;
                const record = records.find(item => item.id === id);
                if (!record) continue;
                const { song: project, mix, style } = record.data;
                this.entries.push({ id, project, mix, style, useSavedStyles: true, saved: JSON.stringify(project),
                    dirty: Boolean(record.dirty), mixChanged: Boolean(record.dirty) });
            }
        } catch { /* The recent-song store may be unavailable. */ }
        finally { this.restoring = false; this.refresh(); }
    }

    activate(entry) {
        if (this.isBusy() || entry.project === this.editor.project) return;
        this.history.reopeningId = entry.id;
        this.editor.open(entry.project, entry.mix ?? [], entry.style, entry.useSavedStyles, entry.view);
        this.list.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
        this.afterActivate?.();
    }

    close(entry) {
        if (!entry || this.isBusy()) return;
        if (this.isDirty(entry) && !window.confirm(t(`「${entry.project.title}」には未保存の編集があります。曲を閉じますか？`,
            `“${entry.project.title}” has unsaved edits. Close the song?`))) return;
        const index = this.entries.indexOf(entry);
        this.entries.splice(index, 1);
        if (entry === this.active) {
            void this.history.flush();
            this.active = undefined;
            const next = this.entries[Math.min(index, this.entries.length - 1)];
            if (next) this.activate(next);
            else this.newSong();
        }
        this.refresh();
    }

    saveAll() {
        if (!this.entries.length || this.isBusy()) return;
        try {
            const files = this.entries.flatMap((entry, index) => {
                const data = entry.project === this.editor.project ? this.editor.webData()
                    : { song: entry.project, mix: entry.mix, style: entry.style };
                const stem = this.editor.fileStem(data.song.title);
                const directory = `${String(index + 1).padStart(2, "0")}-${stem}`;
                return this.editor.desktopFiles(data, stem).map(([name, contents]) => [`${directory}/${name}`, contents]);
            });
            downloadSongFile("JJazzLab-songs.zip", packageSongFiles(files), "application/zip");
            for (const entry of this.entries) {
                entry.saved = JSON.stringify(entry.project);
                entry.dirty = entry.mixChanged = false;
                entry.placeholder = false;
            }
            void this.history.clearUnsaved(this.entries.map(entry => entry.id));
            this.history.schedule();
            this.refresh();
            this.editor.notify(t(`${this.entries.length}曲をZIPに保存しました。`, `Saved ${this.entries.length} songs to a ZIP file.`));
        } catch (error) { this.editor.notify(error.message, true); }
    }

    refresh() {
        this.rememberSession();
        const busy = this.isBusy();
        const tabs = this.entries.map(entry => ({ id: entry.id, title: entry.project.title.trim() || t("無題", "Untitled"),
            active: this.editor.project === entry.project, dirty: this.isDirty(entry) }));
        const signature = JSON.stringify([document.documentElement.lang, tabs]);
        if (signature === this.signature) { this.updateBusy(); return; }
        this.signature = signature;
        this.list.replaceChildren(...tabs.map(({ title, active, dirty }, index) => {
            const entry = this.entries[index];
            const item = document.createElement("div");
            item.className = "song-tab";
            const open = this.editor.button(title, () => this.activate(entry));
            open.setAttribute("role", "tab");
            open.setAttribute("aria-selected", String(active));
            open.tabIndex = active ? 0 : -1;
            open.disabled = busy;
            if (dirty) {
                open.dataset.modified = "";
                open.title = t("未保存の編集", "Unsaved edits");
            }
            open.onkeydown = event => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const offset = event.key === "ArrowLeft" ? -1 : 1;
                const next = event.key === "Home" ? 0 : event.key === "End" ? this.entries.length - 1
                    : (index + offset + this.entries.length) % this.entries.length;
                this.activate(this.entries[next]);
            };
            const close = this.editor.button("×", () => this.close(entry));
            close.disabled = busy;
            close.setAttribute("aria-label", t(`「${entry.project.title}」を閉じる`, `Close “${entry.project.title}”`));
            item.append(open, close);
            return item;
        }));
        this.updateBusy();
    }

    updateBusy() {
        const busy = this.isBusy();
        document.querySelector("#close-current-song").disabled = !this.editor.project || !this.active || busy;
        document.querySelector("#save-all-songs").disabled = !this.entries.length || busy;
        for (const button of this.list.querySelectorAll("button")) button.disabled = busy;
    }
}
