package org.jjazz.web.engine;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Arrays;

/**
 * Exercises the MIDI generation path so TeaVM can report its missing dependencies.
 */
public final class MidiGenerationProbe
{
    private MidiGenerationProbe()
    {
    }

    public static void main(String[] args) throws Exception
    {
        if (args.length < 2)
        {
            throw new IllegalArgumentException("Usage: MidiGenerationProbe <style-file> <output.mid> [chords...]");
        }
        var chords = Arrays.copyOfRange(args, 2, args.length);
        if (chords.length == 0)
        {
            chords = new String[8];
            Arrays.fill(chords, "C");
        }
        try (var output = new FileOutputStream(args[1]))
        {
            MidiGeneration.generate(new File(args[0]), chords, 0, output);
        }
    }
}
