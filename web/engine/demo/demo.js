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
    if (selectedLibraryStyle) { styleInput.value = ""; bundledExtension.value = ""; }
    extendedVariationField.hidden = true;
    accompanimentDirty = true;
    if (song) showStatus("次回の再生から変更を反映します。");
});
styleInput.addEventListener("change", () => {
    selectedLibraryStyle = undefined; libraryStyle.value = ""; bundledExtension.value = "";
    extendedVariationField.hidden = true;
});
bundledExtension.addEventListener("change", () => {
    if (bundledExtension.value) { selectedLibraryStyle = undefined; libraryStyle.value = ""; styleInput.value = ""; }
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
let playbackBar = 1;
let mixerParts = [];
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
const quickMode = document.querySelector("#quick-mode");
const generationControls = document.querySelector("#generation-controls");
const muteAll = document.querySelector("#mute-all");
const clearSolo = document.querySelector("#clear-solo");
const saveMix = document.querySelector("#save-mix");
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
    paused = playing = false; starting = false; updateButtons(); showPlayStatus(message, true);
});

function updateButtons() {
    generateButton.disabled = tempoInput.disabled = generating || starting;
    document.querySelector("#new-project").disabled = document.querySelector("#open-project-button").disabled
        = document.querySelector("#open-project").disabled = quickMode.disabled = generating || starting;
    playButton.disabled = generating || starting || playing;
    stopButton.disabled = generating || starting || (!playing && !paused && playbackBar === 1);
    pauseButton.disabled = generating || starting || !playing;
    playButton.setAttribute("aria-pressed", String(playing));
    stopButton.setAttribute("aria-pressed", String(!playing && !paused));
    pauseButton.setAttribute("aria-pressed", String(paused));
    previousPart.disabled = generating || starting || !editor.project || playbackBar <= 1;
    nextPart.disabled = generating || starting || !editor.project || !editor.partRanges().some(range => range.from > playbackBar);
    previousPart.disabled ||= quickMode.getAttribute("aria-pressed") === "true";
    editor.exportButton.disabled = document.querySelector("#save-project").disabled = !editor.project || starting || generating;
    structureToggle.disabled = !editor.project;
    document.querySelector("#add-user-track").disabled = !editor.project || generating || starting;
    document.querySelector("#open-song-memo").disabled = !editor.project || generating || starting;
    editor.updateUndo();
    editor.undoButton.disabled ||= generating || starting;
    editor.redoButton.disabled ||= generating || starting;
    updateMixerButtons();
    document.querySelector("#loop-controls").disabled = !song || starting || generating;
    updateMenus();
}

function updateMenus() {
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
    let bar = song.barTimes.findIndex(time => time > position.seconds);
    if (bar < 0) bar = song.barTimes.length - 1;
    const beat = song.beatTimes.findLast(beat => beat.seconds <= position.seconds + .00002);
    displayPosition(Math.max(1, bar), beat?.bar === bar ? beat.beat : 1, position.seconds);
    if (editor.project) editor.showPlayingBar((playing || paused) && showPoint.getAttribute("aria-pressed") === "true" ? bar : 0);
    const from = song.barTimes[bar - 1], to = song.barTimes[bar];
    pianoRoll.position(bar, Math.max(0, Math.min(1, (position.seconds - from) / (to - from))), playing || paused);
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
        const limit = value => Math.max(0, Math.min(127, Math.round(value)));
        editor.mix = editor.baseMix.map(track => {
            const part = mixerParts.find(part => part.channel === track.channel);
            if (!part) return track;
            const instrument = part.instrumentChoice;
            return { ...track, volume: limit(track.volume * part.volume), pan: limit(track.pan + part.pan * 64), mute: part.mute,
                ...(instrument ? { patch: instrument.patch, instrument: instrument.id, instrumentEnabled: true } : {}),
                reverb: part.reverb, chorus: part.chorus, reverbEnabled: part.reverbEnabled, chorusEnabled: part.chorusEnabled };
        });
        if (editor.renderedMix) editor.renderedMix = editor.mix;
    } else {
        mixerParts.forEach(({ id, volume, pan, mute, solo, instrumentChoice, reverb, chorus, reverbEnabled, chorusEnabled }) => {
            savedMix.set(id, { volume, pan, mute, solo, instrumentChoice, reverb, chorus, reverbEnabled, chorusEnabled });
        });
    }
    player.mix(mixerParts, Number(masterInput.value) / 100);
}

function updateMixerButtons() {
    const allMuted = mixerParts.length > 0 && mixerParts.every(part => part.mute);
    muteAll.setAttribute("aria-pressed", String(allMuted));
    muteAll.disabled = !mixerParts.length;
    clearSolo.disabled = !mixerParts.some(part => part.solo);
    document.querySelector("#reset-mixer").disabled = !mixerParts.length;
    saveMix.disabled = !editor.renderedMix || activeProject !== editor.project || !song;
    document.querySelector("#import-mix-button").disabled = !editor.project || generating || starting || !editor.baseMix?.length
        || activeProject !== editor.project;
    document.querySelector("#panic").disabled = !mixerParts.length;
}

function openChannelEditor(part) {
    const choices = mixerInstruments.filter(instrument => instrument.drum === part.drum)
        .map(instrument => part.usesDesktopSoundFont ? { ...instrument, ...instrument.desktop } : instrument);
    const current = part.instrumentChoice?.id ?? "";
    document.querySelector("#channel-editor-title").textContent = `CH ${part.channel + 1} · ${part.name}`;
    channelInstrument.replaceChildren(new Option(t(`${part.originalPatch}（元の音色）`, `${part.originalPatch} (original)`), ""),
        ...choices.map(instrument => new Option(instrument.patch, instrument.id)));
    channelInstrument.value = current;
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
        for (const { key, slider, enabled } of fields) {
            part[key] = slider.valueAsNumber;
            part[`${key}Enabled`] = enabled.checked;
        }
        applyMix();
        channelEditor.close();
        renderMixer();
        document.querySelector(`.strip[data-part-index="${mixerParts.indexOf(part)}"] .channel-edit`)?.focus();
    };
    channelEditor.showModal();
}

function updateChannelButton(part, button) {
    const patch = part.instrumentChoice?.patch ?? part.originalPatch;
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
        drum: /#_#Drums#_#|\bkit\b/iu.test(track.instrument + " " + track.patch)
    }))];
    return tracks.map((part, index) => {
        const track = mix?.find(track => track.channel === part.channel);
        const program = initialEvents.get(`${index}:program`) ?? 0;
        const fallback = mixerInstruments.find(instrument => instrument.drum === part.drum && instrument.program === program);
        const original = { volume: 1, pan: 0, solo: false, mute: track?.mute ?? false,
            instrumentChoice: undefined, originalPatch: track?.patch ?? fallback?.patch ?? `Program ${program + 1}` };
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
    mixerContext.onclick = event => {
        const action = event.target.closest("button")?.dataset.action;
        mixerContext.hidden = true;
        if (action === "settings") edit.click();
        if (action === "mute" || action === "solo") strip.querySelector(`[data-mix="${action}"]`).click();
        if (action === "reset") { Object.assign(part, part.original); renderMixer(); applyMix(); }
    };
    mixerContext.onkeydown = event => {
        if (event.key === "Escape") { mixerContext.hidden = true; edit.focus(); }
    };
    openEditorPopup(mixerContext, x, y);
}

function renderMixer() {
    const container = document.querySelector("#mixer-parts");
    container.replaceChildren();
    document.querySelector("#mixer-empty").hidden = mixerParts.length > 0;
    updateMixerButtons();
    const notes = Map.groupBy(song?.events.filter(event => event.type === 0x90 && event.b) ?? [], event => event.part);
    const styleIds = new Set(mixerParts.map(part => part.styleId).filter(Boolean));
    const orderedParts = mixerParts.map((part, index) => ({ part, index })).sort((a, b) => a.part.channel - b.part.channel);
    for (const { part, index } of orderedParts) {
        const strip = document.createElement("div"); strip.className = "strip";
        strip.dataset.partIndex = index;
        strip.dataset.voice = part.source === "user" ? "user" : part.drum ? "drums" : "rhythm";
        const title = document.createElement("div"); title.className = "part-name"; title.textContent = part.name;
        title.title = part.name;
        const channel = document.createElement("small");
        channel.textContent = `CH ${part.channel + 1}${part.source === "user" ? " · User" : part.drum ? " · Drums" : ""}`;
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

async function startPlayback(restart = false) {
    if (generating || starting || (playing && !restart)) return;
    const refresh = !song || accompanimentDirty;
    if (refresh && !form.reportValidity()) return;
    starting = true; updateButtons(); options.disabled = true;
    try {
        const audio = player.initialize(showPlayStatus);
        // Keep the browser's audio activation while the accompaniment is generated.
        audio.catch(() => {});
        if (refresh && !await generateAccompaniment(true)) return;
        await audio;
        await player.play(song, readLoop(), mixerParts, Number(masterInput.value) / 100, Boolean(editor.project), {
            resume: paused && !restart && !refresh,
            click: metronome.getAttribute("aria-pressed") === "true",
            precount: !restart && precount.getAttribute("aria-pressed") === "true" && precountMode.value,
            tempo: tempoInput.valueAsNumber
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
});

function decompress(encoded) {
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
}

async function loadEngine() {
    const wasm = await decompress(embeddedWasm);
    const url = URL.createObjectURL(new Blob([wasm], { type: "application/wasm" }));
    try {
        const engine = await globalThis.TeaVM.wasmGC.load(url, { nodejs: false });
        mixerInstruments = Array.from(engine.exports.getMixerInstruments(), row => {
            const [program, drum, patch, id] = row.split("\t");
            const bank = embeddedDesktopMixerPatches[drum === "true" ? "Drums" : "GM Bank"];
            return { program: Number(program), drum: drum === "true", patch, id, desktop: bank[program] };
        });
        return engine;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function getEngine() {
    engineLoad ??= loadEngine().catch(error => {
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
    paused = playing = false;
    accompanimentDirty = true;
    song = null;
    mixerParts = [];
    player.loadedSong = null;
    displayPosition();
    localizedText(loopStatus, "");
    loopStatus.removeAttribute("data-error");
    editor.showPlayingBar(0);
    showPlayStatus("");
    clearDownload();
    renderMixer();
    updateButtons();
}

const editor = new SongEditor((opened) => {
    pianoRoll.close();
    chosenRange = null;
    activeProject = undefined;
    usesDesktopSoundFont = !opened.mix.length || opened.mix.some(track => track.instrument?.startsWith("FluidSynth#:#"));
    selectedLibraryStyle = undefined;
    libraryStyle.value = "";
    bundledExtension.value = "";
    styleInput.value = "";
    tempoInput.value = opened.project.tempo;
    const sources = new Set(opened.project.parts.map(part => DesktopSongFiles.sourceStyleId(part.styleId)));
    rhythmEngine.querySelector('option[value="song"]').hidden = sources.size === 1;
    rhythmEngine.value = sources.size > 1 ? "song" : sources.has("jjSwing-ID") ? "jjswing" : "yamaha";
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
}, () => {
    if (!chosenRange) showStatus("選択した小節は曲構成の演奏順に含まれていません。");
    else startPlayback(true);
});
editor.onChordScales = async name => (await getEngine()).exports.getChordScales(name);
const pianoRoll = new PianoRoll(editor, range => {
    chosenRange = range;
    if (song && range.to < song.barTimes.length) {
        loopStart.value = range.from;
        loopEnd.value = range.to;
    }
    startPlayback(true);
});
editor.onRender = () => pianoRoll.sync();
document.querySelector("#open-piano-roll").onclick = () => pianoRoll.panel.hidden ? pianoRoll.open() : pianoRoll.close();
document.querySelector("#add-user-track").onclick = () => pianoRoll.addTrack();
quickMode.addEventListener("click", () => {
    if (!editor.project) {
        if (draft) editor.open(draft.project, draft.mix, draft.style);
        else document.querySelector("#new-project").click();
        return;
    }
    draft = { project: editor.project, mix: editor.mix, style: editor.style };
    pianoRoll.close();
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
editor.onChanged = () => { accompanimentDirty = true; updateMixerButtons(); updateMenus(); };
editor.onStyleChoices = () => new Map([
    ["jjSwing-ID", "jjSwing"],
    ...[...bundledStyles.keys(), ...Object.keys(embeddedExtendedStyles)].map(name => [`${name}-ID`, name]),
    ...editor.attachedStyles.map(style => [style.id, style.name]),
    ...(styleArchive?.entries.filter(entry => !styleIssue(entry)).map(entry => [`${entry.name}-ID`, entry.name]) ?? [])
]);
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
                if ((download.hidden || accompanimentDirty) && !await generateAccompaniment()) return;
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
const songMemo = document.querySelector("#song-memo");
const songMemoText = document.querySelector("#song-memo-text");
const songMemoLinks = document.querySelector("#song-memo-links");
songMemoText.oninput = () => {
    const links = new Set(songMemoText.value.match(/https?:\/\/[^\s<>"\])]+/giu) ?? []);
    songMemoLinks.replaceChildren(...[...links].map(url => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = url;
        link.textContent = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        item.append(link);
        return item;
    }));
    songMemoLinks.hidden = !links.size;
};
document.querySelector("#open-song-memo").onclick = () => {
    if (!editor.project) return;
    songMemoText.value = editor.project.comments ?? "";
    songMemoText.oninput();
    songMemo.showModal();
};
document.querySelector("#cancel-song-memo").onclick = () => songMemo.close();
document.querySelector("#song-memo-form").onsubmit = () => {
    if (songMemoText.value === (editor.project.comments ?? "")) return;
    editor.rememberEdit(editor.captureEdit());
    editor.project.comments = songMemoText.value;
    updateMenus();
};
structureToggle.onclick = () => {
    const panel = document.querySelector("#structure");
    panel.hidden = !panel.hidden;
    structureToggle.setAttribute("aria-pressed", String(!panel.hidden));
};
document.addEventListener("keydown", event => {
    if (event.key === "Escape") for (const menu of menus) menu.open = false;
    if (event.defaultPrevented || event.target.closest("input, select, textarea, [contenteditable], dialog")) return;
    const primary = event.ctrlKey || event.metaKey;
    if (primary && event.key.toLowerCase() === "z") {
        event.preventDefault(); (event.shiftKey ? editor.redoButton : editor.undoButton).click();
    } else if (primary && event.key.toLowerCase() === "y") {
        event.preventDefault(); editor.redoButton.click();
    } else if (event.code === "Space" && !primary && !event.target.closest("button, summary, a")) {
        event.preventDefault();
        (playing ? pauseButton : playButton).click();
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
document.querySelector("#import-mix-button").onclick = () => importMix.click();
importMix.onchange = async () => {
    const file = importMix.files[0];
    importMix.value = "";
    if (!file || !editor.project || activeProject !== editor.project || generating || starting) return;
    const project = editor.project;
    try {
        const key = track => `${track.rhythmId}\t${track.name}`;
        const incoming = new Map(DesktopSongFiles.readMix(await file.text()).map(track => [key(track), track]));
        if (editor.project !== project || activeProject !== project || generating || starting) return;
        const previous = editor.mix;
        if (!previous.some(track => incoming.has(key(track)))) throw new Error(t("この曲と共通のトラックがありません。", "The mix shares no tracks with this song."));
        editor.mix = previous.map(track => {
            const matching = incoming.get(key(track));
            return matching ? { ...track, ...matching, channel: track.channel, sourceChannel: track.sourceChannel ?? track.channel } : track;
        });
        if (!await generateAccompaniment()) {
            editor.mix = previous;
            return;
        }
        editor.notify(t(`${file.name} を読み込みました。`, `Imported ${file.name}.`));
    } catch (error) { editor.notify(error.message, true); }
};

async function defaultArrangementStyle(meter, replaced) {
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
    if (id === "jjSwing-ID" && meter === "FOUR_FOUR") return { name: "jjSwing", id, bytes: new Int8Array() };
    const wanted = id.replace(/-ID$/u, "");
    if (id === "jjSwing-ID") return defaultArrangementStyle(meter, wanted);
    const files = Array.from(styleInput.files);
    const file = files.find(file => file.name.toLowerCase() === wanted.toLowerCase());
    if (file) return readLocalStyle(file, files);
    const attached = editor.attachedStyles.find(style => style.id === id);
    if (attached) return restoreAttachedStyle(attached);
    const extension = Object.keys(embeddedExtendedStyles).find(name => name.toLowerCase() === wanted.toLowerCase());
    if (extension) return readBundledExtendedStyle(extension);
    const bundled = [...bundledStyles.keys()].find(name => name.toLowerCase() === wanted.toLowerCase());
    if (bundled) return readBundledArrangementStyle(bundled);
    await loadStylePack();
    const entry = styleArchive?.entries.find(entry => entry.name.toLowerCase() === wanted.toLowerCase() && !styleIssue(entry));
    if (entry) return { name: entry.name, id: `${entry.name}-ID`, bytes: new Int8Array(await styleArchive.read(entry)) };
    return defaultArrangementStyle(meter, wanted);
}

function describeStyle(style) {
    if (style.id === "jjSwing-ID") return { ...style, meter: "FOUR_FOUR", variations: Array.from(engine.exports.getSwingVariations()) };
    const info = style.extension
        ? engine.exports.getExtendedYamahaStyleInfo(style.bytes, style.baseName, style.extension, style.name)
        : engine.exports.getYamahaStyleInfo(style.bytes, style.name);
    const [meter, ...variations] = Array.from(info);
    return { ...style, meter, variations };
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

async function resolveArrangement(project, requestedSwing) {
    const styles = [], sources = [];
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
        styles.push(style);
        sources.push(...project.parts.map(() => 0));
    }
    const parts = project.parts.map((part, index) => arrangePart(part, styles[sources[index]], project.sections[part.section].meter));
    return { styles, sources, parts };
}

form.addEventListener("input", event => {
    if (event.target === styleSearch || event.target === styleCategory) return;
    accompanimentDirty = true;
    if (song) showStatus("次回の再生から変更を反映します。");
    if (editor.project) {
        editor.changed();
    }
});
tempoInput.addEventListener("input", () => {
    accompanimentDirty = true;
    if (editor.project) {
        if (tempoInput.validity.valid && tempoInput.value) editor.project.tempo = tempoInput.valueAsNumber;
        editor.changed();
    }
    if (song) showStatus("次回の再生からテンポを反映します。");
});

form.addEventListener("submit", event => {
    event.preventDefault();
    void generateAccompaniment();
});

async function generateAccompaniment(fromPlay = false) {
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
    generating = true; updateButtons();
    options.disabled = true;
    document.querySelector("#song-editor").inert = true;
    showStatus("MIDIを生成しています…");
    try {
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
            const { styles, sources, parts } = await resolveArrangement(project, requestedSwing);
            style = styles.length === 1 ? styles[0] : { name: project.title };
            const arrangement = { ...project, tempo: tempo || project.tempo, parts };
            const playbackMix = editor.mix.map(track => {
                const equivalent = mixerInstruments.find(instrument => instrument.desktop.id === track.instrument);
                return equivalent ? { ...track, patch: equivalent.patch } : track;
            });
            midi = engine.exports.generateSongMidiWithChordRendering(...DesktopSongFiles.multiStyleEngineArgs(arrangement, styles, sources, playbackMix));
            const defaults = DesktopSongFiles.decodeEngineMix(engine.exports.getSongMix());
            const applied = engine.exports.wasImportedMixApplied();
            const original = new Map(editor.mix.map(track => [`${track.rhythmId}\t${track.name}`, track]));
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
            for (const resolved of styles) {
                if (resolved.replaced) notices.push(`「${resolved.replaced}」の代わりに「${resolved.name}」を使用しました。`);
            }
            if (editor.mix.length && !applied) notices.push("スタイルやトラックが異なるため、既定ミックスを使用しました。");
            const substitutes = defaults.filter((track, index) => track.patch !== completeMix[index].patch).map(track => track.name);
            if (substitutes.length) notices.push(`Web音源で音色を代替: ${substitutes.join("、")}。`);
            editor.notify(notices.join(" "));
            editor.baseMix = editor.renderedMix = editor.mix = completeMix;
            editor.project.parts = arrangement.parts;
            editor.project.tempo = arrangement.tempo;
            editor.styleVariations = new Map(styles.map(style => [style.id, style.variations]));
            editor.render();
            editor.style = styles.filter(style => style.attach).map(style => ({ name: style.name, id: style.id,
                data: Array.from(new Uint8Array(style.bytes.buffer)), ...(style.extension ? { baseName: style.baseName,
                    extensionData: Array.from(new Uint8Array(style.extension.buffer)) } : {}) }));
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
        loopStart.value = chosenRange?.to <= bars ? chosenRange.from : 1;
        loopEnd.value = chosenRange?.to <= bars ? chosenRange.to : bars;
        loopStart.max = loopEnd.max = bars;
        localizedText(loopStatus, "終了小節を含めて繰り返します。"); loopStatus.removeAttribute("data-error");
        renderMixer();
        // Do not send settings to the previous song's worklet parts while stopped.
        player.loadedSong = null;
        updatePosition({ seconds: 0, playing: false });
        accompanimentDirty = false;
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
document.querySelector("#new-project").click();
