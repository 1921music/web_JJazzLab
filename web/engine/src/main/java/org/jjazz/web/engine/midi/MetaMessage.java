package org.jjazz.web.engine.midi;

import java.util.Arrays;

public class MetaMessage extends MidiMessage
{
    private int payloadOffset;

    public MetaMessage()
    {
        this(new byte[]{(byte) 0xff, 0});
    }

    protected MetaMessage(byte[] bytes)
    {
        super(bytes);
        findPayloadOffset();
    }

    @Override
    protected void setMessage(byte[] bytes, int size) throws InvalidMidiDataException
    {
        super.setMessage(bytes, size);
        findPayloadOffset();
    }

    private void findPayloadOffset()
    {
        payloadOffset = Math.min(2, length);
        while (payloadOffset < length && (data[payloadOffset++] & 0x80) != 0)
        {
            // Skip the variable-length encoding.
        }
    }

    public MetaMessage(int type, byte[] bytes, int size) throws InvalidMidiDataException
    {
        this();
        setMessage(type, bytes, size);
    }

    public void setMessage(int type, byte[] bytes, int size) throws InvalidMidiDataException
    {
        if (type < 0 || type > 127 || size < 0 || size > 0x0fff_ffff || (size > 0 && (bytes == null || size > bytes.length)))
        {
            throw new InvalidMidiDataException("Invalid MIDI meta event");
        }
        int count = 1;
        for (int remaining = size >>> 7; remaining != 0; remaining >>>= 7)
        {
            count++;
        }
        payloadOffset = 2 + count;
        data = new byte[payloadOffset + size];
        data[0] = (byte) 0xff;
        data[1] = (byte) type;
        int value = size;
        for (int i = payloadOffset - 1; i >= 2; i--)
        {
            data[i] = (byte) ((value & 127) | (i == payloadOffset - 1 ? 0 : 128));
            value >>>= 7;
        }
        if (size != 0)
        {
            System.arraycopy(bytes, 0, data, payloadOffset, size);
        }
        length = data.length;
    }

    public int getType()
    {
        return length < 2 ? 0 : data[1] & 127;
    }

    public byte[] getData()
    {
        return Arrays.copyOfRange(data, payloadOffset, length);
    }

    @Override
    public Object clone()
    {
        return new MetaMessage(getMessage());
    }
}
