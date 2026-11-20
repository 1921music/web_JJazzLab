"use strict";

class AppDiagnostics {
    constructor(build, getState) {
        this.build = build;
        this.getState = getState;
        this.events = [];
        this.dialog = document.querySelector("#app-diagnostics");
        this.details = this.dialog.querySelector("pre");
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

    record(event) {
        this.events.push({ timestamp: new Date().toISOString(), event });
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
            events: this.events
        };
    }

    render() {
        this.details.textContent = JSON.stringify(this.report(), null, 2);
    }
}
