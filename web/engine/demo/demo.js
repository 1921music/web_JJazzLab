"use strict";

const form = document.querySelector("#midi-form");
const options = document.querySelector("#options");
const chordInput = document.querySelector("#chords");
const styleInput = document.querySelector("#style");
const bundledExtension = document.querySelector("#bundled-extension");
const extendedVariation = document.querySelector("#extended-variation");
const extendedVariationField = document.querySelector("#extended-variation-field");
for (const name of Object.keys(embeddedExtendedStyles)) bundledExtension.add(new Option(name, name));
const tempoInput = document.querySelector("#tempo");
const rhythmEngine = document.querySelector("#rhythm-engine");
const swingBass = document.querySelector("#swing-bass");
const swingDrums = document.querySelector("#swing-drums");
const swingVariation = document.querySelector("#swing-variation");
const status = document.querySelector("#status");
const download = document.querySelector("#download");
const bundledStyle = "8Beat.T160.STY";
const bundledJazzWaltz = "JazzWaltzMed.S351.sst";
const bundledStyles = new Map([[bundledStyle, embeddedStyle], [bundledJazzWaltz, embeddedJazzWaltz], ["DiscoHouse.S145.prs", embeddedDiscoHouse]]);
const builtinRhythms = ["jjSwing", ...bundledStyles.keys()].map(name => ({
    id: `${name}-ID`, name, meter: name === bundledJazzWaltz ? "THREE_FOUR" : "FOUR_FOUR"
}));
const stylePackUrl = "https://raw.githubusercontent.com/1921music/web_JJazzLab/923ed5dd8b6d426722bacdd951b268a049a6638a/web/engine/demo/assets/jjazzlab_user_styles.zip";
const loadStylePackButton = document.querySelector("#load-style-pack");
const stylePackStatus = document.querySelector("#style-pack-status");
const libraryStyle = document.querySelector("#library-style");
const styleCategory = document.querySelector("#style-category");
const styleSearch = document.querySelector("#style-search");
let styleArchive;
let selectedLibraryStyle;
let loadingStylePack = false;
// Tested failures in the published collection. Match the CRC as well as the
// filename so a repaired upstream file automatically becomes selectable.
const knownStyleIssues = new Map([
    ["J-PopHit1_TyPrems.S851.STY:942392629", "元ファイルのMIDIデータが不正です。"],
    ["JazzBluesSimple.S740.sty:66474411", "元ファイルのMIDIデータが不正です。"],
    ["JazzGtrTrio184 9K.s460.sty:2366308981", "元ファイルに空のスタイル区間があり、エンジンが読み込めません。"]
]);
const styleIssue = entry => knownStyleIssues.get(`${entry.name}:${entry.crc}`);

let engine, engineLoad;
let downloadUrl;

function showStylePackStatus(message, error = false) {
    localizedText(stylePackStatus, message);
    stylePackStatus.toggleAttribute("data-error", error);
}

function renderStyleChoices() {
    const words = styleSearch.value.normalize("NFKC").toLowerCase().split(/\s+/u).filter(Boolean);
    const entries = styleArchive.entries.filter(entry => (!styleCategory.value || entry.category === styleCategory.value)
        && words.every(word => `${entry.category} ${entry.name}`.normalize("NFKC").toLowerCase().includes(word)));
    libraryStyle.replaceChildren();
    const option = (value, text) => { const node = document.createElement("option"); node.value = value; node.textContent = text; return node; };
    libraryStyle.append(option("", t("選択なし（ファイルまたは8Beat）")));
    if (selectedLibraryStyle && !entries.includes(selectedLibraryStyle)) {
        const name = `${selectedLibraryStyle.category} / ${selectedLibraryStyle.name}`;
        libraryStyle.append(option(selectedLibraryStyle.path, t(`選択中: ${name}`, `Selected: ${name}`)));
    }
    let group;
    for (const entry of entries) {
        if (!group || group.label !== entry.category) {
            group = document.createElement("optgroup"); group.label = entry.category; libraryStyle.append(group);
        }
        const item = option(entry.path, entry.name + (styleIssue(entry) ? t("（利用不可）") : ""));
        item.disabled = Boolean(styleIssue(entry)); item.title = t(styleIssue(entry) || entry.name);
        group.append(item);
    }
    libraryStyle.value = selectedLibraryStyle?.path || "";
    const available = entries.filter(entry => !styleIssue(entry)).length;
    localizedText(document.querySelector("#style-count"), `（${available}件利用可 / 表示${entries.length}件）`, `(${available} available / ${entries.length} shown)`);
}

async function loadStylePack() {
    if (loadingStylePack || styleArchive) return;
    loadingStylePack = true; loadStylePackButton.disabled = true;
    showStylePackStatus("公開スタイル集を取得しています…");
    try {
        styleArchive = await fetchStyleArchive(stylePackUrl, (bytes, total) => {
            showStylePackStatus(total ? `公開スタイル集を取得しています… ${Math.min(100, Math.round(bytes / total * 100))}%` : `公開スタイル集を取得しています… ${(bytes / 1024 / 1024).toFixed(1)}MB`);
        });
        const categories = [...new Set(styleArchive.entries.map(entry => entry.category))];
        for (const category of categories) {
            const option = document.createElement("option"); option.value = option.textContent = category; styleCategory.append(option);
        }
        renderStyleChoices(); document.querySelector("#style-library").hidden = false;
        localizedText(loadStylePackButton, "公開スタイル集を読み込み済み");
        const available = styleArchive.entries.filter(entry => !styleIssue(entry)).length;
        showStylePackStatus(`${styleArchive.entries.length}件を読み込みました（${available}件利用可）。ページを開いている間は再取得しません。`);
        libraryStyle.focus();
    } catch (error) {
        localizedText(loadStylePackButton, "公開スタイル集を再試行");
        showStylePackStatus(error.message, true);
    } finally { loadingStylePack = false; loadStylePackButton.disabled = Boolean(styleArchive); }
}
loadStylePackButton.addEventListener("click", loadStylePack);

styleSearch.addEventListener("input", () => { if (styleArchive) renderStyleChoices(); });
styleCategory.addEventListener("change", () => { if (styleArchive) renderStyleChoices(); });
libraryStyle.addEventListener("change", () => {
    const selected = styleArchive.entries.find(entry => entry.path === libraryStyle.value);
    if (selected && styleIssue(selected)) { showStylePackStatus(styleIssue(selected), true); renderStyleChoices(); return; }
    selectedLibraryStyle = selected;
    if (selectedLibraryStyle) {
        styleInput.value = ""; bundledExtension.value = "";
        rhythmEngine.value = "yamaha";
        rhythmEngine.dispatchEvent(new Event("change"));
    }
    extendedVariationField.hidden = true;
    accompanimentDirty = true;
    if (song) showStatus("次回の再生から変更を反映します。");
});
styleInput.addEventListener("change", () => {
    selectedLibraryStyle = undefined; libraryStyle.value = ""; bundledExtension.value = "";
    extendedVariationField.hidden = true;
});
bundledExtension.addEventListener("change", () => {
    if (bundledExtension.value) {
        selectedLibraryStyle = undefined; libraryStyle.value = ""; styleInput.value = "";
        rhythmEngine.value = "yamaha";
        rhythmEngine.dispatchEvent(new Event("change"));
    }
    extendedVariationField.hidden = true;
});

rhythmEngine.addEventListener("change", () => {
    const swing = rhythmEngine.value === "jjswing";
    document.querySelector("#swing-settings").hidden = !swing || Boolean(editor.project);
    document.querySelector("#style-field").hidden = swing;
    styleInput.disabled = swing;
    if (swing || editor.project) extendedVariationField.hidden = true;
    tempoInput.placeholder = swing ? "120" : t("スタイルの既定値");
});
let song;
let generating = false;
let starting = false;
let playing = false;
let paused = false;
let accompanimentDirty = true;
let liveArrangement, liveTimer, liveVersion = 0, liveEngine;
const liveCandidates = new Map();
let playbackBar = 1;
let playbackFraction = 0;
let mixerParts = [];
let generatedMidi;
let renderedTempo = 0, tempoDirty = false;

function playbackTempoRate() {
    const tempo = tempoInput.valueAsNumber;
    return renderedTempo && tempoInput.validity.valid && Number.isFinite(tempo) ? tempo / renderedTempo : 1;
}
const savedMix = new Map();
const playButton = document.querySelector("#play");
const stopButton = document.querySelector("#stop");
const pauseButton = document.querySelector("#pause");
const previousPart = document.querySelector("#previous-part");
const nextPart = document.querySelector("#next-part");
const toggleLoop = document.querySelector("#toggle-loop");
const metronome = document.querySelector("#metronome");
const precount = document.querySelector("#precount");
const precountMode = document.querySelector("#precount-mode");
try {
    const storedMode = localStorage.getItem("jjazzlab.precountMode");
    if (["1", "2", "auto"].includes(storedMode)) precountMode.value = storedMode;
} catch { /* Preference storage is optional. */ }
precountMode.onchange = () => {
    try { localStorage.setItem("jjazzlab.precountMode", precountMode.value); } catch { /* Preference storage is optional. */ }
};
const showPoint = document.querySelector("#show-playback-point");
const playhead = document.querySelector("#position");
const structureToggle = document.querySelector("#toggle-structure");
const menus = [...document.querySelectorAll(".app-menu details, .mixer-menu details")];
const generateButton = document.querySelector("#generate");
const workspace = document.querySelector("#workspace");
const mixer = document.querySelector("#mixer");
const toggleMixer = document.querySelector("#toggle-mixer");
const mixerRhythm = document.querySelector("#mixer-rhythm");
const prepareMixer = document.querySelector("#prepare-mixer");
let selectedMixerRhythm = "";
const quickMode = document.querySelector("#quick-mode");
const generationControls = document.querySelector("#generation-controls");
const muteAll = document.querySelector("#mute-all");
const clearSolo = document.querySelector("#clear-solo");
const saveMix = document.querySelector("#save-mix");
const reloadSongMix = document.querySelector("#reload-song-mix");
const restoreFactoryMix = document.querySelector("#restore-factory-mix");
const saveRhythmMix = document.querySelector("#save-rhythm-mix");
const loadRhythmMix = document.querySelector("#load-rhythm-mix");
const rhythmMixPreference = "jjazzlab.rhythmMixes";
const channelEditor = document.querySelector("#channel-editor");
const mixerContext = document.querySelector("#mixer-context");
const channelInstrument = document.querySelector("#channel-instrument");
const channelEffects = [
    { key: "reverb", label: "リバーブ", controller: 91 },
    { key: "chorus", label: "コーラス", controller: 93 }
];
let mixerInstruments = [];
let usesDesktopSoundFont = false;
const loopEnabled = document.querySelector("#loop-enabled");
try {
    const storedLoop = localStorage.getItem("jjazzlab.loop");
    if (storedLoop !== null) loopEnabled.checked = storedLoop === "true";
} catch { /* Preference storage is optional. */ }
toggleLoop.setAttribute("aria-pressed", String(loopEnabled.checked));
const loopStart = document.querySelector("#loop-start");
const loopEnd = document.querySelector("#loop-end");
const masterInput = document.querySelector("#master");
const playStatus = document.querySelector("#play-status");
const loopStatus = document.querySelector("#loop-status");
const player = new AccompanimentPlayer(updatePosition, (message) => {
    player.stopMidi();
    paused = playing = false; starting = false; updateButtons(); showPlayStatus(message, true);
});
let pendingAudition = Promise.resolve();
let auditionRequest = 0;
const clickSettings = new ClickSettings({
    mix: () => instrumentDefaults.playbackMix(mixerParts),
    stopPreview: stopAudition,
    preview: async (settings, active) => {
        if (playing || paused || starting || generating) throw new Error(t("再生を停止してから試聴してください。", "Stop playback before previewing."));
        const notes = [
            { pitch: settings.highPitch, velocity: settings.highVelocity, position: 0, duration: .5 },
            { pitch: settings.lowPitch, velocity: settings.lowVelocity, position: 1, duration: .5 }
        ].filter(note => note.velocity);
        if (notes.length) await queueAudition(notes, true, settings.program, 120, active, { start: 0, end: 2 });
    },
    onChange: settings => {
        if (player.ready && player.loadedSong && !player.previewing) {
            player.send("click-settings", { settings }).catch(error => showPlayStatus(error.message, true));
        }
    }
});

function updateButtons() {
    generateButton.disabled = tempoInput.disabled = generating || starting;
    document.querySelector("#new-project").disabled = document.querySelector("#open-project-button").disabled
        = document.querySelector("#open-project").disabled = quickMode.disabled = generating || starting;
    playButton.disabled = generating || starting || playing;
    stopButton.disabled = generating || starting || (!playing && !paused && playbackBar === 1);
    pianoRoll.auditionButton.disabled = generating || starting || playing || paused;
    pianoRoll.soloButton.disabled = generating || starting;
    pauseButton.disabled = generating || starting || !playing;
    playButton.setAttribute("aria-pressed", String(playing));
    stopButton.setAttribute("aria-pressed", String(!playing && !paused));
    pauseButton.setAttribute("aria-pressed", String(paused));
    previousPart.disabled = generating || starting || !editor.project || playbackBar <= 1;
    nextPart.disabled = generating || starting || !editor.project || !editor.partRanges().some(range => range.from > playbackBar);
    previousPart.disabled ||= quickMode.getAttribute("aria-pressed") === "true";
    editor.exportButton.disabled = document.querySelector("#save-project").disabled = !editor.project || starting || generating;
    document.querySelector("#open-song-print").disabled = !editor.project || generating || starting;
    document.querySelector("#open-midi-output").disabled = generating || starting || playing || paused;
    document.querySelector("#open-recent-songs").disabled = generating || starting;
    songTabs.updateBusy();
    folderIO.update(generating || starting);
    for (const id of ["duplicate-song", "linearize-song", "save-song-template", "clear-song-template"]) {
        document.getElementById(id).disabled = !editor.project || starting || generating;
    }
    structureToggle.disabled = !editor.project;
    document.querySelector("#add-user-track").disabled = !editor.project || generating || starting;
    document.querySelector("#open-song-memo").disabled = !editor.project || generating || starting;
    document.querySelector("#open-chord-inspector").disabled = !editor.project || generating || starting;
    document.querySelector("#toggle-reader").disabled = !editor.project;
    document.querySelector("#create-practice-song").disabled = !editor.project || generating || starting;
    editor.updateUndo();
    editor.undoButton.disabled ||= generating || starting;
    editor.redoButton.disabled ||= generating || starting;
    updateMixerButtons();
    document.querySelector("#loop-controls").disabled = !song || starting || generating;
    updateMenus();
}

function updateMenus() {
    for (const button of document.querySelectorAll("[data-score-resize]")) button.disabled = !editor.project || generating || starting;
    for (const button of document.querySelectorAll("[data-audio-export]")) button.disabled = generating || starting || exportingAudio;
    for (const button of document.querySelectorAll("[data-command]")) {
        const action = document.getElementById(button.dataset.command);
        if (action === download) { button.disabled = generating || starting; continue; }
        button.disabled = action.disabled || action.hidden || Boolean(action.closest("[inert]"))
            || (!editor.project && action.closest("#song-editor") !== null);
    }
}

function showPlayStatus(message, error = false) {
    localizedText(playStatus, message);
    playStatus.toggleAttribute("data-error", error);
}

function updatePosition(position) {
    if (!song) return;
    playing = position.playing;
    paused = Boolean(position.paused);
    if (!playing && !paused) player.stopMidi();
    let bar = song.barTimes.findIndex(time => time > position.seconds);
    if (bar < 0) bar = song.barTimes.length - 1;
    const beat = song.beatTimes.findLast(beat => beat.seconds <= position.seconds + .00002);
    displayPosition(Math.max(1, bar), beat?.bar === bar ? beat.beat : 1, position.seconds);
    if (editor.project) editor.showPlayingBar((playing || paused) && showPoint.getAttribute("aria-pressed") === "true" ? bar : 0);
    const from = song.barTimes[bar - 1], to = song.barTimes[bar];
    playbackFraction = Math.max(0, Math.min(1, (position.seconds - from) / (to - from)));
    pianoRoll.position(bar, playbackFraction, playing || paused);
    updateReader(bar, playbackFraction);
    updateButtons();
    showPlayStatus(paused ? "一時停止中" : position.counting ? "カウントイン" : playing ? "演奏中" : "停止中");
}

function displayPosition(bar = 1, beat = 1, seconds = 0) {
    playbackBar = bar;
    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(Math.floor(seconds % 60)).padStart(2, "0");
    playhead.textContent = `${String(bar).padStart(3, "0")}:${beat} ${mins}m${secs}s`;
}

function readLoop() {
    const start = loopStart.valueAsNumber, end = loopEnd.valueAsNumber;
    const bars = song.barTimes.length - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > bars)
        throw new Error(t(`ループ範囲は1〜${bars}小節で、開始≦終了にしてください。`, `Use bars 1–${bars}, with the first bar no later than the last.`));
    const restart = song.restartBars?.find(bar => bar >= start && bar <= end) ?? start;
    return { enabled: loopEnabled.checked, start: song.barTimes[start - 1], end: song.barTimes[end], restart: song.barTimes[restart - 1] };
}

function applyMix() {
    if (activeProject === editor.project && editor.baseMix) {
        const before = JSON.stringify(editor.unresolvedStyleMix ?? editor.mix);
        const limit = value => Math.max(0, Math.min(127, Math.round(value)));
        editor.mix = editor.mix.map(track => {
            const base = editor.baseMix.find(item => item.rhythmId === track.rhythmId && item.name === track.name);
            if (!base) return track;
            const part = mixerParts.find(part => part.channel === base.channel);
            if (!part) return track;
            const instrument = part.instrumentChoice;
            if (part.outputChannel !== (track.sourceChannel ?? track.channel) || part.transpose !== track.transpose
                    || part.velocityShift !== track.velocityShift || part.instrumentEnabled !== track.instrumentEnabled
                    || part.volumeEnabled !== track.volumeEnabled || part.panEnabled !== track.panEnabled) {
                accompanimentDirty = true;
            }
            return { ...base, volume: limit(base.volume * part.volume), pan: limit(base.pan + part.pan * 64), mute: part.mute,
                ...(instrument ? { patch: instrument.patch, instrument: instrument.id } : {}),
                sourceChannel: part.outputChannel, transpose: part.transpose, velocityShift: part.velocityShift,
                instrumentEnabled: part.instrumentEnabled, volumeEnabled: part.volumeEnabled, panEnabled: part.panEnabled,
                reverb: part.reverb, chorus: part.chorus, reverbEnabled: part.reverbEnabled, chorusEnabled: part.chorusEnabled };
        });
        if (editor.renderedMix) editor.renderedMix = editor.mix;
        if (JSON.stringify(editor.unresolvedStyleMix ?? editor.mix) !== before) songTabs.mixEdited();
    } else {
        mixerParts.forEach(({ id, volume, pan, mute, solo, instrumentChoice, reverb, chorus, reverbEnabled, chorusEnabled }) => {
            savedMix.set(id, { volume, pan, mute, solo, instrumentChoice, reverb, chorus, reverbEnabled, chorusEnabled });
        });
    }
    player.mix(instrumentDefaults.playbackMix(mixerParts), Number(masterInput.value) / 100);
    updateRollSolo();
    recentSongs.schedule();
}

function updateRollSolo() {
    const track = rollMixPart();
    pianoRoll.soloButton.setAttribute("aria-pressed", String(Boolean(track?.solo)));
}

function rollMixPart() {
    if (!pianoRoll.custom) return mixerParts.find(part => part.source === "user" && part.name === pianoRoll.name);
    const styleId = DesktopSongFiles.sourceStyleId(editor.project.parts[pianoRoll.custom.index].styleId);
    const track = editor.mix.find(item => item.rhythmId === styleId && item.name === pianoRoll.name);
    return track && mixerParts.find(part => part.channel === track.channel);
}

function updateMixerButtons() {
    const allMuted = mixerParts.length > 0 && mixerParts.every(part => part.mute);
    muteAll.setAttribute("aria-pressed", String(allMuted));
    muteAll.disabled = !mixerParts.length;
    clearSolo.disabled = !mixerParts.some(part => part.solo);
    document.querySelector("#reset-mixer").disabled = !mixerParts.length;
    saveMix.disabled = !editor.renderedMix || !editor.nativeMix.length || activeProject !== editor.project || !song;
    document.querySelector("#import-mix-button").disabled = !editor.project || generating || starting
        || editor.unresolvedStyleMix !== undefined;
    const ready = activeProject === editor.project && Boolean(song) && !generating && !starting && editor.unresolvedStyleMix === undefined;
    reloadSongMix.disabled = !ready || !editor.openedMix?.length;
    restoreFactoryMix.disabled = !ready;
    saveRhythmMix.disabled = loadRhythmMix.disabled = !ready || !editor.mix.some(track =>
        !DesktopSongFiles.isUserMixTrack(track) && matchesMixerRhythm(track, selectedMixerRhythm));
    prepareMixer.disabled = generating || starting;
    document.querySelector("#panic").disabled = !mixerParts.length;
}

function openChannelEditor(part) {
    const choices = mixerInstruments.filter(instrument => instrument.drum === part.drum)
        .map(instrument => part.usesDesktopSoundFont ? { ...instrument, ...instrument.desktop } : instrument);
    const current = part.instrumentChoice?.id ?? "";
    const mappedDefault = instrumentDefaults.chosen({ ...part, instrumentChoice: undefined });
    document.querySelector("#channel-editor-title").textContent = `CH ${part.outputChannel + 1} · ${part.name}`;
    const search = document.querySelector("#channel-instrument-search");
    const preview = document.querySelector("#channel-preview");
    const visibleInstruments = selected => {
        const terms = search.value.normalize("NFKC").trim().toLowerCase().split(/\s+/u).filter(Boolean);
        const filtered = choices.filter(instrument => {
            const keywords = `${instrument.patch} ${instrument.program + 1}`.normalize("NFKC").toLowerCase();
            return selected === instrument.id || terms.every(term => keywords.includes(term));
        });
        const defaultLabel = mappedDefault ? t(`${mappedDefault.patch}（既定の割り当て）`, `${mappedDefault.patch} (default mapping)`)
            : t(`${part.originalPatch}（元の音色）`, `${part.originalPatch} (original)`);
        channelInstrument.replaceChildren(new Option(defaultLabel, ""),
            ...filtered.map(instrument => new Option(instrument.patch, instrument.id)));
        channelInstrument.value = selected;
    };
    search.value = "";
    search.oninput = () => visibleInstruments(channelInstrument.value);
    visibleInstruments(current);
    preview.disabled = playing || paused || starting || generating;
    preview.onclick = () => {
        const program = choices.find(instrument => instrument.id === channelInstrument.value)?.program ?? mappedDefault?.program ?? part.program;
        const pitches = part.drum ? [36, 38, 42, 51] : [60, 64, 67, 72];
        const notes = pitches.map((pitch, index) => ({ pitch, position: index * .5, duration: .4, velocity: 90 }));
        queueAudition(notes, part.drum, program, 120, () => channelEditor.open);
    };
    const detailed = activeProject === editor.project && Boolean(editor.baseMix?.length);
    const midiFields = document.querySelector("#channel-midi-settings");
    midiFields.hidden = midiFields.disabled = !detailed;
    const outputChannel = document.querySelector("#channel-output");
    const transpose = document.querySelector("#channel-transpose");
    const velocity = document.querySelector("#channel-velocity-shift");
    const flags = [
        ["instrumentEnabled", document.querySelector("#channel-program-enabled")],
        ["volumeEnabled", document.querySelector("#channel-volume-enabled")],
        ["panEnabled", document.querySelector("#channel-pan-enabled")]
    ];
    const used = new Set(mixerParts.filter(item => item !== part).map(item => item.outputChannel));
    outputChannel.replaceChildren(...Array.from({ length: 16 }, (_, channel) => channel)
        .filter(channel => !used.has(channel) && (channel !== 9 || part.drum || channel === part.outputChannel))
        .map(channel => new Option(channel + 1, channel)));
    outputChannel.value = part.outputChannel;
    transpose.value = part.transpose;
    velocity.value = part.velocityShift;
    for (const [key, field] of flags) field.checked = part[key];
    const controls = document.querySelector("#channel-effects");
    controls.replaceChildren();
    const fields = channelEffects.map(({ key, label }) => {
        const row = document.createElement("div");
        row.className = "effect-control";
        const title = document.createElement("span");
        title.textContent = t(label);
        const slider = document.createElement("input");
        slider.id = `channel-${key}`;
        slider.type = "range";
        slider.min = 0;
        slider.max = 127;
        slider.value = part[key];
        slider.setAttribute("aria-label", t(label));
        const output = document.createElement("output");
        output.textContent = slider.value;
        slider.oninput = () => { output.textContent = slider.value; };
        const enabled = document.createElement("input");
        enabled.type = "checkbox";
        enabled.checked = part[`${key}Enabled`];
        enabled.setAttribute("aria-label", t(`${label}を有効にする`, `Enable ${t(label).toLowerCase()}`));
        const toggle = document.createElement("label");
        toggle.className = "check";
        toggle.append(enabled, t("有効"));
        row.append(title, slider, output, toggle);
        controls.append(row);
        return { key, slider, enabled };
    });
    document.querySelector("#channel-editor-form").onsubmit = event => {
        event.preventDefault();
        part.instrumentChoice = choices.find(instrument => instrument.id === channelInstrument.value);
        if (detailed) {
            part.outputChannel = Number(outputChannel.value);
            part.transpose = transpose.valueAsNumber;
            part.velocityShift = velocity.valueAsNumber;
            for (const [key, field] of flags) part[key] = field.checked;
        }
        for (const { key, slider, enabled } of fields) {
            part[key] = slider.valueAsNumber;
            part[`${key}Enabled`] = enabled.checked;
        }
        applyMix();
        if (accompanimentDirty && (playing || paused)) showStatus("次回の再生から変更を反映します。");
        channelEditor.close();
        renderMixer();
        document.querySelector(`.strip[data-part-index="${mixerParts.indexOf(part)}"] .channel-edit`)?.focus();
    };
    channelEditor.showModal();
}

function updateChannelButton(part, button) {
    const patch = instrumentDefaults.chosen(part)?.patch ?? part.originalPatch;
    button.textContent = patch;
    button.title = t(`${patch} · チャンネル設定`, `${patch} · Channel settings`);
    button.setAttribute("aria-label", t(`${part.name}のチャンネル設定（${patch}）`, `Channel settings for ${part.name} (${patch})`));
}

function mixerKnob(part, key, label, min, max, value, onChange) {
    const control = document.createElement("label");
    control.className = "mixer-knob";
    const caption = document.createElement("span");
    caption.textContent = label;
    const input = document.createElement("input");
    input.type = "range";
    input.id = `${key}-${mixerParts.indexOf(part)}`;
    input.min = min;
    input.max = max;
    input.value = value;
    input.setAttribute("aria-label", `${part.name} ${key}`);
    const display = () => {
        const proportion = (input.valueAsNumber - min) / (max - min);
        control.style.setProperty("--angle", `${270 * proportion - 135}deg`);
        control.title = `${label.toUpperCase()} · ${input.value}`;
    };
    input.oninput = () => { onChange(input.valueAsNumber); display(); applyMix(); };
    input.onwheel = event => {
        if (document.activeElement !== input) return;
        event.preventDefault();
        input.value = Math.max(min, Math.min(max, input.valueAsNumber - Math.sign(event.deltaY)));
        input.oninput();
    };
    display();
    control.append(input, caption);
    return control;
}

function initialMixerParts(song, mix) {
    const initialEvents = new Map();
    for (const event of song.events) {
        const setting = event.type === 0xc0 ? "program" : event.type === 0xb0 ? channelEffects.find(effect => effect.controller === event.a)?.key : undefined;
        if (!setting) continue;
        const key = `${event.part}:${setting}`;
        if (!initialEvents.has(key)) initialEvents.set(key, event.type === 0xc0 ? event.a : event.b);
    }
    const activeChannels = new Set(song.parts.map(part => part.channel));
    const tracks = [...song.parts, ...(mix ?? []).filter(track => !activeChannels.has(track.channel)).map(track => ({
        id: `silent:${track.rhythmId}:${track.name}`, name: track.name, channel: track.channel,
        source: /^Sp(?:Drums)?UserChannelRhythmID$/u.test(track.rhythmId) ? "user" : "rhythm",
        drum: /#_#Drums#_#|\bkit\b/iu.test(track.instrument + " " + track.patch),
        styleId: /^Sp(?:Drums)?UserChannelRhythmID$/u.test(track.rhythmId) ? undefined : track.rhythmId
    }))];
    return tracks.map((part, index) => {
        const track = mix?.find(track => track.channel === part.channel);
        const program = initialEvents.get(`${index}:program`) ?? 0;
        const fallback = mixerInstruments.find(instrument => instrument.drum === part.drum && instrument.program === program);
        const original = { volume: 1, pan: 0, solo: false, mute: track?.mute ?? false,
            instrumentChoice: undefined, originalPatch: track?.patch ?? fallback?.patch ?? `Program ${program + 1}`,
            outputChannel: track?.sourceChannel ?? part.channel, transpose: track?.transpose ?? 0, velocityShift: track?.velocityShift ?? 0,
            instrumentEnabled: track?.instrumentEnabled ?? true, volumeEnabled: track?.volumeEnabled ?? true, panEnabled: track?.panEnabled ?? true };
        for (const { key } of channelEffects) {
            original[key] = track?.[key] ?? initialEvents.get(`${index}:${key}`) ?? 0;
            original[`${key}Enabled`] = track?.[`${key}Enabled`] ?? true;
        }
        return { ...part, ...original, original, program, usesDesktopSoundFont: Boolean(mix) && usesDesktopSoundFont,
            ...(!mix ? savedMix.get(part.id) : null) };
    });
}

function mixerTrackIcon(part) {
    if (part.source === "user") return "user";
    if (part.drum) return "drums";
    const program = part.instrumentChoice?.program ?? part.program;
    if (program <= 23) return "keyboard";
    if (program <= 31) return "guitar";
    if (program <= 39) return "bass";
    if (program <= 55) return "strings";
    if (program <= 79) return "hornsection";
    return "notes";
}

function openMixerContext(part, strip, x, y) {
    const edit = strip.querySelector(".channel-edit");
    for (const action of ["edit-user", "rename-user", "remove-user"]) {
        mixerContext.querySelector(`[data-action="${action}"]`).hidden = part.source !== "user";
    }
    const clone = mixerContext.querySelector('[data-action="clone-rhythm"]');
    clone.hidden = !editor.project || part.source !== "rhythm";
    clone.disabled = generating || starting || editor.unresolvedStyleMix !== undefined;
    const exportMidi = mixerContext.querySelector('[data-action="export-rhythm-midi"]');
    exportMidi.hidden = part.source !== "rhythm";
    exportMidi.disabled = generating || starting || part.trackIndex === undefined;
    for (const button of mixerContext.querySelectorAll('[data-action="export-track-wave"], [data-action="export-track-mp3"]')) {
        button.disabled = generating || starting || exportingAudio || part.trackIndex === undefined;
    }
    mixerContext.onclick = event => {
        const action = event.target.closest("button")?.dataset.action;
        mixerContext.hidden = true;
        if (action === "settings") edit.click();
        if (action === "mute" || action === "solo") strip.querySelector(`[data-mix="${action}"]`).click();
        if (action === "reset") {
            const reserved = mixerParts.some(other => other !== part && other.outputChannel === part.original.outputChannel);
            Object.assign(part, part.original, { outputChannel: reserved ? part.outputChannel : part.original.outputChannel });
            renderMixer();
            applyMix();
        }
        if (action === "edit-user") pianoRoll.open(part.name);
        if (action === "rename-user" || action === "remove-user") pianoRoll.editTrack(action.split("-")[0], part.name);
        if (action === "clone-rhythm") void cloneRhythmTrack(part);
        if (action === "export-rhythm-midi") void exportRhythmTrack(part);
        if (action === "export-track-wave" || action === "export-track-mp3") void exportAudio(action === "export-track-mp3" ? "mp3" : "wav", part.id);
    };
    mixerContext.onkeydown = event => {
        if (event.key === "Escape") { mixerContext.hidden = true; edit.focus(); }
    };
    openEditorPopup(mixerContext, x, y);
}

let exportingAudio = false;
async function exportAudio(format, trackId, allTracks = false) {
    if (exportingAudio || generating || starting || !form.reportValidity()) return;
    exportingAudio = true;
    updateMenus();
    try {
        if ((!song || accompanimentDirty || tempoDirty) && !await generateAccompaniment()) return;
        const renderedSong = song;
        const master = Number(masterInput.value) / 100;
        const mix = structuredClone(instrumentDefaults.playbackMix(mixerParts));
        const track = trackId === undefined ? undefined : mix.find(part => part.id === trackId);
        if (trackId !== undefined && !track) throw new Error(t("トラックが見つかりません。", "The track is unavailable."));
        const name = editor.project ? editor.fileStem() : "JJazzLab";
        const trackName = part => part.name.replace(/[<>:"/\\|?*]/gu, "_");
        const render = async (selected, progress) => {
            const parts = selected ? mix.map(part => ({ ...part, mute: part !== selected, solo: part === selected })) : mix;
            const rendered = await renderSongAudio(renderedSong, parts, master, progress);
            return format === "mp3" ? encodeMp3Audio(rendered, progress) : encodeWave(rendered);
        };
        if (allTracks) {
            const tracks = mix.filter(part => !part.mute && part.trackIndex !== undefined);
            if (!tracks.length) throw new Error(t("書き出せるミュートされていないトラックがありません。", "There are no unmuted tracks to export."));
            const files = [];
            for (const [index, part] of tracks.entries()) {
                const progress = message => showStatus(`${index + 1}/${tracks.length} ${part.name} — ${t(message)}`);
                const audio = await render(part, progress);
                let checksum = 0;
                for await (const chunk of audio.stream()) checksum = styleCrc32(chunk, checksum);
                files.push([`${String(index + 1).padStart(2, "0")}-${trackName(part)}.${format}`, audio, checksum]);
            }
            downloadSongFile(`${name}-${format}-tracks.zip`, packageSongFiles(files), "application/zip");
        } else {
            const audio = await render(track, showStatus);
            downloadSongFile(`${name}${track ? `-${trackName(track)}` : ""}.${format}`, audio, audio.type);
        }
        showStatus(t("音声の書き出しが完了しました。", "Audio export complete."));
    } catch (error) { showStatus(error.message, true); }
    finally { exportingAudio = false; updateMenus(); }
}

async function exportRhythmTrack(part) {
    if (!generatedMidi || generating || starting) return;
    try {
        if (accompanimentDirty || tempoDirty || editor.mix !== editor.baseMix) {
            if (!await generateAccompaniment()) return;
            part = mixerParts.find(candidate => candidate.id === part.id);
        }
        if (part?.trackIndex === undefined) return;
        const bytes = exportMidiTrack(generatedMidi, part);
        downloadSongFile(`${editor.fileStem()}-${part.name.replace(/[<>:"/\\|?*]/gu, "_")}.mid`, bytes, "audio/midi");
    } catch (error) { editor.notify(error.message, true); }
}

async function cloneRhythmTrack(part) {
    const key = editor.baseMix?.find(track => track.channel === part.channel);
    if (!key || generating || starting) return;
    if (accompanimentDirty && !await generateAccompaniment()) return;
    const source = editor.mix.find(track => track.rhythmId === key.rhythmId && track.name === key.name);
    if (!source || editor.unresolvedStyleMix !== undefined) return;
    const tracks = editor.project.userTracks;
    const used = new Set(editor.mix.map(track => track.sourceChannel ?? track.channel));
    const channel = Array.from({ length: 16 }, (_, index) => index).find(index => !used.has(index));
    if (channel === undefined) {
        editor.notify(t("空いているMIDIチャンネルがありません。", "No MIDI channel is available."), true);
        return;
    }
    const serialized = engine.exports.getRhythmTrackPhrase(source.channel);
    if (!serialized) {
        editor.notify(t("複製できる音符がありません。", "There are no notes to clone."), true);
        return;
    }
    const original = UserPhrase.read(serialized);
    let suffix = 1;
    while (tracks.some(track => track.name === `${part.name}-${suffix}`)) suffix++;
    const name = `${part.name}-${suffix}`;
    const rhythmId = part.drum ? "SpDrumsUserChannelRhythmID" : "SpUserChannelRhythmID";
    const phrase = UserPhrase.write({ ...original, drum: part.drum });
    if (!editor.editArrangement(() => {
        tracks.push({ name, phrase });
        editor.mix = editor.mix.map(track => track === source ? { ...track, mute: true } : track);
        editor.mix.push({ ...source, name, rhythmId, channel, sourceChannel: channel, mute: false });
    }, [name], source)) return;
    pianoRoll.open(name);
    await generateAccompaniment();
}

function renderMixer() {
    const container = document.querySelector("#mixer-parts");
    container.replaceChildren();
    document.querySelector("#mixer-empty").hidden = mixerParts.length > 0;
    updateMixerButtons();
    updateRollSolo();
    const notes = Map.groupBy(song?.events.filter(event => event.type === 0x90 && event.b) ?? [], event => event.part);
    const styleIds = new Set(mixerParts.map(part => part.styleId).filter(Boolean));
    const all = new Option(t("すべてのリズム", "All rhythms"), "");
    mixerRhythm.replaceChildren(all, ...Array.from(styleIds, id => {
        const name = editor.project?.parts.find(part => part.styleId === id)?.styleName ?? id.replace(/-ID$/u, "");
        return new Option(name, id);
    }));
    mixerRhythm.hidden = styleIds.size < 2;
    mixerRhythm.value = styleIds.has(selectedMixerRhythm) ? selectedMixerRhythm : "";
    const orderedParts = mixerParts.map((part, index) => ({ part, index })).sort((a, b) => a.part.outputChannel - b.part.outputChannel);
    for (const { part, index } of orderedParts) {
        if (mixerRhythm.value && part.source !== "user" && part.styleId !== mixerRhythm.value) continue;
        const strip = document.createElement("div"); strip.className = "strip";
        strip.dataset.partIndex = index;
        strip.dataset.voice = part.source === "user" ? "user" : part.drum ? "drums" : "rhythm";
        const title = document.createElement("div"); title.className = "part-name"; title.textContent = part.name;
        title.title = part.name;
        if (part.source === "rhythm" && part.trackIndex !== undefined) {
            title.draggable = true;
            title.title = `${part.name} · ${t("ピアノロールへドラッグして音符をコピー", "Drag to the piano roll to copy notes")}`;
            title.ondragstart = event => {
                if (generating || starting) return event.preventDefault();
                const phrase = engine.exports.getRhythmTrackPhrase(part.channel);
                if (!phrase) return event.preventDefault();
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(rhythmPhraseDragType, phrase);
            };
        }
        const channel = document.createElement("small");
        channel.textContent = `CH ${part.outputChannel + 1}${part.source === "user" ? " · User" : part.drum ? " · Drums" : ""}`;
        if (styleIds.size > 1 && part.styleId) {
            channel.textContent += ` · ${part.styleId.replace(/-ID$/u, "")}`;
        }
        channel.title = channel.textContent;
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "secondary channel-edit";
        updateChannelButton(part, edit);
        edit.onclick = () => openChannelEditor(part);
        const buttons = document.createElement("div"); buttons.className = "strip-buttons";
        for (const [key, label] of [["mute", "Mute"], ["solo", "Solo"]]) {
            const button = document.createElement("button"); button.type = "button"; button.className = "tool-button";
            button.title = label; button.dataset.mix = button.dataset.icon = key;
            button.setAttribute("aria-label", `${part.name} ${label}`); button.setAttribute("aria-pressed", String(part[key]));
            button.addEventListener("click", () => {
                part[key] = !part[key]; button.setAttribute("aria-pressed", String(part[key])); updateMixerButtons(); applyMix();
            });
            buttons.append(button);
        }
        const gear = document.createElement("button");
        gear.type = "button";
        gear.className = "tool-button";
        gear.dataset.icon = "channel-settings";
        gear.title = t("チャンネル設定");
        gear.setAttribute("aria-label", gear.title);
        gear.onclick = () => edit.click();
        gear.onkeydown = event => {
            if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
            event.preventDefault();
            const bounds = gear.getBoundingClientRect();
            openMixerContext(part, strip, bounds.left, bounds.bottom);
        };
        buttons.append(gear);
        strip.oncontextmenu = event => { event.preventDefault(); openMixerContext(part, strip, event.clientX, event.clientY); };
        strip.append(buttons);
        const pan = mixerKnob(part, "pan", "pan", -100, 100, Math.round(part.pan * 100), value => { part.pan = value / 100; });
        pan.classList.add("strip-pan");
        strip.append(pan);
        for (const { key } of channelEffects) {
            const knob = mixerKnob(part, key, key === "reverb" ? "rev" : "cho", 0, 127, part[key], value => { part[key] = value; });
            knob.querySelector("input").disabled = !part[`${key}Enabled`];
            knob.classList.toggle("disabled-knob", !part[`${key}Enabled`]);
            strip.append(knob);
        }
        const fader = document.createElement("label");
        fader.className = "strip-volume";
        const volume = document.createElement("input");
        volume.id = `volume-${index}`;
        volume.type = "range";
        volume.min = 0;
        volume.max = 150;
        volume.value = Math.round(part.volume * 100);
        volume.setAttribute("aria-label", `${part.name} ${t("音量", "volume")}`);
        const level = document.createElement("output");
        level.textContent = `${volume.value}%`;
        volume.oninput = () => { part.volume = volume.valueAsNumber / 100; level.textContent = `${volume.value}%`; applyMix(); };
        fader.append(volume, level);
        const faderRow = document.createElement("div");
        faderRow.className = "fader-row";
        faderRow.append(fader, edit);
        const icon = document.createElement("span");
        icon.className = "track-icon";
        icon.dataset.icon = `track-${mixerTrackIcon(part)}`;
        icon.setAttribute("aria-hidden", "true");
        strip.append(faderRow, icon, title, channel);
        const preview = document.createElement("canvas");
        preview.className = "track-preview";
        preview.width = 72;
        preview.height = 29;
        preview.setAttribute("aria-hidden", "true");
        const context = preview.getContext("2d");
        if (context) {
            context.fillStyle = part.source === "user" ? "#c3afe8" : part.drum ? "#eac07e" : "#8fcbce";
            for (const note of notes.get(index) ?? []) {
                context.fillRect(note.seconds / song.duration * (preview.width - 2), (1 - note.a / 127) * (preview.height - 2), 2, 1);
            }
        }
        if (part.source === "user" && editor.project?.userTracks.some(track => track.name === part.name)) {
            const overview = document.createElement("button");
            overview.type = "button";
            overview.className = "user-track-overview";
            overview.title = `${t("ピアノロール")} · ${part.name}`;
            overview.setAttribute("aria-label", overview.title);
            overview.append(preview);
            overview.onclick = () => pianoRoll.open(part.name);
            strip.append(overview);
        } else strip.append(preview);
        container.append(strip);
    }
}

async function startPlayback(restart = false, stopAtEnd = false) {
    if (generating || starting || (playing && !restart)) return;
    const refresh = !song || accompanimentDirty || (tempoDirty && (!paused || restart));
    if (refresh && !form.reportValidity()) return;
    starting = true; updateButtons(); options.disabled = true;
    try {
        const audio = player.initialize(showPlayStatus);
        // Keep the browser's audio activation while the accompaniment is generated.
        audio.catch(() => {});
        if (refresh && !await generateAccompaniment(true)) return;
        await audio;
        await pendingAudition;
        let external;
        try { external = await midiOutput.begin(!playing && !paused); }
        catch (error) {
            midiOutput.silence(true);
            showPlayStatus(error.message, true);
        }
        await player.play(song, readLoop(), instrumentDefaults.playbackMix(mixerParts), Number(masterInput.value) / 100, Boolean(editor.project), {
            resume: paused && !restart && !refresh,
            stopAtEnd,
            click: metronome.getAttribute("aria-pressed") === "true",
            clickSettings: clickSettings.resolve(),
            midiOutput: external,
            precount: !restart && precount.getAttribute("aria-pressed") === "true" && precountMode.value,
            tempo: tempoInput.valueAsNumber,
            rate: playbackTempoRate()
        });
    } catch (error) { showPlayStatus(error.message, true); }
    finally { starting = false; options.disabled = false; updateButtons(); }
}
playButton.addEventListener("click", () => startPlayback());
pauseButton.onclick = () => player.pause().catch(error => showPlayStatus(error.message, true));
previousPart.onclick = () => jumpPart(-1);
nextPart.onclick = () => jumpPart(1);
toggleLoop.onclick = () => {
    loopEnabled.checked = !loopEnabled.checked;
    try { localStorage.setItem("jjazzlab.loop", String(loopEnabled.checked)); } catch { /* Preference storage is optional. */ }
    loopEnabled.dispatchEvent(new Event("input", { bubbles: true }));
};
for (const button of [metronome, precount]) button.onclick = () => {
    const enabled = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(enabled));
    if (button === metronome) player.click(enabled).catch(error => showPlayStatus(error.message, true));
};
showPoint.onclick = () => {
    const enabled = showPoint.getAttribute("aria-pressed") !== "true";
    showPoint.setAttribute("aria-pressed", String(enabled));
    editor.showPlayingBar(enabled && (playing || paused) ? playbackBar : 0);
};

function jumpPart(direction) {
    const ranges = editor.partRanges();
    const index = ranges.findLastIndex(range => range.from <= playbackBar);
    const target = direction < 0 && playbackBar > ranges[index]?.from ? index : index + direction;
    if (!ranges[target]) return;
    editor.selectPart(target);
    if (playing || paused) startPlayback(true);
    else {
        const bar = ranges[target].from;
        displayPosition(bar, 1, song?.barTimes[bar - 1] ?? 0);
        updateButtons();
    }
}

async function changeRemoteVariation(direction) {
    if (generating || starting || !editor.project) return;
    const project = editor.project;
    const part = project.parts[editor.partIndices(editor.selectedPart)[0] ?? 0];
    try {
        let variation = editor.parametersFor(part.styleId).get("rpVariationID");
        if (!variation?.values.length) variation = (await editor.onDescribeStyle(part.styleId)).parameters.get("rpVariationID");
        if (!variation?.values.length || editor.project !== project || !project.parts.includes(part)) return;
        const { values, fallback } = variation;
        const current = Math.max(0, values.indexOf(part.parameters.rpVariationID ?? fallback));
        const value = typeof direction === "number" ? values[(current + direction + values.length) % values.length]
            : values.find(value => value.startsWith(`Main ${direction}`));
        if (value && value !== (part.parameters.rpVariationID ?? fallback)) {
            editor.editArrangement(() => { part.parameters.rpVariationID = value; });
        }
    } catch (error) { editor.notify(error.message, true); }
}

stopButton.addEventListener("click", async () => {
    try {
        await player.stop();
        playing = paused = false;
        displayPosition();
        if (song) updatePosition({ seconds: 0, playing: false });
        else updateButtons();
    }
    catch (error) { showPlayStatus(error.message, true); }
});

document.querySelector("#loop-controls").addEventListener("input", () => {
    toggleLoop.setAttribute("aria-pressed", String(loopEnabled.checked));
    if (!song) return;
    try {
        const loop = readLoop(); player.loop(loop);
        localizedText(loopStatus, playing ? "変更は次の折り返しから適用します。" : "終了小節を含めて繰り返します。");
        loopStatus.removeAttribute("data-error");
    } catch (error) { loopStatus.textContent = error.message; loopStatus.setAttribute("data-error", ""); }
});

masterInput.addEventListener("input", () => {
    document.querySelector("#master-value").textContent = `${masterInput.value}%`; applyMix();
});
document.querySelector("#reset-mixer").addEventListener("click", () => {
    mixerParts.forEach(part => Object.assign(part, part.original, { mute: false }));
    masterInput.value = 80; document.querySelector("#master-value").textContent = "80%";
    renderMixer(); applyMix();
});
document.querySelector("#cancel-channel-edit").onclick = () => channelEditor.close();
saveMix.onclick = () => {
    if (editor.renderedMix) downloadSongFile(`${editor.fileStem()}.mix`, editor.desktopMixXml(), "application/xml");
};
muteAll.addEventListener("click", () => {
    const mute = muteAll.getAttribute("aria-pressed") === "false";
    mixerParts.forEach(part => { part.mute = mute; });
    document.querySelectorAll('#mixer-parts [data-mix="mute"]').forEach(button => button.setAttribute("aria-pressed", String(mute)));
    updateMixerButtons(); applyMix();
});
clearSolo.addEventListener("click", () => {
    mixerParts.forEach(part => { part.solo = false; });
    document.querySelectorAll('#mixer-parts [data-mix="solo"]').forEach(button => button.setAttribute("aria-pressed", "false"));
    updateMixerButtons(); applyMix();
});
toggleMixer.addEventListener("click", () => {
    mixer.hidden = !mixer.hidden;
    workspace.classList.toggle("mixer-closed", mixer.hidden);
    toggleMixer.setAttribute("aria-pressed", String(!mixer.hidden));
    if (!mixer.hidden && !song && editor.project) prepareMixer.click();
});
mixerRhythm.onchange = () => {
    selectedMixerRhythm = mixerRhythm.value;
    renderMixer();
};
prepareMixer.onclick = () => {
    if (!song && form.reportValidity()) void generateAccompaniment();
};

function decompress(encoded) {
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
}

async function instantiateEngine() {
    const wasm = await decompress(embeddedWasm);
    const url = URL.createObjectURL(new Blob([wasm], { type: "application/wasm" }));
    try {
        return await globalThis.TeaVM.wasmGC.load(url, { nodejs: false });
    } finally {
        URL.revokeObjectURL(url);
    }
}

function getEngine() {
    engineLoad ??= instantiateEngine().then(engine => {
        mixerInstruments = Array.from(engine.exports.getMixerInstruments(), row => {
            const [program, drum, patch, id] = row.split("\t");
            const bank = embeddedDesktopMixerPatches[drum === "true" ? "Drums" : "GM Bank"];
            return { program: Number(program), drum: drum === "true", patch, id, desktop: bank[program] };
        });
        return engine;
    }).catch(error => {
        engineLoad = undefined;
        throw error;
    });
    return engineLoad;
}

function clearDownload() {
    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = undefined;
    }
    download.hidden = true;
    download.removeAttribute("href");
}

function showStatus(message, error = false, english) {
    localizedText(status, message, english);
    status.toggleAttribute("data-error", error);
}

async function readStyle() {
    if (bundledExtension.value) return readBundledExtendedStyle(bundledExtension.value);
    if (selectedLibraryStyle) return { name: selectedLibraryStyle.name, bytes: new Int8Array(await styleArchive.read(selectedLibraryStyle)) };
    const files = Array.from(styleInput.files);
    const file = files.find(file => /\.yjz$/iu.test(file.name)) ?? files[0];
    if (file) return readLocalStyle(file, files);
    return { name: bundledStyle, bytes: new Int8Array(await decompress(embeddedStyle)) };
}

async function readLocalStyle(file, files) {
    const name = file.name;
    const id = `${name}-ID`;
    if (!/\.yjz$/iu.test(name)) return { name, id, bytes: new Int8Array(await file.arrayBuffer()), attach: true };
    const stem = name.slice(0, -4).toLowerCase();
    const base = ["sty", "prs", "bcs", "sst"].map(ext => files.find(candidate => candidate.name.toLowerCase() === `${stem}.${ext}`)).find(Boolean);
    if (!base) throw new Error(`「${name}」と同じ名前の元スタイル（.sty / .prs / .bcs / .sst）も一緒に選んでください。`);
    return { name, id, baseName: base.name, bytes: new Int8Array(await base.arrayBuffer()), extension: new Int8Array(await file.arrayBuffer()), attach: true };
}

async function readBundledExtendedStyle(name) {
    const data = embeddedExtendedStyles[name];
    return { name, id: `${name}-ID`, baseName: data.baseName, bytes: new Int8Array(await decompress(data.base)),
        extension: new Int8Array(await decompress(data.extension)) };
}

function restoreAttachedStyle(style) {
    return { ...style, bytes: Int8Array.from(style.data),
        ...(style.extensionData ? { extension: Int8Array.from(style.extensionData) } : {}), attach: true };
}

let activeProject;
let chosenRange;
let draft;
function clearPlayback() {
    clearTimeout(liveTimer);
    liveArrangement = undefined;
    liveCandidates.clear();
    liveVersion++;
    paused = playing = false;
    accompanimentDirty = true;
    song = null;
    generatedMidi = null;
    renderedTempo = 0;
    tempoDirty = false;
    mixerParts = [];
    player.loadedSong = null;
    displayPosition();
    playbackFraction = 0;
    updateReader(1, 0);
    localizedText(loopStatus, "");
    loopStatus.removeAttribute("data-error");
    editor.showPlayingBar(0);
    showPlayStatus("");
    clearDownload();
    renderMixer();
    updateButtons();
}

let bootingSong = true;
const editor = new SongEditor((opened, useSavedStyles) => {
    pianoRoll.close();
    recentSongs.opened(Boolean(useSavedStyles && !bootingSong));
    songTabs.opened(useSavedStyles, bootingSong);
    selectedMixerRhythm = "";
    chosenRange = null;
    activeProject = undefined;
    usesDesktopSoundFont = !opened.mix.length || opened.mix.some(track => track.instrument?.startsWith("FluidSynth#:#"));
    selectedLibraryStyle = undefined;
    libraryStyle.value = "";
    bundledExtension.value = "";
    styleInput.value = "";
    tempoInput.value = opened.project.tempo;
    const sources = new Set(opened.project.parts.map(part => DesktopSongFiles.sourceStyleId(part.styleId)));
    const followSong = useSavedStyles || sources.size > 1;
    rhythmEngine.querySelector('option[value="song"]').hidden = !followSong;
    rhythmEngine.value = followSong ? "song" : sources.has("jjSwing-ID") ? "jjswing" : "yamaha";
    rhythmEngine.dispatchEvent(new Event("change"));
    player.stop().catch(error => showPlayStatus(error.message, true));
    clearPlayback();
    document.querySelector("#song-editor").hidden = false;
    quickMode.setAttribute("aria-pressed", "false");
    workspace.classList.remove("quick-view");
    generationControls.open = false;
    showStatus("");
}, (range) => {
    chosenRange = range;
    if (song && range && range.to < song.barTimes.length) {
        loopStart.value = range.from;
        loopEnd.value = range.to;
        loopStart.dispatchEvent(new Event("input", { bubbles: true }));
    }
}, stopAtEnd => {
    if (!chosenRange) showStatus("選択した小節は曲構成の演奏順に含まれていません。");
    else startPlayback(true, stopAtEnd);
});
const openProject = document.querySelector("#open-project");
new SongPrintView(editor);
const folderIO = new SongFolderIO(editor, async () => {
    if (!form.reportValidity()) return null;
    if (!editor.renderedMix && !await generateAccompaniment()) return null;
    return { song: DesktopSongFiles.writeSong(editor.project), mix: editor.desktopMixXml() };
});
folderIO.onOpen = () => { if (!mixer.hidden) prepareMixer.click(); };
const recentSongs = new SongHistory(editor, () => { if (!mixer.hidden) prepareMixer.click(); });
const songTabs = new SongTabs(editor, recentSongs, () => generating || starting || folderIO.saving, () => editor.newSong());
const rhythmLibrary = new RhythmLibrary({ readFile: readLocalStyle, builtins: builtinRhythms,
    describe: async style => { engine ??= await getEngine(); return describeStyle(style); } });
editor.onDefaultRhythm = meter => {
    const style = rhythmLibrary.defaultFor(meter);
    return style && { styleId: style.id, styleName: style.name };
};
songTabs.afterActivate = () => { if (!mixer.hidden) prepareMixer.click(); };
recentSongs.isUnsaved = () => songTabs.isDirty(songTabs.active);
recentSongs.onReopenExisting = id => {
    const entry = songTabs.entries.find(item => item.id === id);
    if (!entry) return false;
    songTabs.activate(entry);
    return true;
};
editor.onBeforeOpen = () => {
    void recentSongs.flush();
    songTabs.suspend(rhythmEngine.value === "song");
};
editor.onSave = () => { songTabs.saved(); recentSongs.schedule(); };
document.querySelector("#duplicate-song").onclick = () => editor.save("duplicate");
for (const button of document.querySelectorAll("[data-audio-export]")) {
    button.onclick = () => exportAudio(button.dataset.audioExport, undefined, button.hasAttribute("data-all-tracks"));
}
document.querySelector("#linearize-song").onclick = () => editor.save("linearize");
document.querySelector("#save-song-template").onclick = () => editor.saveTemplate();
document.querySelector("#clear-song-template").onclick = () => editor.clearTemplate();
async function openSongFromFiles(pending) {
    if (await pending && !mixer.hidden) prepareMixer.click();
}
openProject.onchange = () => openSongFromFiles(editor.openFiles(openProject));
const batchConvertInput = document.querySelector("#batch-convert-input");
const biabExtensions = ["sg", "mg"].flatMap(prefix => Array.from("123456789abcdefghijklmnu", suffix => `.${prefix}${suffix}`));
for (const input of [openProject, batchConvertInput]) input.accept += "," + biabExtensions.join(",");
document.querySelector("#batch-convert-songs").onclick = () => batchConvertInput.click();
batchConvertInput.onchange = async () => {
    const files = Array.from(batchConvertInput.files);
    batchConvertInput.value = "";
    await editor.convertSongs(files);
};
const canDropSong = event => !event.defaultPrevented && event.dataTransfer.types.includes("Files")
    && !event.target.closest('#roll-scroll, input[type="file"]');
workspace.addEventListener("dragover", event => {
    if (!canDropSong(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
});
workspace.addEventListener("drop", event => {
    if (!canDropSong(event)) return;
    event.preventDefault();
    if (!generating && !starting) void openSongFromFiles(editor.loadFiles(Array.from(event.dataTransfer.files)));
});
function importedRhythm(meter) {
    const styleName = meter === "FOUR_FOUR" ? "jjSwing" : meter === "THREE_FOUR" ? bundledJazzWaltz : bundledStyle;
    return editor.onDefaultRhythm(meter) ?? { styleId: styleName + "-ID", styleName };
}
async function readLeadSheet(rows) {
    await rhythmLibrary.ready;
    return DesktopSongFiles.readTextSong(rows, importedRhythm);
}
editor.onReadTextSong = async contents => readLeadSheet((await getEngine()).exports.readTextLeadSheet(contents));
editor.onReadImprovisor = async (contents, filename) => readLeadSheet((await getEngine()).exports.readImprovisorLeadSheet(contents, filename));
editor.onReadBiab = async (contents, filename) => readLeadSheet((await getEngine()).exports.readBiabLeadSheet(contents, filename));
editor.onReadMusicXml = async file => {
    const [wasm, text] = await Promise.all([getEngine(), musicXmlFileText(file), rhythmLibrary.ready]);
    const canonical = new Map();
    return readMusicXml(text, file.name, importedRhythm, name => {
        if (!canonical.has(name)) {
            try { canonical.set(name, wasm.exports.transposeChordSymbols([name], 0)[0]); }
            catch { canonical.set(name, undefined); }
        }
        return canonical.get(name);
    });
};
editor.onChordScales = async name => (await getEngine()).exports.getChordScales(name);
editor.onTransposeChords = async (names, delta) => (await getEngine()).exports.transposeChordSymbols(names, delta);
editor.onReadChordTools = async names => {
    const wasm = (await getEngine()).exports;
    const chords = names.map(name => {
        const [type, tones] = wasm.getChordPreview(name);
        return { name, type, tones };
    });
    return { types: Array.from(wasm.getChordTypes()), chords };
};
editor.onStopChordAudition = stopAudition;
editor.onAuditionChords = async (names, valid) => {
    if (playing || paused || starting || generating) throw new Error(t("再生を停止してから試聴してください。", "Stop playback before previewing."));
    const [wasm] = await Promise.all([getEngine(), player.initialize(showPlayStatus)]);
    if (!valid()) return;
    const notes = [];
    let position = 0;
    for (const name of names) {
        const pitches = Array.from(wasm.exports.getChordPreview(name)).slice(2).map(Number);
        for (const pitch of pitches) {
            notes.push({ pitch, position, duration: .5, velocity: 80 });
            position += .5;
        }
        position += 1;
        for (const pitch of pitches) {
            notes.push({ pitch, position, duration: 2, velocity: 75 });
            position += .1;
        }
        position += 1.5;
    }
    const piano = mixerParts.find(part => !part.drum && (part.instrumentChoice?.program ?? part.program) < 8);
    await queueAudition(notes, false, piano?.instrumentChoice?.program ?? piano?.program ?? 0, 120, valid);
};
editor.onSectionSwing = async (project, section) => {
    const wasm = (await getEngine()).exports;
    const part = project.parts.find(item => project.sections[item.section] === section) ?? project.parts[0];
    const source = DesktopSongFiles.sourceStyleId(part.styleId);
    const style = await readSavedStyle(source, project.sections[part.section].meter);
    const name = style.id === "jjSwing-ID" ? "" : style.baseName ?? style.name;
    return wasm.isTernaryRhythm(style.bytes, name, style.extension ?? new Int8Array(), style.extension ? style.name : "");
};
editor.onQuantizeChordDrop = async (project, section, bar, beat) => {
    const wasm = (await getEngine()).exports;
    let quantization = section.clientProperties?.PropSectionQuantization;
    if (!chordDropQuantizations.has(quantization)) {
        quantization = await editor.onSectionSwing(project, section) ? "ONE_THIRD_BEAT" : "ONE_QUARTER_BEAT";
    }
    return wasm.quantizeChordDrop(quantization, section.meter, bar, beat, project.bars - 1);
};
const pianoRoll = new PianoRoll(editor, (range, stopAtEnd) => {
    chosenRange = range;
    if (song && range.to < song.barTimes.length) {
        loopStart.value = range.from;
        loopEnd.value = range.to;
    }
    startPlayback(true, stopAtEnd);
});
pianoRoll.onTracksChanged = () => {
    if (song && !playing && !paused) void generateAccompaniment();
};
pianoRoll.onTrackOpened = updateRollSolo;
pianoRoll.onScoreChannel = () => {
    const part = rollMixPart();
    return part?.outputChannel ?? editor.mix.find(track => DesktopSongFiles.isUserMixTrack(track) && track.name === pianoRoll.name)?.channel;
};
pianoRoll.onDrumKeyMap = () => {
    const part = rollMixPart();
    const track = part && editor.mix.find(track => track.channel === part.channel)
        || editor.mix.find(track => DesktopSongFiles.isUserMixTrack(track) && track.name === pianoRoll.name);
    const kit = track?.instrument ?? "";
    if (/xg.*pop.?latin/iu.test(kit)) return "XG_PopLatin";
    if (/\bxg\b/iu.test(kit)) return "XG";
    if (/fluid|\bgs\b|gm2/iu.test(kit)) return "GSGM2";
    return "GM";
};
pianoRoll.onSolo = async name => {
    if (!name || generating || starting) return;
    if ((!song || accompanimentDirty) && !playing && !paused && !await generateAccompaniment()) return;
    const track = rollMixPart();
    if (!track) return;
    track.solo = !track.solo;
    renderMixer();
    applyMix();
};
pianoRoll.onAudition = notes => {
    const name = pianoRoll.name, project = editor.project, custom = pianoRoll.custom;
    const drum = pianoRoll.phrase.drum;
    const source = rollMixPart();
    const saved = editor.mix.find(track => DesktopSongFiles.isUserMixTrack(track) && track.name === name);
    const defaultPatch = mixerInstruments.find(instrument =>
        instrument.drum === drum && (instrument.patch === saved?.patch || instrument.desktop.id === saved?.instrument));
    const program = (source && instrumentDefaults.chosen(source)?.program)
        ?? (source?.trackIndex !== undefined ? source.program : defaultPatch?.program) ?? 0;
    queueAudition(notes, drum, program, project.tempo, () =>
        name === pianoRoll.name && project === editor.project && custom === pianoRoll.custom);
};

function queueAudition(notes, drum, program, tempo, stillValid, range) {
    if (!notes.length || playing || paused || starting || generating) return;
    const request = ++auditionRequest;
    const audio = player.initialize(showPlayStatus);
    audio.catch(() => {});
    pendingAudition = pendingAudition.then(async () => {
        await audio;
        if (request !== auditionRequest || !stillValid() || playing || paused || starting || generating) return;
        const secondsPerBeat = 60 / tempo;
        const start = range?.start ?? notes.reduce((min, note) => Math.min(min, note.position), Infinity);
        const events = [];
        for (const note of notes) {
            events.push({ seconds: (note.position - start) * secondsPerBeat, part: 0, type: 0x90, a: note.pitch, b: note.velocity },
                { seconds: (note.position - start + note.duration) * secondsPerBeat, part: 0, type: 0x80, a: note.pitch, b: 0 });
        }
        events.sort((a, b) => a.seconds - b.seconds || a.type - b.type);
        const duration = range ? (range.end - start) * secondsPerBeat : events.at(-1).seconds + .15;
        events.unshift({ seconds: 0, part: 0, type: 0xc0, a: program, b: 0 });
        const part = { drum, volume: 1, pan: 0 };
        await player.play({ parts: [part], events, duration }, { enabled: false, start: 0, end: duration },
            [part], Number(masterInput.value) / 100, false, { preview: true, click: false });
        showPlayStatus("");
    }).catch(error => showPlayStatus(error.message, true));
    return pendingAudition;
}

function stopAudition() {
    auditionRequest++;
    pendingAudition = pendingAudition.then(() => {
        if (player.previewing) return player.stop();
    }).catch(error => showPlayStatus(error.message, true));
}
pianoRoll.onStopAudition = stopAudition;
channelEditor.addEventListener("close", stopAudition);
const reader = document.querySelector("#easy-reader");
const toggleReader = document.querySelector("#toggle-reader");
const readerLocation = document.querySelector("#reader-location");
const readerCurrent = document.querySelector("#reader-current");
const readerNext = document.querySelector("#reader-next");
const readerAnnotation = document.querySelector("#reader-annotation");
let readerBars = [], readerChords = [];
function buildReader() {
    readerBars = [];
    readerChords = [];
    const project = editor.project;
    if (!project) return;
    const chordsByBar = Map.groupBy(project.chords, chord => chord.bar);
    const counts = new Map();
    for (const range of editor.partRanges()) {
        const part = project.parts[range.index];
        const occurrence = counts.get(part.section) ?? 0;
        counts.set(part.section, occurrence + 1);
        const beats = DesktopSongFiles.meters[project.sections[part.section].meter][1];
        for (let i = range.sheetStart; i < range.sheetEnd; i++) {
            const bar = range.from + i - range.sheetStart;
            readerBars.push({ name: part.name, beats, occurrence, sheetBar: i });
            for (const chord of (chordsByBar.get(i) ?? []).sort((a, b) => a.beat - b.beat)) {
                const name = editor.chordLabel(chord.name, true);
                readerChords.push({ bar, beat: chord.beat, name });
            }
        }
    }
}
function updateReader(bar, fraction) {
    if (reader.hidden) return;
    const info = readerBars[bar - 1];
    if (!info) return;
    const beat = info.beats * fraction;
    const index = readerChords.findLastIndex(chord => chord.bar < bar || chord.bar === bar && chord.beat <= beat + 1e-6);
    readerLocation.textContent = t(`${info.name} · ${bar}小節`, `${info.name} · Bar ${bar}`);
    readerCurrent.textContent = readerChords[index]?.name ?? "—";
    readerNext.textContent = readerChords[index + 1]?.name ?? "—";
    const note = editor.project.annotations?.find(note => note.bar === info.sheetBar);
    const lines = (note?.text ?? "").split("\n").map(line => line.trim()).filter(Boolean);
    const namedLine = lines.find(line => /^#\w+\s/u.test(line) && line.slice(1).split(/\s/u, 1)[0] === info.name);
    const numbered = lines.filter(line => /^#(?:\s|$)/u.test(line));
    const chosen = namedLine ?? (numbered.length ? numbered[info.occurrence % numbered.length] : undefined);
    readerAnnotation.textContent = lines.flatMap(line => {
        if (!line.startsWith("#")) return [line];
        if (line !== chosen) return [];
        return [line.replace(/^#\w*\s*/u, "")];
    }).join("\n");
    readerAnnotation.hidden = !readerAnnotation.textContent;
}
function showReader(visible) {
    reader.hidden = !visible;
    toggleReader.setAttribute("aria-expanded", String(visible));
    if (visible) {
        buildReader();
        updateReader(playbackBar, playbackFraction);
    }
}
toggleReader.onclick = () => showReader(reader.hidden);
const chordDisplayDialog = document.querySelector("#chord-display-key");
const chordDisplaySemitones = document.querySelector("#chord-display-semitones");
try {
    const preference = Number(localStorage.getItem("jjazzlab.chordDisplayTranspose"));
    if (Number.isInteger(preference) && preference >= 0 && preference < 12) editor.displayTranspose = preference;
} catch { /* Preference storage is optional. */ }
document.querySelector("#open-chord-display-key").onclick = () => {
    const keys = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
    chordDisplaySemitones.replaceChildren(new Option(t("コンサートキー", "Concert pitch"), 0),
        ...keys.slice(1).map((key, index) => new Option(`${key} (+${index + 1})`, index + 1)));
    chordDisplaySemitones.value = editor.displayTranspose;
    chordDisplayDialog.showModal();
};
document.querySelector("#cancel-chord-display").onclick = () => chordDisplayDialog.close();
document.querySelector("#chord-display-form").onsubmit = event => {
    event.preventDefault();
    editor.displayTranspose = Number(chordDisplaySemitones.value);
    try { localStorage.setItem("jjazzlab.chordDisplayTranspose", editor.displayTranspose); } catch { /* Preference storage is optional. */ }
    if (editor.project) editor.render();
    chordDisplayDialog.close();
};
document.querySelector("#close-reader").onclick = () => { showReader(false); toggleReader.focus(); };
editor.onRender = () => {
    pianoRoll.sync();
    recentSongs.schedule();
    if (songTabs.active?.project === editor.project) songTabs.refresh();
    if (!reader.hidden) {
        buildReader();
        updateReader(playbackBar, playbackFraction);
    }
};
document.querySelector("#open-piano-roll").onclick = () => pianoRoll.panel.hidden ? pianoRoll.open() : pianoRoll.close();
document.querySelector("#add-user-track").onclick = () => pianoRoll.addTrack();
quickMode.addEventListener("click", () => {
    if (!editor.project) {
        if (draft) {
            const entry = songTabs.entries.find(item => item.project === draft.project);
            if (entry) songTabs.activate(entry);
            else {
                recentSongs.reopeningId = draft.historyId;
                editor.open(draft.project, draft.mix, draft.style, draft.useSavedStyles);
            }
        }
        else document.querySelector("#new-project").click();
        return;
    }
    void recentSongs.flush();
    songTabs.suspend(rhythmEngine.value === "song");
    draft = { project: editor.project, mix: editor.unresolvedStyleMix ?? editor.mix, style: editor.style,
        useSavedStyles: rhythmEngine.value === "song", historyId: recentSongs.id };
    pianoRoll.close();
    showReader(false);
    editor.project = null;
    activeProject = undefined;
    chosenRange = null;
    document.querySelector("#song-editor").hidden = true;
    document.querySelector("#quick-chords").hidden = false;
    chordInput.required = true;
    tempoInput.value = "";
    selectedLibraryStyle = undefined;
    libraryStyle.value = bundledExtension.value = styleInput.value = "";
    rhythmEngine.querySelector('option[value="song"]').hidden = true;
    rhythmEngine.value = "yamaha";
    rhythmEngine.dispatchEvent(new Event("change"));
    player.stop().catch(error => showPlayStatus(error.message, true));
    clearPlayback();
    showStatus("");
    quickMode.setAttribute("aria-pressed", "true");
    workspace.classList.add("quick-view");
    generationControls.open = true;
    chordInput.focus();
});
editor.onMeterChange = meter => {
    if (meter === "THREE_FOUR" && rhythmEngine.value === "jjswing") {
        rhythmEngine.value = "yamaha";
        rhythmEngine.dispatchEvent(new Event("change"));
    }
};
editor.onChanged = () => {
    accompanimentDirty = true;
    scheduleAccompanimentRefresh();
    updateMixerButtons(); updateMenus(); recentSongs.schedule();
    if (songTabs.active?.project === editor.project) songTabs.refresh();
};
editor.onStyleChoices = () => new Map([
    ["jjSwing-ID", "jjSwing"],
    ...[...bundledStyles.keys(), ...Object.keys(embeddedExtendedStyles)].map(name => [`${name}-ID`, name]),
    ...Array.from(styleInput.files, file => [`${file.name}-ID`, file.name]),
    ...Array.from(rhythmLibrary.records.values(), style => [style.id, style.name]),
    ...editor.attachedStyles.map(style => [style.id, style.name]),
    ...(styleArchive?.entries.filter(entry => !styleIssue(entry)).map(entry => [`${entry.name}-ID`, entry.name]) ?? [])
]);
editor.onRhythmCatalogue = choices => {
    const catalog = new Map([...choices, ...editor.onStyleChoices()]);
    const categories = new Map(styleArchive?.entries.map(entry => [`${entry.name}-ID`, entry.category]));
    const meters = new Map([...builtinRhythms, ...rhythmLibrary.records.values()].map(entry => [entry.id, entry.meter]));
    return [...catalog].map(([id, name]) => ({
        id, name, category: categories.get(id),
        provider: id === "jjSwing-ID" ? "jjSwing" : /\.yjz-ID$/iu.test(id) ? "YamJJazz" : "Yamaha",
        meter: meters.get(id)
    })).sort((a, b) => a.name.localeCompare(b.name));
};
editor.hasRhythmPack = () => Boolean(styleArchive);
editor.onLoadRhythmPack = loadStylePack;
editor.onDescribeStyle = async id => {
    engine ??= await getEngine();
    const style = await findSavedStyle(DesktopSongFiles.sourceStyleId(id));
    if (!style) throw new Error(t("スタイルが見つかりません。", "The style could not be found."));
    return describeStyle(style);
};
editor.onDescribeRhythm = async id => {
    const style = await editor.onDescribeStyle(id);
    const name = style.id === "jjSwing-ID" ? "" : style.baseName ?? style.name;
    const voices = Array.from(engine.exports.getRhythmVoices(style.bytes, name,
        style.extension ?? new Int8Array(), style.extension ? style.name : ""), row => {
        const [name, type] = row.split("\t");
        return { name, type };
    });
    return { ...style, voices };
};
let rhythmPreviewEngine;
editor.onStopRhythmPreview = stopAudition;
editor.onPreviewRhythm = async (index, style, variation, stillValid) => {
    if (playing || paused || starting || generating) throw new Error(t("再生を停止してから試聴してください。", "Stop playback before previewing."));
    const audio = player.initialize(showPlayStatus);
    const project = editor.project;
    const part = project.parts[index];
    const section = project.sections[part.section];
    const { sheetStart, sheetEnd } = editor.partRanges()[index];
    const bars = sheetEnd - sheetStart;
    const chords = project.chords.filter(chord => chord.bar >= sheetStart && chord.bar < sheetEnd)
        .map(chord => ({ ...chord, bar: chord.bar - sheetStart }));
    if (!chords.some(chord => chord.bar === 0 && chord.beat === 0)) {
        const previous = project.chords.filter(chord => chord.bar < sheetStart).toSorted((a, b) => a.bar - b.bar || a.beat - b.beat).at(-1);
        chords.unshift({ name: previous?.name ?? "C", bar: 0, beat: 0 });
    }
    const compatible = Object.fromEntries(Object.entries(part.parameters).filter(([id]) => style.parameters.get(id)?.type !== "custom"
        && style.parameters.has(id)));
    if (variation) compatible.rpVariationID = variation;
    const candidate = arrangePart({ ...part, section: 0, parameters: compatible }, style, section.meter);
    const excerpt = { title: project.title, tempo: project.tempo, bars, chords, sections: [{ ...section, bar: 0 }],
        parts: [candidate], userTracks: [] };
    rhythmPreviewEngine ??= instantiateEngine().catch(error => { rhythmPreviewEngine = undefined; throw error; });
    const [wasm] = await Promise.all([rhythmPreviewEngine, audio]);
    if (!stillValid()) return;
    const midi = wasm.exports.generateSongMidiWithChordRendering(...DesktopSongFiles.multiStyleEngineArgs(excerpt, [style], [0], []));
    const beats = Array(bars).fill(DesktopSongFiles.meters[section.meter][1]);
    const preview = parseMidi(midi, bars, wasm.exports.getPartMetadata(), beats);
    const tracks = initialMixerParts(preview, DesktopSongFiles.decodeEngineMix(wasm.exports.getSongMix()));
    const queued = pendingAudition.then(async () => {
        if (!stillValid() || playing || paused || starting || generating) return;
        await player.play(preview, { enabled: false, start: 0, end: preview.duration },
            tracks, Number(masterInput.value) / 100, false, { preview: true, click: false });
    });
    pendingAudition = queued.catch(() => {});
    await queued;
};
editor.onDrumTransformChoices = async () => Array.from((await getEngine()).exports.getDrumTransforms(), row => row.split("\t"));
editor.onStopDrumPreview = stopAudition;
let drumPreviewEngine;
editor.onPreviewDrumTransforms = async (index, value, stillValid) => {
    if (playing || paused || starting || generating) throw new Error(t("再生を停止してから試聴してください。", "Stop playback before previewing."));
    const audio = player.initialize(showPlayStatus);
    audio.catch(() => {});
    const project = editor.project;
    const range = editor.partRanges()[index];
    const preview = { ...project, parts: project.parts.map((part, position) => position === index
        ? { ...part, parameters: { ...part.parameters, RP_SYS_DrumsTransformId: value } } : part) };
    drumPreviewEngine ??= instantiateEngine().catch(error => { drumPreviewEngine = undefined; throw error; });
    const [wasm, arrangement] = await Promise.all([drumPreviewEngine, resolveArrangement(preview, rhythmEngine.value === "jjswing"), audio]);
    if (!stillValid()) return;
    const { parts, sources, styles, overrideStyles } = arrangement;
    wasm.exports.generateSongMidiWithChordRendering(...DesktopSongFiles.multiStyleEngineArgs(
        { ...preview, parts }, [...styles, ...overrideStyles], sources, editor.unresolvedStyleMix ?? editor.mix));
    const style = styles[sources[index]];
    const voices = wasm.exports.getRhythmVoices(style.bytes, style.id === "jjSwing-ID" ? "" : style.baseName ?? style.name,
        style.extension ?? new Int8Array(), style.extension ? style.name : "");
    const drumVoice = Array.from(voices, row => row.split("\t")).find(([, type]) => type === "DRUMS")?.[0];
    const tracks = DesktopSongFiles.decodeEngineMix(wasm.exports.getSongMix());
    const track = tracks.find(track => DesktopSongFiles.sourceStyleId(track.rhythmId) === style.id && track.name === drumVoice);
    if (!track) throw new Error(t("このリズムにドラムトラックがありません。", "This rhythm has no drums track."));
    const generated = wasm.exports.getRhythmTrackPhrase(track.channel);
    const bars = DesktopSongFiles.barBeats(preview);
    const start = bars.slice(0, range.from - 1).reduce((sum, beats) => sum + beats, 0);
    const end = start + bars.slice(range.from - 1, range.to).reduce((sum, beats) => sum + beats, 0);
    const notes = (generated ? UserPhrase.read(generated).notes : []).filter(note => note.position >= start && note.position < end)
        .map(note => ({ ...note, duration: Math.min(note.duration, end - note.position) }));
    if (!notes.length) throw new Error(t("この区間に試聴できるドラム音符がありません。", "There are no drum notes to preview in this song part."));
    const instrument = mixerInstruments.find(item => item.drum && (track.patch === item.patch || track.instrument === item.desktop.id));
    await queueAudition(notes, true, instrument?.program ?? 0, project.tempo, stillValid, { start, end });
};
editor.onEditCustomPhrase = async (index, voice, targets = [index]) => {
    const project = editor.project;
    const part = project.parts[index];
    try {
        const range = editor.partRanges()[index];
        const bars = DesktopSongFiles.barBeats(project);
        const offset = bars.slice(0, range.from - 1).reduce((sum, beats) => sum + beats, 0);
        const end = offset + bars.slice(range.from - 1, range.to).reduce((sum, beats) => sum + beats, 0);
        let phrase = DesktopSongFiles.readCustomPhrases(part.parameters.RP_SYS_CustomPhraseId).get(voice);
        if (!phrase) {
            if ((!song || accompanimentDirty) && !await generateAccompaniment()) return;
            if (editor.project !== project || project.parts[index] !== part) return;
            const id = DesktopSongFiles.sourceStyleId(part.styleId);
            const track = editor.mix.find(track => track.rhythmId === id && track.name === voice);
            if (!track) throw new Error(t("この区間の伴奏トラックを準備できません。", "The accompaniment track for this part is unavailable."));
            const generated = engine.exports.getRhythmTrackPhrase(track.channel);
            const original = generated ? UserPhrase.read(generated) : { channel: track.channel, drum: false, notes: [] };
            const notes = original.notes.filter(note => note.position >= offset && note.position < end)
                .map(note => ({ ...note, position: Math.fround(note.position - offset),
                    duration: Math.fround(Math.min(note.duration, end - note.position)) }));
            phrase = UserPhrase.write({ ...original, notes });
        }
        pianoRoll.openCustom(index, voice, phrase, offset, targets);
    } catch (error) { editor.notify(error.message, true); }
};
editor.onUsePartStyles = () => {
    rhythmEngine.querySelector('option[value="song"]').hidden = false;
    rhythmEngine.value = "song";
    rhythmEngine.dispatchEvent(new Event("change"));
};
editor.onExport = async () => {
    if (!form.reportValidity()) return;
    if (!editor.renderedMix && !await generateAccompaniment()) return;
    editor.export();
};

for (const menu of menus) {
    menu.querySelector("summary").onclick = () => {
        updateMenus();
        for (const other of menus) if (other !== menu) other.open = false;
    };
    menu.addEventListener("click", event => {
        const command = event.target.closest("[data-command]");
        if (command?.dataset.command === "download") {
            void (async () => {
                if (!form.reportValidity()) return;
                if ((download.hidden || accompanimentDirty || tempoDirty) && !await generateAccompaniment()) return;
                download.click();
            })();
        } else if (command) document.getElementById(command.dataset.command).click();
        if (event.target.closest("button, a")) menu.open = false;
    });
}
document.addEventListener("pointerdown", event => {
    for (const menu of menus) if (!menu.contains(event.target)) menu.open = false;
    if (!mixerContext.contains(event.target)) mixerContext.hidden = true;
});
document.querySelector("#show-generation-controls").onclick = () => {
    generationControls.open = true;
    generationControls.scrollIntoView({ block: "nearest" });
    generationControls.querySelector("summary").focus({ preventScroll: true });
};
const songMemo = new SongMemo(editor, folderIO);
structureToggle.onclick = () => {
    const panel = document.querySelector("#structure");
    panel.hidden = !panel.hidden;
    structureToggle.setAttribute("aria-pressed", String(!panel.hidden));
};
document.addEventListener("keydown", event => {
    if (event.key === "Escape") for (const menu of menus) menu.open = false;
    if (event.defaultPrevented || event.target.closest("input, select, textarea, [contenteditable], dialog")) return;
    const primary = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (primary && key === "z") {
        event.preventDefault(); (event.shiftKey ? editor.redoButton : editor.undoButton).click();
    } else if (primary && key === "y") {
        event.preventDefault(); editor.redoButton.click();
    } else if (event.code === "Space" && !primary && event.shiftKey) {
        event.preventDefault(); stopButton.click();
    } else if (event.code === "Space" && !primary && !event.target.closest("button, summary, a")) {
        event.preventDefault();
        (playing ? pauseButton : playButton).click();
    } else if (!primary && !event.altKey) {
        if (key === "f1" || key === "f2") {
            event.preventDefault();
            (key === "f1" ? previousPart : nextPart).click();
        } else if (key === "f3" && (playing || paused)) {
            event.preventDefault();
            if (editor.project) {
                editor.selectPart(0);
                editor.chooseBar(0, 0, undefined, true);
            } else {
                loopStart.value = 1;
                loopEnd.value = song.barTimes.length - 1;
            }
            startPlayback(true);
        } else if (key === "l") {
            event.preventDefault(); toggleLoop.click();
        } else if (["j", "k", "-", "+", "="].includes(key) && !tempoInput.disabled) {
            event.preventDefault();
            const increase = key === "k" || key === "+" || key === "=";
            const tempo = tempoInput.valueAsNumber || 120;
            tempoInput.value = Math.max(Number(tempoInput.min), Math.min(Number(tempoInput.max), tempo + (increase ? 1 : -1)));
            tempoInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }
});
document.querySelector("#ui-language").onchange = event => {
    const language = event.target.value;
    applyLanguage(language);
    try { localStorage.setItem("jjazzlab.language", language); } catch { /* Preference storage is optional. */ }
    if (editor.project) editor.render();
    if (styleArchive) renderStyleChoices();
    tempoInput.placeholder = rhythmEngine.value === "jjswing" ? "120" : t("スタイルの既定値");
    renderMixer();
    updateButtons();
};

document.querySelector("#panic").onclick = () => player.panic().catch(error => showPlayStatus(error.message, true));
const importMix = document.querySelector("#import-mix");
const matchesMixerRhythm = (track, id) => !id || DesktopSongFiles.sourceStyleId(track.rhythmId) === DesktopSongFiles.sourceStyleId(id);
const loadRhythmPresets = () => new Map(JSON.parse(localStorage.getItem(rhythmMixPreference) ?? "[]"));

async function restoreInstrumentMixes(incoming, exactOnly) {
    const project = editor.project;
    if (!project || generating || starting || editor.unresolvedStyleMix !== undefined) return false;
    if ((!song || accompanimentDirty || activeProject !== project) && !await generateAccompaniment()) return false;
    if (editor.project !== project) return false;
    if (editor.unresolvedStyleMix !== undefined) {
        throw new Error(t("曲が参照するスタイルを読み込んでから、ミックスを適用してください。",
            "Load the styles referenced by the song before applying its mix."));
    }
    const previous = editor.mix;
    const merged = DesktopSongFiles.mergeInstrumentMixes(previous, incoming, exactOnly);
    if (!merged) throw new Error(t("この曲と共通のトラックがありません。", "The mix shares no tracks with this song."));
    editor.mix = merged;
    if (!await generateAccompaniment()) {
        editor.mix = previous;
        return false;
    }
    if (JSON.stringify(editor.mix) !== JSON.stringify(previous)) songTabs.mixEdited();
    return true;
}

reloadSongMix.onclick = async () => {
    try {
        if (await restoreInstrumentMixes(editor.openedMix, false)) {
            editor.notify(t("読み込み時のミックスを適用しました。", "Restored the mix loaded with the song."));
        }
    } catch (error) { editor.notify(error.message, true); }
};
restoreFactoryMix.onclick = async () => {
    const selected = selectedMixerRhythm;
    if (accompanimentDirty && !await generateAccompaniment()) return;
    if (await generateAccompaniment(false, selected)) {
        editor.notify(t("既定の音色と設定に戻しました。", "Restored default instruments and settings."));
    }
};
saveRhythmMix.onclick = () => {
    try {
        const presets = loadRhythmPresets();
        const visible = editor.mix.filter(track => !DesktopSongFiles.isUserMixTrack(track) && matchesMixerRhythm(track, selectedMixerRhythm));
        for (const [id, tracks] of Map.groupBy(visible, track => track.rhythmId)) presets.set(id, tracks);
        localStorage.setItem(rhythmMixPreference, JSON.stringify([...presets]));
        editor.notify(t("リズム別ミックスを保存しました。", "Saved the rhythm mix presets."));
    } catch (error) { editor.notify(error.message, true); }
};
loadRhythmMix.onclick = async () => {
    try {
        const presets = loadRhythmPresets();
        const ids = new Set(editor.mix.filter(track => matchesMixerRhythm(track, selectedMixerRhythm)).map(track => track.rhythmId));
        const tracks = [...ids].flatMap(id => presets.get(id) ?? []);
        if (!tracks.length) throw new Error(t("該当するリズムの保存済みミックスがありません。", "No mix preset has been saved for these rhythms."));
        if (await restoreInstrumentMixes(tracks, true)) editor.notify(t("リズム別ミックスを適用しました。", "Applied the rhythm mix presets."));
    } catch (error) { editor.notify(error.message, true); }
};
document.querySelector("#import-mix-button").onclick = () => importMix.click();
importMix.onchange = async () => {
    const file = importMix.files[0];
    importMix.value = "";
    if (!file || !editor.project || generating || starting || editor.unresolvedStyleMix !== undefined) return;
    const project = editor.project;
    try {
        const incoming = DesktopSongFiles.readMix(await file.text());
        if (editor.project !== project || generating || starting) return;
        if (await restoreInstrumentMixes(incoming, false)) editor.notify(t(`${file.name} を読み込みました。`, `Imported ${file.name}.`));
    } catch (error) { editor.notify(error.message, true); }
};

async function defaultArrangementStyle(meter, replaced) {
    await rhythmLibrary.ready;
    const preferred = rhythmLibrary.defaultFor(meter);
    if (preferred) return { ...(preferred.bytes ? preferred : await findSavedStyle(preferred.id)), replaced };
    const name = meter === "THREE_FOUR" ? bundledJazzWaltz : bundledStyle;
    return { ...await readBundledArrangementStyle(name), replaced };
}

async function readBundledArrangementStyle(name) {
    return { name, id: `${name}-ID`, bytes: new Int8Array(await decompress(bundledStyles.get(name))) };
}

async function readArrangementStyle(project, requestedSwing, meter) {
    if (requestedSwing && meter === "FOUR_FOUR") return { name: "jjSwing", id: "jjSwing-ID", bytes: new Int8Array() };
    if (requestedSwing) return defaultArrangementStyle(meter);
    if (styleInput.files.length || selectedLibraryStyle || bundledExtension.value) {
        const style = await readStyle();
        return { ...style, id: `${style.name}-ID` };
    }
    if (editor.attachedStyles.length === 1) {
        const attached = editor.attachedStyles[0];
        return restoreAttachedStyle(attached);
    }
    if (project.parts[0].styleId === "jjSwing-ID") return defaultArrangementStyle(meter);
    return readSavedStyle(DesktopSongFiles.sourceStyleId(project.parts[0].styleId), meter);
}

async function readSavedStyle(id, meter) {
    const style = id === "jjSwing-ID" && meter !== "FOUR_FOUR" ? undefined : await findSavedStyle(id);
    return style ?? defaultArrangementStyle(meter, id.replace(/-ID$/u, ""));
}

async function findSavedStyle(id) {
    if (id === "jjSwing-ID") return { name: "jjSwing", id, bytes: new Int8Array() };
    const wanted = id.replace(/-ID$/u, "");
    const files = Array.from(styleInput.files);
    const file = files.find(file => file.name.toLowerCase() === wanted.toLowerCase());
    if (file) return readLocalStyle(file, files);
    const attached = editor.attachedStyles.find(style => style.id === id);
    if (attached) return restoreAttachedStyle(attached);
    await rhythmLibrary.ready;
    const local = rhythmLibrary.records.get(id);
    if (local) return local;
    const extension = Object.keys(embeddedExtendedStyles).find(name => name.toLowerCase() === wanted.toLowerCase());
    if (extension) return readBundledExtendedStyle(extension);
    const bundled = [...bundledStyles.keys()].find(name => name.toLowerCase() === wanted.toLowerCase());
    if (bundled) return readBundledArrangementStyle(bundled);
    await loadStylePack();
    const entry = styleArchive?.entries.find(entry => entry.name.toLowerCase() === wanted.toLowerCase() && !styleIssue(entry));
    if (entry) return { name: entry.name, id: `${entry.name}-ID`, bytes: new Int8Array(await styleArchive.read(entry)) };
    return undefined;
}

function describeStyle(style) {
    const styleName = style.id === "jjSwing-ID" ? "" : style.baseName ?? style.name;
    const [meter, ...rows] = engine.exports.getRhythmParameters(style.bytes, styleName,
        style.extension ?? new Int8Array(), style.extension ? style.name : "");
    const parameters = new Map(rows.map(row => {
        const [id, name, fallback, type, ...values] = row.split("\t");
        return [id, { id, name, fallback, type, values }];
    }));
    return { ...style, meter, parameters, variations: parameters.get("rpVariationID")?.values ?? [] };
}

function arrangePart(part, style, partMeter) {
    const parameters = { ...part.parameters };
    if (style.id === "jjSwing-ID" || parameters.rpVariationID) {
        parameters.rpVariationID = selectVariation(parameters.rpVariationID, style.variations);
    }
    if (partMeter === style.meter) return { ...part, styleId: style.id, styleName: style.name, parameters };
    const label = DesktopSongFiles.meters[partMeter][0];
    const provider = style.extension ? "YamJJazzRhythmProviderID" : "YamahaRhythmProviderID";
    return { ...part, styleId: `${provider}___${style.id}___${label}`, styleName: `[${label}]${style.name}`, parameters };
}

function selectVariation(saved, available) {
    const variation = saved?.trim().toLowerCase();
    const exact = available.find(value => value.toLowerCase() === variation);
    if (exact) return exact;

    // Styles can offer additional versions of a Main, Intro, or Ending.
    const family = /^(main [a-e]|fill in [a-z]+|intro|ending)\b/u.exec(variation ?? "")?.[1];
    if (family) {
        const compatible = available.find(value => value.toLowerCase().startsWith(`${family}-`)
            || value.toLowerCase().startsWith(`${family} `));
        if (compatible) return compatible;
    }
    return available[0];
}

function liveSongKeys(project) {
    const structure = JSON.stringify([project.bars, project.loopRestartBar, rhythmEngine.value,
        project.sections.map(section => [section.bar, section.meter]),
        project.parts.map(part => [part.section, part.styleId, part.parameters.rpTempoID ?? "100"]),
        project.userTracks.map(track => track.name)]);
    const music = JSON.stringify([
        project.chords.map(chord => [chord.bar, chord.beat, chord.name, chord.features, chord.scale, chord.alternate]),
        project.parts.map(part => Object.entries(part.parameters).sort()),
        project.userTracks.map(track => track.phrase)
    ]);
    return { structure, music };
}

function withBrowserPatches(track) {
    const equivalent = mixerInstruments.find(instrument => instrument.desktop.id === track.instrument);
    return equivalent ? { ...track, patch: equivalent.patch } : track;
}

function scheduleAccompanimentRefresh() {
    if ((!playing && !paused) || generating || starting || !liveArrangement || editor.project !== activeProject
        || player.previewing || player.loadedSong !== song) return;
    const version = ++liveVersion;
    clearTimeout(liveTimer);
    const cancel = player.refresh(null, version).then(() => {
        for (const pending of liveCandidates.keys()) if (pending < version) liveCandidates.delete(pending);
    });
    cancel.catch(error => showPlayStatus(error.message, true));
    const project = editor.project;
    if (liveArrangement.structure !== liveSongKeys(project).structure) {
        showStatus("次回の再生から変更を反映します。");
        return;
    }
    liveTimer = setTimeout(async () => {
        const active = () => version === liveVersion && editor.project === project && (playing || paused) && !generating && !starting;
        try {
            await cancel;
            if (!active()) return;
            const { music, structure } = liveSongKeys(project);
            if (music === liveArrangement.music) {
                accompanimentDirty = false;
                return;
            }
            const snapshot = structuredClone(project);
            const ready = liveEngine ??= instantiateEngine().catch(error => { liveEngine = undefined; throw error; });
            const [wasm, resolution] = await Promise.all([ready, resolveArrangement(snapshot, rhythmEngine.value === "jjswing")]);
            if (!active()) return;
            const { parts, styles, overrideStyles, sources } = resolution;
            const arrangement = { ...snapshot, parts, tempo: renderedTempo };
            const mix = (editor.unresolvedStyleMix ?? editor.mix).map(withBrowserPatches);
            const midi = wasm.exports.generateSongMidiWithChordRendering(...DesktopSongFiles.multiStyleEngineArgs(
                arrangement, [...styles, ...overrideStyles], sources, mix));
            const metadata = wasm.exports.getPartMetadata();
            const barBeats = DesktopSongFiles.barBeats(arrangement);
            const replacement = parseMidi(midi, barBeats.length, metadata, barBeats);
            const trackIndices = new Map(song.parts.map((part, index) => [part.id, index]));
            const indices = replacement.parts.map(part => trackIndices.get(part.id));
            if (indices.includes(undefined) || replacement.barTimes.length !== song.barTimes.length
                || replacement.barTimes.some((time, index) => Math.abs(time - song.barTimes[index]) > .002)) {
                showStatus("次回の再生から変更を反映します。");
                return;
            }
            const events = replacement.events.map(event => ({ ...event, part: indices[event.part] }));
            const refreshed = { ...song, events };
            liveCandidates.set(version, { project, music, structure, song: refreshed, midi, metadata });
            await player.refresh(refreshed, version);
        } catch {
            if (active()) showStatus("次回の再生から変更を反映します。");
        }
    }, 350);
}

player.onRefreshApplied = version => {
    const candidate = liveCandidates.get(version);
    liveCandidates.delete(version);
    if (!candidate || candidate.project !== editor.project || player.previewing) return;
    song = player.loadedSong = candidate.song;
    generatedMidi = candidate.midi;
    liveArrangement = { music: candidate.music, structure: candidate.structure };
    const exportedMidi = exportGmMidi(candidate.midi, candidate.metadata);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([exportedMidi], { type: "audio/midi" }));
    download.href = downloadUrl;
    if (version === liveVersion) {
        accompanimentDirty = false;
        showStatus(t("演奏中の伴奏を更新しました。", "Updated the accompaniment during playback."));
    }
};

async function resolveArrangement(project, requestedSwing) {
    const styles = [], sources = [], replacedStyles = new Map();
    const byId = new Map();
    const firstMeter = project.sections[project.parts[0].section].meter;
    const mixedMeters = project.parts.some(part => project.sections[part.section].meter !== firstMeter);
    if (rhythmEngine.value === "song" || (requestedSwing && mixedMeters)) {
        const bySource = new Map();
        for (const part of project.parts) {
            const id = DesktopSongFiles.sourceStyleId(part.styleId);
            const meter = project.sections[part.section].meter;
            const key = id === "jjSwing-ID" ? `${id}:${meter}` : id;
            if (!bySource.has(key)) {
                const style = await readSavedStyle(id, meter);
                if (style.replaced) replacedStyles.set(style.replaced, style.name);
                if (!byId.has(style.id)) {
                    byId.set(style.id, styles.length);
                    styles.push(describeStyle(style));
                }
                bySource.set(key, byId.get(style.id));
            }
            sources.push(bySource.get(key));
        }
    } else {
        const allowSwing = requestedSwing && ["FOUR_FOUR", "THREE_FOUR"].includes(firstMeter);
        let style = describeStyle(await readArrangementStyle(project, allowSwing, firstMeter));
        const hasAdaptedStyle = project.parts.some(part => DesktopSongFiles.sourceStyleId(part.styleId) !== part.styleId);
        if (style.meter !== firstMeter && !mixedMeters && !hasAdaptedStyle && ["THREE_FOUR", "FOUR_FOUR"].includes(firstMeter)) {
            style = describeStyle(await defaultArrangementStyle(firstMeter, style.name));
        }
        if (style.replaced) replacedStyles.set(style.replaced, style.name);
        styles.push(style);
        sources.push(...project.parts.map(() => 0));
    }
    const parts = project.parts.map((part, index) => arrangePart(part, styles[sources[index]], project.sections[part.section].meter));
    const overrideStyles = [], missingOverrides = [];
    const available = new Set(styles.map(style => style.id.toLowerCase()));
    for (const id of DesktopSongFiles.overrideStyleIds(parts)) {
        if (available.has(id.toLowerCase())) continue;
        const name = id.replace(/-ID$/u, "");
        try {
            const style = await findSavedStyle(id);
            if (!style) {
                missingOverrides.push(name);
                continue;
            }
            overrideStyles.push(describeStyle(style));
            available.add(style.id.toLowerCase());
        } catch (error) {
            missingOverrides.push(`${name} (${error.message})`);
        }
    }
    return { styles, sources, parts, replacedStyles, overrideStyles, missingOverrides };
}

form.addEventListener("input", event => {
    if (event.target === styleSearch || event.target === styleCategory || event.target === tempoInput) return;
    accompanimentDirty = true;
    if (song) showStatus("次回の再生から変更を反映します。");
    if (editor.project) {
        editor.changed();
    }
});
tempoInput.addEventListener("input", () => {
    if (!tempoInput.validity.valid) return;
    const tempo = tempoInput.valueAsNumber;
    if (editor.project && Number.isFinite(tempo)) editor.project.tempo = tempo;
    recentSongs.schedule();
    if (editor.project) songTabs.refresh();
    tempoDirty = Boolean(song && tempo !== renderedTempo);
    if (playing || paused) player.tempo(playbackTempoRate()).catch(error => showPlayStatus(error.message, true));
});

form.addEventListener("submit", event => {
    event.preventDefault();
    void generateAccompaniment();
});

async function generateAccompaniment(fromPlay = false, factoryRhythm) {
    if (generating || (starting && !fromPlay)) return false;
    clearDownload();
    const project = editor.project;
    const chords = chordInput.value.split(/[\s,|]+/u).filter(Boolean);
    if (!project && !chords.length) {
        showStatus("コードを1つ以上入力してください。", true);
        chordInput.focus();
        return false;
    }

    const tempo = tempoInput.valueAsNumber || 0;
    const solo = new Set(activeProject === project ? mixerParts.filter(part => part.solo).map(part => part.id) : []);
    generating = true; updateButtons();
    options.disabled = true;
    document.querySelector("#song-editor").inert = true;
    showStatus("MIDIを生成しています…");
    try {
        await pendingAudition;
        await player.stop();
        clearPlayback();
        if (!engine) {
            try {
                engine = await getEngine();
            } catch {
                throw new Error("Wasmを読み込めませんでした。WasmGCとgzip展開に対応したブラウザで開いてください。");
            }
        }
        const requestedSwing = rhythmEngine.value === "jjswing";
        let style, bars = chords.length, barBeats;
        let midi;
        if (project) {
            if (!project.chords.length) throw new Error("コードを1つ以上入力してください。");
            const { styles, sources, parts, replacedStyles, overrideStyles, missingOverrides } = await resolveArrangement(project, requestedSwing);
            const allStyles = [...styles, ...overrideStyles];
            const followSong = rhythmEngine.value === "song";
            const unresolved = followSong && replacedStyles.size > 0;
            const savedStyleMix = editor.unresolvedStyleMix ?? editor.mix;
            let inputMix = followSong && !unresolved ? savedStyleMix : editor.mix;
            style = styles.length === 1 ? styles[0] : { name: project.title };
            const arrangement = { ...project, tempo: tempo || project.tempo, parts };
            const renderMidi = mix => engine.exports.generateSongMidiWithChordRendering(
                ...DesktopSongFiles.multiStyleEngineArgs(arrangement, allStyles, sources, mix.map(withBrowserPatches)));
            if (factoryRhythm !== undefined && inputMix.length) {
                renderMidi([]);
                const factory = DesktopSongFiles.decodeEngineMix(engine.exports.getSongMix())
                    .filter(track => DesktopSongFiles.isUserMixTrack(track) || matchesMixerRhythm(track, factoryRhythm));
                inputMix = DesktopSongFiles.mergeInstrumentMixes(inputMix, factory, true) ?? inputMix;
            }
            midi = renderMidi(inputMix);
            const defaults = DesktopSongFiles.decodeEngineMix(engine.exports.getSongMix());
            const applied = engine.exports.wasImportedMixApplied();
            const original = new Map(inputMix.map(track => [`${track.rhythmId}\t${track.name}`, track]));
            const keepAssignments = applied && original.size === defaults.length
                && defaults.every(track => original.has(`${track.rhythmId}\t${track.name}`));
            const completeMix = defaults.map(track => {
                if (!applied) return track;
                const source = original.get(`${track.rhythmId}\t${track.name}`);
                if (!source) return track;
                return { ...source, sourceChannel: keepAssignments ? source.sourceChannel ?? source.channel : track.channel, channel: track.channel };
            });
            const notices = [];
            if (requestedSwing && (styles.length !== 1 || styles[0].id !== "jjSwing-ID")) {
                notices.push("jjSwingは4/4専用のため、この曲の拍子に対応するスタイルで演奏します。");
            }
            for (const [requested, replacement] of replacedStyles) {
                notices.push(t(`「${requested}」の代わりに「${replacement}」を使用しました。`, `Using “${replacement}” in place of “${requested}”.`));
            }
            if (missingOverrides.length) {
                const names = missingOverrides.join(", ");
                notices.push(t(`上書き先のスタイルが見つからないため、元のトラックで演奏します: ${names}。`,
                    `Using the original tracks for unavailable override styles: ${names}.`));
            }
            if (followSong) {
                const fallbackParts = new Set(project.parts.filter((part, index) => part.parameters.rpVariationID
                    && part.parameters.rpVariationID !== parts[index].parameters.rpVariationID).map(part => part.name));
                if (fallbackParts.size) {
                    const names = [...fallbackParts].join(", ");
                    notices.push(t(`利用できないバリエーションを演奏時のみ代替: ${names}。`, `Using a playback-only variation substitute in: ${names}.`));
                }
            }
            if (inputMix.length && !applied) notices.push(t("スタイルやトラックが異なるため、既定ミックスを使用しました。"));
            if (unresolved) notices.push(t("元のリズム指定とミックスを保存します。代替スタイルのミックス調整は今回の再生用です。",
                "Saved files keep the original styles and mix. Mixer edits to replacement styles apply to playback in this session."));
            const substitutes = defaults.filter((track, index) => track.patch !== completeMix[index].patch).map(track => track.name);
            if (substitutes.length) notices.push(`Web音源で音色を代替: ${substitutes.join("、")}。`);
            editor.notify(notices.join(" "));
            editor.baseMix = editor.renderedMix = editor.mix = completeMix;
            editor.unresolvedStyleMix = unresolved ? savedStyleMix : undefined;
            if (!followSong) editor.project.parts = arrangement.parts;
            editor.project.tempo = arrangement.tempo;
            editor.styleParameters = new Map(styles.map(style => [style.id, style.parameters]));
            editor.render();
            const attached = new Map((followSong ? editor.attachedStyles : []).map(style => [style.id, style]));
            for (const style of allStyles.filter(item => item.attach)) attached.set(style.id, { name: style.name, id: style.id,
                data: Array.from(new Uint8Array(style.bytes.buffer)), ...(style.extension ? { baseName: style.baseName,
                    extensionData: Array.from(new Uint8Array(style.extension.buffer)) } : {}) });
            editor.style = [...attached.values()];
            editor.exportButton.disabled = false;
            activeProject = project;
            barBeats = DesktopSongFiles.barBeats(arrangement);
            bars = barBeats.length;
        } else try {
            style = requestedSwing ? { name: "jjSwing" } : await readStyle();
            if (requestedSwing) {
                midi = engine.exports.generateSwingMidiWithVariation(chords, tempo, swingVariation.value, swingBass.value, swingDrums.value);
            } else if (style.extension) {
                const { variations } = describeStyle(style);
                const variation = extendedVariation.dataset.style === style.name ? selectVariation(extendedVariation.value, variations) : variations[0];
                extendedVariation.replaceChildren(...variations.map(value => new Option(value, value)));
                extendedVariation.dataset.style = style.name;
                extendedVariation.value = variation;
                extendedVariationField.hidden = false;
                midi = engine.exports.generateExtendedMidi(style.bytes, style.baseName, style.extension, style.name, chords, tempo, variation);
            } else {
                midi = engine.exports.generateMidi(style.bytes, style.name, chords, tempo);
            }
        } catch (error) {
            console.error(error);
            throw new Error(requestedSwing ? "jjSwingの伴奏を生成できませんでした。コード表記を確認してください。" : error.message);
        }
        const metadata = engine.exports.getPartMetadata();
        song = parseMidi(midi, bars, metadata, barBeats);
        generatedMidi = midi;
        renderedTempo = tempo || project?.tempo || song.bpm;
        if (project?.loopRestartBar !== undefined) {
            song.restartBars = editor.partRanges().filter(range => project.loopRestartBar >= range.sheetStart && project.loopRestartBar < range.sheetEnd)
                .map(range => range.from + project.loopRestartBar - range.sheetStart);
        }
        const exportedMidi = exportGmMidi(midi, metadata);
        downloadUrl = URL.createObjectURL(new Blob([exportedMidi], { type: "audio/midi" }));
        download.href = downloadUrl;
        download.download = style.name.replace(/\.[^.]+$/u, "") + "-accompaniment.mid";
        download.hidden = false;
        mixerParts = initialMixerParts(song, project ? editor.baseMix : null);
        for (const part of mixerParts) if (solo.has(part.id)) part.solo = true;
        loopStart.value = chosenRange?.to <= bars ? chosenRange.from : 1;
        loopEnd.value = chosenRange?.to <= bars ? chosenRange.to : bars;
        loopStart.max = loopEnd.max = bars;
        localizedText(loopStatus, "終了小節を含めて繰り返します。"); loopStatus.removeAttribute("data-error");
        renderMixer();
        // Do not send settings to the previous song's worklet parts while stopped.
        player.loadedSong = null;
        updatePosition({ seconds: 0, playing: false });
        accompanimentDirty = false;
        liveArrangement = project ? liveSongKeys(project) : undefined;
        showStatus(`${bars}小節・${song.parts.length}パートの伴奏を生成しました。`, false,
            `Accompaniment ready · ${bars} bars · ${song.parts.length} tracks.`);
        return true;
    } catch (error) {
        showStatus(error.message, true);
        return false;
    } finally {
        options.disabled = starting;
        document.querySelector("#song-editor").inert = false;
        generating = false; updateButtons();
    }
}
const chordInspector = new ChordInspector({
    describe: async name => {
        const wasm = (await getEngine()).exports;
        const [, tones, ...pitches] = Array.from(wasm.getChordPreview(name));
        const scales = Array.from(wasm.getChordScales(name), row => {
            const [id, , name, pitches] = row.split("\t");
            return { id, name, pitches: JSON.parse(pitches) };
        });
        const note = (/\/([A-G][#b]?)$/u.exec(name) ?? /^([A-G][#b]?)/u.exec(name))?.[1];
        const degrees = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
        const bass = note ? (degrees[note[0]] + (note[1] === "b" ? -1 : note[1] === "#" ? 1 : 0) + 12) % 12 : undefined;
        return { tones, pitches: pitches.map(Number), bass, scales };
    },
    play: (name, active) => editor.onAuditionChords([name], active),
    stop: stopAudition
});
editor.onInspectChord = chord => chordInspector.open(chord);
document.querySelector("#open-chord-inspector").onclick = () => {
    if (editor.project) return editor.onInspectChord(editor.selectedChord ?? editor.chordsForTools()[0] ?? editor.project.chords[0]);
};

const midiOutput = new MidiOutput(() => {
    player.stopMidi();
    if (player.ready) player.send("midi-disable").catch(error => showPlayStatus(error.message, true));
});
player.onMidiStop = () => midiOutput.silence();
player.onMidi = (messages, context) => {
    try { midiOutput.emit(messages, context); }
    catch (error) {
        midiOutput.silence(true);
        midiOutput.onDisconnect();
        showPlayStatus(error.message, true);
    }
};

const instrumentDefaults = new InstrumentDefaults({
    instruments: () => mixerInstruments,
    prepare: getEngine,
    audition: (instrument, active) => {
        const pitches = instrument.drum ? [36, 38, 42, 51] : [60, 64, 67, 72];
        const notes = pitches.map((pitch, index) => ({ pitch, position: index * .5, duration: .4, velocity: 90 }));
        queueAudition(notes, instrument.drum, instrument.program, 120, active);
    },
    stop: stopAudition,
    update: () => {
        renderMixer();
        player.mix(instrumentDefaults.playbackMix(mixerParts), Number(masterInput.value) / 100);
    }
});

const midiRemote = new MidiRemote([
    { id: "play", note: 24, japanese: "再生", english: "Play", run: () => playButton.click() },
    { id: "stop", note: 26, japanese: "停止", english: "Stop", run: () => stopButton.click() },
    { id: "pause", japanese: "一時停止", english: "Pause", run: () => pauseButton.click() },
    { id: "restart", note: 28, japanese: "再生範囲の先頭へ", english: "Restart playback",
        run: () => { if (playing || paused) void startPlayback(true); } },
    { id: "previous-part", note: 25, japanese: "前の演奏区間", english: "Previous song part", run: () => previousPart.click() },
    { id: "next-part", note: 27, japanese: "次の演奏区間", english: "Next song part", run: () => nextPart.click() },
    { id: "play-selection", note: 32, japanese: "選択範囲のみ再生", english: "Play selection",
        run: () => { if (editor.project) editor.playSelection(); } },
    { id: "loop", note: 33, japanese: "ループ切り替え", english: "Toggle loop", run: () => toggleLoop.click() },
    { id: "previous-variation", note: 21, japanese: "前のバリエーション", english: "Previous variation",
        run: () => void changeRemoteVariation(-1) },
    { id: "next-variation", note: 23, japanese: "次のバリエーション", english: "Next variation",
        run: () => void changeRemoteVariation(1) },
    ...["A", "B", "C", "D"].map((letter, index) => ({
        id: `variation-${letter}`, note: [14, 16, 17, 19][index], japanese: `バリエーション ${letter}`, english: `Variation ${letter}`,
        run: () => void changeRemoteVariation(letter)
    })),
    { id: "transpose-down", note: 29, japanese: "半音下げる", english: "Transpose down a semitone",
        run: () => { if (editor.project) void editor.transposeChords(-1); } },
    { id: "transpose-up", note: 31, japanese: "半音上げる", english: "Transpose up a semitone",
        run: () => { if (editor.project) void editor.transposeChords(1); } }
], () => player.initialize(showPlayStatus).catch(error => showPlayStatus(error.message, true)));

document.querySelector("#new-project").click();
bootingSong = false;
void recentSongs.restore(songTabs.startup).then(() => songTabs.restore());
