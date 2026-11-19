package org.jjazz.web.engine;

import java.io.ByteArrayOutputStream;
import org.jjazz.rhythmparametersimpl.api.RP_SYS_Variation;
import org.teavm.jso.JSExport;

/** JavaScript entry point for generating a General MIDI accompaniment. */
public final class WasmMidiEngine
{
    private static String[] partMetadata = new String[0];
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
                                          String[] userTrackNames, String[] userPhrases) throws Exception
    {
        partMetadata = new String[0];
        var song = new SongInput(title, meter, tempo, bars, sectionNames, sectionBars, chords, chordBars, chordBeats,
                partNames, partSections, partParameters, userTrackNames, userPhrases);
        var midi = new ByteArrayOutputStream();
        if (styleName.isEmpty())
        {
            partMetadata = MidiGeneration.generateSong(null, song, midi);
        } else
        {
            try (var style = new RawStyleFile(styleBytes, styleName))
            {
                partMetadata = MidiGeneration.generateSong(style.file(), song, midi);
            }
        }
        return midi.toByteArray();
    }

    /** Available values come from the original jjSwing rhythm parameter. */
    @JSExport
    public static String[] getSwingVariations() throws Exception
    {
        WebServices.install();
        return RP_SYS_Variation.getVariationRp(WebJJSwing.rhythm()).getPossibleValues().toArray(new String[0]);
    }

    /** Track-indexed entries: drums|melodic, a tab, then the rhythm voice name. */
    @JSExport
    public static String[] getPartMetadata()
    {
        return partMetadata.clone();
    }
}
