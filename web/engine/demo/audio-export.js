"use strict";

async function renderSongAudio(song, parts, master, onStatus) {
    const rate = 44100;
    const frames = Math.ceil((song.duration + .1) * rate);
    const context = new OfflineAudioContext(2, frames, rate);
    const [assets] = await Promise.all([loadSynthAssets(onStatus), loadSynthWorklet(context)]);
    const module = await WebAssembly.compile(assets.wasm);
    const node = new AudioWorkletNode(context, "soundfont-synth", {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: { module, soundfont: assets.soundfont, song, parts, master, effects: synthEffects }
    });
    connectSynthOutput(context, node);
    const failed = new Promise((resolve, reject) => {
        node.onprocessorerror = () => reject(new Error(t("音声を書き出せませんでした。", "Audio rendering failed.")));
        node.port.onmessage = ({ data }) => {
            if (data.error) reject(new Error(data.error));
        };
    });
    onStatus(t("音声を生成しています…", "Rendering audio…"));
    try {
        return await Promise.race([context.startRendering(), failed]);
    } finally {
        node.port.close();
        node.disconnect();
    }
}

function encodeWave(audio) {
    const dataBytes = audio.length * 4;
    if (dataBytes > 0xffffffff - 36) throw new Error(t("WAV形式で保存できる長さを超えています。", "The song exceeds the WAV file size limit."));
    const header = new DataView(new ArrayBuffer(44));
    header.setUint32(0, 0x52494646);  // RIFF
    header.setUint32(4, 36 + dataBytes, true);
    header.setUint32(8, 0x57415645);  // WAVE
    header.setUint32(12, 0x666d7420); // fmt
    header.setUint32(16, 16, true);
    header.setUint16(20, 1, true);
    header.setUint16(22, 2, true);
    header.setUint32(24, audio.sampleRate, true);
    header.setUint32(28, audio.sampleRate * 4, true);
    header.setUint16(32, 4, true);
    header.setUint16(34, 16, true);
    header.setUint32(36, 0x64617461); // data
    header.setUint32(40, dataBytes, true);

    const channels = [audio.getChannelData(0), audio.getChannelData(1)];
    const chunks = [header];
    for (let start = 0; start < audio.length; start += 65536) {
        const count = Math.min(65536, audio.length - start);
        const chunk = new DataView(new ArrayBuffer(count * 4));
        for (let frame = 0; frame < count; frame++) {
            for (let channel = 0; channel < 2; channel++) {
                const sample = Math.min(1, Math.max(-1, channels[channel][start + frame]));
                chunk.setInt16(frame * 4 + channel * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
            }
        }
        chunks.push(chunk);
    }
    return new Blob(chunks, { type: "audio/wav" });
}

async function encodeMp3Audio(audio, onStatus) {
    onStatus(t("MP3に変換しています…", "Encoding MP3…"));
    const encoder = (await getEngine()).exports;
    const left = audio.getChannelData(0), right = audio.getChannelData(1);
    const encoded = [];
    encoder.startMp3(audio.sampleRate);
    try {
        let lastYield = performance.now();
        for (let start = 0; start < audio.length; start += 8192) {
            encoded.push(encoder.encodeMp3(left.subarray(start, start + 8192), right.subarray(start, start + 8192)));
            if (performance.now() - lastYield > 24) {
                await new Promise(resolve => setTimeout(resolve, 0));
                lastYield = performance.now();
            }
        }
        encoded.push(encoder.finishMp3());
        return new Blob(encoded, { type: "audio/mpeg" });
    } finally { encoder.closeMp3(); }
}
