"use strict";

// ZIP directory and selective extraction for the public style collection.
// All bytes stay in memory; no filesystem, persistent storage or download link.
const styleArchiveLimits = { archive: 16 * 1024 * 1024, entry: 1024 * 1024, total: 64 * 1024 * 1024, count: 2000 };

function styleCrc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

class MemoryStyleArchive {
    constructor(input) {
        this.bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
        const bytes = this.bytes;
        if (bytes.length < 22 || bytes.length > styleArchiveLimits.archive) throw new Error("スタイル集のZIPサイズが不正です。");
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const u16 = offset => this.view.getUint16(offset, true);
        const u32 = offset => this.view.getUint32(offset, true);
        let end = bytes.length - 22;
        const minimum = Math.max(0, end - 65535);
        while (end >= minimum && !(u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length)) end--;
        if (end < minimum) throw new Error("スタイル集のZIPディレクトリが見つかりません。");
        const count = u16(end + 10), size = u32(end + 12), start = u32(end + 16);
        if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || count === 65535 || start === 0xffffffff)
            throw new Error("分割ZIP・ZIP64には対応していません。");
        if (count > styleArchiveLimits.count || start + size !== end) throw new Error("スタイル集のZIPディレクトリが不正です。");
        this.entries = [];
        this.cache = new Map();
        const paths = new Set();
        let offset = start, total = 0;
        for (let i = 0; i < count; i++) {
            if (offset + 46 > end || u32(offset) !== 0x02014b50) throw new Error("スタイル集のZIPエントリーが不正です。");
            const flags = u16(offset + 8), method = u16(offset + 10);
            const crc = u32(offset + 16), compressed = u32(offset + 20), length = u32(offset + 24);
            const nameLength = u16(offset + 28), extraLength = u16(offset + 30), commentLength = u16(offset + 32);
            const localOffset = u32(offset + 42), next = offset + 46 + nameLength + extraLength + commentLength;
            if (next > end) throw new Error("スタイル集のZIPエントリーが途中で切れています。");
            // The current public collection uses ASCII paths. UTF-8 paths are
            // supported as well; no path is ever used for a filesystem write.
            const path = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
            offset = next;
            if (!/\.(sty|sst|prs|bcs)$/iu.test(path)) continue;
            const segments = path.split("/");
            if (segments.some(s => !s || s === "." || s === ".." || /[\\:\x00-\x1f]/u.test(s)) || paths.has(path))
                throw new Error("スタイル集に不正または重複したファイル名があります。");
            paths.add(path);
            total += length;
            if ((flags & 1) || ![0, 8].includes(method)) throw new Error("暗号化ZIPまたは未対応のZIP圧縮形式です。");
            if (!length || length > styleArchiveLimits.entry || total > styleArchiveLimits.total || localOffset + 30 > start)
                throw new Error("スタイル集の展開サイズが範囲外です。");
            this.entries.push({ path, name: segments.at(-1), category: segments.slice(1, -1).join("/") || "その他", flags, method, crc, compressed, length, localOffset, directoryStart: start });
        }
        if (offset !== end || !this.entries.length) throw new Error("ZIP内に利用できるYamahaスタイルがありません。");
        this.entries.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    }

    async read(entry) {
        if (!this.entries.includes(entry)) throw new Error("スタイル集に含まれない項目です。");
        if (!this.cache.has(entry.path)) {
            this.cache.set(entry.path, this.extract(entry).catch(error => { this.cache.delete(entry.path); throw error; }));
        }
        return this.cache.get(entry.path);
    }

    async extract(entry) {
        const view = this.view, offset = entry.localOffset;
        if (view.getUint32(offset, true) !== 0x04034b50 || view.getUint16(offset + 6, true) !== entry.flags || view.getUint16(offset + 8, true) !== entry.method)
            throw new Error("スタイルのZIPローカルヘッダーが不正です。");
        const nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
        const start = offset + 30 + nameLength + extraLength;
        if (start + entry.compressed > entry.directoryStart) throw new Error("圧縮スタイルが途中で切れています。");
        const localName = new TextDecoder("utf-8", { fatal: true }).decode(this.bytes.subarray(offset + 30, offset + 30 + nameLength));
        if (localName !== entry.path) throw new Error("スタイルのZIPファイル名が一致しません。");
        let bytes;
        if (entry.method === 0) bytes = this.bytes.slice(start, start + entry.compressed);
        else {
            const stream = new Blob([this.bytes.subarray(start, start + entry.compressed)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
            const reader = stream.getReader(), output = new Uint8Array(entry.length);
            let length = 0;
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (length + value.length > entry.length) throw new Error("スタイルの展開サイズが不正です。");
                    output.set(value, length); length += value.length;
                }
                bytes = output.subarray(0, length);
            } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        }
        if (bytes.length !== entry.length || styleCrc32(bytes) !== entry.crc) throw new Error("スタイルのZIP整合性チェックに失敗しました。");
        if (bytes.length < 14 || new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0) !== 0x4d546864)
            throw new Error("選択したファイルはMIDI形式のYamahaスタイルではありません。");
        return bytes;
    }
}

async function fetchStyleArchive(url, onProgress = () => {}) {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 60000);
    try {
        const response = await fetch(url, { credentials: "omit", cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error(`スタイル集の取得に失敗しました (${response.status})。`);
        const total = Number(response.headers.get("content-length")) || 0;
        if (total > styleArchiveLimits.archive) throw new Error("スタイル集のZIPが大きすぎます。");
        const reader = response.body.getReader(), chunks = [];
        let length = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                length += value.length;
                if (length > styleArchiveLimits.archive) throw new Error("スタイル集のZIPが大きすぎます。");
                chunks.push(value); onProgress(length, total);
            }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return new MemoryStyleArchive(bytes);
    } catch (error) {
        if (error instanceof TypeError || error.name === "AbortError")
            throw new Error("スタイル集を取得できませんでした。接続または配信元のCORS設定を確認して再試行してください。");
        throw error;
    } finally { clearTimeout(timeout); }
}

if (typeof module !== "undefined") module.exports = { MemoryStyleArchive, fetchStyleArchive, styleCrc32 };
