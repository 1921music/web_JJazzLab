"use strict";

function improvisationHalfBars(mode, bars, tempo, random = Math.random) {
    const { easy, easyStarts, medium } = embeddedImprovisationPatterns;
    const sequence = mode === "medium" ? medium : easy;
    let index = mode === "medium" ? Math.round((sequence.length - 1) * random())
        : easyStarts[Math.round((easyStarts.length - 1) * random())];
    const result = [];
    while (result.length < bars * 2) {
        const item = sequence[index++ % sequence.length];
        let span = Number(item[1]) + (item.endsWith("H") ? .5 : 0);
        if (tempo > 200) span = span < 2 ? span * 2 : span + 1.5;
        const size = Math.min(bars * 2 - result.length, span * 2);
        result.push(...Array(size).fill(item.startsWith("P") ? "play" : "rest"));
    }
    if (mode === "density") {
        const threshold = tempo < 95 ? 3 : tempo < 180 ? 4 : 6;
        for (let first = 0; first < result.length;) {
            if (result[first] === "rest") { first++; continue; }
            let end = first + 1;
            while (result[end] === "play") end++;
            const initial = random() > .5 ? "dense" : "sparse";
            const split = end - first >= threshold && random() >= .3 ? end - Math.floor((end - first) / 2) : end;
            result.fill(initial, first, split);
            result.fill(initial === "dense" ? "sparse" : "dense", split, end);
            first = end;
        }
    }
    return result;
}

class ImprovisationGuide {
    constructor(editor) {
        this.editor = editor;
        this.guides = new WeakMap();
        this.dialog = document.querySelector("#improvisation-guide");
        this.cue = document.querySelector("#improvisation-cue");
        const form = this.dialog.querySelector("form");
        document.querySelector("#open-improvisation-guide").onclick = () => {
            if (!editor.project) return;
            form.elements.mode.value = this.guides.get(editor.project)?.mode ?? "easy";
            this.dialog.showModal();
        };
        form.onsubmit = event => {
            event.preventDefault();
            this.generate(form.elements.mode.value);
            this.dialog.close();
        };
        form.elements.clearGuide.onclick = () => {
            this.guides.delete(editor.project);
            this.paint();
            this.position(0, 0);
            this.dialog.close();
        };
        form.elements.cancelGuide.onclick = () => this.dialog.close();
    }

    generate(mode, ranges = this.editor.partRanges()) {
        const project = this.editor.project;
        const bars = ranges.at(-1)?.to ?? 0;
        const revision = ranges.map(range => [range.sheetStart, range.sheetEnd]).join("|");
        this.guides.set(project, { mode, revision, values: improvisationHalfBars(mode, bars, project.tempo), ranges });
        this.active = undefined;
        this.paint();
        this.position(0, 0);
    }

    label(kind) {
        return { play: t("弾く", "Play"), rest: t("休む", "Rest"), dense: t("音を多く", "Dense"), sparse: t("音を少なく", "Sparse") }[kind];
    }

    paint() {
        const project = this.editor.project;
        const guide = this.guides.get(project);
        const ranges = this.editor.partRanges();
        this.editor.grid.toggleAttribute("data-improvised", Boolean(guide));
        const revision = ranges.map(range => [range.sheetStart, range.sheetEnd]).join("|");
        if (guide && guide.revision !== revision) return this.generate(guide.mode, ranges);
        const occurrences = new Map();
        if (guide) {
            for (const range of ranges) {
                for (let bar = range.sheetStart; bar < range.sheetEnd; bar++) {
                    if (!occurrences.has(bar) || range.index === this.active) occurrences.set(bar, range.from + bar - range.sheetStart);
                }
            }
        }
        for (const [index, cell] of Array.from(this.editor.grid.children).entries()) {
            cell.querySelector(".improvisation-guide-cells")?.remove();
            const bar = occurrences.get(index);
            if (!bar) continue;
            const overlay = document.createElement("div");
            overlay.className = "improvisation-guide-cells";
            for (const kind of guide.values.slice((bar - 1) * 2, bar * 2)) {
                const span = document.createElement("span");
                span.dataset.guide = kind;
                span.textContent = this.label(kind);
                overlay.append(span);
            }
            cell.append(overlay);
        }
    }

    position(bar, fraction) {
        const project = this.editor.project;
        const guide = this.guides.get(project);
        const range = guide?.ranges.find(range => bar >= range.from && bar <= range.to);
        if (this.active !== range?.index && guide) {
            this.active = range?.index;
            this.paint();
        }
        if (!range) {
            this.cue.hidden = true;
            return;
        }
        const meter = project.sections[project.parts[range.index].section].meter;
        const beats = DesktopSongFiles.meters[meter][1];
        const half = beats === 3 ? .5 : Math.ceil(beats / 2) / beats;
        const kind = guide.values[(bar - 1) * 2 + Number(fraction >= half)];
        this.cue.hidden = !kind;
        this.cue.dataset.guide = kind;
        this.cue.textContent = this.label(kind);
    }
}
