package org.jjazz.web.engine;

import java.io.File;
import javax.sound.midi.MidiSystem;
import org.jjazz.midimix.spi.MidiMixManager;
import org.jjazz.rhythmmusicgeneration.api.SongSequenceBuilder;
import org.jjazz.song.spi.SongContextFactory;
import org.jjazz.song.spi.SongFactory;
import org.jjazz.yamjjazz.rhythm.YamJJazzRhythmImpl;

/**
 * Exercises the existing desktop path so TeaVM can report its missing dependencies.
 */
public final class MidiGenerationProbe
{
    private MidiGenerationProbe()
    {
    }

    public static void main(String[] args) throws Exception
    {
        if (args.length != 2)
        {
            throw new IllegalArgumentException("Usage: MidiGenerationProbe <style-file> <output.mid>");
        }
        var rhythm = new YamJJazzRhythmImpl(new File(args[0]));
        rhythm.loadResources();
        var song = SongFactory.getDefault().createEmptySong("Wasm probe", 8, "A", rhythm.getTimeSignature(), "C");
        var structure = song.getSongStructure();
        structure.setSongPartsRhythm(structure.getSongParts(), rhythm, null);
        var mix = MidiMixManager.getDefault().findMix(song);
        var builder = new SongSequenceBuilder(SongContextFactory.getDefault().of(song, mix));
        var result = builder.buildAll(true);
        builder.makeSequenceExportable(result, false);
        MidiSystem.write(result.sequence, 1, new File(args[1]));
    }
}
