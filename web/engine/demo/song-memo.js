"use strict";

function memoLink(value, local) {
    const text = value.trim();
    const drivePath = local && /^[A-Z]:[\\/]/iu.test(text);
    const filePath = drivePath || local && text.startsWith("/");
    const encoded = filePath ? text.replaceAll("\\", "/").split("/").map((segment, index) =>
        index === 0 && drivePath ? segment : encodeURIComponent(segment)).join("/") : "";
    const url = new URL(filePath ? "file://" + (drivePath ? "/" : "") + encoded : text);
    if (local ? url.protocol !== "file:" || !url.pathname.slice(1) : !["https:", "http:"].includes(url.protocol))
        throw new Error(t("リンクの形式が正しくありません。", "Enter a valid link."));
    if (local) decodeURIComponent(url.pathname);
    return url;
}

class SongMemo {
    constructor(editor, folder) {
        this.editor = editor;
        this.folder = folder;
        this.boundFiles = new WeakMap();
        this.dialog = document.querySelector("#song-memo");
        this.text = this.dialog.querySelector("textarea");
        this.links = this.dialog.querySelector("#song-memo-links");
        this.status = this.dialog.querySelector("#song-memo-status");
        this.file = document.querySelector("#song-memo-local-file");
        this.file.onchange = () => {
            const file = this.file.files[0];
            this.file.value = "";
            if (!file || !this.pendingFile) return;
            const { url, project } = this.pendingFile;
            this.pendingFile = undefined;
            if (this.editor.project !== project) return;
            const label = decodeURIComponent(url.pathname.split("/").at(-1));
            if (file.name.toLowerCase() !== label.toLowerCase()) {
                this.status.textContent = t(`「${label}」を選択してください。`, `Choose “${label}”.`);
                return;
            }
            if (!this.boundFiles.has(project)) this.boundFiles.set(project, new Map());
            this.boundFiles.get(project).set(url.href, file);
            this.openFile(file);
        };
        this.text.oninput = () => this.renderLinks();
        document.querySelector("#open-song-memo").onclick = () => {
            if (!editor.project) return;
            this.text.value = editor.project.comments ?? "";
            this.status.textContent = "";
            this.renderLinks();
            this.dialog.showModal();
        };
        this.dialog.querySelector("#cancel-song-memo").onclick = () => this.dialog.close();
        this.dialog.querySelector("form").onsubmit = () => {
            if (this.text.value !== (editor.project.comments ?? "")) editor.editArrangement(() => { editor.project.comments = this.text.value; });
        };

        const insert = document.querySelector("#insert-memo-link");
        const form = insert.querySelector("form");
        const { linkType, address, testLink, cancelLink } = form.elements;
        const error = insert.querySelector("[role=alert]");
        const url = () => {
            error.textContent = "";
            try { return memoLink(address.value, linkType.value === "local"); }
            catch { error.textContent = t("リンクの形式が正しくありません。", "Enter a valid link."); }
        };
        this.dialog.querySelector("#open-memo-link-form").onclick = () => {
            form.reset();
            error.textContent = "";
            insert.showModal();
        };
        cancelLink.onclick = () => insert.close();
        testLink.onclick = () => {
            const link = url();
            if (link?.protocol === "file:") void this.openLocal(link);
            else if (link) window.open(link.href, "_blank", "noopener,noreferrer");
        };
        form.onsubmit = event => {
            event.preventDefault();
            const link = url();
            if (!link) return;
            this.text.value += (this.text.value && !this.text.value.endsWith("\n") ? "\n" : "") + link.href + " ";
            this.renderLinks();
            insert.close();
        };
    }

    renderLinks() {
        this.links.replaceChildren();
        const addresses = new Set(this.text.value.match(/\b(?:https?:\/\/|file:\/)[^\s<>"\])]+/giu) ?? []);
        for (const address of addresses) {
            let url;
            try { url = memoLink(address, /^file:/iu.test(address)); } catch { continue; }
            const item = document.createElement("li");
            if (url.protocol === "file:") {
                const button = document.createElement("button");
                button.className = "secondary";
                button.type = "button";
                button.textContent = url.href;
                button.onclick = () => this.openLocal(url);
                item.append(button);
            } else {
                const link = document.createElement("a");
                link.href = url.href;
                link.textContent = address;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                item.append(link);
            }
            this.links.append(item);
        }
        this.links.hidden = !this.links.children.length;
    }

    async openLocal(url) {
        const project = this.editor.project;
        const bound = this.boundFiles.get(project)?.get(url.href);
        if (bound) return this.openFile(bound);
        const directory = this.folder.active?.directory;
        if (directory && !url.hostname) {
            try {
                const pieces = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
                const root = pieces.findLastIndex(piece => piece.toLowerCase() === directory.name.toLowerCase());
                if (root >= 0 && pieces.length > root + 1) {
                    let handle = directory;
                    for (const name of pieces.slice(root + 1, -1)) handle = await handle.getDirectoryHandle(name);
                    const file = await (await handle.getFileHandle(pieces.at(-1))).getFile();
                    if (this.editor.project === project) this.openFile(file);
                    return;
                }
            } catch { /* The file can still be chosen individually. */ }
        }
        if (this.editor.project !== project) return;
        this.status.textContent = t("リンク先のファイルを選択してください。", "Choose the file for this local link.");
        this.pendingFile = { url, project };
        this.file.click();
    }

    openFile(file) {
        this.status.textContent = "";
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
