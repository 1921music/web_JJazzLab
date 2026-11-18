package org.jjazz.web.engine;

import java.io.File;
import java.util.List;
import javax.sound.midi.MidiSystem;
import org.jjazz.midi.api.MidiUtilities;
import org.jjazz.midi.api.synths.GMSynth;
import org.jjazz.midimix.MidiMixManagerImpl;
import org.jjazz.outputsynth.api.OutputSynth;
import org.jjazz.rhythmmusicgeneration.api.SongSequenceBuilder;
import org.jjazz.song.spi.SongContextFactory;
import org.jjazz.song.spi.SongFactory;
import org.jjazz.songstructure.SongStructureImpl;
import org.jjazz.yamjjazz.rhythm.YamJJazzRhythmImpl;

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
        if (args.length != 2)
        {
            throw new IllegalArgumentException("Usage: MidiGenerationProbe <style-file> <output.mid>");
        }
        var rhythm = new YamJJazzRhythmImpl(new File(args[0]));
        rhythm.loadResources();
        var factory = SongFactory.getDefault();
        var leadSheet = factory.createEmptyChordLeadSheet("A", rhythm.getTimeSignature(), 8, "C");
        var structure = new SongStructureImpl(leadSheet);
        var part = structure.createSongPart(rhythm, "A", 0, leadSheet.getSection(0), false);
        // The rhythm is already selected, so this probe does not need a shared rhythm catalog.
        structure.performWriteAPImethodThrowing(structure.addSongPartsOperation(List.of(part)));
        var song = factory.createSong("Wasm probe", structure, true);
        song.setTempo(rhythm.getPreferredTempo());
        var gm = new OutputSynth(GMSynth.getInstance());
        var mix = new MidiMixManagerImpl().createMix(rhythm, gm::findInstrument);
        var builder = new SongSequenceBuilder(SongContextFactory.getDefault().of(song, mix));
        var result = builder.buildAll();
        builder.makeSequenceExportable(result, false, MidiUtilities::getGmModeOnSysExMessage);
        MidiSystem.write(result.sequence, 1, new File(args[1]));
    }
}
