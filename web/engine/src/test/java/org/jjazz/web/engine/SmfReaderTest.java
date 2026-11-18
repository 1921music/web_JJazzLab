package org.jjazz.web.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.zip.ZipInputStream;
import javax.sound.midi.MetaMessage;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.SysexMessage;
import org.jjazz.yamjjazz.CASMDataReader;
import org.jjazz.yamjjazz.FormatNotSupportedException;
import org.jjazz.yamjjazz.rhythm.api.Style;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class SmfReaderTest
{
    private static final HexFormat HEX = HexFormat.of();

    private record Event(int track, long tick, int status, int data1, int data2, String payload)
    {
    }

    @Test
    void matchesJvmEventsFromUnmodifiedYamahaStyle(@TempDir Path directory) throws Exception
    {
        byte[] style;
        try (var zip = new ZipInputStream(getClass().getResourceAsStream(
                "/org/jjazz/yamjjazz/rhythm/api/resources/YamahaDefaultFiles.zip")))
        {
            while (true)
            {
                var entry = zip.getNextEntry();
                assertNotNull(entry, "Bundled style is missing");
                if (entry.getName().equals("8Beat.T160.STY"))
                {
                    style = zip.readAllBytes();
                    break;
                }
            }
        }

        var sequence = MidiSystem.getSequence(new ByteArrayInputStream(style));
        var expected = new ArrayList<Event>();
        var tracks = sequence.getTracks();
        for (int i = 0; i < tracks.length; i++)
        {
            var track = tracks[i];
            for (int j = 0; j < track.size(); j++)
            {
                var event = track.get(j);
                long tick = event.getTick();
                var message = event.getMessage();
                expected.add(switch (message)
                {
                    case ShortMessage m -> new Event(i, tick, m.getStatus(), m.getData1(), m.getData2(), "");
                    case MetaMessage m -> new Event(i, tick, m.getStatus(), m.getType(), 0, HEX.formatHex(m.getData()));
                    case SysexMessage m -> new Event(i, tick, m.getStatus(), 0, 0, HEX.formatHex(m.getData()));
                    default -> throw new IllegalArgumentException("Unexpected MIDI message: " + message);
                });
            }
        }

        var actual = new ArrayList<Event>();
        var header = SmfReader.read(style, (track, tick, status, data1, data2, offset, length) ->
            actual.add(new Event(track, tick, status, data1, data2, HEX.formatHex(style, offset, offset + length))));
        assertEquals(sequence.getResolution(), header.ticksPerQuarter());
        assertEquals(tracks.length, header.trackCount());
        assertEquals(expected, actual);
        var webSequence = org.jjazz.web.engine.midi.MidiSystem.getSequence(new ByteArrayInputStream(style));
        assertEquals(sequence.getTickLength(), webSequence.getTickLength());
        var output = new ByteArrayOutputStream();
        assertEquals(org.jjazz.web.engine.midi.MidiSystem.write(webSequence, 1, output), output.size());
        byte[] exported = output.toByteArray();
        var reread = new ArrayList<Event>();
        assertEquals(1, SmfReader.read(exported, (track, tick, status, data1, data2, offset, length) ->
            reread.add(new Event(track, tick, status, data1, data2, HEX.formatHex(exported, offset, offset + length))))
                .format());
        assertEquals(expected, reread);
        assertEquals(sequence.getTickLength(), MidiSystem.getSequence(new ByteArrayInputStream(exported)).getTickLength());
        assertEquals("4341534d", HEX.formatHex(style, header.endOffset(), header.endOffset() + 4));
        assertEquals(expected.stream().filter(e -> (e.status & 0xf0) == 0x90 && e.data2 > 0).count(),
                StyleInputProbe.countStyleNotes(style));
        var file = Files.write(directory.resolve("8Beat.T160.STY"), style);
        var desktopStyle = new Style();
        desktopStyle.readNonMusicData(file.toFile());
        assertEquals(desktopStyle.getStylePartTypes().size(), StyleInputProbe.countStyleParts(style));
    }

    @Test
    void rejectsInvalidTrackLengthsAndDeltaTimes()
    {
        var badDelta = HEX.parseHex("4d546864000000060000000101e04d54726b000000058080808000");
        SmfReader.EventSink unexpected = (track, tick, status, data1, data2, offset, length) -> fail("Unexpected event");
        assertThrows(IllegalArgumentException.class, () -> SmfReader.read(badDelta, unexpected));
        var truncated = Arrays.copyOf(badDelta, badDelta.length - 1);
        assertThrows(IllegalArgumentException.class, () -> SmfReader.read(truncated, unexpected));
    }

    @Test
    void rejectsOversizedCasmLength()
    {
        var reader = new CASMDataReader(new Style(), "Oversized CASM");
        byte[] bytes = HEX.parseHex("4341534dffffffff");
        assertThrows(FormatNotSupportedException.class, () -> reader.readCasmChunk(bytes, 0, 480));
    }
}
