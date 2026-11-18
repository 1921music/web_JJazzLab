package org.jjazz.web.engine;

import java.io.File;
import java.io.OutputStream;
import java.util.List;
import javax.sound.midi.MidiSystem;
import org.jjazz.chordleadsheet.spi.item.CLI_Factory;
import org.jjazz.harmony.api.Position;
import org.jjazz.midimix.spi.MidiMixManager;
import org.jjazz.rhythmmusicgeneration.api.SongSequenceBuilder;
import org.jjazz.song.spi.SongContextFactory;
import org.jjazz.song.spi.SongFactory;
import org.jjazz.songstructure.SongStructureImpl;
import org.jjazz.yamjjazz.rhythm.YamJJazzRhythmImpl;

final class MidiGeneration
{
    private MidiGeneration()
    {
    }

    static void generate(File styleFile, String[] chords, int tempo, OutputStream output) throws Exception
    {
        if (chords.length == 0)
        {
            throw new IllegalArgumentException("At least one chord is required");
        }
        WebServices.install();
        var rhythm = new YamJJazzRhythmImpl(styleFile);
        rhythm.loadResources();
        var factory = SongFactory.getDefault();
        var leadSheet = factory.createEmptyChordLeadSheet("A", rhythm.getTimeSignature(), chords.length, null);
        var chordFactory = CLI_Factory.getDefault();
        for (int bar = 0; bar < chords.length; bar++)
        {
            leadSheet.addItem(chordFactory.createChordSymbol(chords[bar], new Position(bar)));
        }
        var structure = new SongStructureImpl(leadSheet);
        var part = structure.createSongPart(rhythm, "A", 0, leadSheet.getSection(0), false);
        // The rhythm is already selected, so generation does not need a shared rhythm catalog.
        structure.performWriteAPImethodThrowing(structure.addSongPartsOperation(List.of(part)));
        var song = factory.createSong("Web accompaniment", structure, true);
        song.setTempo(tempo == 0 ? rhythm.getPreferredTempo() : tempo);
        var mix = MidiMixManager.getDefault().createMix(rhythm);
        var builder = new SongSequenceBuilder(SongContextFactory.getDefault().of(song, mix));
        var result = builder.buildAll(true);
        builder.makeSequenceExportable(result, false);
        MidiSystem.write(result.sequence, 1, output);
    }
}
