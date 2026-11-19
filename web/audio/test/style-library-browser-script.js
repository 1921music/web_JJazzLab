/* Run inside our own file:// demo; no archive or style is written to disk. */
(async () => {
    const report = { protocol: location.protocol, fixture: Boolean(styleFixtureUrl) };
    const check = (value, message) => { if (!value) throw new Error(message); };
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const until = async (predicate, label) => {
        for (let i = 0; i < 600; i++) { if (predicate()) return; await pause(100); }
        throw new Error("Timed out: " + label + " / " + status.textContent + " / " + stylePackStatus.textContent);
    };
    try {
        let requests = 0, transferred = 0, failNext = true;
        const nativeFetch = globalThis.fetch;
        globalThis.fetch = async (url, options) => {
            if (String(url) !== stylePackUrl) return nativeFetch(url, options);
            requests++;
            if (failNext) { failNext = false; throw new TypeError("Simulated network failure"); }
            transferred++;
            check(options.cache === "no-store" && options.credentials === "omit", "ZIP must not use persistent application caching");
            return nativeFetch(styleFixtureUrl || url, options);
        };
        const createUrl = URL.createObjectURL.bind(URL);
        URL.createObjectURL = blob => { check(!/zip/iu.test(blob.type), "ZIP must not create a download URL"); return createUrl(blob); };
        Storage.prototype.setItem = () => { throw new Error("Unexpected persistent storage write"); };
        check(!styleArchive && requests === 0, "Style collection must be lazy");
        loadStylePackButton.click(); loadStylePackButton.click();
        await until(() => !loadingStylePack, "recoverable ZIP failure");
        check(requests === 1 && stylePackStatus.hasAttribute("data-error") && !loadStylePackButton.disabled, "Failed ZIP fetch must allow retry");
        loadStylePackButton.click();
        await until(() => !loadingStylePack, "style collection");
        check(styleArchive, stylePackStatus.textContent);
        check(styleArchive.entries.length === 189, "Expected the 189 public styles");
        check(styleArchive.cache.size === 0, "Styles should be extracted only when selected");
        check(styleCategory.options.length === 11, "Expected ten style categories");
        check([...libraryStyle.options].filter(option => option.disabled).length === 3, "Known malformed source files should be disabled");
        report.styles = styleArchive.entries.length;
        styleSearch.value = "bossa"; styleSearch.dispatchEvent(new Event("input", { bubbles: true }));
        const matches = [...libraryStyle.options].filter(option => option.value && !option.disabled);
        check(matches.length > 0 && matches.length < 189 && matches.every(option => /bossa/iu.test(option.textContent)), "Style-name search failed");
        libraryStyle.value = matches[0].value; libraryStyle.dispatchEvent(new Event("change", { bubbles: true }));
        const selected = selectedLibraryStyle;
        const file = await readStyle();
        check(file.name === selected.name && file.bytes instanceof Int8Array && new Uint8Array(file.bytes).subarray(0, 4).join() === "77,84,104,100", "Selected ZIP entry did not reach readStyle");
        styleCategory.value = "Swing&Jazz"; styleCategory.dispatchEvent(new Event("change"));
        check(libraryStyle.value === selected.path && (await readStyle()).name === selected.name, "Filtering lost the selected style");
        chordInput.value = "C | Am7 | Dm7 | G7"; tempoInput.value = 120;
        form.requestSubmit(); await until(() => !generating, "archive style MIDI generation");
        check(song && !status.hasAttribute("data-error"), status.textContent);
        check(download.download === selected.name.replace(/\.[^.]+$/u, "") + "-accompaniment.mid", "MIDI filename must reflect the archive style");
        report.selected = selected.path; report.parts = song.parts.length;
        report.extracted = styleArchive.cache.size;
        check(requests === 2 && transferred === 1, "Repeated reads must reuse the in-memory ZIP");

        // All actual collection styles are tested against the existing Wasm,
        // keeping both the ZIP and extracted files entirely in process memory.
        report.generated = 0; report.generationFailures = []; report.unavailable = [];
        for (const entry of styleArchive.entries) {
            if (styleIssue(entry)) { report.unavailable.push({ name: entry.path, reason: styleIssue(entry) }); continue; }
            try {
                const bytes = new Int8Array(await styleArchive.read(entry));
                const midi = engine.exports.generateMidi(bytes, entry.name, ["C", "Am7", "Dm7", "G7"], 120);
                const result = parseMidi(midi, 4, engine.exports.getPartMetadata());
                check(result.parts.length > 0, "No notes"); report.generated++;
            } catch (error) { report.generationFailures.push({ name: entry.path, error: error.message || String(error) }); }
            await pause(0);
        }

        const local = new DataTransfer();
        local.items.add(new File([await decompress(embeddedStyle)], "local.STY"));
        styleInput.files = local.files; styleInput.dispatchEvent(new Event("change", { bubbles: true }));
        check(!selectedLibraryStyle && libraryStyle.value === "" && (await readStyle()).name === "local.STY", "Local file must override the library selection");
        styleInput.value = ""; styleInput.dispatchEvent(new Event("change", { bubbles: true }));
        check((await readStyle()).name === bundledStyle, "Clearing selection must restore bundled 8Beat");
        libraryStyle.value = selected.path; libraryStyle.dispatchEvent(new Event("change"));
        rhythmEngine.value = "jjswing"; rhythmEngine.dispatchEvent(new Event("change"));
        check(document.querySelector("#style-field").hidden && requests === 2, "jjSwing must hide the style collection without refetching");
        rhythmEngine.value = "yamaha"; rhythmEngine.dispatchEvent(new Event("change"));
        check(!document.querySelector("#style-field").hidden && selectedLibraryStyle === selected, "Switching engines lost the selected archive style");
        check(![...document.querySelectorAll("a[download]")].some(a => /\.zip$/iu.test(a.download)), "ZIP download link must not exist");
        report.requests = requests; report.transferred = transferred;
        report.ok = report.generationFailures.length === 0;
    } catch (error) { report.ok = false; report.error = error.stack || error.message; }
    console.log("JJAZZ_SMOKE_RESULT=" + JSON.stringify(report));
})();
