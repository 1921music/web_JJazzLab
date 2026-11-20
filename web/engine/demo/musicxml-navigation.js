"use strict";

function readMusicXmlNavigation(direction, sound) {
    const marks = [];
    const timeOnly = (sound?.getAttribute("time-only")?.match(/\d+/gu) ?? []).map(Number);
    const caption = musicXmlElements(direction, "direction-type").map(type => musicXmlText(type, "words")).join(" ");
    const destination = /\bal\s*fine\b/iu.test(caption) ? "fine" : /\bal\s*coda\b/iu.test(caption) ? "coda" : "";
    for (const type of ["segno", "coda", "dacapo", "dalsegno", "tocoda", "fine"]) {
        const value = sound?.getAttribute(type);
        if (value && value !== "no") marks.push({ type, value, timeOnly, destination });
    }
    for (const type of ["segno", "coda"]) {
        if (!marks.some(mark => mark.type === type)
                && musicXmlElements(direction, "direction-type").some(node => musicXmlChild(node, type))) {
            marks.push({ type, value: type, timeOnly, destination });
        }
    }
    return marks;
}

function musicXmlNavigation(bars) {
    const targets = new Map();
    let hasFine = false, pass = 1, destination = "";
    for (const [index, bar] of bars.entries()) {
        for (const { type, value } of bar.navigation) {
            if (type === "segno" || type === "coda") {
                const key = type + ":" + (value === "yes" ? type : value);
                if (!targets.has(key)) targets.set(key, index);
            }
            if (type === "fine") hasFine = true;
        }
    }
    return index => {
        for (const mark of bars[index].navigation) {
            const { type, value, timeOnly } = mark;
            if (type === "fine" && destination === "fine") return { bar: bars.length };
            if (type === "tocoda" && destination !== "fine" && (timeOnly.length ? timeOnly.includes(pass) : pass === 2)) {
                const bar = targets.get("coda:" + (value === "yes" ? "coda" : value));
                if (bar !== undefined) {
                    destination = "";
                    return { bar };
                }
            }
            if ((type === "dalsegno" || type === "dacapo") && (timeOnly.length ? timeOnly.includes(pass) : pass === 1)) {
                const bar = type === "dacapo" ? 0 : targets.get("segno:" + (value === "yes" ? "segno" : value));
                if (bar === undefined) continue;
                pass++;
                destination = mark.destination || (hasFine ? "fine" : "coda");
                return { bar };
            }
        }
    };
}
