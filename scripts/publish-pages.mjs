/**
 * Publish a reviewed PWA directory or standalone HTML to GitHub Pages without
 * switching the development checkout. Dry run: node scripts/publish-pages.mjs WSL_image/pwa
 * Publish: build/test/commit/push, then add --publish to the same command.
 * Git's existing credential helper is used in memory; no token is persisted.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publish = process.argv.includes("--publish");
const input = process.argv.slice(2).find(value => value !== "--publish");
if (!input) throw new Error("Usage: node scripts/publish-pages.mjs [--publish] <pwa-directory|built.html>");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const remote = git("remote", "get-url", "origin");
const match = remote.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?$/u);
if (!match) throw new Error("origin must be a GitHub HTTPS or SSH repository");
const [, owner, repository] = match;
const sourceCommit = git("rev-parse", "HEAD");
const sourceUrl = "https://github.com/" + owner + "/" + repository + "/tree/" + sourceCommit;
const readSource = file => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/gu, "\n");
const inputPath = path.resolve(input);
const isPwa = fs.statSync(inputPath).isDirectory();
let html = fs.readFileSync(isPwa ? path.join(inputPath, "index.html") : inputPath, "utf8").replace(/\r\n/gu, "\n");
if (!/^<!doctype html>/iu.test(html) || html.includes("JJAZZ_SMOKE_RESULT")) throw new Error("Expected a production demo HTML, without test instrumentation");
for (const file of ["demo.js", "locale.js", "midi.js", "song-files.js", "song-editor.js", "piano-roll.js", "style-archive.js", "player.js"]) {
    const expected = readSource("web/engine/demo/" + file).trim().replace(/<\/script/giu, "<\\/script");
    if (!html.includes(expected)) throw new Error("Build is stale: " + file + ". Rebuild and test before publishing.");
}
const worklet = JSON.parse(html.match(/const embeddedWorklet = (.*);/u)?.[1] || "null");
if (worklet !== readSource("web/engine/demo/synth-worklet.js")) throw new Error("Build is stale: synth-worklet.js");
const pwaFiles = [];
let workerSource;
if (isPwa) {
    if (!html.includes('rel="manifest" href="./manifest.webmanifest"')) throw new Error("Expected a packaged PWA directory");
    const installScript = readSource("web/engine/demo/pwa.js").trim();
    if (!html.includes(installScript)) throw new Error("Build is stale: pwa.js");
    workerSource = readSource("web/engine/demo/sw.js");
    const worker = fs.readFileSync(path.join(inputPath, "sw.js"), "utf8");
    const buildId = worker.match(/cachePrefix \+ "([\da-f]{16})"/u)?.[1];
    if (!buildId || worker !== workerSource.replace("PWA_BUILD_ID", buildId)) throw new Error("Build is stale: sw.js");
    for (const [name, source] of [
        ["manifest.webmanifest", "web/engine/demo/manifest.webmanifest"],
        ["icon-192.png", "web/engine/demo/assets/icon-192.png"],
        ["icon-512.png", "graphics/icon_512x512.png"]
    ]) {
        const data = fs.readFileSync(path.join(inputPath, name));
        const current = fs.readFileSync(path.join(root, source));
        const matches = name.endsWith(".png") ? current.equals(data) : readSource(source) === data.toString("utf8").replace(/\r\n/gu, "\n");
        if (!matches) throw new Error("Build is stale: " + name);
        pwaFiles.push([name, data]);
    }
} else if (html.includes('rel="manifest" href="./manifest.webmanifest"')) {
    throw new Error("Pass the complete PWA directory to publish its manifest, icons and service worker");
}
const marker = '<meta name="jjazzlab-source-commit" content="' + sourceCommit + '">';
html = html.replace(/<meta name="jjazzlab-source-commit"[^>]*>\s*/gu, "").replace(/<\/head>/iu, marker + "\n</head>");
if (!html.includes("<!-- SOURCE_REVISION -->")) throw new Error("Build is stale: source revision placeholder is missing");
html = html.replace("<!-- SOURCE_REVISION -->", '<p id="source-revision" class="hint">ソース: <a href="' + sourceUrl + '" target="_blank" rel="noopener noreferrer" title="' + sourceCommit + '"><code>' + sourceCommit.slice(0, 9) + '</code></a></p>');
if (isPwa) {
    const hash = createHash("sha256").update(workerSource).update(html);
    for (const [, data] of pwaFiles) hash.update(data);
    pwaFiles.push(["sw.js", workerSource.replace("PWA_BUILD_ID", hash.digest("hex").slice(0, 16))]);
}
const deployed = [["index.html", html], ...pwaFiles];
const checksums = Object.fromEntries(deployed.map(([name, data]) => [name, createHash("sha256").update(data).digest("hex")]));
const checksum = checksums["index.html"];
console.log(JSON.stringify({ repository: owner + "/" + repository, sourceCommit, bytes: Buffer.byteLength(html), sha256: checksum, pwa: isPwa, files: Object.keys(checksums), branch: "gh-pages", publish }));
if (!publish) process.exit(0);
if (git("status", "--porcelain")) throw new Error("Commit all source changes before publishing");

let credential;
try {
    credential = execFileSync("git", ["-c", "credential.interactive=false", "credential", "fill"], {
        cwd: root, input: "protocol=https\nhost=github.com\n\n", encoding: "utf8",
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, stdio: ["pipe", "pipe", "pipe"]
    });
} catch { throw new Error("GitHub credential unavailable from Git's credential helper"); }
const token = credential.split(/\r?\n/u).find(line => line.startsWith("password="))?.slice(9);
if (!token) throw new Error("GitHub credential unavailable");
credential = undefined;
const base = "https://api.github.com/repos/" + owner + "/" + repository;
async function api(endpoint, method = "GET", body, allow404 = false) {
    const response = await fetch(base + endpoint, {
        method, signal: AbortSignal.timeout(30000),
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text(), result = text ? JSON.parse(text) : null;
    if (allow404 && response.status === 404) return null;
    if (!response.ok) {
        const error = new Error("GitHub " + response.status + ": " + result?.message);
        error.status = response.status;
        throw error;
    }
    return result;
}

await api("/commits/" + sourceCommit); // Source must already be pushed.
const current = await api("/git/ref/heads/gh-pages", "GET", undefined, true);
const parent = current ? await api("/git/commits/" + current.object.sha) : null;
const files = [
    ...deployed, [".nojekyll", ""],
    ["deployment.json", JSON.stringify({ sourceCommit, sourceUrl, htmlSha256: checksum, files: checksums }, null, 2) + "\n"],
    ["README.md", "# Published browser demo\n\nSource commit: [" + sourceCommit + "](" + sourceUrl + ")\n"]
];
const tree = [];
for (const [name, content] of files) {
    const blob = await api("/git/blobs", "POST", { content: Buffer.from(content).toString("base64"), encoding: "base64" });
    tree.push({ path: name, mode: "100644", type: "blob", sha: blob.sha });
}
// Preserve any existing custom files (for example CNAME) on the publishing branch.
const nextTree = await api("/git/trees", "POST", { ...(parent ? { base_tree: parent.tree.sha } : {}), tree });
const commit = await api("/git/commits", "POST", { message: "Publish browser demo from " + sourceCommit.slice(0, 9), tree: nextTree.sha, parents: current ? [current.object.sha] : [] });
if (current) await api("/git/refs/heads/gh-pages", "PATCH", { sha: commit.sha, force: false });
else await api("/git/refs", "POST", { ref: "refs/heads/gh-pages", sha: commit.sha });
console.log("Published artifact commit: " + commit.sha);

let pages = await api("/pages", "GET", undefined, true);
const source = { branch: "gh-pages", path: "/" };
if (!pages) {
    try { pages = await api("/pages", "POST", { build_type: "legacy", source }); }
    catch (error) {
        // Creating gh-pages can automatically enable Pages between the GET and
        // POST. Reuse that site instead of failing a successful publication.
        if (error.status !== 409) throw error;
        pages = await api("/pages");
    }
}
if (pages.build_type !== "legacy" || pages.source?.branch !== source.branch || pages.source?.path !== source.path) {
    await api("/pages", "PUT", { build_type: "legacy", source });
    pages = await api("/pages");
}
if (!pages.https_enforced) await api("/pages", "PUT", { https_enforced: true });
const url = pages.html_url.replace(/^http:/u, "https:");
console.log("GitHub Pages URL: " + url);
// Creating the site normally queues a build. An explicit build also covers
// updates made with Git's REST endpoints without relying on a push event.
const pendingBuild = await api("/pages/builds/latest", "GET", undefined, true);
if (pendingBuild?.commit !== commit.sha || pendingBuild.status === "errored") await api("/pages/builds", "POST", {});
let previous = "", lastError = "";
for (let attempt = 0; attempt < 40; attempt++) {
    const build = await api("/pages/builds/latest", "GET", undefined, true);
    const state = build ? build.status + " " + build.commit : "queued";
    if (state !== previous) { console.log("Pages build: " + state); previous = state; }
    if (build?.commit === commit.sha && build.status === "errored") throw new Error(build.error?.message || "Pages build failed");
    if (build?.commit === commit.sha && build.status === "built") {
        try {
            const verified = await Promise.all(Object.entries(checksums).map(async ([name, expected]) => {
                const address = new URL(name === "index.html" ? "./" : name, url);
                address.searchParams.set("v", sourceCommit);
                const response = await fetch(address, { cache: "no-store", signal: AbortSignal.timeout(15000) });
                return response.ok && createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex") === expected;
            }));
            if (verified.every(Boolean)) {
                console.log(JSON.stringify({ published: true, url, sourceCommit, pagesCommit: commit.sha, verifiedHtmlSha256: checksum }));
                process.exit(0);
            }
            lastError = "Waiting for the deployed files";
        } catch (error) { lastError = error.message; }
    }
    await new Promise(resolve => setTimeout(resolve, 15000));
}
throw new Error("Pages deployment verification timed out: " + lastError);
