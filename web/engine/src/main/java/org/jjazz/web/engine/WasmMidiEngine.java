package org.jjazz.web.engine;

import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import org.jjazz.rhythmparametersimpl.api.RP_SYS_Variation;
import org.jjazz.yamjjazz.rhythm.YamJJazzRhythmImpl;
import org.teavm.jso.JSExport;

/** JavaScript entry point for generating a General MIDI accompaniment. */
public final class WasmMidiEngine
{
    private static String[] partMetadata = new String[0];
    private static String[] songMix = new String[0];
    private static boolean importedMixApplied;
    private WasmMidiEngine()
    {
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
        partMetadata = new String[0];
        songMix = new String[0];
        importedMixApplied = false;
        var song = new SongInput(title, tempo, bars, sectionNames, sectionBars, sectionMeters, chords, chordBars, chordBeats,
                partNames, partSections, partParameters, userTrackNames, userPhrases);
        var midi = new ByteArrayOutputStream();
        MidiGeneration.Result result;
        if (styleName.isEmpty())
        {
            result = MidiGeneration.generateSong(null, song, mix, midi);
        } else
        {
            try (var style = new RawStyleFile(styleBytes, styleName))
            {
                result = MidiGeneration.generateSong(style.file(), song, mix, midi);
            }
        }
        partMetadata = result.metadata();
        songMix = result.mix();
        importedMixApplied = result.importedMixApplied();
        return midi.toByteArray();
    }

    @JSExport
    public static String[] getSongMix()
    {
        return songMix.clone();
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
        WebServices.install();
        try (var style = new RawStyleFile(bytes, name))
        {
            var rhythm = new YamJJazzRhythmImpl(style.file());
            var variations = RP_SYS_Variation.getVariationRp(rhythm).getPossibleValues();
            var result = new String[variations.size() + 1];
            result[0] = rhythm.getTimeSignature().name();
            for (int i = 0; i < variations.size(); i++) result[i + 1] = variations.get(i);
            return result;
        }
    }

    /** Track-indexed entries: drums|melodic, a tab, then the rhythm voice name. */
    @JSExport
    public static String[] getPartMetadata()
    {
        return partMetadata.clone();
    }
}
