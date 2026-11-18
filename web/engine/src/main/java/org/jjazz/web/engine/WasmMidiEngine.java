package org.jjazz.web.engine;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import org.teavm.jso.JSExport;

/** JavaScript entry point for generating a General MIDI accompaniment. */
public final class WasmMidiEngine
{
    private WasmMidiEngine()
    {
    }

    @JSExport
    public static byte[] generateMidi(byte[] styleBytes, String styleName, String[] chords, int tempo) throws Exception
    {
        if (styleName.isEmpty() || styleName.equals(".") || styleName.equals("..")
                || styleName.indexOf('/') >= 0 || styleName.indexOf('\\') >= 0 || styleName.indexOf(':') >= 0)
        {
            throw new IllegalArgumentException("A style filename without a path is required");
        }
        // TeaVM uses an in-memory filesystem. The adapter preserves the
        // unmodified desktop style-loading path and the original filename.
        var directory = File.createTempFile("jjazzlab-", ".input");
        if (!directory.delete() || !directory.mkdir())
        {
            throw new IOException("Could not create a temporary style directory");
        }
        var file = new File(directory, styleName);
        try
        {
            try (var styleOutput = new FileOutputStream(file))
            {
                styleOutput.write(styleBytes);
            }
            var midi = new ByteArrayOutputStream();
            MidiGeneration.generate(file, chords, tempo, midi);
            return midi.toByteArray();
        } finally
        {
            file.delete();
            directory.delete();
        }
    }
}
