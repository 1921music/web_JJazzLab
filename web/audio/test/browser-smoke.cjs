// Run the packaged file:// HTML in an isolated headless Chrome process.
// The test runs inside our own page; it does not control an existing browser.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

let fixtureServer;
(async () => {
let fixtureUrl = null;
if (process.env.JJAZZ_SMOKE_SUITE === "style-library" && process.env.JJAZZ_STYLE_FIXTURE === "1") {
    // Test-only CORS-enabled server. The real official ZIP stays in RAM.
    const response = await fetch("https://www.jjazzlab.org/pkg/jjazzlab_user_styles.zip");
    if (!response.ok) throw new Error("Official ZIP fixture fetch: " + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    fixtureServer = require("node:http").createServer((request, reply) => {
        reply.writeHead(200, { "Access-Control-Allow-Origin": "*", "Content-Type": "application/zip", "Content-Length": bytes.length, "Cache-Control": "no-store" });
        reply.end(bytes);
    });
    await new Promise(resolve => fixtureServer.listen(0, "127.0.0.1", resolve));
    fixtureUrl = "http://127.0.0.1:" + fixtureServer.address().port + "/styles.zip";
}

const htmlPath = path.resolve(process.argv[2] || "WSL_image/midi-demo.html");
const chrome = process.env.CHROME_BIN || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const scratch = fs.mkdtempSync(path.join(path.dirname(htmlPath), "soundfont-smoke-"));
const smokePath = path.join(scratch, "smoke.html");
const harness = process.env.JJAZZ_SMOKE_SUITE === "style-library"
    ? "const styleFixtureUrl = " + JSON.stringify(fixtureUrl) + ";\n" + fs.readFileSync(path.join(__dirname, "style-library-browser-script.js"), "utf8")
    : process.env.JJAZZ_SMOKE_SUITE === "jjswing"
    ? fs.readFileSync(path.join(__dirname, "jjswing-browser-script.js"), "utf8") : `
(async () => {
    const check = (value, message) => { if (!value) throw new Error(message); };
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const until = async (predicate, label) => {
        for (let i = 0; i < 600; i++) { if (await predicate()) return; await pause(100); }
        throw new Error("Timed out: " + label + " / " + document.querySelector("#status").textContent + " / " + document.querySelector("#play-status").textContent);
    };
    const report = { protocol: location.protocol, secure: isSecureContext };
    const originalSend = player.send.bind(player);
    player.send = (...args) => {
        console.log("JJAZZ_SMOKE_STAGE=" + JSON.stringify({ command: args[0], state: player.context?.state, time: player.context?.currentTime }));
        return originalSend(...args).then(result => {
            console.log("JJAZZ_SMOKE_ACK=" + args[0]); return result;
        });
    };
    try {
        let downloads = 0, failNextDownload = true;
        const nativeFetch = globalThis.fetch;
        globalThis.fetch = (...args) => {
            if (String(args[0]).includes("TimGM6mb.sf2")) {
                if (failNextDownload) { failNextDownload = false; return Promise.reject(new TypeError("Simulated offline")); }
                downloads++;
            }
            return nativeFetch(...args);
        };
        check(location.protocol === "file:", "Expected file://");
        check(isSecureContext, "file:// must be a secure context");
        form.requestSubmit();
        await until(() => song && !generating, "MIDI generation");
        check(downloads === 0, "SoundFont downloaded before play");
        report.parts = song.parts.map(p => ({ name: p.name, channel: p.channel, drum: p.drum }));
        check(song.parts.find(p => p.name === "SubRhythm")?.drum, "SubRhythm must use the percussion bank");
        const midi = new Uint8Array(await (await nativeFetch(download.href)).arrayBuffer());
        report.midiBytes = midi.length;
        const exported = parseMidi(midi, song.barTimes.length - 1);
        const sourceDrums = song.parts.filter(p => p.drum);
        const exportedDrums = exported.parts.filter(p => p.drum);
        check(sourceDrums.length === 2 && sourceDrums.some(p => p.channel === 8), "Browser lost independent percussion channels");
        check(exportedDrums.length === 2 && exportedDrums.every(p => p.channel === 9), "GM download must route all percussion to channel 10");
        check(!exported.events.some(e => e.channel === 8), "GM download still contains channel 9 events");
        check(exported.events.filter(e => e.type === 0x90).length === song.events.filter(e => e.type === 0x90).length, "GM download lost notes");
        report.exportedDrumChannels = exportedDrums.map(p => p.channel + 1);
        playButton.click();
        await until(() => !starting && playStatus.hasAttribute("data-error"), "recoverable offline error");
        check(!playing && !playButton.disabled, "Download failure must allow retry");
        playButton.click();
        await until(() => playing || (!starting && playStatus.hasAttribute("data-error")), "first play");
        check(playing, playStatus.textContent);
        check(player.context.audioWorklet, "AudioWorklet unavailable");
        const analyser = player.context.createAnalyser(); analyser.fftSize = 2048;
        player.compressor.connect(analyser);
        const samples = new Float32Array(2048);
        let peak = 0;
        for (let i = 0; i < 20; i++) {
            await pause(50); analyser.getFloatTimeDomainData(samples);
            peak = Math.max(peak, ...samples.map(Math.abs));
        }
        check(peak > .00001, "No rendered audio at Web Audio output");
        report.peak = peak;
        const mute = document.querySelector(".strip button"); mute.click();
        const volume = document.querySelector("#volume-0"); volume.value = "37"; volume.dispatchEvent(new Event("input"));
        check(mixerParts[0].mute && mixerParts[0].volume === .37, "Mixer UI did not update");
        stopButton.click(); await until(() => !playing, "stop");
        check(mixerParts[0].mute && mixerParts[0].volume === .37, "Stop lost mixer settings");
        form.requestSubmit(); await until(() => song && !generating, "regeneration");
        check(mixerParts[0].mute && mixerParts[0].volume === .37, "Regeneration lost mixer settings");
        check(downloads === 1, "Regeneration downloaded SF2 again");
        document.querySelector("#reset-mixer").click();
        check(!mixerParts[0].mute && mixerParts[0].volume === 1, "Mixer reset failed");
        loopStart.value = 2; loopEnd.value = 2;
        loopStart.dispatchEvent(new Event("input", { bubbles: true }));
        playButton.click(); await until(() => playing, "second play");
        check(downloads === 1, "Second play downloaded SF2 again");
        let positions = [];
        const previousPosition = player.onPosition;
        player.onPosition = data => { positions.push(data.seconds); previousPosition(data); };
        await pause(2800);
        check(positions.length > 2 && positions.every(s => s >= song.barTimes[1] && s <= song.barTimes[2]), "Loop escaped its selected bar");
        report.loopPositions = positions.length;
        const oldSong = song;
        chordInput.value = "F | Dm7 | Gm7 | C7"; chordInput.dispatchEvent(new Event("input", { bubbles: true }));
        check(playing && song === oldSong, "Editing stopped the current performance");
        await player.stop();
        report.downloads = downloads; report.retry = true; report.ok = true;
    } catch (error) { report.ok = false; report.error = error.stack || error.message; report.audioState = player.context?.state; report.audioTime = player.context?.currentTime; }
    console.log("JJAZZ_SMOKE_RESULT=" + JSON.stringify(report));
})();`;
fs.writeFileSync(smokePath, fs.readFileSync(htmlPath, "utf8").replace("</body>", "<script>" + harness + "</script></body>"));
const child = spawn(chrome, [
    "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    "--autoplay-policy=no-user-gesture-required", "--enable-logging=stderr", "--log-level=0",
    "--user-data-dir=" + path.join(scratch, "profile"), pathToFileURL(smokePath).href
], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
const log = fs.createWriteStream(path.join(scratch, "chrome.log"));
let buffer = "", finished = false;
const timeout = setTimeout(() => finish({ ok: false, error: "Headless Chrome smoke test timed out", scratch }), 150000);
function finish(result) {
    if (finished) return; finished = true;
    clearTimeout(timeout); child.kill(); log.end();
    fixtureServer?.close();
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
}
function read(data) {
    log.write(data); buffer += data.toString();
    const line = buffer.match(/JJAZZ_SMOKE_RESULT=(\{.*\})", source:/u);
    if (line) {
        try { finish(JSON.parse(line[1])); } catch (error) { finish({ ok: false, error: error.message, raw: line[1] }); }
    }
    if (buffer.length > 100000) buffer = buffer.slice(-50000);
}
child.stderr.on("data", read); child.stdout.on("data", read);
child.on("error", error => finish({ ok: false, error: error.message }));
child.on("exit", code => { if (!finished) finish({ ok: false, error: "Chrome exited before reporting: " + code, scratch }); });
})().catch(error => { fixtureServer?.close(); console.error(error.message); process.exitCode = 1; });
