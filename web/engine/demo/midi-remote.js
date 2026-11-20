"use strict";

class MidiRemote {
    constructor(actions, prepareAudio) {
        this.actions = actions;
        this.prepareAudio = prepareAudio;
        this.defaults = Object.fromEntries(actions.map(({ id, note }) => [id, note === undefined ? null : `note:0:${note}`]));
        this.bindings = { ...this.defaults };
        this.controllers = new Map();
        this.inputId = null;
        this.key = "jjazzlab.midiRemote";
        try {
            const saved = JSON.parse(localStorage.getItem(this.key) ?? "{}");
            this.inputId = typeof saved.input === "string" ? saved.input : null;
            for (const id of Object.keys(this.defaults)) {
                const binding = saved.bindings?.[id];
                if (binding === null || /^(note|cc|program):(?:[0-9]|1[0-5]):(?:[0-9]|[1-9][0-9]|1[01][0-9]|12[0-7])$/u.test(binding)) {
                    this.bindings[id] = binding;
                }
            }
        } catch { /* Optional storage. */ }
        this.dialog = document.querySelector("#midi-remote");
        this.rows = this.dialog.querySelector("tbody");
        this.status = this.dialog.querySelector("#midi-remote-status");
        this.devices = this.dialog.querySelector("#midi-remote-device");
        this.connectButton = this.dialog.querySelector("#midi-remote-connect");
        this.enabled = this.dialog.querySelector("#midi-remote-enabled");
        this.enabled.onchange = () => { this.controllers.clear(); };
        this.connectButton.onclick = () => this.connect();
        this.devices.onchange = () => {
            this.inputId = this.devices.value;
            this.selectInput();
            this.store();
        };
        this.dialog.querySelector("#midi-remote-defaults").onclick = () => {
            this.learning = undefined;
            this.bindings = { ...this.defaults };
            this.store();
            this.render();
        };
        this.dialog.querySelector("#close-midi-remote").onclick = () => this.dialog.close();
        this.dialog.addEventListener("close", () => { this.learning = undefined; });
        document.querySelector("#open-midi-remote").onclick = () => {
            this.show(t("接続してMIDI入力を選んでください。", "Connect to choose a MIDI input."));
            if (this.access) this.updateDevices();
            this.render();
            this.dialog.showModal();
        };
    }

    show(message, error = false) {
        this.status.textContent = message;
        this.status.toggleAttribute("data-error", error);
    }

    store() {
        try { localStorage.setItem(this.key, JSON.stringify({ input: this.inputId, bindings: this.bindings })); } catch { /* Optional storage. */ }
    }

    async connect() {
        if (typeof navigator.requestMIDIAccess !== "function") {
            this.show(t("このブラウザではMIDI入力を利用できません。", "MIDI input is unavailable in this browser."), true);
            return;
        }
        this.connectButton.disabled = true;
        try {
            this.prepareAudio?.();
            this.access ??= await navigator.requestMIDIAccess({ sysex: false });
            this.access.onstatechange = () => this.updateDevices();
            this.updateDevices();
        } catch (error) {
            this.show(t("MIDI入力を開けませんでした。", "Could not open MIDI input.") + " " + error.message, true);
        } finally {
            this.connectButton.disabled = false;
        }
    }

    updateDevices() {
        const inputs = Array.from(this.access.inputs.values()).filter(input => input.state !== "disconnected");
        this.devices.replaceChildren(new Option(t("入力なし", "No input"), ""),
            ...inputs.map(input => new Option(input.name || input.id, input.id)));
        if (this.inputId === null && inputs.length === 1) this.inputId = inputs[0].id;
        this.devices.value = inputs.some(input => input.id === this.inputId) ? this.inputId : "";
        this.devices.disabled = !inputs.length;
        this.selectInput();
    }

    selectInput() {
        const next = this.access.inputs.get(this.devices.value);
        if (next !== this.input) {
            if (this.input) this.input.onmidimessage = null;
            this.input = next;
            this.controllers.clear();
            this.onDeviceChange?.(next);
            if (next) next.onmidimessage = event => this.receive(event.data);
        }
        this.show(next ? t(`${next.name || next.id} から入力中。`, `Listening to ${next.name || next.id}.`)
            : t("MIDI入力を選んでください。", "Choose a MIDI input."));
    }

    receive(bytes) {
        if (this.onRawMessage?.(bytes)) return;
        const [status, number, value] = bytes;
        const channel = status & 15;
        const command = status & 0xf0;
        let binding;
        if (!Number.isInteger(number)) return;
        if (command === 0x90 && value) binding = `note:${channel}:${number}`;
        else if (command === 0xc0) binding = `program:${channel}:${number}`;
        else if (command === 0xb0 && Number.isInteger(value)) {
            const key = `cc:${channel}:${number}`;
            const pressed = value >= 64;
            if (pressed && !this.controllers.get(key)) binding = key;
            this.controllers.set(key, pressed);
        }
        if (!binding) return;
        if (this.learning && this.dialog.open) {
            const existing = Object.keys(this.bindings).find(id => this.bindings[id] === binding);
            if (existing) this.bindings[existing] = null;
            this.bindings[this.learning] = binding;
            this.learning = undefined;
            this.store();
            this.render();
            this.show(t("割り当てを保存しました。", "Saved the binding."));
        } else if (this.enabled.checked && !this.dialog.open) {
            this.actions.find(action => this.bindings[action.id] === binding)?.run();
        }
    }

    render() {
        this.rows.replaceChildren();
        for (const action of this.actions) {
            const row = this.rows.insertRow();
            row.insertCell().textContent = t(action.japanese, action.english);
            const binding = this.bindings[action.id];
            if (binding) {
                const [type, channel, number] = binding.split(":");
                const label = { note: t("ノート", "Note"), cc: "CC", program: t("プログラム", "Program change") }[type];
                row.insertCell().textContent = `CH ${Number(channel) + 1} · ${label} ${number}`;
            } else row.insertCell().textContent = "—";
            const cell = row.insertCell();
            const learn = document.createElement("button");
            learn.className = "secondary";
            learn.type = "button";
            learn.textContent = t("学習", "Learn");
            learn.setAttribute("aria-pressed", String(this.learning === action.id));
            learn.onclick = () => {
                this.learning = action.id;
                this.render();
                this.show(t("鍵盤のキーかペダルを操作してください。", "Play a key or press a pedal."));
            };
            const remove = document.createElement("button");
            remove.className = "secondary";
            remove.type = "button";
            remove.textContent = t("解除", "Clear");
            remove.disabled = !binding;
            remove.onclick = () => {
                this.learning = undefined;
                this.bindings[action.id] = null;
                this.store();
                this.render();
            };
            cell.append(learn, remove);
        }
    }
}
