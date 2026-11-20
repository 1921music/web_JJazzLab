"use strict";

const compareUserNotes = (a, b) => a.position - b.position || a.pitch - b.pitch || a.duration - b.duration || a.velocity - b.velocity;
const rhythmPhraseDragType = "application/x-jjazzlab-rhythm-phrase";

// Desktop Phrase.saveAsString and NoteEvent.saveAsString use absolute song beats.
const UserPhrase = {
    read(value) {
        const match = /^\[(drums_)?(\d{1,2})(?:\|(.*))?\]$/us.exec(value.trim());
        if (!match || Number(match[2]) > 15) throw new Error(t("ユーザートラックを読み込めません。", "Cannot read the user track."));
        const notes = match[3] ? match[3].split("|").map(token => {
            const note = /^(\d{1,3}),(?:(FLAT|SHARP),)?(\d{1,3}),([^:]+):(.+)$/u.exec(token);
            const pitch = Number(note?.[1]), velocity = Number(note?.[3]);
            const duration = Math.fround(Number(note?.[4])), position = Math.fround(Number(note?.[5]));
            if (!note || pitch > 127 || velocity > 127 || !Number.isFinite(duration) || duration <= 0
                    || !Number.isFinite(position) || position < 0) {
                throw new Error(t("音符の保存形式が不正です。", "The saved note format is invalid."));
            }
            return { pitch, velocity, duration, position, ...(note[2] ? { accidental: note[2] } : {}) };
        }) : [];
        return { drum: Boolean(match[1]), channel: Number(match[2]), notes };
    },

    write({ drum, channel, notes }) {
        const sorted = notes.toSorted(compareUserNotes);
        const tokens = sorted.map(({ pitch, velocity, duration, position, accidental }) =>
            [pitch, ...(accidental ? [accidental] : []), velocity, duration].join(",") + ":" + position);
        return "[" + [drum ? "drums_" + channel : channel, ...tokens].join("|") + "]";
    }
};

const PIANO_KEYS = 60;
const PIANO_RULER = 38;
const MIN_NOTE = 1 / 96;
const PITCH_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const pitchName = pitch => PITCH_NAMES[pitch % 12] + (Math.floor(pitch / 12) - 1);

class PianoRoll {
    constructor(editor, onPlay) {
        this.editor = editor;
        this.onPlay = onPlay;
        for (const id of ["piano-roll", "roll-track", "roll-scroll", "roll-size", "roll-canvas", "roll-velocity-lane",
            "roll-grid", "roll-snap", "roll-velocity", "roll-zoom", "roll-vertical-zoom", "roll-status", "roll-context", "roll-pitch",
            "roll-position", "roll-length", "roll-note-form"]) {
            this[id] = document.getElementById(id);
        }
        this.panel = this["piano-roll"];
        this.scroll = this["roll-scroll"];
        this.canvas = this["roll-canvas"];
        this.staff = document.querySelector("#roll-score");
        this.staffToggle = document.querySelector("#roll-show-score");
        this.staffOctave = document.querySelector("#roll-score-octave");
        this.drumMapField = document.querySelector("#roll-drum-map");
        this.staffToggle.onclick = () => {
            this.toggleRollButton(this.staffToggle);
            this.updateScoreControls();
            this.queuePaint();
        };
        this.staffOctave.onchange = () => {
            this.editor.setSheetProperty(this.scoreProperty(), this.staffOctave.value);
            this.queuePaint();
        };
        this.drumMapField.onchange = () => this.select([...this.selection]);
        this.tools = [...this.panel.querySelectorAll("[data-roll-tool]")];
        this.selection = new Set();
        this.pixels = this["roll-zoom"].valueAsNumber;
        this.rowHeight = this["roll-vertical-zoom"].valueAsNumber;
        this.tool = "select";
        this.queuePaint = this.queuePaint.bind(this);
        new ResizeObserver(this.queuePaint).observe(this.scroll);
        this.scroll.onscroll = this.queuePaint;
        this.scroll.onpointerdown = event => this.begin(event);
        this.scroll.onpointermove = event => this.move(event);
        this.scroll.onpointerup = event => this.finish(event);
        this.scroll.onpointercancel = () => { this.gesture = null; this.queuePaint(); };
        this.scroll.onkeydown = event => this.key(event);
        this.scroll.oncontextmenu = event => {
            event.preventDefault();
            const point = this.point(event);
            const hit = this.hit(point);
            if (hit && !this.selection.has(hit)) this.select([hit]);
            this.pastePosition = this.quantize(point.beat);
            const menu = this["roll-context"];
            menu.querySelector('[data-action="paste"]').disabled = !this.clipboard?.length;
            openEditorPopup(menu, event.clientX, event.clientY);
        };
        this["roll-context"].onclick = event => {
            const action = event.target.closest("button")?.dataset.action;
            this["roll-context"].hidden = true;
            if (["select", "draw", "erase"].includes(action)) this.setTool(action);
            if (action === "copy") this.copy();
            if (action === "invert") this.invertSelection();
            if (action === "paste") this.paste(this.pastePosition);
            if (action === "delete") this.erase();
            this.scroll.focus({ preventScroll: true });
        };
        document.addEventListener("pointerdown", event => {
            if (!this["roll-context"].contains(event.target)) this["roll-context"].hidden = true;
        });
        this["roll-context"].onkeydown = event => {
            if (event.key === "Escape") {
                this["roll-context"].hidden = true;
                this.scroll.focus({ preventScroll: true });
            }
        };
        for (const button of this.tools) button.onclick = () => this.setTool(button.dataset.rollTool);
        this["roll-track"].onchange = () => this.open(this["roll-track"].value);
        this["roll-snap"].onclick = () => {
            const button = this["roll-snap"];
            button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
            this.queuePaint();
        };
        this["roll-grid"].onchange = this.queuePaint;
        this["roll-zoom"].oninput = () => this.zoom(this["roll-zoom"].valueAsNumber, this.rowHeight);
        this["roll-vertical-zoom"].oninput = () => this.zoom(this.pixels, this["roll-vertical-zoom"].valueAsNumber);
        document.querySelector("#roll-fit").onclick = () => this.fitNotes();
        this.scroll.addEventListener("wheel", event => {
            if ((!event.ctrlKey && !event.metaKey) || !event.deltaY) return;
            event.preventDefault();
            const bounds = this.scroll.getBoundingClientRect();
            const x = Math.max(0, event.clientX - bounds.left - this.keyWidth);
            const y = Math.max(0, event.clientY - bounds.top - PIANO_RULER);
            const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
            if (event.shiftKey) this.zoom(this.pixels, this.rowHeight * factor, x, y);
            else this.zoom(this.pixels * factor, this.rowHeight, x, y);
        }, { passive: false });
        this["roll-velocity"].onchange = () => {
            const input = this["roll-velocity"];
            if (input.validity.valid && Number.isInteger(input.valueAsNumber)) {
                this.defaultVelocity = input.valueAsNumber;
                this.changeSelected(note => ({ ...note, velocity: this.defaultVelocity }));
            }
        };
        this["roll-note-form"].onsubmit = event => {
            event.preventDefault();
            const pitch = this["roll-pitch"].valueAsNumber;
            const position = this["roll-position"].valueAsNumber;
            const duration = this["roll-length"].valueAsNumber;
            this.changeSelected(note => this.fit({ ...note, pitch, position, duration }), true);
        };
        const velocity = this["roll-velocity-lane"];
        velocity.onpointerdown = event => {
            if (!this.selection.size) {
                const bounds = velocity.getBoundingClientRect();
                if (event.clientX - bounds.left < this.keyWidth) return;
                const beat = (event.clientX - bounds.left - this.keyWidth + this.scroll.scrollLeft) / this.pixels;
                const hit = this.phrase.notes.find(note => Math.abs(note.position - beat) <= 6 / this.pixels);
                if (hit) this.select([hit]);
            }
            if (!this.selection.size) return;
            velocity.setPointerCapture(event.pointerId);
            this.velocityDrag = true;
            this.previewVelocity(event);
        };
        velocity.onpointermove = event => { if (this.velocityDrag) this.previewVelocity(event); };
        velocity.onpointerup = event => {
            if (!this.velocityDrag) return;
            this.previewVelocity(event);
            const value = this.velocityPreview;
            this.velocityDrag = false;
            this.velocityPreview = undefined;
            this.defaultVelocity = value;
            this.changeSelected(note => ({ ...note, velocity: value }));
        };
        velocity.onpointercancel = () => { this.velocityDrag = false; this.velocityPreview = undefined; this.queuePaint(); };
        document.querySelector("#roll-quantize").onclick = () => this.quantizeNotes();
        document.querySelector("#roll-humanize").onclick = () => this.humanize();
        const midiFile = document.querySelector("#roll-midi-file");
        document.querySelector("#roll-import-midi").onclick = () => midiFile.click();
        midiFile.onchange = () => {
            const file = midiFile.files[0];
            midiFile.value = "";
            if (file) this.importMidi(file);
        };
        const canImport = event => event.dataTransfer.types.some(type => type === "Files" || type === rhythmPhraseDragType);
        this.scroll.ondragover = event => {
            if (canImport(event)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
            }
        };
        this.scroll.ondrop = event => {
            if (!canImport(event)) return;
            event.preventDefault();
            const phrase = event.dataTransfer.getData(rhythmPhraseDragType);
            if (phrase) {
                try {
                    const notes = UserPhrase.read(phrase).notes;
                    this.importNotes(this.custom ? notes.map(note => ({ ...note, position: note.position - this.custom.offset })) : notes);
                }
                catch (error) { this.editor.notify(error.message, true); }
                return;
            }
            const files = event.dataTransfer.files;
            if (files.length === 1) this.importMidi(files[0]);
            else this.editor.notify(t("MIDIファイルを1つ選択してください。", "Select one MIDI file."), true);
        };
        document.querySelector("#roll-play").onclick = () => this.play();
        this.auditionButton = document.querySelector("#roll-audition");
        this.auditionButton.onclick = () => {
            this.toggleRollButton(this.auditionButton);
            if (this.auditionButton.getAttribute("aria-pressed") === "true") this.hear([...this.selection]);
            else this.onStopAudition?.();
        };
        this.soloButton = document.querySelector("#roll-solo");
        this.soloButton.onclick = () => this.onSolo?.(this.name);
        this.followButton = document.querySelector("#roll-follow");
        this.followButton.onclick = () => this.toggleRollButton(this.followButton);
        document.querySelector("#roll-close").onclick = () => this.close();
        document.querySelector("#roll-rename-track").onclick = () => this.editTrack("rename", this.name);
        document.querySelector("#roll-remove-track").onclick = () => this.editTrack("remove", this.name);
        this.defaultVelocity = 90;
    }

    async importMidi(file) {
        if (this.panel.hidden || !this.savedTrack || this.editor.grid.closest("[inert]")) return;
        const target = this.savedTrack;
        try {
            const mix = this.editor.unresolvedStyleMix ?? this.editor.mix;
            const userTrack = this.custom ? undefined : mix.find(track => DesktopSongFiles.isUserMixTrack(track) && track.name === target.name);
            const channel = userTrack?.sourceChannel ?? userTrack?.channel ?? this.phrase.channel;
            const bytes = new Int8Array(await file.arrayBuffer());
            const engine = await getEngine();
            if (this.panel.hidden || this.savedTrack !== target) return;
            if (this.editor.grid.closest("[inert]")) {
                throw new Error(t("伴奏の準備が終わってから再試行してください。", "Retry after the accompaniment is ready."));
            }
            const notes = UserPhrase.read(engine.exports.importMidiPhrase(bytes, channel, this.phrase.drum)).notes;
            if (!notes.length) {
                throw new Error(t(`MIDIチャンネル ${channel + 1} に取り込める音符がありません。`,
                    `There are no notes to import on MIDI channel ${channel + 1}.`));
            }
            this.importNotes(notes);
        } catch (error) {
            if (!this.panel.hidden && this.savedTrack === target) {
                localizedText(this["roll-status"], `MIDIを読み込めません。 ${error.message}`, `Unable to import MIDI. ${error.message}`);
            }
        }
    }

    importNotes(notes) {
        if (!notes.length || this.panel.hidden || this.editor.grid.closest("[inert]")) return;
        if (this.custom) notes = notes.filter(note => note.position >= 0 && note.position < this.total).map(note => this.fit(note));
        if (!notes.length) return;
        this.commit([...this.phrase.notes, ...notes], notes);
        this.scroll.scrollLeft = Math.max(0, notes[0].position * this.pixels - this.keyWidth);
        this.scroll.scrollTop = (127 - notes[0].pitch + .5) * this.rowHeight - (this.scroll.clientHeight - PIANO_RULER) / 2;
        this.scroll.focus({ preventScroll: true });
    }

    humanize() {
        if (!this.phrase?.notes.length) return;
        const source = this.saved;
        const target = this.savedTrack;
        const dialog = document.querySelector("#roll-humanize-dialog");
        const form = document.querySelector("#roll-humanize-form");
        const selected = document.querySelector("#humanize-selection");
        selected.checked = Boolean(this.selection.size);
        selected.disabled = !selected.checked;
        const sliders = ["timing", "bias", "velocity"].map(field => document.querySelector(`#humanize-${field}`));
        for (const slider of sliders) {
            slider.oninput = () => { form.querySelector(`output[for="${slider.id}"]`).value = slider.value + "%"; };
        }
        document.querySelector("#cancel-humanize").onclick = () => dialog.close();
        form.onsubmit = async event => {
            event.preventDefault();
            const [timing, bias, velocity] = sliders.map(slider => slider.valueAsNumber / 100);
            const selection = selected.checked ? UserPhrase.write({ ...this.phrase, notes: [...this.selection] }) : "";
            dialog.close();
            if (!timing && !bias && !velocity) return;
            try {
                const engine = await getEngine();
                if (this.saved !== source || this.savedTrack !== target || this.panel.hidden || this.editor.grid.closest("[inert]")) return;
                const project = this.editor.project;
                const meter = project.sections[project.parts[this.custom?.index ?? 0].section].meter;
                const modified = engine.exports.humanizePhrase(source, selection, meter, this.total, project.tempo, timing, bias, velocity);
                this.commit(UserPhrase.read(modified).notes);
            } catch (error) { this.editor.notify(error.message, true); }
        };
        dialog.showModal();
    }

    addTrack() {
        this.editTrack("add");
    }

    editTrack(action, currentName) {
        const project = this.editor.project;
        if (!project) return;
        const tracks = project.userTracks;
        const track = tracks.find(track => track.name === currentName);
        if (action !== "add" && !track) return;
        const dialog = document.querySelector("#user-track-editor");
        const form = document.querySelector("#user-track-form");
        const name = document.querySelector("#user-track-name");
        const type = document.querySelector("#user-track-type");
        const removing = action === "remove";
        const adding = action === "add";
        const title = adding ? t("ユーザートラックを追加", "Add user track")
            : removing ? t(`「${currentName}」を削除しますか？`, `Delete “${currentName}”?`)
                : t("トラック名を変更", "Rename track");
        localizedText(document.querySelector("#user-track-editor-title"), title, title);
        localizedText(form.querySelector('[type="submit"]'), removing ? "削除" : "適用", removing ? "Delete" : "Apply");
        document.querySelector("#user-track-name-field").hidden = name.disabled = removing;
        document.querySelector("#user-track-type-field").hidden = type.disabled = !adding;
        document.querySelector("#cancel-user-track").onclick = () => dialog.close();
        let sequence = 1;
        if (adding) while (tracks.some(track => track.name === "User" + sequence)) sequence++;
        name.value = currentName ?? "User" + sequence;
        name.setCustomValidity("");
        name.oninput = () => name.setCustomValidity("");
        type.value = "melodic";
        form.onsubmit = event => {
            event.preventDefault();
            if (this.editor.project !== project || project.userTracks !== tracks) return dialog.close();
            const next = name.value.trim();
            if (!removing && (!next || /[\t\r\n]/u.test(next) || tracks.some(item => item !== track && item.name === next))) {
                name.setCustomValidity(t("使われていない有効なトラック名を入力してください。", "Enter a valid, unused track name."));
                name.reportValidity();
                return;
            }
            if (adding && Math.max(this.editor.mix.filter(item => !DesktopSongFiles.isUserMixTrack(item)).length,
                (this.editor.unresolvedStyleMix ?? []).filter(item => !DesktopSongFiles.isUserMixTrack(item)).length) + tracks.length >= 16) {
                this.editor.notify(t("空いているMIDIチャンネルがありません。", "No MIDI channel is available."), true);
                return dialog.close();
            }
            dialog.close();
            if (action === "rename" && next === currentName) return;
            const wasOpen = !this.panel.hidden && this.name === currentName;
            if (!this.editor.editArrangement(() => {
                if (adding) {
                    tracks.push({ name: next, phrase: UserPhrase.write({ drum: type.value === "drums", channel: 0, notes: [] }) });
                    return;
                }
                if (removing) tracks.splice(tracks.indexOf(track), 1);
                else track.name = next;
                for (const key of ["mix", "unresolvedStyleMix"]) {
                    this.editor[key] = this.editor[key]?.flatMap(item => {
                        if (!DesktopSongFiles.isUserMixTrack(item) || item.name !== currentName) return [item];
                        return removing ? [] : [{ ...item, name: next }];
                    });
                }
            }, [currentName, next])) return;
            if (adding || (!removing && wasOpen)) this.open(next);
            if (adding) this.setTool("draw");
            this.onTracksChanged?.();
        };
        dialog.showModal();
        if (!removing) name.select();
    }

    open(name) {
        const tracks = this.editor.project?.userTracks;
        if (!tracks?.length) return this.addTrack();
        this.custom = null;
        this.name = tracks.find(track => track.name === name)?.name ?? tracks[0].name;
        this.show();
    }

    openCustom(index, voice, phrase, offset, targets = [index]) {
        this.custom = { index, voice, phrase, offset, targets };
        this.name = voice;
        this.show();
    }

    show() {
        this.panel.hidden = false;
        this.rangeStart = this.rangeEnd = undefined;
        this.playhead = undefined;
        if (!this.sync()) return;
        this.onTrackOpened?.();
        this.scroll.scrollLeft = 0;
        const pitch = this.phrase.notes[0]?.pitch ?? 64;
        this.scroll.scrollTop = (127 - pitch + .5) * this.rowHeight - (this.scroll.clientHeight - PIANO_RULER) / 2;
        this.scroll.focus({ preventScroll: true });
    }

    close() {
        this.onStopAudition?.();
        this.panel.hidden = true;
        this["roll-context"].hidden = true;
        this.gesture = null;
        this.name = undefined;
        this.custom = null;
        this.phrase = undefined;
        this.saved = undefined;
        this.select([]);
    }

    sync() {
        if (this.panel.hidden) return false;
        const project = this.editor.project;
        const custom = this.custom;
        const track = this.track();
        if (!track) { this.close(); return false; }
        const encoded = custom ? DesktopSongFiles.readCustomPhrases(track.parameters.RP_SYS_CustomPhraseId).get(this.name) ?? custom.phrase
            : track.phrase;
        const picker = this["roll-track"];
        picker.replaceChildren(...(custom ? [new Option(`${track.name} · ${this.name}`, this.name)]
            : project.userTracks.map(item => new Option(item.name, item.name))));
        picker.disabled = Boolean(custom);
        picker.value = this.name;
        document.querySelector("#roll-rename-track").hidden = document.querySelector("#roll-remove-track").hidden = Boolean(custom);
        if (track !== this.savedTrack || encoded !== this.saved) {
            try { this.phrase = UserPhrase.read(encoded); }
            catch (error) { this.close(); this.editor.notify(error.message, true); return false; }
            this.saved = encoded;
            this.savedTrack = track;
            this.select([]);
        }
        this.boundaries = [0];
        const ranges = this.editor.partRanges();
        const range = custom ? ranges[custom.index] : null;
        this.barOffset = range ? range.from - 1 : 0;
        const bars = DesktopSongFiles.barBeats(project).slice(this.barOffset, range?.to);
        for (const count of bars) this.boundaries.push(this.boundaries.at(-1) + count);
        this.total = this.boundaries.at(-1);
        const sheetChords = Map.groupBy(project.chords, chord => chord.bar);
        this.chords = (range ? [range] : ranges).flatMap(range =>
            Array.from({ length: range.to - range.from + 1 }, (_, offset) =>
                sheetChords.get(range.sheetStart + offset) ?? []));
        this.staffMeters = (range ? [range] : ranges).flatMap(({ index, from, to }) =>
            Array(to - from + 1).fill(project.sections[project.parts[index].section].meter));
        this.updateScoreControls();
        this.measure();
        return true;
    }

    get keyWidth() { return this.phrase?.drum ? 144 : PIANO_KEYS; }

    drumKeyName(pitch) {
        const map = this.drumMapField.value || this.onDrumKeyMap?.() || "GM";
        return embeddedDrumKeyMaps[map]?.[pitch] ?? String(pitch);
    }

    scoreProperty() {
        return `NoteEditorScoreOctaveTransposition#${this.onScoreChannel?.() ?? this.phrase.channel}`;
    }

    scoreOctave() {
        const saved = this.editor.project.clientProperties?.[this.scoreProperty()];
        if (/^-?[0-3]$/u.test(saved)) return Number(saved);
        const notes = this.phrase.notes;
        const avg = notes.length ? notes.reduce((sum, note) => sum + note.pitch, 0) / notes.length : 60;
        const suggested = avg < 43 ? Math.floor((55 - avg) / 12) : avg > 79 ? Math.floor((67 - avg) / 12) : 0;
        return Math.min(3, Math.max(-3, suggested));
    }

    updateScoreControls() {
        const drums = this.phrase.drum;
        this.staffToggle.hidden = this.staffToggle.disabled = drums;
        this.drumMapField.closest("label").hidden = !drums;
        this.staff.hidden = this.staffOctave.closest("label").hidden = drums || this.staffToggle.getAttribute("aria-pressed") !== "true";
        if (!drums) this.staffOctave.value = this.scoreOctave();
    }

    track() {
        const project = this.editor.project;
        return this.custom ? project?.parts[this.custom.index] : project?.userTracks.find(track => track.name === this.name);
    }

    measure() {
        const size = this["roll-size"];
        size.style.width = (this.keyWidth + this.pixels * Math.max(this.total,
            this.phrase.notes.reduce((end, note) => Math.max(end, note.position + note.duration), 0))) + "px";
        size.style.height = (PIANO_RULER + 128 * this.rowHeight) + "px";
        this.queuePaint();
    }

    zoom(pixels, rowHeight, anchorX = 0, anchorY = (this.scroll.clientHeight - PIANO_RULER) / 2) {
        if (!this.phrase) return;
        const beat = (this.scroll.scrollLeft + anchorX) / this.pixels;
        const row = (this.scroll.scrollTop + anchorY) / this.rowHeight;
        this["roll-zoom"].value = pixels;
        this["roll-vertical-zoom"].value = rowHeight;
        this.pixels = this["roll-zoom"].valueAsNumber;
        this.rowHeight = this["roll-vertical-zoom"].valueAsNumber;
        this.measure();
        this.scroll.scrollLeft = beat * this.pixels - anchorX;
        this.scroll.scrollTop = row * this.rowHeight - anchorY;
    }

    fitNotes() {
        if (!this.phrase?.notes.length) return;
        let left = Infinity, right = 0, low = 127, high = 0;
        for (const note of this.phrase.notes) {
            left = Math.min(left, note.position);
            right = Math.max(right, note.position + note.duration);
            low = Math.min(low, note.pitch);
            high = Math.max(high, note.pitch);
        }
        const width = this.scroll.clientWidth - this.keyWidth, height = this.scroll.clientHeight - PIANO_RULER;
        if (width <= 0 || height <= 0) return;
        this.zoom(width / (right - left + 2), height / (high - low + 3));
        this.scroll.scrollLeft = Math.max(0, (left - 1) * this.pixels);
        this.scroll.scrollTop = Math.max(0, (126 - high) * this.rowHeight);
    }

    setTool(tool) {
        this.tool = tool;
        this.scroll.dataset.tool = tool;
        this.tools.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.rollTool === tool)));
    }

    quantize(beat, down = false) {
        const step = this["roll-grid"].valueAsNumber || Number(this["roll-grid"].value);
        return Math.max(0, (down ? Math.floor(beat / step) : Math.round(beat / step)) * step);
    }

    fit(note) {
        const position = Math.min(Math.max(0, this.total - MIN_NOTE), Math.max(0, note.position));
        return { ...note, position: Math.fround(position),
            duration: Math.fround(Math.max(MIN_NOTE, Math.min(this.total - position, note.duration))),
            pitch: Math.min(127, Math.max(0, note.pitch)) };
    }

    point(event) {
        const rect = this.scroll.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        return { x, y, beat: (x - this.keyWidth + this.scroll.scrollLeft) / this.pixels,
            pitch: Math.min(127, Math.max(0, 127 - Math.floor((y - PIANO_RULER + this.scroll.scrollTop) / this.rowHeight))) };
    }

    hit(point) {
        return this.phrase.notes.findLast(note => note.pitch === point.pitch
            && note.position <= point.beat && point.beat <= note.position + Math.max(note.duration, 4 / this.pixels));
    }

    select(notes) {
        this.selection = new Set(notes);
        const first = notes[0];
        for (const [id, value] of [["roll-pitch", first?.pitch], ["roll-position", first?.position], ["roll-length", first?.duration]]) {
            this[id].value = value ?? "";
            this[id].disabled = notes.length !== 1;
        }
        this["roll-note-form"].querySelector("button").disabled = notes.length !== 1;
        this["roll-velocity"].value = first?.velocity || this.defaultVelocity;
        document.querySelector("#roll-humanize").disabled = !this.phrase?.notes.length;
        document.querySelector("#roll-fit").disabled = !this.phrase?.notes.length;
        const count = this.phrase?.notes.length ?? 0;
        const label = this.phrase?.drum && notes.length === 1 ? this.drumKeyName(first.pitch) : undefined;
        localizedText(this["roll-status"], label ?? (notes.length ? notes.length + " 音符を選択" : "音符 " + count),
            label ?? (notes.length ? notes.length + " selected" : count + " notes"));
        this.queuePaint();
    }

    toggleRollButton(button) {
        button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
    }

    hear(notes) {
        if (notes.length && !this.auditionButton.disabled && this.auditionButton.getAttribute("aria-pressed") === "true") {
            this.onAudition?.(notes);
        }
    }

    invertSelection() {
        this.select(this.phrase.notes.filter(note => !this.selection.has(note)));
    }

    commit(notes, selected = []) {
        if (this.track() !== this.savedTrack) return;
        const encoded = UserPhrase.write({ ...this.phrase, notes });
        this.phrase.notes = notes.toSorted(compareUserNotes);
        if (encoded !== this.saved) {
            this.editor.rememberEdit(this.editor.captureEdit());
            this.saved = encoded;
            if (this.custom) {
                for (const index of this.custom.targets) {
                    const part = this.editor.project.parts[index];
                    if (part?.styleId === this.savedTrack.styleId) DesktopSongFiles.setCustomPhrase(part, this.name, encoded);
                }
            } else this.savedTrack.phrase = encoded;
            this.editor.changed();
            this.measure();
        }
        this.select(selected);
    }

    changeSelected(transform, one = false) {
        if (!this.selection.size || (one && this.selection.size !== 1)) return;
        const selected = [];
        const notes = this.phrase.notes.map(note => {
            if (!this.selection.has(note)) return note;
            const changed = transform(note);
            selected.push(changed);
            return changed;
        });
        this.commit(notes, selected);
    }

    quantizeNotes() {
        if (!this.selection.size) this.select(this.phrase.notes);
        this.changeSelected(note => this.fit({ ...note, position: this.quantize(note.position) }));
    }

    begin(event) {
        if (event.button !== 0 || this.editor.grid.closest("[inert]")) return;
        const point = this.point(event);
        if (point.x < this.keyWidth && point.y >= PIANO_RULER) {
            this.hear([{ pitch: point.pitch, position: 0, duration: 2, velocity: 75 }]);
            return;
        }
        if (point.x < this.keyWidth || point.x >= this.scroll.clientWidth || point.y >= this.scroll.clientHeight) return;
        if (point.y >= PIANO_RULER && this.tool === "erase") {
            const hit = this.hit(point);
            if (hit) { this.select([hit]); this.erase(); }
            return;
        }
        const hit = point.y >= PIANO_RULER ? this.hit(point) : undefined;
        const alreadySelected = this.selection.has(hit);
        const modifier = event.ctrlKey || event.metaKey;
        const snap = (this["roll-snap"].getAttribute("aria-pressed") === "true") !== event.altKey;
        if (hit && this.tool === "select" && !this.selection.has(hit)) {
            this.select(modifier || event.shiftKey ? [...this.selection, hit] : [hit]);
        }
        if (hit && this.tool === "select") this.hear([hit]);
        this.gesture = { id: event.pointerId, point, hit, alreadySelected, snap, modifier, shift: event.shiftKey, changed: false,
            kind: point.y < PIANO_RULER ? "ruler" : this.tool === "draw" ? "draw" : !hit ? "box"
                : (hit.position + hit.duration - point.beat) * this.pixels <= 8 ? "resize" : "move" };
        this.scroll.focus({ preventScroll: true });
        this.scroll.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    move(event) {
        const drag = this.gesture;
        if (!drag || drag.id !== event.pointerId) return;
        const point = this.point(event);
        if (!drag.changed && Math.hypot(point.x - drag.point.x, point.y - drag.point.y) < 3) return;
        drag.changed = true;
        drag.end = point;
        if (drag.kind === "draw") drag.preview = [this.drawNote(drag, point)];
        if (drag.kind === "move" || drag.kind === "resize") {
            let delta = point.beat - drag.point.beat;
            if (drag.snap) {
                const edge = drag.hit.position + (drag.kind === "resize" ? drag.hit.duration : 0);
                delta = this.quantize(edge + delta) - edge;
            }
            const notes = [...this.selection];
            if (drag.kind === "move") {
                const lower = Math.min(...notes.map(note => note.position));
                const upper = Math.max(...notes.map(note => note.position + note.duration));
                delta = Math.max(-lower, Math.min(Math.max(0, this.total - upper), delta));
                const pitch = Math.max(-Math.min(...notes.map(note => note.pitch)), Math.min(
                    127 - Math.max(...notes.map(note => note.pitch)), point.pitch - drag.point.pitch));
                drag.preview = notes.map(note => ({ ...note, position: Math.fround(note.position + delta), pitch: note.pitch + pitch }));
            } else {
                drag.preview = notes.map(note => this.fit({ ...note, duration: note.duration + delta }));
            }
        }
        this.queuePaint();
    }

    drawNote(drag, point) {
        const start = Math.min(drag.point.beat, point.beat), end = Math.max(drag.point.beat, point.beat);
        const position = drag.snap ? this.quantize(start, true) : start;
        const length = Number(this["roll-grid"].value);
        const duration = drag.changed ? Math.max(drag.snap ? length : MIN_NOTE,
            (drag.snap ? this.quantize(end) : end) - position) : length;
        return this.fit({ pitch: drag.point.pitch, position, duration, velocity: this.defaultVelocity });
    }

    finish(event) {
        const drag = this.gesture;
        if (!drag || drag.id !== event.pointerId) return;
        this.move(event);
        this.gesture = null;
        const point = this.point(event);
        if (drag.kind === "draw") {
            if (drag.point.beat < this.total) {
                const note = this.drawNote(drag, point);
                this.commit([...this.phrase.notes, note], [note]);
            }
        } else if (drag.kind === "ruler") {
            if (drag.changed || drag.shift) {
                const a = drag.shift && this.rangeStart !== undefined ? this.rangeStart : this.barAt(drag.point.beat);
                const b = this.barAt(point.beat);
                this.rangeStart = Math.min(a, b);
                this.rangeEnd = Math.max(a, b);
            } else { this.rangeStart = this.rangeEnd = undefined; }
        } else if (drag.kind === "box") {
            const notes = drag.changed ? this.phrase.notes.filter(note =>
                note.pitch >= Math.min(point.pitch, drag.point.pitch) && note.pitch <= Math.max(point.pitch, drag.point.pitch)
                && note.position <= Math.max(point.beat, drag.point.beat) && note.position + note.duration >= Math.min(point.beat, drag.point.beat)) : [];
            this.select(drag.shift ? [...new Set([...this.selection, ...notes])] : notes);
            this.hear(notes);
        } else if (drag.preview) {
            const copy = drag.modifier && drag.kind === "move";
            this.commit([...this.phrase.notes.filter(note => copy || !this.selection.has(note)), ...drag.preview], drag.preview);
        } else if (drag.modifier) {
            const selection = [...this.selection];
            if (drag.alreadySelected) this.select(selection.filter(note => note !== drag.hit));
        } else if (!drag.shift) this.select([drag.hit]);
        this.queuePaint();
    }

    previewVelocity(event) {
        const bounds = this["roll-velocity-lane"].getBoundingClientRect();
        this.velocityPreview = Math.min(127, Math.max(1, Math.round((bounds.bottom - event.clientY) * 127 / bounds.height)));
        this["roll-velocity"].value = this.velocityPreview;
        this.queuePaint();
    }

    copy() {
        if (this.selection.size) this.clipboard = [...this.selection].sort((a, b) => a.position - b.position);
    }

    paste(at) {
        if (!this.clipboard?.length || at >= this.total) return;
        const origin = this.clipboard[0].position;
        const notes = this.clipboard.filter(note => at + note.position - origin < this.total)
            .map(note => this.fit({ ...note, position: at + note.position - origin }));
        this.commit([...this.phrase.notes, ...notes], notes);
    }

    erase() {
        if (this.selection.size) this.commit(this.phrase.notes.filter(note => !this.selection.has(note)));
    }

    key(event) {
        if (this.editor.grid.closest("[inert]")) return;
        const primary = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (primary && key === "a") this.select(this.phrase.notes);
        else if (primary && event.shiftKey && key === "i") this.invertSelection();
        else if (primary && key === "f") this.fitNotes();
        else if (primary && (key === "c" || key === "x")) { this.copy(); if (key === "x") this.erase(); }
        else if (primary && key === "v") this.paste(this.selection.size
            ? Math.min(...[...this.selection].map(note => note.position)) : this.scroll.scrollLeft / this.pixels);
        else if (key === "delete" || key === "backspace") this.erase();
        else if (key === "g" && !primary) this["roll-snap"].click();
        else if (key === "q" && !primary) this.quantizeNotes();
        else if (key === "h" && primary) this.humanize();
        else if (key === "h" && !primary) this.auditionButton.click();
        else if (key === "s" && !primary) this.soloButton.click();
        else if (key === "a" && !primary) this.followButton.click();
        else if (event.code === "Space" && primary) this.play();
        else if (this.selection.size && ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
            const dy = key === "arrowup" ? 1 : key === "arrowdown" ? -1 : 0;
            const dx = key === "arrowright" ? 1 : key === "arrowleft" ? -1 : 0;
            this.changeSelected(note => event.altKey && dy ? { ...note, velocity: Math.min(127, Math.max(1, note.velocity + dy)) }
                : this.fit({ ...note, pitch: note.pitch + dy, position: note.position + dx * Number(this["roll-grid"].value) }));
        } else return;
        event.preventDefault();
    }

    barAt(beat) {
        const next = this.boundaries.findIndex(value => value > beat);
        return Math.max(1, next < 0 ? this.boundaries.length - 1 : next);
    }

    play() {
        const start = this.rangeStart ?? this.barAt(this.selection.size
            ? Math.min(...[...this.selection].map(note => note.position)) : this.scroll.scrollLeft / this.pixels);
        this.onPlay({ from: start + this.barOffset, to: (this.rangeEnd ?? this.boundaries.length - 1) + this.barOffset }, Boolean(this.custom));
    }

    position(bar, fraction, active) {
        if (this.panel.hidden || !this.boundaries) return;
        bar -= this.barOffset;
        this.playhead = active ? this.boundaries[bar - 1] + fraction * (this.boundaries[bar] - this.boundaries[bar - 1]) : undefined;
        if (Number.isFinite(this.playhead) && !this.gesture && this.followButton.getAttribute("aria-pressed") === "true") {
            const x = this.playhead * this.pixels;
            if (x < this.scroll.scrollLeft || x > this.scroll.scrollLeft + this.scroll.clientWidth - this.keyWidth) this.scroll.scrollLeft = x;
        }
        this.queuePaint();
    }

    queuePaint() {
        if (this.panel.hidden || this.paintPending) return;
        this.paintPending = requestAnimationFrame(() => {
            this.paintPending = 0;
            if (!this.panel.hidden && this.phrase) this.paint();
        });
    }

    canvasContext(canvas, width, height) {
        const scale = devicePixelRatio || 1;
        const w = Math.round(width * scale), h = Math.round(height * scale);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        const context = canvas.getContext("2d");
        context.setTransform(scale, 0, 0, scale, 0, 0);
        return context;
    }

    paint() {
        const width = this.scroll.clientWidth, height = this.scroll.clientHeight;
        if (width <= this.keyWidth || height <= PIANO_RULER) return;
        const lane = this["roll-velocity-lane"];
        const ctx = this.canvasContext(this.canvas, width, height);
        const v = this.canvasContext(lane, width, 58);
        const offsetX = this.scroll.scrollLeft, offsetY = this.scroll.scrollTop;
        const x = beat => this.keyWidth + beat * this.pixels - offsetX;
        const rowHeight = this.rowHeight;
        const y = pitch => PIANO_RULER + (127 - pitch) * rowHeight - offsetY;
        ctx.fillStyle = "#e4e0d9"; ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.beginPath(); ctx.rect(0, PIANO_RULER, width, height - PIANO_RULER); ctx.clip();
        ctx.font = "11px system-ui";
        for (let pitch = 127; pitch >= 0; pitch--) {
            const top = y(pitch);
            if (top < PIANO_RULER - rowHeight || top > height) continue;
            const black = PITCH_NAMES[pitch % 12].includes("♯");
            const keyHeight = Math.max(1, rowHeight - 1);
            ctx.fillStyle = black ? "#cecac4" : "#eeeae2"; ctx.fillRect(this.keyWidth, top, width - this.keyWidth, keyHeight);
            ctx.fillStyle = "#f9f6f0"; ctx.fillRect(0, top, this.keyWidth - 1, keyHeight);
            if (black && !this.phrase.drum) {
                ctx.fillStyle = "#333b44"; ctx.fillRect(0, top, 36, keyHeight);
            }
            if (rowHeight >= 14 && (this.phrase.drum || pitch % 12 === 0)) {
                ctx.fillStyle = "#292d31";
                ctx.fillText(this.phrase.drum ? this.drumKeyName(pitch) : pitchName(pitch), this.phrase.drum ? 4 : 38, top + 13, this.keyWidth - 8);
            }
        }
        ctx.restore();
        ctx.fillStyle = "#3b3e40"; ctx.fillRect(0, 0, width, PIANO_RULER);
        v.fillStyle = "#43484b"; v.fillRect(0, 0, width, 58);
        ctx.save();
        ctx.beginPath(); ctx.rect(this.keyWidth, 0, width - this.keyWidth, height); ctx.clip();
        v.save();
        v.beginPath(); v.rect(this.keyWidth, 0, width - this.keyWidth, 58); v.clip();
        const drag = this.gesture;
        const from = drag?.kind === "ruler" && drag.end ? this.barAt(Math.min(drag.point.beat, drag.end.beat)) : this.rangeStart;
        const to = drag?.kind === "ruler" && drag.end ? this.barAt(Math.max(drag.point.beat, drag.end.beat)) : this.rangeEnd;
        if (from !== undefined) {
            ctx.fillStyle = "#79d0df86";
            ctx.fillRect(x(this.boundaries[from - 1]), 0, x(this.boundaries[to]) - x(this.boundaries[from - 1]), PIANO_RULER);
        }
        const step = Number(this["roll-grid"].value);
        for (let bar = 0; bar + 1 < this.boundaries.length; bar++) {
            const first = this.boundaries[bar], next = this.boundaries[bar + 1];
            if (x(next) < this.keyWidth || x(first) > width) continue;
            for (let index = 1; first + index * step < next - .00001; index++) {
                const beat = first + index * step;
                const major = Math.abs(index * step - Math.round(index * step)) < .00001;
                if (!major && step * this.pixels < 6) continue;
                ctx.fillStyle = major ? "#9a958c" : "#bcb6ad";
                ctx.fillRect(Math.round(x(beat)), PIANO_RULER, 1, height);
            }
            ctx.fillStyle = "#827c72"; ctx.fillRect(Math.round(x(first)), 0, 1, height);
            v.fillStyle = "#646b6f"; v.fillRect(Math.round(x(first)), 0, 1, 58);
            ctx.fillStyle = "#f7f4ea"; ctx.fillText(String(bar + 1), x(first) + 5, 16);
            ctx.fillStyle = "#9cd8df";
            const chords = this.chords[bar].toSorted((a, b) => a.beat - b.beat);
            for (const [index, chord] of chords.entries()) {
                const available = (chords[index + 1]?.beat ?? next - first) - chord.beat;
                if (available * this.pixels > 8) ctx.fillText(this.editor.chordLabel(chord.name, true), x(first + chord.beat) + 5, 32, available * this.pixels - 7);
            }
        }
        const notes = drag?.preview && drag.kind !== "draw" && !drag.modifier
            ? this.phrase.notes.filter(note => !this.selection.has(note)) : this.phrase.notes;
        for (const note of [...notes, ...(drag?.preview ?? [])]) {
            const left = x(note.position), top = y(note.pitch);
            const length = Math.max(4, note.duration * this.pixels);
            const selected = this.selection.has(note) || drag?.preview?.includes(note);
            if (left + length < this.keyWidth || left > width) continue;
            const velocity = selected ? this.velocityPreview ?? note.velocity : note.velocity;
            if (top >= PIANO_RULER - rowHeight && top < height) {
                ctx.save();
                ctx.beginPath(); ctx.rect(this.keyWidth, PIANO_RULER, width - this.keyWidth, height - PIANO_RULER); ctx.clip();
                ctx.fillStyle = selected ? "#227ba8" : "hsl(181 48% " + (80 - velocity * .31) + "%)";
                const inset = rowHeight >= 6 ? 2 : 0;
                ctx.fillRect(left, top + inset, length - 1, Math.max(1, rowHeight - inset * 2));
                if (rowHeight >= 6) {
                    ctx.strokeStyle = selected ? "#094064" : "#507575";
                    ctx.strokeRect(left + .5, top + 2.5, length - 2, rowHeight - 5);
                }
                if (length > 30 && rowHeight >= 14) {
                    ctx.fillStyle = selected ? "#fff" : "#173335";
                    ctx.fillText(this.phrase.drum ? this.drumKeyName(note.pitch) : pitchName(note.pitch), left + 4, top + 13, length - 8);
                }
                ctx.restore();
            }
            const level = velocity * 54 / 127;
            v.fillStyle = selected ? "#82d4ef" : "#6aa8a5";
            v.fillRect(left, 58 - level, 4, level);
        }
        if (drag?.kind === "box" && drag.end) {
            const left = x(Math.min(drag.point.beat, drag.end.beat)), right = x(Math.max(drag.point.beat, drag.end.beat));
            const top = y(Math.max(drag.point.pitch, drag.end.pitch)), bottom = y(Math.min(drag.point.pitch, drag.end.pitch)) + rowHeight;
            ctx.fillStyle = "#4eacc954"; ctx.fillRect(left, top, right - left, bottom - top);
        }
        if (Number.isFinite(this.playhead)) {
            ctx.fillStyle = v.fillStyle = "#ff9347";
            ctx.fillRect(x(this.playhead), 0, 2, height);
            v.fillRect(x(this.playhead), 0, 2, 58);
        }
        ctx.restore();
        v.restore();
        ctx.fillStyle = "#dce1e1";
        ctx.fillText(this.phrase.drum ? "MIDI" : "♫", 12, 18);
        v.fillStyle = "#e3e7e8"; v.font = "11px system-ui"; v.fillText("VEL", 11, 32);
        if (!this.staff.hidden) paintPianoScore(this.canvasContext(this.staff, width, staffHeight), this, width);
    }
}
