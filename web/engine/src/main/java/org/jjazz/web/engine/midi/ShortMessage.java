package org.jjazz.web.engine.midi;

public class ShortMessage extends MidiMessage
{
    public static final int NOTE_OFF = 0x80;
    public static final int NOTE_ON = 0x90;
    public static final int POLY_PRESSURE = 0xa0;
    public static final int CONTROL_CHANGE = 0xb0;
    public static final int PROGRAM_CHANGE = 0xc0;
    public static final int CHANNEL_PRESSURE = 0xd0;
    public static final int PITCH_BEND = 0xe0;

    public ShortMessage()
    {
        super(new byte[]{(byte) NOTE_ON, 64, 127});
    }

    protected ShortMessage(byte[] bytes)
    {
        super(bytes);
    }

    public ShortMessage(int status, int data1, int data2) throws InvalidMidiDataException
    {
        this();
        setMessage(status, data1, data2);
    }

    public ShortMessage(int command, int channel, int data1, int data2) throws InvalidMidiDataException
    {
        this();
        setMessage(command, channel, data1, data2);
    }

    public void setMessage(int command, int channel, int data1, int data2) throws InvalidMidiDataException
    {
        if (command < NOTE_OFF || command > PITCH_BEND || (command & 15) != 0 || channel < 0 || channel > 15)
        {
            throw new InvalidMidiDataException("Invalid MIDI channel or command");
        }
        setMessage(command | channel, data1, data2);
    }

    public void setMessage(int status, int data1, int data2) throws InvalidMidiDataException
    {
        int size = getDataLength(status);
        if (size > 0 && (data1 < 0 || data1 > 127) || size > 1 && (data2 < 0 || data2 > 127))
        {
            throw new InvalidMidiDataException("Invalid MIDI data byte");
        }
        data = new byte[size + 1];
        data[0] = (byte) status;
        if (size > 0)
        {
            data[1] = (byte) data1;
        }
        if (size > 1)
        {
            data[2] = (byte) data2;
        }
        length = data.length;
    }

    public void setMessage(int status) throws InvalidMidiDataException
    {
        if (getDataLength(status) != 0)
        {
            throw new InvalidMidiDataException("MIDI status requires data bytes");
        }
        setMessage(status, 0, 0);
    }

    protected final int getDataLength(int status) throws InvalidMidiDataException
    {
        if (status >= 0x80 && status < 0xf0)
        {
            int command = status & 0xf0;
            return command == PROGRAM_CHANGE || command == CHANNEL_PRESSURE ? 1 : 2;
        }
        return switch (status)
        {
            case 0xf1, 0xf3 -> 1;
            case 0xf2 -> 2;
            case 0xf6, 0xf8, 0xfa, 0xfb, 0xfc, 0xfe, 0xff -> 0;
            default -> throw new InvalidMidiDataException("Invalid MIDI status " + status);
        };
    }

    public int getCommand()
    {
        return getStatus() & 0xf0;
    }

    public int getChannel()
    {
        return getStatus() & 15;
    }

    public int getData1()
    {
        return length > 1 ? data[1] & 127 : 0;
    }

    public int getData2()
    {
        return length > 2 ? data[2] & 127 : 0;
    }

    @Override
    public Object clone()
    {
        return new ShortMessage(getMessage());
    }
}
