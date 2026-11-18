package org.jjazz.web.engine;

import java.io.ByteArrayOutputStream;
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
        try (var style = new RawStyleFile(styleBytes, styleName))
        {
            var midi = new ByteArrayOutputStream();
            MidiGeneration.generate(style.file(), chords, tempo, midi);
            return midi.toByteArray();
        }
    }
}
