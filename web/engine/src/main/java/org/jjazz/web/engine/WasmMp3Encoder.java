package org.jjazz.web.engine;

import java.util.Arrays;
import org.jjazz.embeddedsynth.lame.mp3.Lame;
import org.jjazz.embeddedsynth.lame.mp3.MPEGMode;

/** Encodes the browser's stereo PCM in blocks using JJazzLab's Java LAME library. */
final class WasmMp3Encoder implements AutoCloseable
{
    private static final int BLOCK_FRAMES = 8192;
    private final Lame encoder = new Lame();
    private final byte[] encoded = new byte[BLOCK_FRAMES * 2 + 7200];

    WasmMp3Encoder(int sampleRate)
    {
        var flags = encoder.getFlags();
        flags.setInNumChannels(2);
        flags.setInSampleRate(sampleRate);
        flags.setMode(MPEGMode.STEREO);
        flags.setBitRate(320);
        flags.setQuality(Lame.QUALITY_HIGHEST);
        flags.bWriteVbrTag = false; // CBR output can be streamed without rewriting an initial header.
        flags.setWriteId3tagAutomatic(false);
        if (encoder.initParams() < 0)
        {
            close();
            throw new IllegalArgumentException("Unsupported MP3 sample rate " + sampleRate);
        }
    }

    byte[] encode(float[] left, float[] right)
    {
        if (left.length != right.length || left.length > BLOCK_FRAMES)
        {
            throw new IllegalArgumentException("Invalid stereo MP3 block size");
        }
        for (int frame = 0; frame < left.length; frame++)
        {
            left[frame] = Math.clamp(left[frame], -1f, 1f) * 2147483648f;
            right[frame] = Math.clamp(right[frame], -1f, 1f) * 2147483648f;
        }
        return result(encoder.encodeBuffer(left, right, left.length, encoded));
    }

    byte[] finish()
    {
        return result(encoder.encodeFlush(encoded));
    }

    private byte[] result(int size)
    {
        if (size < 0) throw new IllegalStateException("MP3 encoding failed (" + size + ")");
        return Arrays.copyOf(encoded, size);
    }

    @Override
    public void close()
    {
        encoder.close();
    }
}
