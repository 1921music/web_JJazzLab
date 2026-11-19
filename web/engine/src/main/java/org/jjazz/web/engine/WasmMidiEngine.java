package org.jjazz.web.engine;

import java.io.ByteArrayOutputStream;
import org.teavm.jso.JSExport;

/** JavaScript entry point for generating a General MIDI accompaniment. */
public final class WasmMidiEngine
{
    private static String[] partMetadata = new String[0];
    private WasmMidiEngine()
    {
    }

    @JSExport
    public static byte[] generateMidi(byte[] styleBytes, String styleName, String[] chords, int tempo) throws Exception
    {
        partMetadata = new String[0];
        try (var style = new RawStyleFile(styleBytes, styleName))
        {
            var midi = new ByteArrayOutputStream();
            partMetadata = MidiGeneration.generate(style.file(), chords, tempo, midi);
            return midi.toByteArray();
        }
    }

    /** Track-indexed entries: drums|melodic, a tab, then the rhythm voice name. */
    @JSExport
    public static String[] getPartMetadata()
    {
        return partMetadata.clone();
    }
}
