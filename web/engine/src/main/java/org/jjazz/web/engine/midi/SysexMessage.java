package org.jjazz.web.engine.midi;

import java.util.Arrays;

public class SysexMessage extends MidiMessage
{
    public static final int SYSTEM_EXCLUSIVE = 0xf0;
    public static final int SPECIAL_SYSTEM_EXCLUSIVE = 0xf7;

    public SysexMessage()
    {
        super(new byte[]{(byte) 0xf0, (byte) 0xf7});
    }

    protected SysexMessage(byte[] bytes)
    {
        super(bytes);
    }

    public SysexMessage(int status, byte[] bytes, int size) throws InvalidMidiDataException
    {
        this();
        setMessage(status, bytes, size);
    }

    @Override
    public void setMessage(byte[] bytes, int size) throws InvalidMidiDataException
    {
        if (size < 1 || size > bytes.length)
        {
            throw new InvalidMidiDataException("Invalid MIDI SysEx length");
        }
        checkStatus(bytes[0] & 255);
        super.setMessage(bytes, size);
    }

    public void setMessage(int status, byte[] bytes, int size) throws InvalidMidiDataException
    {
        checkStatus(status);
        if (size < 0 || size > bytes.length)
        {
            throw new InvalidMidiDataException("Invalid MIDI SysEx length");
        }
        data = new byte[size + 1];
        data[0] = (byte) status;
        System.arraycopy(bytes, 0, data, 1, size);
        length = data.length;
    }

    private static void checkStatus(int status) throws InvalidMidiDataException
    {
        if (status != SYSTEM_EXCLUSIVE && status != SPECIAL_SYSTEM_EXCLUSIVE)
        {
            throw new InvalidMidiDataException("Invalid MIDI SysEx status");
        }
    }

    public byte[] getData()
    {
        return Arrays.copyOfRange(data, 1, length);
    }

    @Override
    public Object clone()
    {
        return new SysexMessage(getMessage());
    }
}
