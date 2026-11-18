package org.jjazz.web.engine;

import java.io.IOException;
import org.jjazz.yamjjazz.CASMDataReader;
import org.jjazz.yamjjazz.FormatNotSupportedException;
import org.jjazz.yamjjazz.rhythm.api.Style;
import org.teavm.jso.JSExport;

/**
 * Verifies MIDI event decoding from raw style bytes in the Wasm runtime.
 */
public final class StyleInputProbe
{
    private StyleInputProbe()
    {
    }

    @JSExport
    public static int countStyleNotes(byte[] bytes)
    {
        var counter = new NoteCounter();
        SmfReader.read(bytes, counter);
        return counter.count;
    }

    @JSExport
    public static int countStyleParts(byte[] bytes) throws IOException, FormatNotSupportedException
    {
        var header = SmfReader.read(bytes, (track, tick, status, data1, data2, offset, length) -> {});
        var style = new Style();
        new CASMDataReader(style, "Wasm style").readCasmChunk(bytes, header.endOffset(), header.ticksPerQuarter());
        return style.getStylePartTypes().size();
    }

    private static final class NoteCounter implements SmfReader.EventSink
    {
        private int count;

        @Override
        public void event(int track, long tick, int status, int data1, int data2, int payloadOffset, int payloadLength)
        {
            if ((status & 0xf0) == 0x90 && data2 > 0)
            {
                count++;
            }
        }
    }
}
