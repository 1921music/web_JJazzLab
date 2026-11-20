"use strict";

const midiOutputModes = {
    gm: [0xf0, 0x7e, 0x7f, 0x09, 0x01, 0xf7],
    gm2: [0xf0, 0x7e, 0x7f, 0x09, 0x03, 0xf7],
    gs: [0xf0, 0x41, 0x10, 0x42, 0x12, 0x40, 0x00, 0x7f, 0x00, 0x41, 0xf7],
    xg: [0xf0, 0x43, 0x10, 0x4c, 0x00, 0x00, 0x7e, 0x00, 0xf7]
};

class MidiOutput {
    constructor(onDisconnect) {
        this.onDisconnect = onDisconnect;
        this.key = "jjazzlab.midiOutput";
        this.settings = { device: "", gmDrums: true, sendSetup: true, monitor: true, mode: "", delay: 0, drumMap: [] };
        try { Object.assign(this.settings, JSON.parse(localStorage.getItem(this.key) ?? "{}")); } catch { /* Optional storage. */ }
        if (!Array.isArray(this.settings.drumMap)) this.settings.drumMap = [];
        this.channels = new Set();
        this.dialog = document.querySelector("#midi-output");
        this.form = this.dialog.querySelector("form");
        this.status = this.dialog.querySelector("[role=status]");
        const { device, gmDrums, sendSetup, monitor, mode, delay, drumMap, connect, connectSysex, closeDialog } = this.form.elements;
        const range = { minimum: 0, maximum: 127 };
        document.querySelector("#open-midi-output").onclick = () => {
            for (const field of [gmDrums, sendSetup, monitor]) field.checked = Boolean(this.settings[field.name]);
            for (const field of [mode, delay]) field.value = this.settings[field.name];
            drumMap.value = this.settings.drumMap.map(([source, target]) => `${source}=${target}`).join("\n");
            this.show("");
            this.showDevices();
            this.dialog.showModal();
        };
        connect.onclick = () => this.connect(false);
        connectSysex.onclick = () => this.connect(true);
        closeDialog.onclick = () => this.dialog.close();
        this.form.onsubmit = event => {
            event.preventDefault();
            const map = [];
            for (const row of drumMap.value.trim().split(/\r?\n/u).filter(line => line.trim())) {
                const match = /^(\d{1,3})\s*=\s*(\d{1,3})$/u.exec(row.trim());
                const pair = match?.slice(1).map(Number);
                if (!pair?.every(value => value >= range.minimum && value <= range.maximum) || map.some(([source]) => source === pair[0])) {
                    this.show(t("打楽器のキーマップは 0～127 の番号を「36=35」の形式で入力し、元の番号を重複させないでください。",
                        "Use one drum key mapping per line, such as 36=35, with unique source numbers in the range 0–127."), true);
                    return;
                }
                map.push(pair);
            }
            if (mode.value && device.value && !this.access?.sysexEnabled) {
                this.show(t("選んだ初期化方式を使うには、SysExを許可して接続してください。",
                    "Connect with SysEx permission to use the selected initialization mode."), true);
                return;
            }
            this.silence(true);
            this.settings = { device: device.value, gmDrums: gmDrums.checked, sendSetup: sendSetup.checked,
                monitor: monitor.checked, mode: mode.value, delay: delay.valueAsNumber, drumMap: map };
            try { localStorage.setItem(this.key, JSON.stringify(this.settings)); } catch { /* Optional storage. */ }
            this.dialog.close();
        };
    }

    show(message, error = false) {
        this.status.textContent = message;
        this.status.toggleAttribute("data-error", error);
    }

    async connect(sysex) {
        if (typeof navigator.requestMIDIAccess !== "function") {
            this.show(t("このブラウザではMIDI出力を利用できません。", "MIDI output is unavailable in this browser."), true);
            return;
        }
        try {
            const access = await navigator.requestMIDIAccess({ sysex });
            if (this.access) this.access.onstatechange = null;
            this.access = access;
            access.onstatechange = () => {
                if (this.port?.state === "disconnected") {
                    this.silence(true);
                    this.onDisconnect();
                }
                if (this.dialog.open) this.showDevices(this.form.elements.device.value);
            };
            this.showDevices();
            this.show(sysex ? t("MIDI出力とSysExを許可しました。", "MIDI output and SysEx are available.")
                : t("MIDI出力を許可しました。", "MIDI output is available."));
        } catch (error) { this.show(error.message, true); }
    }

    showDevices(selected = this.settings.device) {
        const { device } = this.form.elements;
        const ports = Array.from(this.access?.outputs.values() ?? []).filter(port => port.state !== "disconnected");
        device.replaceChildren(new Option(t("出力なし", "No external output"), ""),
            ...ports.map(port => new Option(port.name || port.id, port.id)));
        if (selected && !ports.some(port => port.id === selected)) device.add(new Option(t("未接続の機器", "Disconnected device"), selected));
        device.value = selected;
    }

    async begin(reset) {
        const port = this.access?.outputs.get(this.settings.device);
        if (!port || port.state === "disconnected") return undefined;
        this.port = port;
        await port.open();
        if (this.port !== port) return undefined;
        this.readyAt = 0;
        const mode = reset && this.access.sysexEnabled && midiOutputModes[this.settings.mode];
        if (mode) {
            port.send(mode);
            this.readyAt = performance.now() + 60;
        }
        return this.settings;
    }

    emit(messages, clock) {
        const port = this.port;
        if (!port || port.state === "disconnected") return;
        const sync = clock.getOutputTimestamp?.();
        const now = performance.now();
        const base = sync?.performanceTime ? sync.performanceTime - sync.contextTime * 1000 : now - clock.currentTime * 1000;
        for (const { bytes, seconds } of messages) {
            this.channels.add(bytes[0] & 15);
            port.send(bytes, Math.max(this.readyAt, now, base + seconds * 1000 + this.settings.delay));
        }
    }

    silence(releasePort = false) {
        const port = this.port;
        if (port?.state === "connected") {
            try {
                port.clear();
                for (const channel of this.channels) {
                    port.send([0xb0 | channel, 64, 0]);
                    port.send([0xb0 | channel, 120, 0]);
                    port.send([0xb0 | channel, 123, 0]);
                }
            } catch { /* The device may disconnect during playback. */ }
        }
        this.channels.clear();
        if (releasePort) this.port = undefined;
    }
}
