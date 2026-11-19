package org.jjazz.web.engine;

import javax.sound.midi.MetaMessage;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class JJSwingCompatibilityTest
{
    @Test
    void mapsXgArticulationsInsteadOfPlayingMissingOrUnrelatedGsEffects()
    {
        assertEquals(38, WebJJSwing.timGmDrumNote(25));
        assertEquals(40, WebJJSwing.timGmDrumNote(26));
        assertEquals(39, WebJJSwing.timGmDrumNote(27));
        assertEquals(40, WebJJSwing.timGmDrumNote(28));
        assertEquals(38, WebJJSwing.timGmDrumNote(29));
        assertEquals(85, WebJJSwing.timGmDrumNote(30));
        assertEquals(38, WebJJSwing.timGmDrumNote(31));
        assertEquals(31, WebJJSwing.timGmDrumNote(32));
        assertEquals(36, WebJJSwing.timGmDrumNote(33));
        assertEquals(37, WebJJSwing.timGmDrumNote(34));
        for (int pitch = 35; pitch < 128; pitch++) assertEquals(pitch, WebJJSwing.timGmDrumNote(pitch));
    }

    @Test
    void translatesMatchingNoteOnsOffsAndPressureWithoutChangingTimingOrControllers() throws Exception
    {
        var track = new Sequence(Sequence.PPQ, 480).createTrack();
        track.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_ON, 9, 25, 81), 12));
        track.add(new MidiEvent(new ShortMessage(ShortMessage.POLY_PRESSURE, 9, 25, 60), 20));
        track.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_OFF, 9, 25, 0), 120));
        track.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_ON, 9, 26, 0), 121));
        track.add(new MidiEvent(new ShortMessage(ShortMessage.CONTROL_CHANGE, 9, 33, 40), 122));
        track.add(new MidiEvent(new ShortMessage(ShortMessage.PROGRAM_CHANGE, 9, 40, 0), 123));
        var name = new MetaMessage(3, new byte[]{65}, 1);
        track.add(new MidiEvent(name, 124));
        WebJJSwing.adaptDrumTrack(track);
        int[] pitches = {38, 38, 38, 40, 33, 40};
        long[] times = {12, 20, 120, 121, 122, 123};
        int[] velocities = {81, 60, 0, 0, 40, 0};
        for (int i = 0; i < pitches.length; i++)
        {
            var message = (ShortMessage) track.get(i).getMessage();
            assertEquals(pitches[i], message.getData1());
            assertEquals(9, message.getChannel());
            assertEquals(velocities[i], message.getData2());
            assertEquals(times[i], track.get(i).getTick());
        }
        assertSame(name, track.get(6).getMessage());
    }
}
