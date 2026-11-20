package org.jjazz.web.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import javax.sound.midi.InvalidMidiDataException;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import org.jjazz.chordleadsheet.api.item.ExtChordSymbol;
import org.jjazz.chordleadsheet.api.item.CLI_ChordSymbol;
import org.jjazz.chordleadsheet.api.item.CLI_Section;
import org.jjazz.chordleadsheet.api.item.NCExtChordSymbol;
import org.jjazz.harmony.spi.ScaleManager;
import org.jjazz.harmony.api.TimeSignature;
import org.jjazz.harmony.api.Position;
import org.jjazz.humanizer.api.Humanizer;
import org.jjazz.importers.api.TextReader;
import org.jjazz.phrase.api.NoteEvent;
import org.jjazz.phrase.api.Phrase;
import org.jjazz.phrase.api.Phrases;
import org.jjazz.phrasetransform.DrumsAccentsTransform;
import org.jjazz.phrasetransform.api.PhraseTransform;
import org.jjazz.phrasetransform.api.PhraseTransformCategory;
import org.jjazz.phrasetransform.api.PhraseTransformManager;
import org.jjazz.quantizer.api.Quantization;
import org.jjazz.quantizer.api.Quantizer;
import org.jjazz.rhythm.api.Rhythm;
import org.jjazz.rhythmparametersimpl.api.RP_SYS_Variation;
import org.jjazz.utilities.api.FloatRange;
import org.teavm.jso.JSExport;

/** JavaScript entry point for generating a General MIDI accompaniment. */
public final class WasmMidiEngine
{
    private static String[] partMetadata = new String[0];
    private static String[] songMix = new String[0];
    private static Phrase[] rhythmPhrases = new Phrase[16];
    private static boolean importedMixApplied;
    private WasmMidiEngine()
    {
    }

    @JSExport
    public static String[] readTextLeadSheet(String text)
    {
        WebServices.install();
        TextReader.ParsedLeadSheet parsed;
        try
        {
            parsed = new TextReader(text).readLeadSheet();
        } catch (RuntimeException ex)
        {
            return new String[] { ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage() };
        }
        if (parsed == null) return new String[0];
        var sheet = parsed.leadSheet();
        var rows = new ArrayList<String>();
        rows.add(parsed.title());
        rows.add(Integer.toString(parsed.tempo()));
        rows.add(Integer.toString(sheet.getSizeInBars()));
        for (var section : sheet.getItems(CLI_Section.class))
        {
            rows.add("section\t" + section.getPosition().getBar() + "\t" + section.getData().getTimeSignature().name()
                    + "\t" + section.getData().getName());
        }
        for (var chord : sheet.getItems(CLI_ChordSymbol.class))
        {
            rows.add("chord\t" + chord.getPosition().getBar() + "\t" + chord.getPosition().getBeat()
                    + "\t" + chord.getData().getName() + "\t" + chord.getData().getOriginalName());
        }
        return rows.toArray(String[]::new);
    }

    @JSExport
    public static String importMidiPhrase(byte[] bytes, int channel, boolean drums) throws Exception
    {
        var sequence = MidiSystem.getSequence(new ByteArrayInputStream(bytes));
        if (sequence.getDivisionType() != Sequence.PPQ)
        {
            throw new InvalidMidiDataException("The MIDI file does not use PPQ timing");
        }
        var phrases = Phrases.getPhrases(sequence.getResolution(), sequence.getTracks());
        var result = new Phrase(channel, drums);
        if (phrases.size() == 1)
        {
            result.add(phrases.getFirst());
        } else
        {
            phrases.stream().filter(phrase -> phrase.getChannel() == channel).findFirst().ifPresent(result::add);
        }
        return Phrase.saveAsString(result);
    }

    @JSExport
    public static String humanizePhrase(String source, String selection, String meter, float endBeat, int tempo,
            float timing, float bias, float velocity) throws ParseException
    {
        var phrase = Phrase.loadAsString(source);
        if (phrase.isEmpty()) return source;
        float end = Math.max(endBeat, phrase.getNotesBeatRange().to);
        var humanizer = new Humanizer(phrase, TimeSignature.valueOf(meter), new FloatRange(0, end), null, tempo);
        if (selection.isEmpty())
        {
            humanizer.registerNotes(phrase);
        } else
        {
            var selectedCounts = new HashMap<String, Integer>();
            for (var note : Phrase.loadAsString(selection))
            {
                selectedCounts.merge(NoteEvent.saveAsString(note), 1, Integer::sum);
            }
            var selected = phrase.stream().filter(note ->
            {
                String key = NoteEvent.saveAsString(note);
                if (selectedCounts.getOrDefault(key, 0) == 0) return false;
                selectedCounts.computeIfPresent(key, (ignored, count) -> count - 1);
                return true;
            }).toList();
            humanizer.registerNotes(selected);
        }
        humanizer.setConfig(new Humanizer.Config(timing, bias, velocity));
        humanizer.humanize();
        return Phrase.saveAsString(phrase);
    }

    @JSExport
    public static byte[] generateMidi(byte[] styleBytes, String styleName, String[] chords, int tempo) throws Exception
    {
        partMetadata = new String[0];
        try (var style = new RawStyleFile(styleBytes, styleName))
        {
            var midi = new ByteArrayOutputStream();
            partMetadata = MidiGeneration.generate(style.file(), chords, tempo, midi);
            return midi.toByteArray();
        }
    }

    @JSExport
    public static byte[] generateExtendedMidi(byte[] styleBytes, String styleName, byte[] extensionBytes, String extensionName,
                                              String[] chords, int tempo, String variation) throws Exception
    {
        partMetadata = new String[0];
        try (var style = new RawStyleFile(styleBytes, styleName); var extension = RawStyleFile.extension(extensionBytes, extensionName))
        {
            var midi = new ByteArrayOutputStream();
            partMetadata = MidiGeneration.generateExtended(style.file(), extension.file(), chords, tempo, variation, midi);
            return midi.toByteArray();
        }
    }

    /** Generate using jjSwing's dedicated bass and drums generators. */
    @JSExport
    public static byte[] generateSwingMidi(String[] chords, int tempo, String bassStyle, String drumsStyle) throws Exception
    {
        return generateSwingMidiWithVariation(chords, tempo, "Main A-1", bassStyle, drumsStyle);
    }

    /** Generate a selected jjSwing variation; "auto" lets the variation choose each playing style. */
    @JSExport
    public static byte[] generateSwingMidiWithVariation(String[] chords, int tempo, String variation, String bassStyle, String drumsStyle) throws Exception
    {
        partMetadata = new String[0];
        var midi = new ByteArrayOutputStream();
        partMetadata = MidiGeneration.generateSwing(chords, tempo, variation, bassStyle, drumsStyle, midi);
        return midi.toByteArray();
    }

    /** Generate a complete arrangement. Empty styleName selects jjSwing. */
    @JSExport
    public static byte[] generateSongMidi(byte[] styleBytes, String styleName, String title, String meter, int tempo, int bars,
                                          String[] sectionNames, int[] sectionBars, String[] chords, int[] chordBars, float[] chordBeats,
                                          String[] partNames, int[] partSections, String[] partParameters,
                                          String[] userTrackNames, String[] userPhrases, String[] mix) throws Exception
    {
        var meters = new String[sectionNames.length];
        Arrays.fill(meters, meter);
        return generateSongMidiWithMeters(styleBytes, styleName, title, tempo, bars, sectionNames, sectionBars, meters,
                chords, chordBars, chordBeats, partNames, partSections, partParameters, userTrackNames, userPhrases, mix);
    }

    /** Generate a song with an individual meter for each lead-sheet section. */
    @JSExport
    public static byte[] generateSongMidiWithMeters(byte[] styleBytes, String styleName, String title, int tempo, int bars,
                                                    String[] sectionNames, int[] sectionBars, String[] sectionMeters,
                                                    String[] chords, int[] chordBars, float[] chordBeats, String[] partNames,
                                                    int[] partSections, String[] partParameters, String[] userTrackNames,
                                                    String[] userPhrases, String[] mix) throws Exception
    {
        return generateSongMidiWithStyles(styleBytes, new String[]{styleName}, new int[]{styleBytes.length}, new int[partNames.length],
                title, tempo, bars, sectionNames, sectionBars, sectionMeters, chords, chordBars, chordBeats, partNames, partSections,
                partParameters, userTrackNames, userPhrases, mix);
    }

    /** Per-part style indices refer to the supplied style names and contiguous byte ranges. */
    @JSExport
    public static byte[] generateSongMidiWithStyles(byte[] styleBytes, String[] styleNames, int[] styleLengths, int[] partSources,
                                                    String title, int tempo, int bars, String[] sectionNames, int[] sectionBars,
                                                    String[] sectionMeters, String[] chords, int[] chordBars, float[] chordBeats,
                                                    String[] partNames, int[] partSections, String[] partParameters,
                                                    String[] userTrackNames, String[] userPhrases, String[] mix) throws Exception
    {
        return generateSongMidiWithStylePairs(styleBytes, styleNames, styleLengths, new String[styleNames.length], new int[styleNames.length],
                partSources, title, tempo, bars, sectionNames, sectionBars, sectionMeters, chords, chordBars, chordBeats, partNames,
                partSections, partParameters, userTrackNames, userPhrases, mix);
    }

    /** A style's base bytes are followed immediately by its optional extension bytes. */
    @JSExport
    public static byte[] generateSongMidiWithStylePairs(byte[] styleBytes, String[] styleNames, int[] styleLengths,
                                                       String[] extensionNames, int[] extensionLengths, int[] partSources,
                                                       String title, int tempo, int bars, String[] sectionNames, int[] sectionBars,
                                                       String[] sectionMeters, String[] chords, int[] chordBars, float[] chordBeats,
                                                       String[] partNames, int[] partSections, String[] partParameters,
                                                       String[] userTrackNames, String[] userPhrases, String[] mix) throws Exception
    {
        return generateSongMidiWithChordRendering(styleBytes, styleNames, styleLengths, extensionNames, extensionLengths,
                partSources, title, tempo, bars, sectionNames, sectionBars, sectionMeters, chords, chordBars, chordBeats,
                partNames, partSections, partParameters, userTrackNames, userPhrases, mix, new String[0]);
    }

    /** Standard scales compatible with a chord, in desktop serialization order. */
    @JSExport
    public static String[] getChordScales(String name) throws ParseException
    {
        var chord = ExtChordSymbol.get(name);
        if (chord instanceof NCExtChordSymbol) return new String[0];
        var manager = ScaleManager.getDefault();
        var scales = manager.getStandardScales();
        return manager.getMatchingScales(chord).stream()
                .map(scale -> scales.indexOf(scale.getScale()) + "\t" + scale.getStartNote().getPitch() + "\t" + scale.getScale().getName())
                .toArray(String[]::new);
    }

    /** Render the same chord interpretation and scale as the desktop song. */
    @JSExport
    public static byte[] generateSongMidiWithChordRendering(byte[] styleBytes, String[] styleNames, int[] styleLengths,
                                                       String[] extensionNames, int[] extensionLengths, int[] partSources,
                                                       String title, int tempo, int bars, String[] sectionNames, int[] sectionBars,
                                                       String[] sectionMeters, String[] chords, int[] chordBars, float[] chordBeats,
                                                       String[] partNames, int[] partSections, String[] partParameters,
                                                       String[] userTrackNames, String[] userPhrases, String[] mix,
                                                       String[] chordRendering) throws Exception
    {
        partMetadata = new String[0];
        songMix = new String[0];
        importedMixApplied = false;
        if (styleNames.length == 0 || styleNames.length != styleLengths.length
                || styleNames.length != extensionNames.length || styleNames.length != extensionLengths.length)
        {
            throw new IllegalArgumentException("Invalid song style columns");
        }
        var song = new SongInput(title, tempo, bars, sectionNames, sectionBars, sectionMeters, chords, chordBars, chordBeats,
                partNames, partSections, partParameters, userTrackNames, userPhrases, chordRendering);
        var midi = new ByteArrayOutputStream();
        var staged = new RawStyleFile[styleNames.length * 2];
        var files = new File[styleNames.length];
        var extensions = new File[styleNames.length];
        MidiGeneration.Result result;
        int offset = 0;
        try
        {
            for (int index = 0; index < styleNames.length; index++)
            {
                int length = styleLengths[index];
                if (length < 0 || length > styleBytes.length - offset) throw new IllegalArgumentException("Invalid style length");
                if (!styleNames[index].isEmpty())
                {
                    staged[2 * index] = new RawStyleFile(Arrays.copyOfRange(styleBytes, offset, offset + length), styleNames[index]);
                    files[index] = staged[2 * index].file();
                }
                offset += length;
                int extensionLength = extensionLengths[index];
                if (extensionLength < 0 || extensionLength > styleBytes.length - offset) throw new IllegalArgumentException("Invalid extension length");
                if (extensionLength > 0)
                {
                    if (files[index] == null) throw new IllegalArgumentException("Missing Yamaha base style");
                    staged[2 * index + 1] = RawStyleFile.extension(Arrays.copyOfRange(styleBytes, offset, offset + extensionLength), extensionNames[index]);
                    extensions[index] = staged[2 * index + 1].file();
                }
                offset += extensionLength;
            }
            if (offset != styleBytes.length) throw new IllegalArgumentException("Invalid packed song styles");
            result = MidiGeneration.generateSong(files, extensions, partSources, song, mix, midi);
        } finally
        {
            for (var style : staged)
            {
                if (style != null) style.close();
            }
        }
        partMetadata = result.metadata();
        songMix = result.mix();
        rhythmPhrases = result.rhythmPhrases();
        importedMixApplied = result.importedMixApplied();
        return midi.toByteArray();
    }

    @JSExport
    public static String[] getSongMix()
    {
        return songMix.clone();
    }

    @JSExport
    public static String getRhythmTrackPhrase(int channel)
    {
        var phrase = rhythmPhrases[channel];
        return phrase == null ? "" : Phrase.saveAsString(phrase);
    }

    @JSExport
    public static String[] getMixerInstruments()
    {
        return SongMix.instrumentChoices();
    }

    @JSExport
    public static boolean wasImportedMixApplied()
    {
        return importedMixApplied;
    }

    /** Available values come from the original jjSwing rhythm parameter. */
    @JSExport
    public static String[] getSwingVariations() throws Exception
    {
        WebServices.install();
        return RP_SYS_Variation.getVariationRp(WebJJSwing.rhythm()).getPossibleValues().toArray(new String[0]);
    }

    /** Reports the style's meter followed by its available variation names. */
    @JSExport
    public static String[] getYamahaStyleInfo(byte[] bytes, String name) throws Exception
    {
        try (var style = new RawStyleFile(bytes, name))
        {
            return getStyleInfo(style.file(), null);
        }
    }

    @JSExport
    public static String[] getExtendedYamahaStyleInfo(byte[] bytes, String name, byte[] extensionBytes, String extensionName) throws Exception
    {
        try (var style = new RawStyleFile(bytes, name); var extension = RawStyleFile.extension(extensionBytes, extensionName))
        {
            return getStyleInfo(style.file(), extension.file());
        }
    }

    @JSExport
    public static String[] getRhythmVoices(byte[] bytes, String name, byte[] extensionBytes, String extensionName) throws Exception
    {
        return voiceInfo(readRhythm(bytes, name, extensionBytes, extensionName));
    }

    @JSExport
    public static boolean isTernaryRhythm(byte[] bytes, String name, byte[] extensionBytes, String extensionName) throws Exception
    {
        return readRhythm(bytes, name, extensionBytes, extensionName).getFeatures().division().isTernary();
    }

    @JSExport
    public static float[] quantizeChordDrop(String quantization, String meter, int bar, float beat, int lastBar)
    {
        var timeSignature = TimeSignature.valueOf(meter);
        var position = new Position(bar, Math.clamp(beat, 0, Math.nextDown(timeSignature.getNbNaturalBeats())));
        var result = Quantizer.getQuantized(Quantization.valueOf(quantization), position, timeSignature, 1f, lastBar);
        return new float[] { result.getBar(), result.getBeat() };
    }

    private static Rhythm readRhythm(byte[] bytes, String name, byte[] extensionBytes, String extensionName) throws Exception
    {
        WebServices.install();
        if (name.isEmpty())
        {
            return WebJJSwing.rhythm();
        }
        try (var style = new RawStyleFile(bytes, name))
        {
            if (extensionName.isEmpty())
            {
                return MidiGeneration.createYamahaRhythm(style.file(), null);
            }
            try (var extension = RawStyleFile.extension(extensionBytes, extensionName))
            {
                return MidiGeneration.createYamahaRhythm(style.file(), extension.file());
            }
        }
    }

    @JSExport
    public static String[] getDrumTransforms()
    {
        WebServices.install();
        return PhraseTransformManager.getDefault().getPhraseTransforms(PhraseTransformCategory.DRUMS).stream()
                .filter(transform -> !transform.getInfo().getUniqueId().contains(PhraseTransform.HIDDEN_ID_TOKEN))
                .map(transform -> transform.getInfo().getUniqueId() + "\t" + transform.getInfo().getName() + "\t"
                    + transform.getProperties().getProperty(DrumsAccentsTransform.PROP_VELOCITY_OFFSET, ""))
                .toArray(String[]::new);
    }

    private static String[] voiceInfo(Rhythm rhythm)
    {
        return rhythm.getRhythmVoices().stream().map(voice -> voice.getName() + "\t" + voice.getType().name()).toArray(String[]::new);
    }

    private static String[] getStyleInfo(File style, File extension) throws Exception
    {
        WebServices.install();
        var rhythm = MidiGeneration.createYamahaRhythm(style, extension);
        var variations = RP_SYS_Variation.getVariationRp(rhythm).getPossibleValues();
        var result = new String[variations.size() + 1];
        result[0] = rhythm.getTimeSignature().name();
        for (int i = 0; i < variations.size(); i++) result[i + 1] = variations.get(i);
        return result;
    }

    /** Track-indexed entries: drums|melodic, a tab, then the rhythm voice name. */
    @JSExport
    public static String[] getPartMetadata()
    {
        return partMetadata.clone();
    }
}
