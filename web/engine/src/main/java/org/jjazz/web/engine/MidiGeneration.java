package org.jjazz.web.engine;

import java.io.File;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.List;
import javax.sound.midi.MidiSystem;
import org.jjazz.chordleadsheet.spi.item.CLI_Factory;
import org.jjazz.harmony.api.Position;
import org.jjazz.midimix.api.UserRhythmVoice;
import org.jjazz.midimix.MidiMixManagerImpl;
import org.jjazz.jjswing.api.JJSwingRhythm;
import org.jjazz.jjswing.api.RP_BassStyle;
import org.jjazz.jjswing.api.RP_DrumsStyle;
import org.jjazz.rhythm.api.Rhythm;
import org.jjazz.rhythmparametersimpl.api.RP_SYS_Variation;
import org.jjazz.midimix.spi.MidiMixManager;
import org.jjazz.rhythmmusicgeneration.api.SongSequenceBuilder;
import org.jjazz.song.spi.SongContextFactory;
import org.jjazz.song.spi.SongFactory;
import org.jjazz.song.api.Song;
import org.jjazz.songstructure.SongStructureImpl;
import org.jjazz.yamjjazz.rhythm.YamJJazzRhythmImpl;

final class MidiGeneration
{
    record Result(String[] metadata, String[] mix, boolean importedMixApplied) {}

    private MidiGeneration()
    {
    }

    static String[] generate(File styleFile, String[] chords, int tempo, OutputStream output) throws Exception
    {
        WebServices.install();
        return generate(new YamJJazzRhythmImpl(styleFile), chords, tempo, null, null, null, output);
    }

    static String[] generateSwing(String[] chords, int tempo, String bassStyle, String drumsStyle, OutputStream output) throws Exception
    {
        return generateSwing(chords, tempo, "Main A-1", bassStyle, drumsStyle, output);
    }

    static String[] generateSwing(String[] chords, int tempo, String variation, String bassStyle, String drumsStyle, OutputStream output) throws Exception
    {
        WebServices.install();
        var rhythm = WebJJSwing.rhythm();
        if (!RP_SYS_Variation.getVariationRp(rhythm).isValidValue(variation))
        {
            throw new IllegalArgumentException("Unsupported jjSwing variation: " + variation);
        }
        return generate(rhythm, chords, tempo, variation, bassStyle, drumsStyle, output);
    }

    static Result generateSong(File[] styleFiles, int[] partSources, SongInput input, String[] mix, OutputStream output) throws Exception
    {
        WebServices.install();
        var rhythms = new Rhythm[styleFiles.length];
        for (int index = 0; index < styleFiles.length; index++)
        {
            var file = styleFiles[index];
            rhythms[index] = file == null ? WebJJSwing.rhythm() : new YamJJazzRhythmImpl(file);
            rhythms[index].loadResources();
        }
        return render(Arrays.asList(rhythms), input.createSong(rhythms, partSources), mix, output);
    }

    private static String[] generate(Rhythm rhythm, String[] chords, int tempo, String variation, String bassStyle, String drumsStyle, OutputStream output) throws Exception
    {
        if (chords.length == 0)
        {
            throw new IllegalArgumentException("At least one chord is required");
        }
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
        if (variation != null)
        {
            structure.setRhythmParameterValue(part, RP_SYS_Variation.getVariationRp(rhythm), variation);
        }
        if (bassStyle != null)
        {
            structure.setRhythmParameterValue(part, RP_BassStyle.get(rhythm), bassStyle);
            structure.setRhythmParameterValue(part, RP_DrumsStyle.get(rhythm), drumsStyle);
        }
        var song = factory.createSong("Web accompaniment", structure, true);
        song.setTempo(tempo == 0 ? rhythm.getPreferredTempo() : tempo);
        return render(List.of(rhythm), song, null, output).metadata();
    }

    private static Result render(List<Rhythm> rhythms, Song song, String[] mixInput, OutputStream output) throws Exception
    {
        boolean multiple = rhythms.size() > 1;
        // Use the desktop's allocator for a whole arrangement. Keep its song registry local to this render.
        var mix = multiple ? new MidiMixManagerImpl().createMix(song) : MidiMixManager.getDefault().createMix(rhythms.get(0));
        if (!multiple)
        {
            for (var name : song.getUserPhraseNames().stream().sorted().toList())
            {
                mix.addUserChannel(name, song.getUserPhrase(name).isDrums());
            }
        }
        for (var rhythm : rhythms)
        {
            if (rhythm instanceof JJSwingRhythm) WebJJSwing.configureMix(rhythm, mix);
        }
        boolean editableMix = mixInput != null;
        if (editableMix)
        {
            // The Web synthesizer can play each percussion track independently.
            // Desktop GM rerouting would move the notes to a different mix strip.
            for (int channel : mix.getDrumsReroutedChannels())
            {
                mix.setDrumsReroutedChannel(false, channel);
            }
        }
        boolean importedMixApplied = editableMix && mixInput.length > 0 && SongMix.apply(mix, mixInput);
        var builder = new SongSequenceBuilder(SongContextFactory.getDefault().of(song, mix));
        var result = builder.buildAll(true);
        builder.makeSequenceExportable(result, editableMix);
        WebJJSwing.adaptDrumNotes(result);
        MidiSystem.write(result.sequence, 1, output);
        // Track-indexed metadata keeps percussion outside channel 10 identifiable
        // without changing the exported Standard MIDI File.
        var partMetadata = new String[result.sequence.getTracks().length];
        for (var entry : result.mapRvTrackId.entrySet())
        {
            var voice = entry.getKey();
            String kind = voice.isDrums() ? "drums" : "melodic";
            if (editableMix)
            {
                var source = voice instanceof UserRhythmVoice ? "user" : "rhythm";
                String styleId = multiple && !(voice instanceof UserRhythmVoice) ? "\t" + voice.getContainer().getUniqueId() : "";
                partMetadata[entry.getValue()] = source + "-" + kind + "\t" + voice.getName() + styleId;
            } else
            {
                partMetadata[entry.getValue()] = kind + "\t" + voice.getName();
            }
        }
        return new Result(partMetadata, editableMix ? SongMix.snapshot(mix) : new String[0], importedMixApplied);
    }
}
