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
import org.jjazz.yamjjazz.rhythm.api.Style;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class SmfReaderTest
{
    private static final HexFormat HEX = HexFormat.of();
    private static final String STYLE_NAME = "8Beat.T160.STY";

    private record Event(int track, long tick, int status, int data1, int data2, String payload)
    {
    }

    @Test
    void matchesJvmEventsFromUnmodifiedYamahaStyle(@TempDir Path directory) throws Exception
    {
        byte[] style = bundledStyle();
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
        var file = Files.write(directory.resolve(STYLE_NAME), style);
        var desktopStyle = new Style();
        desktopStyle.readNonMusicData(file.toFile());
        assertEquals(desktopStyle.getStylePartTypes().size(), StyleInputProbe.countStyleParts(style));
    }

    @Test
    void exportsPlayableTracksAtRequestedTempo() throws Exception
    {
        var output = WasmMidiEngine.generateMidi(bundledStyle(), STYLE_NAME,
                new String[]{"C", "Am7", "Dm7", "G7"}, 120);
        var sequence = MidiSystem.getSequence(new ByteArrayInputStream(output));
        var tracks = sequence.getTracks();
        assertTrue(tracks.length > 2);
        assertTrue(sequence.getTickLength() >= 4L * 4 * sequence.getResolution() - 1);
        boolean hasTempo = false;
        boolean hasDrum = false;
        boolean hasMelody = false;
        for (var track : tracks)
        {
            for (int i = 0; i < track.size(); i++)
            {
                var message = track.get(i).getMessage();
                if (message instanceof MetaMessage meta && meta.getType() == 0x51)
                {
                    if (Arrays.equals(new byte[]{7, (byte) 0xa1, 0x20}, meta.getData()))
                    {
                        hasTempo = true;
                    }
                } else if (message instanceof ShortMessage note && note.getCommand() == ShortMessage.NOTE_ON
                        && note.getData2() > 0)
                {
                    hasDrum |= note.getChannel() == 9;
                    hasMelody |= note.getChannel() != 9;
                }
            }
        }
        assertTrue(hasTempo, "Expected 120 BPM tempo meta-event");
        assertTrue(hasDrum, "Expected GM channel 10 drum notes");
        assertTrue(hasMelody, "Expected pitched notes");
    }

    private byte[] bundledStyle() throws Exception
    {
        try (var zip = new ZipInputStream(getClass().getResourceAsStream(
                "/org/jjazz/yamjjazz/rhythm/api/resources/YamahaDefaultFiles.zip")))
        {
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry())
            {
                if (entry.getName().equals(STYLE_NAME))
                {
                    return zip.readAllBytes();
                }
            }
        }
        throw new IllegalStateException("Bundled style is missing: " + STYLE_NAME);
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
        String midi = "4d546864000000060000000101e04d54726b0000000400ff2f00";
        byte[] outer = HEX.parseHex(midi + "4341534dffffffff");
        byte[] inner = HEX.parseHex(midi + "4341534d00000010435345470000000853646563ffffffff");
        assertThrows(IllegalArgumentException.class, () -> SmfReader.validateStyleLayout(outer));
        assertThrows(IllegalArgumentException.class, () -> SmfReader.validateStyleLayout(inner));
    }
}
