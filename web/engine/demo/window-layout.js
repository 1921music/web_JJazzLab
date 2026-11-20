"use strict";

class WindowLayout {
    constructor(workspace) {
        this.workspace = workspace;
        this.key = "jjazzlab.windowLayout";
        this.defaults = { mixerSide: "left", mixerWidth: 30, scoreHeight: 50 };
        this.settings = { ...this.defaults };
        try { Object.assign(this.settings, JSON.parse(localStorage.getItem(this.key) ?? "{}")); } catch { /* Optional storage. */ }
        this.apply();
        this.dialog = document.querySelector("#window-layout");
        this.form = this.dialog.querySelector("form");
        const { mixerSide, mixerWidth, scoreHeight, closeLayout } = this.form.elements;
        document.querySelector("#open-window-layout").onclick = () => {
            mixerSide.value = this.settings.mixerSide;
            mixerWidth.value = this.settings.mixerWidth;
            scoreHeight.value = this.settings.scoreHeight;
            this.dialog.showModal();
        };
        closeLayout.onclick = () => this.dialog.close();
        this.form.onsubmit = event => {
            event.preventDefault();
            this.settings = { mixerSide: mixerSide.value, mixerWidth: mixerWidth.valueAsNumber, scoreHeight: scoreHeight.valueAsNumber };
            this.apply();
            try { localStorage.setItem(this.key, JSON.stringify(this.settings)); } catch { /* Optional storage. */ }
            this.dialog.close();
        };
        document.querySelector("#reset-window-layout").onclick = () => {
            this.settings = { ...this.defaults };
            this.apply();
            try { localStorage.removeItem(this.key); } catch { /* Optional storage. */ }
            for (const toggle of workspace.querySelectorAll("#toggle-mixer, #toggle-structure")) {
                if (toggle.getAttribute("aria-pressed") === "false") toggle.click();
            }
        };
        const fullscreen = document.querySelector("#toggle-fullscreen");
        const status = document.querySelector("#fullscreen-status");
        fullscreen.disabled = !document.fullscreenEnabled;
        fullscreen.onclick = async () => {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
                status.textContent = "";
            } catch (error) { status.textContent = error.message; }
        };
        document.addEventListener("fullscreenchange", () => {
            fullscreen.setAttribute("aria-pressed", String(Boolean(document.fullscreenElement)));
        });
    }

    apply() {
        const { mixerSide, mixerWidth, scoreHeight } = this.settings;
        this.workspace.dataset.mixerSide = mixerSide;
        this.workspace.style.setProperty("--mixer-width", `${mixerWidth}%`);
        if (scoreHeight === this.defaults.scoreHeight) this.workspace.style.removeProperty("--score-height");
        else this.workspace.style.setProperty("--score-height", `${scoreHeight}vh`);
    }
}
