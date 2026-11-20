"use strict";

const staffHeight = 126;
const staffSteps = [[0, ""], [0, "♯"], [1, ""], [1, "♯"], [2, ""], [3, ""],
    [3, "♯"], [4, ""], [4, "♯"], [5, ""], [5, "♯"], [6, ""]];

function scoreNoteValue(beats) {
    let closest, error = Infinity;
    for (const [base, flags] of [[4, -2], [2, -1], [1, 0], [.5, 1], [.25, 2], [.125, 3], [.0625, 4]]) {
        for (const [ratio, dot, triplet] of [[1, false, false], [1.5, true, false], [2 / 3, false, true]]) {
            const distance = Math.abs(Math.log(beats / (base * ratio)));
            if (distance < error) { closest = { flags, dot, triplet }; error = distance; }
        }
    }
    return closest;
}

function paintPianoScore(ctx, roll, width) {
    const keyWidth = roll.keyWidth;
    const x = beat => keyWidth + beat * roll.pixels - roll.scroll.scrollLeft;
    const treble = 55, bass = 104, spacing = 8;
    const line = (fromX, fromY, toX, toY) => {
        ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
    };
    ctx.fillStyle = "#f7f2e8";
    ctx.fillRect(0, 0, width, staffHeight);
    ctx.strokeStyle = "#77746d";
    ctx.lineWidth = 1;
    for (const bottom of [treble, bass]) {
        for (let row = 0; row < 5; row++) line(0, bottom - row * spacing + .5, width, bottom - row * spacing + .5);
    }
    ctx.fillStyle = "#31353a";
    ctx.font = '32px "Segoe UI Symbol", "Noto Music", serif';
    ctx.fillText("𝄞", 8, treble - 3);
    ctx.fillText("𝄢", 9, bass - 6);
    ctx.save();
    ctx.beginPath(); ctx.rect(keyWidth, 0, width - keyWidth, staffHeight); ctx.clip();
    ctx.font = "12px system-ui";
    const notesByBar = Map.groupBy(roll.phrase.notes, note => roll.barAt(note.position) - 1);
    const octave = roll.scoreOctave();
    for (let index = 0; index + 1 < roll.boundaries.length; index++) {
        const start = roll.boundaries[index], end = roll.boundaries[index + 1];
        if (x(end) < keyWidth || x(start) > width) continue;
        ctx.strokeStyle = "#96938a"; line(x(start), treble - 32, x(start), bass);
        const chords = roll.chords[index].toSorted((a, b) => a.beat - b.beat);
        for (const chord of chords) {
            ctx.fillStyle = "#576064";
            ctx.fillText(roll.editor.chordLabel(chord.name, true), x(start + chord.beat) + 4, 15);
        }
        const accidentals = new Map();
        for (const note of (notesByBar.get(index) ?? []).toSorted((a, b) => a.position - b.position || a.pitch - b.pitch)) {
            const offset = x(note.position) + 5;
            const pitch = Math.max(0, Math.min(127, note.pitch + 12 * octave));
            const [degree, sharp] = staffSteps[pitch % 12];
            const chord = chords.findLast(chord => start + chord.beat <= note.position);
            const flat = sharp && /^[A-G](?:b|♭)/u.test(chord?.name ?? "");
            const step = Math.floor(pitch / 12) * 7 + degree + Number(Boolean(flat));
            const accidental = flat ? "♭" : sharp;
            const bottom = pitch >= 60 ? treble : bass;
            const reference = bottom === treble ? 37 : 25;
            const relative = step - reference;
            const y = bottom - relative * spacing / 2;
            const compound = ["SIX_EIGHT", "TWELVE_EIGHT"].includes(roll.staffMeters[index]);
            const { flags, dot, triplet } = scoreNoteValue(note.duration * (compound ? 1.5 : 1));
            ctx.fillStyle = ctx.strokeStyle = roll.selection.has(note) ? "#136d9e" : "#23262a";
            for (let ledger = -2; ledger >= relative; ledger -= 2) line(offset - 7, bottom - ledger * 4, offset + 7, bottom - ledger * 4);
            for (let ledger = 10; ledger <= relative; ledger += 2) line(offset - 7, bottom - ledger * 4, offset + 7, bottom - ledger * 4);
            if (accidental !== (accidentals.get(step) ?? "")) ctx.fillText(accidental || "♮", offset - 14, y + 4);
            accidentals.set(step, accidental);
            ctx.beginPath(); ctx.ellipse(offset, y, 4.6, 3.1, -.22, 0, 2 * Math.PI);
            if (flags >= 0) ctx.fill(); else ctx.stroke();
            if (flags > -2) {
                const direction = relative >= 4 ? 1 : -1;
                const stem = offset - direction * 4;
                line(stem, y, stem, y + direction * 23);
                for (let flag = 0; flag < flags; flag++) {
                    const tail = y + direction * (23 - flag * 5);
                    ctx.beginPath(); ctx.moveTo(stem, tail); ctx.quadraticCurveTo(stem + 7, tail - direction * 3, stem + 7, tail - direction * 8); ctx.stroke();
                }
            }
            if (dot) { ctx.beginPath(); ctx.arc(offset + 8, y - 2, 1.45, 0, 2 * Math.PI); ctx.fill(); }
            if (triplet) ctx.fillText("3", offset + 8, y - 8);
        }
    }
    if (Number.isFinite(roll.playhead)) {
        ctx.strokeStyle = "#dc7837";
        line(x(roll.playhead), 0, x(roll.playhead), staffHeight);
    }
    ctx.restore();
}
