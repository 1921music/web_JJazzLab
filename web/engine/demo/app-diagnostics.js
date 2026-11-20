"use strict";

class AppDiagnostics {
    constructor(build, getState) {
        const { source, ...buildDetails } = build;
        this.build = { ...buildDetails, sourceCommit: source?.commit, sourceDirty: source?.dirty };
        this.getState = getState;
        this.events = [];
        this.key = "jjazzlab.diagnosticLevel";
        this.level = "error";
        try {
            const level = localStorage.getItem(this.key);
            if (["off", "error", "info"].includes(level)) this.level = level;
        } catch { /* Optional storage. */ }
        this.dialog = document.querySelector("#app-diagnostics");
        this.details = this.dialog.querySelector("#diagnostic-report");
        if (source?.commit) {
            const revision = this.dialog.querySelector("#build-source-commit");
            revision.querySelector("code").textContent = source.commit;
            if (source.url) revision.href = source.url;
            this.dialog.querySelector("#build-source").hidden = false;
        }
        this.dialog.querySelector("#build-source-dirty").hidden = !source?.dirty;
        const level = this.dialog.querySelector("#diagnostics-level");
        level.value = this.level;
        level.onchange = () => {
            this.level = level.value;
            try { localStorage.setItem(this.key, this.level); } catch { /* Optional storage. */ }
            this.render();
        };
        document.querySelector("#open-app-diagnostics").onclick = () => {
            this.render();
            this.dialog.showModal();
        };
        this.dialog.querySelector("#save-diagnostics").onclick = () =>
            downloadSongFile("jjazzlab-web-diagnostics.json", JSON.stringify(this.report(), null, 2) + "\n", "application/json");
        this.dialog.querySelector("#clear-diagnostics").onclick = () => { this.events = []; this.render(); };
        this.dialog.querySelector("#close-diagnostics").onclick = () => this.dialog.close();
        window.addEventListener("error", () => this.record("browser-script-error"));
        window.addEventListener("unhandledrejection", () => this.record("unhandled-promise-rejection"));
    }

    record(event, severity = "error") {
        if (this.level === "off" || (severity === "info" && this.level !== "info")) return;
        this.events.push({ timestamp: new Date().toISOString(), severity, event });
        if (this.events.length > 100) this.events.shift();
        if (this.dialog.open) this.render();
    }

    report() {
        return {
            app: "JJazzLab Web",
            build: this.build,
            browser: { platform: navigator.userAgentData?.platform, userAgent: navigator.userAgent, language: document.documentElement.lang },
            capabilities: {
                secureContext: window.isSecureContext,
                webAssembly: typeof WebAssembly === "object",
                audioWorklet: typeof AudioWorkletNode === "function",
                webMidi: typeof navigator.requestMIDIAccess === "function",
                localFolderPicker: typeof window.showDirectoryPicker === "function",
                fullscreen: Boolean(document.fullscreenEnabled)
            },
            session: this.getState(),
            logging: { level: this.level, retainedEvents: this.events.length },
            events: this.events
        };
    }

    render() {
        this.details.textContent = JSON.stringify(this.report(), null, 2);
    }
}
