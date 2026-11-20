/* Injected into the packaged editor by browser-smoke.cjs. */
(async () => {
    const report = {};
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    try {
        editor.open(DesktopSongFiles.readSong(desktopFixture.song), DesktopSongFiles.readMix(desktopFixture.mix), undefined, true);
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        const tempo = editor.project.tempo;
        const excerpt = editor.createPracticeSong(0, 3, tempo, tempo, 2);
        editor.open(excerpt.song, excerpt.mix, excerpt.style, true);
        while (generating) await new Promise(resolve => setTimeout(resolve, 20));
        check(await generateAccompaniment(), status.textContent);
        const downloads = [];
        const realAnchorClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
            if (/\.(wav|mp3|zip)$/u.test(this.download)) downloads.push({ name: this.download, data: fetch(this.href).then(reply => reply.arrayBuffer()) });
            else realAnchorClick.call(this);
        };
        try {
            const renderStatus = () => document.querySelector("#status").textContent;
            await document.querySelector("#export-wave").onclick();
            check(downloads.length === 1, `Whole-song WAV download was not created: ${renderStatus()}`);
            const track = mixerParts.find(part => part.trackIndex !== undefined && song.events.some(event => song.parts[event.part]?.id === part.id
                && event.type === 0x90 && event.b > 0));
            check(Boolean(track), "The working song has no rendered track to export");
            await exportAudio("wav", track.id);
            check(downloads.length === 2 && downloads[1].name.includes(track.name), `Track WAV download was not created: ${renderStatus()}`);
            await document.querySelector("#export-mp3").onclick();
            check(downloads.length === 3 && downloads[2].name.endsWith(".mp3"), `Whole-song MP3 download was not created: ${renderStatus()}`);
            const excerptTrack = mixerParts.find(part => part.trackIndex !== undefined && song.events.some(event => song.parts[event.part]?.id === part.id
                && event.type === 0x90 && event.b > 0));
            check(Boolean(excerptTrack), "The MP3 excerpt has no rendered track to export");
            await exportAudio("mp3", excerptTrack.id);
            check(downloads.length === 4 && downloads[3].name.includes(excerptTrack.name), `Track MP3 download was not created: ${renderStatus()}`);
            const audibleTracks = mixerParts.filter(part => !part.mute && part.trackIndex !== undefined);
            check(audibleTracks.length > 1, "The exported excerpt needs a mix with multiple tracks");
            audibleTracks[0].mute = true;
            try {
                await document.querySelector("#export-wave-tracks").onclick();
                await document.querySelector("#export-mp3-tracks").onclick();
            } finally { audibleTracks[0].mute = false; }
            check(downloads.length === 6, `A batch audio ZIP was not created: ${renderStatus()}`);
            for (const [record, extension] of [[downloads[4], "wav"], [downloads[5], "mp3"]]) {
                const zip = new DataView(await record.data);
                const entries = [];
                for (let offset = 0; zip.getUint32(offset, true) === 0x04034b50;) {
                    const length = zip.getUint32(offset + 18, true);
                    const nameLength = zip.getUint16(offset + 26, true);
                    const name = new TextDecoder().decode(new Uint8Array(zip.buffer, offset + 30, nameLength));
                    const start = offset + 30 + nameLength;
                    check(styleCrc32(new Uint8Array(zip.buffer, start, length)) === zip.getUint32(offset + 14, true), `Invalid CRC for ${name}`);
                    entries.push(name);
                    offset = start + length;
                }
                const expected = audibleTracks.slice(1).map((part, index) =>
                    `${String(index + 1).padStart(2, "0")}-${part.name.replace(/[<>:"/\\|?*]/gu, "_")}.${extension}`);
                check(JSON.stringify(entries) === JSON.stringify(expected), "The audio ZIP did not contain exactly the unmuted tracks");
            }
            report.audioTrackZip = audibleTracks.length - 1;
        } finally { HTMLAnchorElement.prototype.click = realAnchorClick; }
        const [wave, trackWave] = await Promise.all(downloads.slice(0, 2).map(async file => new DataView(await file.data)));
        for (const file of [wave, trackWave]) {
            check(file.getUint32(0) === 0x52494646 && file.getUint32(8) === 0x57415645 && file.getUint32(24, true) === 44100
                && file.getUint16(22, true) === 2 && file.getUint16(34, true) === 16 && file.getUint32(40, true) === file.byteLength - 44,
                "The downloaded file does not have a valid stereo PCM WAV header");
        }
        const outputEnergy = file => {
            let energy = 0;
            for (let byte = 44; byte < file.byteLength; byte += 148) energy += file.getInt16(byte, true) ** 2;
            return energy;
        };
        check(outputEnergy(wave) > 0 && outputEnergy(trackWave) > 0 && outputEnergy(wave) !== outputEnergy(trackWave),
            "The full song and its isolated track did not render distinct audible WAV files");
        report.wavExport = { songBytes: wave.byteLength, trackBytes: trackWave.byteLength, channels: 2, sampleRate: 44100 };
        const decoder = new OfflineAudioContext(2, 1, 44100);
        const mp3 = await Promise.all(downloads.slice(2, 4).map(async file => decoder.decodeAudioData(await file.data)));
        const peaks = mp3.map(audio => audio.getChannelData(0).reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0));
        check(mp3.every(audio => audio.numberOfChannels === 2 && Math.abs(audio.duration - song.duration) < .25)
            && peaks.every(peak => peak > .001) && peaks[0] !== peaks[1], "Chrome did not decode distinct audible MP3 files at the expected duration");
        report.mp3Export = { seconds: mp3[0].duration, channels: 2 };
        report.ok = true;
    } catch (error) { report.ok = false; report.error = error.stack || error.message; }
    console.log("JJAZZ_SMOKE_RESULT=" + JSON.stringify(report));
})();
