const { test } = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { MemoryStyleArchive, fetchStyleArchive, styleCrc32 } = require("../../engine/demo/style-archive.js");

const style = Buffer.from("4d546864000000060001000101e04d54726b0000000400ff2f00", "hex");
function zip(items, comment = Buffer.alloc(0)) {
    const locals = [], directory = [];
    let offset = 0;
    for (const item of items) {
        const name = Buffer.from(item.name), data = item.data || style, method = item.method ?? 8, flags = item.flags ?? 0;
        const packed = method === 8 ? zlib.deflateRawSync(data) : data;
        const crc = styleCrc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
        if (!(flags & 8)) { local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); }
        local.writeUInt16LE(name.length, 26);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 6); central.writeUInt16LE(flags, 8); central.writeUInt16LE(method, 10);
        central.writeUInt32LE(item.crc ?? crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(item.length ?? data.length, 24);
        central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
        const descriptor = flags & 8 ? Buffer.alloc(16) : Buffer.alloc(0);
        if (descriptor.length) { descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(crc, 4); descriptor.writeUInt32LE(packed.length, 8); descriptor.writeUInt32LE(data.length, 12); }
        locals.push(local, name, packed, descriptor); directory.push(central, name);
        offset += local.length + name.length + packed.length + descriptor.length;
    }
    const central = Buffer.concat(directory), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(items.length, 8); end.writeUInt16LE(items.length, 10);
    end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(comment.length, 20);
    return Buffer.concat([...locals, central, end, comment]);
}

test("ZIP lists supported style extensions by category and selectively extracts stored/deflated entries", async () => {
    const archive = new MemoryStyleArchive(zip([
        { name: "styles/Jazz/Swing.STY", method: 0 }, { name: "styles/Latin/Bossa.prs" },
        { name: "styles/Ballad/Slow.bcs" }, { name: "styles/Jazz/Waltz.sst" }, { name: "styles/readme.txt", data: Buffer.from("text") }
    ]));
    assert.equal(archive.entries.length, 4);
    assert.deepEqual(archive.entries.map(e => e.category), ["Ballad", "Jazz", "Jazz", "Latin"]);
    assert.equal(archive.cache.size, 0);
    for (const entry of archive.entries) assert.deepEqual(Buffer.from(await archive.read(entry)), style);
    const entry = archive.entries[0];
    assert.equal(await archive.read(entry), await archive.read(entry));
});

test("ZIP handles UTF-8 names, data descriptors, byte offsets and comments containing signatures", async () => {
    const comment = Buffer.from("comment PK\x05\x06 inside the ZIP comment");
    const bytes = zip([{ name: "styles/Jazz/日本語.sty", flags: 0x808 }], comment);
    const buffer = Buffer.concat([Buffer.alloc(7), bytes, Buffer.alloc(3)]);
    const archive = new MemoryStyleArchive(buffer.subarray(7, 7 + bytes.length));
    assert.equal(archive.entries[0].name, "日本語.sty");
    assert.deepEqual(Buffer.from(await archive.read(archive.entries[0])), style);
});

test("CRC-32 matches the standard vector and rejects corrupted data without caching failures", async () => {
    assert.equal(styleCrc32(Buffer.from("123456789")), 0xcbf43926);
    const archive = new MemoryStyleArchive(zip([{ name: "styles/Jazz/Bad.sty", crc: 1 }]));
    await assert.rejects(archive.read(archive.entries[0]), /整合性/);
    assert.equal(archive.cache.size, 0);
});

test("ZIP rejects truncation, traversal, duplicate names, encryption and excessive expansion", async () => {
    assert.throws(() => new MemoryStyleArchive(Buffer.from("not a zip")), /サイズ/);
    assert.throws(() => new MemoryStyleArchive(zip([{ name: "styles/Test.sty" }]).subarray(0, -2)), /ディレクトリ/);
    assert.throws(() => new MemoryStyleArchive(zip([{ name: "../Test.sty" }])), /ファイル名/);
    assert.throws(() => new MemoryStyleArchive(zip([{ name: "C:\\Test.sty" }])), /ファイル名/);
    assert.throws(() => new MemoryStyleArchive(zip([{ name: "Test.sty" }, { name: "Test.sty" }])), /重複/);
    assert.throws(() => new MemoryStyleArchive(zip([{ name: "Test.sty", flags: 1 }])), /暗号化/);
    assert.throws(() => new MemoryStyleArchive(zip([{ name: "Test.sty", length: 1024 * 1024 + 1 }])), /展開サイズ/);
    assert.throws(() => new MemoryStyleArchive(zip([{ name: "readme.txt" }])), /利用できる/);
    const archive = new MemoryStyleArchive(zip([{ name: "Test.sty", length: 8 }]));
    await assert.rejects(archive.read(archive.entries[0]), /展開サイズ/);
    const notMidi = new MemoryStyleArchive(zip([{ name: "Test.sty", data: Buffer.alloc(20) }]));
    await assert.rejects(notMidi.read(notMidi.entries[0]), /MIDI形式/);
});

test("fetch streams the archive to memory without persistent caching and reports recoverable failures", async () => {
    const originalFetch = global.fetch, progress = [];
    const bytes = zip([{ name: "styles/Jazz/Test.sty" }]);
    try {
        global.fetch = async (url, options) => {
            assert.equal(url, "https://example.test/styles.zip");
            assert.equal(options.cache, "no-store"); assert.equal(options.credentials, "omit");
            return new Response(bytes, { headers: { "content-length": String(bytes.length) } });
        };
        const archive = await fetchStyleArchive("https://example.test/styles.zip", (n, total) => progress.push([n, total]));
        assert.equal(archive.entries.length, 1);
        assert.deepEqual(progress.at(-1), [bytes.length, bytes.length]);
        global.fetch = async () => { throw new TypeError("Failed to fetch"); };
        await assert.rejects(fetchStyleArchive("https://example.test/styles.zip"), /CORS/);
        global.fetch = async () => new Response("not found", { status: 404 });
        await assert.rejects(fetchStyleArchive("https://example.test/styles.zip"), /404/);
        global.fetch = async () => new Response(bytes, { headers: { "content-length": "999999999" } });
        await assert.rejects(fetchStyleArchive("https://example.test/styles.zip"), /大きすぎ/);
    } finally { global.fetch = originalFetch; }
});
