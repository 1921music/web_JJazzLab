(() => {
    const result = {};
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const check = (valid, message) => { if (!valid) throw new Error(message); };
    try {
        const [phaseDance, soul, maxine] = legacyFixtures.songs.map(DesktopSongFiles.readSong);
        check(phaseDance.title === "PhaseDance" && soul.bars === 8 && maxine.title === "Maxine_old"
            && maxine.bars === 46 && maxine.parts.length === 8, "The source song structure was lost");
        result.songVersions = [phaseDance, soul, maxine].map((song, index) => {
            const xml = DesktopSongFiles.writeSong(song);
            const reopened = DesktopSongFiles.readSong(xml);
            check(xml.includes("<spVERSION>4</spVERSION>") && reopened.bars === song.bars
                && same(reopened.parts, song.parts) && same(reopened.chords, song.chords), `Song v${index + 1} did not migrate to v4`);
            return index + 1;
        });
        result.mixVersions = legacyFixtures.mixes.map((fixture, index) => {
            const mix = DesktopSongFiles.readMix(fixture);
            const xml = DesktopSongFiles.writeMix(mix);
            check(mix.length === [6, 8, 5, 5][index] && mix.every(track => track.patch)
                && xml.includes("<spVERSION>5</spVERSION>") && same(DesktopSongFiles.readMix(xml), mix),
            `Mix v${index + 1} lost a channel, patch or setting during migration`);
            if (index === 0) check(mix.some(track => track.patch === "Grand Piano"), "The v1 saved instrument ID did not recover its patch name");
            return index + 1;
        });
        result.ok = true;
    } catch (error) { result.ok = false; result.error = error.stack || error.message; }
    console.log("JJAZZ_SMOKE_RESULT=" + JSON.stringify(result));
})();
