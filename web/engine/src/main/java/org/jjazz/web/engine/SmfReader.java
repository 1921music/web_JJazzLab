package org.jjazz.web.engine;

/**
 * Reads the PPQ MIDI portion of standard MIDI files and Yamaha style files.
 * Stops after the declared tracks so the caller can read trailing style chunks.
 */
final class SmfReader
{
    private static final int HEADER = 0x4d546864;
    private static final int TRACK = 0x4d54726b;

    record Header(int format, int trackCount, int ticksPerQuarter, int endOffset)
    {
    }

    @FunctionalInterface
    interface EventSink
    {
        /**
         * For a channel event, data1 and data2 are the MIDI data bytes.
         * For a meta event, data1 is the meta type. Meta and SysEx payload
         * ranges refer to the original input bytes.
         */
        void event(int track, long tick, int status, int data1, int data2, int payloadOffset, int payloadLength);
    }

    private SmfReader()
    {
    }

    static Header read(byte[] input, EventSink sink)
    {
        var file = new Cursor(input, 0, input.length);
        if (file.readInt() != HEADER)
        {
            throw new IllegalArgumentException("Missing MThd chunk");
        }
        var header = file.readChunk();
        int format = header.readU16();
        int tracks = header.readU16();
        int division = header.readU16();
        if (format > 1 || tracks == 0 || (format == 0 && tracks != 1))
        {
            throw new IllegalArgumentException("Expected a MIDI type 0 or type 1 file");
        }
        if (division == 0 || (division & 0x8000) != 0)
        {
            throw new IllegalArgumentException("Expected positive ticks per quarter note");
        }
        for (int i = 0; i < tracks;)
        {
            int id = file.readInt();
            var chunk = file.readChunk();
            if (id == TRACK)
            {
                readTrack(chunk, i, sink);
                i++;
            }
        }
        return new Header(format, tracks, division, file.position);
    }

    private static void readTrack(Cursor track, int trackNumber, EventSink sink)
    {
        long tick = 0;
        int runningStatus = 0;
        while (track.position < track.end)
        {
            tick += track.readVariableLength();
            int status = track.readU8();
            if (status < 0x80)
            {
                if (runningStatus == 0)
                {
                    throw new IllegalArgumentException("MIDI data byte without running status");
                }
                track.position--;
                status = runningStatus;
            }

            if (status < 0xf0)
            {
                runningStatus = status;
                int command = status & 0xf0;
                int data1 = track.readDataByte();
                int data2 = command == 0xc0 || command == 0xd0 ? 0 : track.readDataByte();
                sink.event(trackNumber, tick, status, data1, data2, 0, 0);
            } else if (status == 0xff || status == 0xf0 || status == 0xf7)
            {
                runningStatus = 0;
                int type = status == 0xff ? track.readDataByte() : 0;
                int length = track.readVariableLength();
                int start = track.position;
                track.skip(length);
                sink.event(trackNumber, tick, status, type, 0, start, length);
                if (status == 0xff && type == 0x2f)
                {
                    return;
                }
            } else
            {
                throw new IllegalArgumentException("Unsupported MIDI status byte: " + status);
            }
        }
    }

    private static final class Cursor
    {
        private final byte[] input;
        private final int end;
        private int position;

        Cursor(byte[] input, int start, int end)
        {
            this.input = input;
            this.position = start;
            this.end = end;
        }

        int readU8()
        {
            int start = position;
            skip(1);
            return input[start] & 0xff;
        }

        int readU16()
        {
            return (readU8() << 8) | readU8();
        }

        int readInt()
        {
            return (readU16() << 16) | readU16();
        }

        int readDataByte()
        {
            int value = readU8();
            if (value >= 0x80)
            {
                throw new IllegalArgumentException("Expected a MIDI data byte");
            }
            return value;
        }

        int readVariableLength()
        {
            int value = 0;
            for (int i = 0; i < 4; i++)
            {
                int next = readU8();
                value = (value << 7) | (next & 0x7f);
                if (next < 0x80)
                {
                    return value;
                }
            }
            throw new IllegalArgumentException("MIDI variable-length value exceeds four bytes");
        }

        Cursor readChunk()
        {
            int size = readInt();
            int start = position;
            skip(size);
            return new Cursor(input, start, position);
        }

        void skip(int size)
        {
            if (size < 0 || size > end - position)
            {
                throw new IllegalArgumentException("Truncated or oversized MIDI chunk or event");
            }
            position += size;
        }
    }
}
