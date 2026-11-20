"use strict";

const isDrumMetadata = (info) => /^(?:(?:user|rhythm)-)?drums\t/u.test(info ?? "");

// Parse the generated SMF without relying on browser MIDI devices. Tracks retain
// their identity even when several rhythm voices share the MIDI drum channel.
function parseMidi(input, barCount, metadata = [], barBeats) {
    const bytes = new Uint8Array(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = 0;
    const need = (n) => { if (pos + n > bytes.length) throw new Error("MIDIが途中で切れています。"); };
    const u8 = () => { need(1); return bytes[pos++]; };
    const u16 = () => { need(2); const n = view.getUint16(pos); pos += 2; return n; };
    const u32 = () => { need(4); const n = view.getUint32(pos); pos += 4; return n; };
    const tag = () => String.fromCharCode(u8(), u8(), u8(), u8());
    const vlq = () => {
        let n = 0;
        for (let i = 0; i < 4; i++) { const b = u8(); n = n * 128 + (b & 127); if (!(b & 128)) return n; }
        throw new Error("MIDIの可変長整数が不正です。");
    };
    if (tag() !== "MThd") throw new Error("MIDIヘッダーが不正です。");
    const headerSize = u32();
    if (headerSize < 6) throw new Error("MIDIヘッダーが不正です。");
    const format = u16(), tracks = u16(), ppq = u16();
    if (format > 1 || !tracks || !ppq || ppq & 0x8000) throw new Error("未対応のMIDI形式です。");
    need(headerSize - 6); pos += headerSize - 6;
    const events = [], parts = [], meterChanges = [];
    let lastTick = 0, serial = 0, numerator = 4, denominator = 4;
    for (let track = 0; track < tracks; track++) {
        if (tag() !== "MTrk") throw new Error("MIDIトラックが不正です。");
        const length = u32(); need(length);
        const end = pos + length, trackEvents = [], channels = new Set();
        let tick = 0, running = 0, name = "", hasNotes = false;
        while (pos < end) {
            tick += vlq();
            let status = u8();
            if (status < 128) { if (!running) throw new Error("MIDIステータスが不正です。"); pos--; status = running; }
            if (status === 255) {
                const type = u8(), size = vlq(); need(size);
                if (type === 3) name = new TextDecoder().decode(bytes.subarray(pos, pos + size));
                if (type === 0x51 && size === 3) events.push({ tick, tempo: bytes[pos] * 65536 + bytes[pos + 1] * 256 + bytes[pos + 2], order: serial++ });
                if (type === 0x58 && size >= 2) {
                    const meter = { tick, numerator: bytes[pos], denominator: 2 ** bytes[pos + 1] };
                    if (!meter.numerator || bytes[pos + 1] > 7) throw new Error("MIDIの拍子が不正です。");
                    meterChanges.push(meter);
                    if (tick === 0) { numerator = meter.numerator; denominator = meter.denominator; }
                }
                pos += size;
            } else if (status === 0xf0 || status === 0xf7) {
                const size = vlq(); need(size); pos += size; running = 0;
            } else {
                if (status >= 0xf0) throw new Error("未対応のMIDIイベントです。");
                running = status;
                const type = status & 0xf0, channel = status & 15;
                const a = u8(), b = type === 0xc0 || type === 0xd0 ? 0 : u8();
                if (a > 127 || b > 127) throw new Error("MIDIデータが不正です。");
                channels.add(channel);
                if (type === 0x90 && b) hasNotes = true;
                trackEvents.push({ tick, type, channel, a, b, order: serial++ });
            }
            if (pos > end) throw new Error("MIDIトラックの長さが不正です。");
        }
        lastTick = Math.max(lastTick, tick);
        if (hasNotes) {
            // Split multi-channel tracks as well, so every mixer strip is independent.
            for (const channel of channels) {
                if (!trackEvents.some(e => e.channel === channel && e.type === 0x90 && e.b)) continue;
                const part = parts.length;
                const info = metadata[track]?.split("\t");
                const match = /^(user|rhythm)-(drums|melodic)$/u.exec(info?.[0] ?? "");
                const styleId = match?.[1] === "rhythm" && info?.length > 2 ? info.at(-1) : undefined;
                const label = (styleId ? info.slice(1, -1) : info?.slice(1))?.join("\t") || name.replace(/-channel\d+\/16$/u, "") || `パート ${part + 1}`;
                const drum = info ? isDrumMetadata(metadata[track]) : channel === 9;
                parts.push(match ? { id: styleId ? `${match[1]}:${styleId}:${label}` : `${match[1]}:${label}`, name: label, channel, drum, source: match[1], ...(styleId ? { styleId } : {}) }
                    : { id: `${label}:${channel}`, name: label, channel, drum });
                for (const e of trackEvents) if (e.channel === channel) events.push({ ...e, part });
            }
        }
    }
    if (!parts.length || parts.length > 32) throw new Error("再生可能なパート数は1〜32です。");
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    const ticksPerBar = ppq * numerator * 4 / denominator;
    // Use the requested song length, not a final end-of-track padding tick.
    let barTick = 0;
    const bars = [{ tick: 0, bar: 0 }];
    const count = barBeats?.length ?? (barCount || Math.ceil(lastTick / ticksPerBar));
    for (let index = 0; index < count; index++) {
        barTick += barBeats ? barBeats[index] * ppq : ticksPerBar;
        bars.push({ tick: barTick, bar: index + 1 });
    }
    const endTick = barBeats || barCount ? barTick : lastTick;
    const beats = [];
    let meterIndex = 0;
    for (let bar = 0; bar + 1 < bars.length; bar++) {
        const start = bars[bar].tick, end = bars[bar + 1].tick;
        while (meterChanges[meterIndex + 1]?.tick <= start) meterIndex++;
        const meter = meterChanges[meterIndex]?.tick <= start ? meterChanges[meterIndex] : { numerator, denominator };
        const count = meter.denominator === 8 && meter.numerator % 3 === 0 ? meter.numerator / 3 : meter.numerator;
        for (let beat = 0; beat < count; beat++) beats.push({ tick: start + (end - start) * beat / count, beat: beat + 1, barIndex: bar });
    }
    const timeline = [...events, ...bars, ...beats].sort((a, b) => a.tick - b.tick || (a.order ?? -1) - (b.order ?? -1));
    let tempo = 500000, tick = 0, seconds = 0;
    const barTimes = [], beatTimes = [], playable = [];
    for (const e of timeline) {
        seconds += (e.tick - tick) * tempo / ppq / 1000000; tick = e.tick;
        if (e.tempo !== undefined) { if (e.tempo <= 0) throw new Error("MIDIテンポが不正です。"); tempo = e.tempo; }
        else if (e.bar !== undefined) barTimes[e.bar] = seconds;
        else if (e.beat !== undefined) beatTimes.push({ seconds, beat: e.beat, bar: e.barIndex + 1 });
        else if (e.tick <= endTick) playable.push({ ...e, seconds });
    }
    return { parts, events: playable, barTimes, beatTimes, duration: barTimes.at(-1), meterChanges };
}

// Read event bytes for an export-only rewrite. Expand running status so a
// removed controller or a changed channel can never invalidate later events.
function readMidiForExport(input) {
    const bytes = new Uint8Array(input);
    const view = new DataView(bytes.buffer);
    let pos = 0;
    const need = n => { if (pos + n > bytes.length) throw new Error("MIDIが途中で切れています。"); };
    const u8 = () => { need(1); return bytes[pos++]; };
    const u16 = () => { need(2); const n = view.getUint16(pos); pos += 2; return n; };
    const u32 = () => { need(4); const n = view.getUint32(pos); pos += 4; return n; };
    const tag = () => String.fromCharCode(u8(), u8(), u8(), u8());
    const vlq = () => {
        let value = 0;
        for (let i = 0; i < 4; i++) { const b = u8(); value = value * 128 + (b & 127); if (!(b & 128)) return value; }
        throw new Error("MIDIの可変長整数が不正です。");
    };
    if (tag() !== "MThd") throw new Error("MIDIヘッダーが不正です。");
    const size = u32();
    if (size < 6) throw new Error("MIDIヘッダーが不正です。");
    const format = u16(), count = u16(), timing = u16();
    if (format > 1 || !count || !timing || timing & 0x8000) throw new Error("未対応のMIDI形式です。");
    need(size - 6); pos += size - 6;
    const header = bytes.slice(0, pos), tracks = [];
    for (let track = 0; track < count; track++) {
        if (tag() !== "MTrk") throw new Error("MIDIトラックが不正です。");
        const length = u32(); need(length);
        const end = pos + length, events = [];
        let tick = 0, running = 0;
        while (pos < end) {
            tick += vlq();
            const start = pos;
            let status = u8(), data, meta;
            if (status < 128) { if (!running) throw new Error("MIDIステータスが不正です。"); pos--; status = running; }
            if (status === 255) {
                meta = u8(); const length = vlq(); need(length); pos += length;
                data = bytes.slice(start, pos);
            } else if (status === 0xf0 || status === 0xf7) {
                const length = vlq(); need(length); pos += length; running = 0;
                data = bytes.slice(start, pos);
            } else {
                if (status >= 0xf0) throw new Error("未対応のMIDIイベントです。");
                running = status;
                const a = u8(), type = status & 0xf0;
                const b = type === 0xc0 || type === 0xd0 ? undefined : u8();
                if (a > 127 || b > 127) throw new Error("MIDIデータが不正です。");
                data = new Uint8Array(b === undefined ? [status, a] : [status, a, b]);
            }
            if (pos > end) throw new Error("MIDIトラックの長さが不正です。");
            events.push({ tick, status, meta, data });
        }
        tracks.push(events);
    }
    return { header, tracks };
}

function midiVariableLength(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0x0fffffff) throw new Error("MIDIイベントの間隔が範囲外です。");
    const bytes = [value & 127];
    while (value = Math.floor(value / 128)) bytes.unshift((value & 127) | 128);
    return bytes;
}

// Download path only: keep browser playback's original channels and drum flags.
// A GM drum channel has one shared set of controllers, so retain the primary
// rhythm's channel settings, rather than let secondary tracks overwrite them.
function exportGmMidi(input, metadata = []) {
    const { header, tracks } = readMidiForExport(input);
    const isDrum = (event, track) => event.status < 0xf0 &&
        (metadata[track] ? isDrumMetadata(metadata[track]) : (event.status & 15) === 9);
    let primary;
    tracks.forEach((events, track) => {
        for (const event of events) {
            if (!isDrum(event, track) || (event.status & 0xf0) !== 0x90 || !event.data[2]) continue;
            const channel = event.status & 15;
            if (!primary || (primary.channel !== 9 && channel === 9)) primary = { track, channel };
        }
    });
    if (!primary) return new Uint8Array(input);
    const chunks = [header];
    tracks.forEach((events, track) => {
        const output = [];
        let previousTick = 0;
        for (const event of events) {
            let data = event.data;
            if (isDrum(event, track)) {
                const type = event.status & 0xf0;
                const owner = track === primary.track && (event.status & 15) === primary.channel;
                // Notes and polyphonic key pressure belong to the individual
                // part. CC/program/channel pressure/pitch bend are shared.
                if (!owner && ![0x80, 0x90, 0xa0].includes(type)) continue;
                data = data.slice(); data[0] = type | 9;
            } else if (event.meta === 3 && isDrumMetadata(metadata[track])) {
                // Keep the exported track-name channel annotation accurate.
                let offset = 2;
                while (data[offset++] & 128) { /* skip the original name length */ }
                const name = new TextDecoder().decode(data.subarray(offset)).replace(/-channel\d+\/16$/u, "-channel10/16");
                const encoded = new TextEncoder().encode(name);
                data = new Uint8Array([255, 3, ...midiVariableLength(encoded.length), ...encoded]);
            }
            output.push(...midiVariableLength(event.tick - previousTick)); previousTick = event.tick;
            // Avoid argument-count limits for large text/SysEx events.
            for (const byte of data) output.push(byte);
        }
        const length = output.length;
        chunks.push(new Uint8Array([0x4d, 0x54, 0x72, 0x6b, length >>> 24, length >>> 16, length >>> 8, length]), new Uint8Array(output));
    });
    const result = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
}

if (typeof module !== "undefined") module.exports = { parseMidi, exportGmMidi };
