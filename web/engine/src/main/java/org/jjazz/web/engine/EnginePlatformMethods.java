package org.jjazz.web.engine;

import java.io.File;
import java.io.IOException;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import org.jjazz.midimix.api.MidiMix;

public final class EnginePlatformMethods
{
    private EnginePlatformMethods()
    {
    }

    public static boolean checkMidiFileTypeSupport(Sequence sequence, int type, boolean notify)
    {
        for (int supported : MidiSystem.getMidiFileTypes(sequence))
        {
            if (supported == type)
            {
                return true;
            }
        }
        return false;
    }

    public static MidiMix loadFromFile(File file) throws IOException
    {
        throw new IOException("Desktop MIDI mix files are unavailable in the Web engine");
    }

    public static void showProgressDialogAndRun(Runnable work, String caption)
    {
        work.run();
    }
}
