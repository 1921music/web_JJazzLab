"use strict";

function downloadSongFile(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The song package uses uncompressed ZIP entries so no library is needed.
function packageSongFiles(files) {
    const encoder = new TextEncoder();
    const local = [], directory = [];
    let offset = 0;
    for (const [filename, value] of files) {
        const name = encoder.encode(filename);
        const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
        const crc = styleCrc32(bytes);
        for (const central of [false, true]) {
            const fixed = central ? 46 : 30;
            const header = new Uint8Array(fixed + name.length);
            const view = new DataView(header.buffer);
            const u16 = (at, value) => view.setUint16(at, value, true);
            const u32 = (at, value) => view.setUint32(at, value, true);
            const extra = central ? 2 : 0;
            u32(0, central ? 0x02014b50 : 0x04034b50);
            u16(4 + extra, 20); u16(6 + extra, 0x0800);
            u16(12 + extra, 33);
            u32(14 + extra, crc); u32(18 + extra, bytes.length); u32(22 + extra, bytes.length);
            u16(26 + extra, name.length);
            header.set(name, fixed);
            if (central) { u16(4, 20); u32(42, offset); directory.push(header); }
            else local.push(header, bytes);
        }
        offset += local.at(-2).length + bytes.length;
    }
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
    view.setUint32(12, directory.reduce((size, entry) => size + entry.length, 0), true);
    view.setUint32(16, offset, true);
    return new Blob([...local, ...directory, end]);
}

class SongEditor {
    constructor(onOpen, onChooseBar) {
        this.onOpen = onOpen;
        this.onChooseBar = onChooseBar;
        this.grid = document.querySelector("#lead-sheet");
        this.parts = document.querySelector("#song-parts");
        this.title = document.querySelector("#project-title");
        this.meter = document.querySelector("#project-meter");
        const mixedMeter = new Option("曲中で変化", "");
        mixedMeter.disabled = true;
        this.meter.replaceChildren(mixedMeter, ...Object.entries(DesktopSongFiles.meters).map(([id, [label]]) => new Option(label, id)));
        this.status = document.querySelector("#project-status");
        this.exportButton = document.querySelector("#export-project");
        document.querySelector("#new-project").onclick = () => this.open({
            title: "新しい曲", tempo: 120, bars: 4, sections: [{ name: "A", bar: 0, meter: "FOUR_FOUR" }],
            chords: ["C", "Am7", "Dm7", "G7"].map((name, bar) => ({ name, bar, beat: 0 })),
            parts: [{ name: "A", section: 0, styleId: "jjSwing-ID", styleName: "jjSwing", parameters: {} }], userTracks: []
        }, []);
        document.querySelector("#open-project").onchange = event => this.openFiles(event.target);
        document.querySelector("#add-bar").onclick = () => this.editArrangement(() => {
            if (this.project.bars >= 1024) throw new Error("譜面の上限は1024小節です。");
            this.project.bars++;
        });
        this.removeBar = document.querySelector("#remove-bar");
        this.removeBar.onclick = () => this.editArrangement(() => {
            const bar = this.project.bars - 1;
            if (bar < 1 || this.project.sections.at(-1).bar === bar) return;
            this.project.chords = this.project.chords.filter(chord => chord.bar < bar);
            this.project.bars = bar;
        });
        document.querySelector("#add-song-part").onclick = () => {
            this.editArrangement(() => {
                const part = this.project.parts.at(-1);
                this.project.parts.push({ ...part, parameters: { ...part.parameters } });
            });
        };
        this.title.oninput = () => { this.project.title = this.title.value; this.changed(); };
        this.meter.onchange = () => {
            this.editArrangement(() => {
                for (const section of this.project.sections) section.meter = this.meter.value;
            });
            this.onMeterChange?.(this.project.sections[0].meter);
        };
        document.querySelector("#save-project").onclick = () => this.save();
        this.exportButton.onclick = () => this.export();
    }

    notify(message = "", error = false) {
        this.status.textContent = message;
        this.status.toggleAttribute("data-error", error);
    }

    changed() {
        this.renderedMix = null;
        this.exportButton.disabled = true;
    }

    editArrangement(action) {
        try { this.readChords(); action(); this.changed(); this.render(); }
        catch (error) { this.notify(error.message, true); }
    }

    open(project, mix, style = null) {
        this.project = project;
        this.mix = mix;
        this.style = style;
        this.inputs = [];
        this.selectedPart = null;
        this.changed();
        this.notify();
        document.querySelector("#project-editor").hidden = false;
        document.querySelector("#quick-chords").hidden = true;
        document.querySelector("#chords").required = false;
        this.render();
        this.onOpen(this);
    }

    async openFiles(input) {
        const files = Array.from(input.files);
        input.value = "";
        if (!files.length) return;
        try {
            const web = files.find(file => /\.jjazzweb$/iu.test(file.name));
            if (web) {
                const data = JSON.parse(await web.text());
                if (files.length !== 1 || data.version !== 1 || !data.song?.parts?.length || !data.song?.sections?.length) {
                    throw new Error("Web用の曲ファイルを1つ選択してください。");
                }
                this.open(DesktopSongFiles.validateSong(data.song), data.mix ?? [], data.style);
                return;
            }
            const songFile = files.find(file => /\.sng$/iu.test(file.name));
            const mixFile = files.find(file => /\.mix$/iu.test(file.name));
            if (!songFile || files.length > 2 || (files.length === 2 && !mixFile)
                || (mixFile && songFile.name.slice(0, -4).toLowerCase() !== mixFile.name.slice(0, -4).toLowerCase())) {
                throw new Error(".sng と、必要に応じて同じ名前の .mix を選択してください。");
            }
            const song = DesktopSongFiles.readSong(await songFile.text());
            const mix = mixFile ? DesktopSongFiles.readMix(await mixFile.text()) : [];
            this.open(song, mix);
            this.notify(`${songFile.name} を開きました。${song.parts[0].styleName ? ` スタイル: ${song.parts[0].styleName}` : ""}`);
        } catch (error) { this.notify(error.message, true); }
    }

    button(label, callback) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = label;
        button.onclick = callback;
        return button;
    }

    chooseBar(bar, selectedPart = null) {
        let start = 0;
        let first;
        for (let index = 0; index < this.project.parts.length; index++) {
            const part = this.project.parts[index];
            const from = this.project.sections[part.section].bar;
            const to = this.project.sections[part.section + 1]?.bar ?? this.project.bars;
            if (bar >= from && bar < to) {
                const location = { from: start + bar - from + 1, to: start + to - from };
                first ??= location;
                if (index === selectedPart) { this.onChooseBar(location); return; }
            }
            start += to - from;
        }
        if (first) this.onChooseBar(first);
    }

    showPlayingBar(bar) {
        let offset = bar - 1;
        let row;
        let sheetBar;
        if (bar && this.project) {
            for (let index = 0; index < this.project.parts.length; index++) {
                const section = this.project.parts[index].section;
                const start = this.project.sections[section].bar;
                const length = (this.project.sections[section + 1]?.bar ?? this.project.bars) - start;
                if (offset < length) { row = index; sheetBar = start + offset; break; }
                offset -= length;
            }
        }
        this.grid.querySelector(".playing-bar")?.classList.remove("playing-bar");
        this.parts.querySelector(".playing-bar")?.classList.remove("playing-bar");
        this.grid.children[sheetBar]?.classList.add("playing-bar");
        this.parts.children[row]?.classList.add("playing-bar");
    }

    render() {
        const { title, sections, chords, parts, bars, userTracks } = this.project;
        this.title.value = title;
        this.meter.value = sections.some(section => section.meter !== sections[0].meter) ? "" : sections[0].meter;
        this.removeBar.disabled = bars < 2 || sections.at(-1).bar === bars - 1;
        this.grid.replaceChildren();
        this.inputs = [];
        for (let bar = 0; bar < bars; bar++) {
            const cell = document.createElement("div");
            const section = sections.find(item => item.bar === bar);
            const heading = this.button(`${bar + 1}小節${section ? ` · ${section.name} · ${DesktopSongFiles.meters[section.meter][0]}` : ""}`,
                () => this.chooseBar(bar, this.selectedPart));
            const input = document.createElement("input");
            input.setAttribute("aria-label", `${bar + 1}小節のコード`);
            input.spellcheck = false;
            input.value = chords.filter(chord => chord.bar === bar).sort((a, b) => a.beat - b.beat)
                .map(chord => chord.beat ? `${Number((chord.beat + 1).toFixed(6))}:${chord.name}` : chord.name).join(" ");
            input.oninput = () => this.changed();
            input.onkeydown = event => {
                if (event.key === "Enter" || event.key === "ArrowDown" || event.key === "ArrowUp") {
                    const next = this.inputs[bar + (event.key === "ArrowUp" ? -1 : 1)];
                    if (next) { event.preventDefault(); next.focus(); next.select(); }
                }
            };
            this.inputs.push(input);
            const addSection = this.button("区切り", () => {
                try {
                    this.readChords();
                    const index = sections.findIndex(item => item.bar > bar);
                    const insert = index < 0 ? sections.length : index;
                    let suffix = 1;
                    while (sections.some(item => item.name === `S${suffix}`)) suffix++;
                    sections.splice(insert, 0, { name: `S${suffix}`, bar, meter: sections[insert - 1].meter });
                    for (const part of parts) if (part.section >= insert) part.section++;
                    this.changed(); this.render();
                } catch (error) { this.notify(error.message, true); }
            });
            addSection.disabled = Boolean(section);
            cell.append(heading, input, addSection);
            if (section) {
                const sectionName = document.createElement("input");
                sectionName.value = section.name;
                sectionName.setAttribute("aria-label", `${bar + 1}小節のセクション名`);
                sectionName.onchange = () => {
                    const name = sectionName.value.trim();
                    if (!name || sections.some(other => other !== section && other.name === name)) {
                        sectionName.value = section.name;
                        this.notify("セクション名は空欄や重複を避けてください。", true);
                        return;
                    }
                    this.editArrangement(() => {
                        for (const part of parts) {
                            if (sections[part.section] === section && part.name === section.name) part.name = name;
                        }
                        section.name = name;
                    });
                };
                cell.append(sectionName);
            }
            this.grid.append(cell);
        }
        this.parts.replaceChildren();
        parts.forEach((part, index) => {
            const item = document.createElement("li");
            const row = document.createElement("div");
            const select = document.createElement("select");
            select.setAttribute("aria-label", `${index + 1}番目のセクション`);
            sections.forEach((section, id) => {
                const option = document.createElement("option"); option.value = id; option.textContent = section.name; select.append(option);
            });
            select.value = part.section;
            select.onchange = () => { part.section = Number(select.value); part.name = sections[part.section].name; this.changed(); };
            const variation = document.createElement("input");
            variation.placeholder = "バリエーション";
            variation.setAttribute("aria-label", `${index + 1}番目のバリエーション`);
            variation.value = part.parameters.rpVariationID ?? "";
            variation.oninput = () => { part.parameters.rpVariationID = variation.value; this.changed(); };
            const move = (destination) => {
                try {
                    this.readChords();
                    [parts[index], parts[destination]] = [parts[destination], parts[index]];
                    this.selectedPart = null;
                    this.changed(); this.render();
                } catch (error) { this.notify(error.message, true); }
            };
            const up = this.button("上へ", () => move(index - 1)); up.disabled = index === 0;
            const down = this.button("下へ", () => move(index + 1)); down.disabled = index === parts.length - 1;
            const remove = this.button("削除", () => {
                try {
                    this.readChords(); parts.splice(index, 1); this.selectedPart = null; this.changed(); this.render();
                } catch (error) { this.notify(error.message, true); }
            });
            remove.disabled = parts.length < 2;
            row.append(select, variation, up, down, remove, this.button("この区間を選択", () => {
                this.selectedPart = index; this.chooseBar(sections[part.section].bar, index);
            }));
            item.append(row); this.parts.append(item);
        });
        document.querySelector("#user-track-summary").textContent = userTracks.length ? `ユーザートラック: ${userTracks.map(track => track.name).join("、")}` : "";
    }

    readChords() {
        const previous = new Map(this.project.chords.map(chord => [`${chord.bar}:${chord.beat}:${chord.name}`, chord]));
        this.project.chords = this.inputs.flatMap((input, bar) => {
            const beats = new Set();
            return input.value.trim().split(/\s+/u).filter(Boolean).map(token => {
                const match = /^(?:(\d+(?:\.\d+)?):)?(.+)$/u.exec(token);
                const beat = Number(match[1] ?? 1) - 1;
                const section = this.project.sections.findLast(item => item.bar <= bar);
                if (beat < 0 || beat >= DesktopSongFiles.meters[section.meter][1] || beats.has(beat)) {
                    throw new Error(`${bar + 1}小節のコードの拍位置を確認してください。`);
                }
                beats.add(beat);
                return previous.get(`${bar}:${beat}:${match[2]}`) ?? { name: match[2], bar, beat };
            });
        });
    }

    fileStem() { return this.project.title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_") || "JJazzLab"; }

    save() {
        try {
            this.readChords();
            const data = { version: 1, song: this.project, mix: this.renderedMix ?? this.mix, style: this.style };
            downloadSongFile(`${this.fileStem()}.jjazzweb`, JSON.stringify(data), "application/json");
        } catch (error) { this.notify(error.message, true); }
    }

    export() {
        try {
            if (!this.renderedMix) throw new Error("伴奏を生成してから書き出してください。");
            const stem = this.fileStem();
            const desktopMix = this.renderedMix.map(track => ({ ...track, channel: track.sourceChannel ?? track.channel }));
            const files = [[`${stem}.sng`, DesktopSongFiles.writeSong(this.project)], [`${stem}.mix`, DesktopSongFiles.writeMix(desktopMix)]];
            if (this.style?.data) files.push([`styles/${this.style.name}`, Uint8Array.from(this.style.data)]);
            downloadSongFile(`${stem}.zip`, packageSongFiles(files), "application/zip");
        } catch (error) { this.notify(error.message, true); }
    }
}
