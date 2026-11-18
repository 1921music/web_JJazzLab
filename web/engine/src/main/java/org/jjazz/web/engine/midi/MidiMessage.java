package org.jjazz.web.engine.midi;

import java.util.Arrays;

public abstract class MidiMessage implements Cloneable
{
    protected byte[] data;
    protected int length;

    protected MidiMessage(byte[] data)
    {
        this.data = data;
        length = data == null ? 0 : data.length;
    }

    protected void setMessage(byte[] bytes, int size) throws InvalidMidiDataException
    {
        if (size < 0 || size > bytes.length)
        {
            throw new InvalidMidiDataException("Invalid message length");
        }
        data = Arrays.copyOf(bytes, size);
        length = size;
    }

    public byte[] getMessage()
    {
        return Arrays.copyOf(data, length);
    }

    public int getStatus()
    {
        return length == 0 ? 0 : data[0] & 0xff;
    }

    public int getLength()
    {
        return length;
    }

    @Override
    public abstract Object clone();
}
