package org.jjazz.web.engine.midi;

public class InvalidMidiDataException extends Exception
{
    public InvalidMidiDataException()
    {
    }

    public InvalidMidiDataException(String message)
    {
        super(message);
    }
}
