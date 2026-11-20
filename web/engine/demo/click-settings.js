"use strict";

const clickDefaults = Object.freeze({ highPitch: 37, lowPitch: 37, highVelocity: 120, lowVelocity: 90, channel: 9 });
const clickPercussionNames = [
    "Acoustic Bass Drum", "Bass Drum 1", "Side Stick", "Acoustic Snare", "Hand Clap", "Electric Snare",
    "Low Floor Tom", "Closed Hi-Hat", "High Floor Tom", "Pedal Hi-Hat", "Low Tom", "Open Hi-Hat",
    "Low-Mid Tom", "Hi-Mid Tom", "Crash Cymbal 1", "High Tom", "Ride Cymbal 1", "Chinese Cymbal",
    "Ride Bell", "Tambourine", "Splash Cymbal", "Cowbell", "Crash Cymbal 2", "Vibraslap", "Ride Cymbal 2",
    "Hi Bongo", "Low Bongo", "Mute Hi Conga", "Open Hi Conga", "Low Conga", "High Timbale", "Low Timbale",
    "High Agogo", "Low Agogo", "Cabasa", "Maracas", "Short Whistle", "Long Whistle", "Short Guiro",
    "Long Guiro", "Claves", "Hi Wood Block", "Low Wood Block", "Mute Cuica", "Open Cuica", "Mute Triangle", "Open Triangle"
];

class ClickSettings {
    constructor({ mix, preview, stopPreview, onChange }) {
        this.mix = mix;
        this.key = "jjazzlab.clickSettings";
        this.values = { ...clickDefaults };
        const ranges = { highPitch: [35, 81], lowPitch: [35, 81], highVelocity: [0, 127], lowVelocity: [0, 127], channel: [0, 15] };
        try {
            const saved = JSON.parse(localStorage.getItem(this.key) ?? "{}");
            for (const [key, [min, max]] of Object.entries(ranges)) {
                const value = saved?.[key];
                if (Number.isInteger(value) && value >= min && value <= max) this.values[key] = value;
            }
        } catch { /* Optional storage. */ }
        const dialog = document.querySelector("#click-settings");
        const form = dialog.querySelector("form");
        const status = dialog.querySelector("#click-settings-status");
        const readFields = () => Object.fromEntries(Object.keys(ranges).map(key => [key, Number(form.elements[key].value)]));
        const writeFields = values => {
            for (const key of Object.keys(ranges)) form.elements[key].value = values[key];
        };
        for (const key of ["highPitch", "lowPitch"]) {
            form.elements[key].replaceChildren(...clickPercussionNames.map((name, index) => new Option(`${index + 35} · ${name}`, index + 35)));
        }
        form.elements.channel.replaceChildren(...Array.from({ length: 16 }, (_, index) => new Option(index + 1, index)));
        document.querySelector("#open-click-settings").onclick = () => {
            writeFields(this.values);
            status.textContent = "";
            dialog.showModal();
        };
        form.elements.resetClick.onclick = () => writeFields(clickDefaults);
        form.elements.cancelClick.onclick = () => dialog.close();
        form.elements.previewClick.onclick = async () => {
            if (!form.reportValidity()) return;
            status.textContent = "";
            try { await preview(this.resolve(readFields()), () => dialog.open); }
            catch (error) { status.textContent = error.message; }
        };
        form.onsubmit = event => {
            event.preventDefault();
            this.values = readFields();
            try { localStorage.setItem(this.key, JSON.stringify(this.values)); } catch { /* Optional storage. */ }
            onChange(this.resolve());
            dialog.close();
        };
        dialog.addEventListener("close", stopPreview);
    }

    resolve(values = this.values) {
        const tracks = this.mix();
        const assigned = tracks.find(track => track.outputChannel === values.channel);
        const channel = assigned && !assigned.drum ? 9 : values.channel;
        const drums = tracks.find(track => track.outputChannel === channel && track.drum);
        return { ...values, channel, program: drums?.instrumentChoice?.program ?? drums?.program ?? 0 };
    }
}
