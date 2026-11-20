const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { once } = require("node:events");
const { setTimeout: sleep } = require("node:timers/promises");

const directory = path.resolve(process.argv[2] ?? "WSL_image/pwa");
const font = fs.readFileSync(process.env.SOUNDFONT_TEST_SF2 ?? "WSL_image/TimGM6mb.sf2");
const files = new Map([
    ["", ["index.html", "text/html; charset=utf-8"]],
    ["index.html", ["index.html", "text/html; charset=utf-8"]],
    ["manifest.webmanifest", ["manifest.webmanifest", "application/manifest+json"]],
    ["sw.js", ["sw.js", "application/javascript"]],
    ["icon-192.png", ["icon-192.png", "image/png"]],
    ["icon-512.png", ["icon-512.png", "image/png"]]
].map(([url, [file, type]]) => [url, { data: fs.readFileSync(path.join(directory, file)), type }]));

async function until(action, message) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        const result = await action();
        if (result) return result;
        await sleep(100);
    }
    throw new Error(message);
}

async function main() {
    let offline = false, fontRequests = 0;
    const prefix = "/web_JJazzLab/";
    const server = http.createServer((request, response) => {
        if (offline) return request.socket.destroy();
        const url = new URL(request.url, "http://localhost");
        const name = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : undefined;
        const file = files.get(name);
        if (name === "test.sf2") {
            fontRequests++;
            response.writeHead(200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" });
            response.end(font);
        } else if (file) {
            response.writeHead(200, { "Content-Type": file.type, "Cache-Control": "no-store" });
            response.end(file.data);
        } else { response.writeHead(404); response.end(); }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = `http://127.0.0.1:${server.address().port}`;
    const profile = fs.mkdtempSync(path.join(path.dirname(directory), "pwa-smoke-"));
    const chrome = spawn(process.env.CHROME_BIN ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", [
        "--headless=new", "--remote-debugging-port=0", "--no-first-run", "--disable-background-networking",
        "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${profile}`, "about:blank"
    ], { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] });
    let socket;
    try {
        const activePortFile = path.join(profile, "DevToolsActivePort");
        const port = await until(() => fs.existsSync(activePortFile) && fs.readFileSync(activePortFile, "utf8").split("\n")[0],
            "Chromium did not start debugging");
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        socket = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
        await once(socket, "open");
        let serial = 0;
        const waiting = new Map();
        socket.addEventListener("message", ({ data }) => {
            const message = JSON.parse(data);
            const settle = waiting.get(message.id);
            if (settle) settle(message);
        });
        async function send(method, params = {}) {
            const id = ++serial;
            const result = new Promise((resolve, reject) => {
                const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`DevTools timed out: ${method}`)); }, 25000);
                waiting.set(id, message => {
                    clearTimeout(timer);
                    waiting.delete(id);
                    if (message.error) reject(new Error(`${method}: ${message.error.message}`));
                    else resolve(message.result);
                });
            });
            socket.send(JSON.stringify({ id, method, params }));
            return result;
        }
        async function evaluate(expression) {
            const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
            if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
            return result.result.value;
        }
        await send("Page.enable");
        await send("Page.addScriptToEvaluateOnNewDocument", { source: `
            const nativeFetch = globalThis.fetch;
            globalThis.fetch = (url, ...options) => nativeFetch(
                typeof url === "string" && url.endsWith("/TimGM6mb.sf2") ? "${prefix}test.sf2" : url, ...options);
        ` });
        await send("Page.navigate", { url: address + prefix });
        await until(() => evaluate("Boolean(navigator.serviceWorker?.controller)"), "The PWA service worker did not take control");
        const manifest = await send("Page.getAppManifest");
        assert.deepEqual(manifest.errors, []);
        assert.equal(JSON.parse(manifest.data).display, "standalone");
        const installability = await send("Page.getInstallabilityErrors");
        assert.deepEqual(installability.installabilityErrors, []);
        assert.equal(await evaluate(`(async () => {
            const button = document.querySelector("#install-app");
            const event = new Event("beforeinstallprompt", { cancelable: true });
            let prompted = false;
            event.prompt = () => { prompted = true; };
            window.dispatchEvent(event);
            if (button.hidden) return false;
            button.click();
            return event.defaultPrevented && prompted && button.hidden;
        })()`), true);
        assert.equal(await evaluate("loadSynthAssets(() => {}).then(assets => assets.soundfont.byteLength)"), font.length);
        assert.equal(fontRequests, 1);
        offline = true;
        await send("Page.navigate", { url: address + prefix + "?offline=1" });
        await until(() => evaluate("location.search === '?offline=1' && typeof startPlayback === 'function'"), "The cached shell did not start offline");
        assert.equal(await evaluate("loadSynthAssets(() => {}).then(assets => assets.soundfont.byteLength)"), font.length);
        await evaluate("startPlayback()");
        await until(() => evaluate("playing && player.ready"), "Offline playback did not start");
        console.log("Chromium installability, subdirectory scope, install button and offline playback passed");
    } finally {
        socket?.close();
        chrome.kill();
        server.closeAllConnections();
        server.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
