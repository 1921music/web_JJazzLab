package org.jjazz.web.engine.midi;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import org.jjazz.web.engine.SmfReader;

/** File operations used by the engine's in-memory MIDI model. */
public final class MidiSystem
{
    private MidiSystem()
    {
    }

    public static Sequence getSequence(InputStream input) throws IOException, InvalidMidiDataException
    {
        byte[] bytes = input.readAllBytes();
        try
        {
            var reader = new SequenceReader(bytes);
            SmfReader.read(bytes, reader);
            return reader.sequence;
        } catch (IllegalArgumentException e)
        {
            var invalid = new InvalidMidiDataException(e.getMessage());
            invalid.initCause(e);
            throw invalid;
        }
    }

    public static int[] getMidiFileTypes(Sequence sequence)
    {
        int tracks = sequence.getTracks().length;
        return switch (tracks)
        {
            case 0 -> new int[0];
            case 1 -> new int[]{0, 1};
            default -> new int[]{1};
        };
    }

    public static int write(Sequence sequence, int type, File file) throws IOException
    {
        try (var out = new FileOutputStream(file))
        {
            return write(sequence, type, out);
        }
    }

    public static int write(Sequence sequence, int type, OutputStream output) throws IOException
    {
        var tracks = sequence.getTracks();
        if ((type != 0 && type != 1) || tracks.length == 0 || tracks.length > 0xffff || (type == 0 && tracks.length != 1))
        {
            throw new IllegalArgumentException("Unsupported MIDI file type or track count");
        }
        var out = new DataOutputStream(output);
        out.writeInt(0x4d546864); // MThd
        out.writeInt(6);
        out.writeShort(type);
        out.writeShort(tracks.length);
        out.writeShort(sequence.getResolution());
        for (Track track : tracks)
        {
            var buffer = new ByteArrayOutputStream();
            long previousTick = 0;
            for (int i = 0; i < track.size(); i++)
            {
                var event = track.get(i);
                writeVariableLength(buffer, event.getTick() - previousTick);
                previousTick = event.getTick();
                var message = event.getMessage();
                byte[] data = message.getMessage();
                if (message instanceof SysexMessage)
                {
                    buffer.write(data[0]);
                    writeVariableLength(buffer, data.length - 1);
                    buffer.write(data, 1, data.length - 1);
                } else if (message instanceof MetaMessage || (message instanceof ShortMessage && message.getStatus() < 0xf0))
                {
                    buffer.write(data);
                } else
                {
                    throw new IllegalArgumentException("MIDI message cannot be stored in an SMF track");
                }
            }
            out.writeInt(0x4d54726b); // MTrk
            out.writeInt(buffer.size());
            buffer.writeTo(out);
        }
        return out.size();
    }

    private static void writeVariableLength(OutputStream out, long value) throws IOException
    {
        if (value < 0 || value > 0x0fff_ffff)
        {
            throw new IllegalArgumentException("MIDI delta or length is out of range: " + value);
        }
        int shift = 21;
        while (shift > 0 && (value >>> shift) == 0)
        {
            shift -= 7;
        }
        while (shift > 0)
        {
            out.write((int) ((value >>> shift) & 127) | 128);
            shift -= 7;
        }
        out.write((int) value & 127);
    }

    private static final class SequenceReader implements SmfReader.EventSink
    {
        private final byte[] bytes;
        private Sequence sequence;
        private Track[] tracks;

        SequenceReader(byte[] bytes)
        {
            this.bytes = bytes;
        }

        @Override
        public void header(int format, int trackCount, int ticksPerQuarter)
        {
            try
            {
                sequence = new Sequence(Sequence.PPQ, ticksPerQuarter);
            } catch (InvalidMidiDataException e)
            {
                throw new IllegalArgumentException(e.getMessage(), e);
            }
            tracks = new Track[trackCount];
            for (int i = 0; i < trackCount; i++)
            {
                tracks[i] = sequence.createTrack();
            }
        }

        @Override
        public void event(int track, long tick, int status, int data1, int data2, int offset, int size)
        {
            try
            {
                MidiMessage message = switch (status)
                {
                    case 0xff -> new MetaMessage(data1, Arrays.copyOfRange(bytes, offset, offset + size), size);
                    case 0xf0, 0xf7 -> new SysexMessage(status, Arrays.copyOfRange(bytes, offset, offset + size), size);
                    default -> new ShortMessage(status, data1, data2);
                };
                tracks[track].add(new MidiEvent(message, tick));
            } catch (InvalidMidiDataException e)
            {
                throw new IllegalArgumentException(e.getMessage(), e);
            }
        }
    }
}
