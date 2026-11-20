package org.jjazz.web.engine;

import org.jjazz.chordleadsheet.api.item.ChordRenderingInfo.Feature;
import org.jjazz.chordleadsheet.api.item.VoidAltExtChordSymbol;
import org.jjazz.harmony.spi.ScaleManager;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SongInputTest
{
    @Test
    void createsNativeChordInterpretationScaleAndMarkerAlternative() throws Exception
    {
        var chord = SongInput.parseChord("Cmaj7", "ACCENT_STRONGER,SHOT\t0\t60\nG7\nPEDAL_BASS\t\t\n\nsolo\nsolo2");
        var rendering = chord.getRenderingInfo();
        assertTrue(rendering.hasAllFeatures(Feature.ACCENT_STRONGER, Feature.SHOT));
        assertEquals(ScaleManager.getDefault().getStandardScales().get(0), rendering.getScaleInstance().getScale());
        assertEquals(60, rendering.getScaleInstance().getStartNote().getPitch());
        assertTrue(chord.getAlternateFilter().accept("solo2"));
        assertFalse(chord.getAlternateFilter().accept("theme"));
        assertTrue(chord.getAlternateChordSymbol().getRenderingInfo().hasAllFeatures(Feature.PEDAL_BASS));
    }

    @Test
    void keepsAnExplicitSilentAlternative()
    {
        var chord = assertDoesNotThrow(() -> SongInput.parseChord("C", "\t\t\nNC\n\t\t\nRANDOM_OFTEN"));
        assertSame(VoidAltExtChordSymbol.getInstance(), chord.getAlternateChordSymbol());
        assertTrue(chord.getAlternateFilter().isRandom());
    }
}
