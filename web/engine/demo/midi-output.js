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
        this.defaults = { gmDrums: true, sendSetup: true, monitor: true, thru: false, mode: "", delay: 0, drumMap: [], patchMap: [] };
        this.settings = { device: "", ...this.defaults, profiles: {} };
        try { Object.assign(this.settings, JSON.parse(localStorage.getItem(this.key) ?? "{}")); } catch { /* Optional storage. */ }
        if (!Array.isArray(this.settings.drumMap)) this.settings.drumMap = [];
        if (!Array.isArray(this.settings.patchMap)) this.settings.patchMap = [];
        if (this.settings.device && !this.settings.profiles?.[this.settings.device]) {
            const { device, profiles, ...profile } = this.settings;
            this.settings.profiles = { ...profiles, [device]: profile };
        }
        this.channels = new Set();
        this.heldNotes = new Map();
        this.sustainedChannels = new Set();
        this.dialog = document.querySelector("#midi-output");
        this.form = this.dialog.querySelector("form");
        this.status = this.dialog.querySelector("[role=status]");
        const { device, gmDrums, sendSetup, monitor, thru, mode, delay, drumMap, patchMap, connect, connectSysex, testOutput, closeDialog } = this.form.elements;
        const range = { minimum: 0, maximum: 127 };
        const showProfile = profile => {
            for (const field of [gmDrums, sendSetup, monitor, thru]) field.checked = Boolean(profile[field.name]);
            for (const field of [mode, delay]) field.value = profile[field.name];
            drumMap.value = profile.drumMap.map(([source, target]) => `${source}=${target}`).join("\n");
            patchMap.value = profile.patchMap.map(([key, msb, lsb, target]) =>
                `${key >= 128 ? "D" : ""}${key % 128}=${msb},${lsb},${target}`).join("\n");
        };
        document.querySelector("#open-midi-output").onclick = () => {
            showProfile(this.settings);
            this.show("");
            this.showDevices();
            this.dialog.showModal();
        };
        connect.onclick = () => this.connect(false);
        connectSysex.onclick = () => this.connect(true);
        device.onchange = () => showProfile({ ...this.defaults, ...this.settings.profiles?.[device.value] });
        testOutput.onclick = () => this.test(device.value);
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
            const patches = new Map();
            for (const row of patchMap.value.split(/\r?\n/u).filter(line => line.trim())) {
                const match = /^(D?)(\d{1,3})\s*=\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/iu.exec(row.trim());
                const values = match?.slice(2).map(Number);
                const key = values?.[0] + (match?.[1] ? 128 : 0);
                if (!values?.every(value => value <= 127) || patches.has(key)) {
                    this.show(t("音色は「33=0,1,35」またはドラムの「D0=0,0,8」の形式で、番号0～127を使い重複なく指定してください。",
                        "Use unique patch mappings like 33=0,1,35 or D0=0,0,8 for drums. Each number is 0–127."), true);
                    return;
                }
                patches.set(key, values.slice(1));
            }
            if (mode.value && device.value && !this.access?.sysexEnabled) {
                this.show(t("選んだ初期化方式を使うには、SysExを許可して接続してください。",
                    "Connect with SysEx permission to use the selected initialization mode."), true);
                return;
            }
            this.silence(true);
            this.releaseThru();
            const profile = { gmDrums: gmDrums.checked, sendSetup: sendSetup.checked,
                monitor: monitor.checked, thru: thru.checked, mode: mode.value, delay: delay.valueAsNumber, drumMap: map,
                patchMap: Array.from(patches, ([key, patch]) => [key, ...patch]) };
            this.settings = { device: device.value, ...profile, profiles: { ...this.settings.profiles, [device.value]: profile } };
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
            this.unsubscribe?.();
            this.access = access;
            const statechange = () => {
                if (this.thruPort?.state === "disconnected") this.releaseThru();
                if (this.port?.state === "disconnected") {
                    this.silence(true);
                    this.onDisconnect();
                }
                if (this.dialog.open) this.showDevices(this.form.elements.device.value);
            };
            access.addEventListener?.("statechange", statechange);
            this.unsubscribe = () => access.removeEventListener?.("statechange", statechange);
            this.showDevices(this.form.elements.device.value);
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

    async test(device) {
        const port = this.access?.outputs.get(device);
        if (!port || port.state === "disconnected") {
            this.show(t("テストするMIDI出力を選んでください。", "Choose a MIDI output to test."), true);
            return;
        }
        try {
            await port.open();
            const now = performance.now();
            [60, 64, 67].forEach((pitch, index) => {
                port.send([0x90, pitch, 82], now + index * 150);
                port.send([0x80, pitch, 0], now + index * 150 + 120);
            });
            this.show(t("テスト音を3音送りました。", "Sent three test notes."));
        } catch (error) { this.show(error.message, true); }
    }

    forward(bytes) {
        if (!this.settings.thru) return;
        const port = this.access?.outputs.get(this.settings.device);
        const [status, number, value] = bytes;
        if (!port || port.state === "disconnected" || status < 0x80 || status >= 0xf0) return;
        if (this.thruPort !== port) this.releaseThru();
        try {
            port.send(bytes);
            this.thruPort = port;
            const channel = status & 15;
            const command = status & 0xf0;
            const key = channel * 128 + number;
            if (command === 0x90 && value) this.heldNotes.set(key, [0x80 | channel, number, 0]);
            else if (command === 0x80 || command === 0x90) this.heldNotes.delete(key);
            else if (command === 0xb0 && number === 64) {
                if (value >= 64) this.sustainedChannels.add(channel);
                else this.sustainedChannels.delete(channel);
            }
        } catch (error) { this.show(error.message, true); }
    }

    releaseThru() {
        const port = this.thruPort;
        if (port?.state === "connected") {
            try {
                for (const channel of this.sustainedChannels) port.send([0xb0 | channel, 64, 0]);
                for (const note of this.heldNotes.values()) port.send(note);
            } catch { /* The device may disconnect before the release. */ }
        }
        this.thruPort = undefined;
        this.heldNotes.clear();
        this.sustainedChannels.clear();
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
