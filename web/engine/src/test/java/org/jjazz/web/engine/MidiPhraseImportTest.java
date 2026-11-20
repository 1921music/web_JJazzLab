package org.jjazz.web.engine;

import java.io.ByteArrayOutputStream;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;
import org.jjazz.phrase.api.Phrase;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MidiPhraseImportTest
{
    @Test
    void remapsSingleChannelAndKeepsMusicalTiming() throws Exception
    {
        var sequence = new Sequence(Sequence.PPQ, 96);
        addNote(sequence.createTrack(), 3, 54);
        var result = Phrase.loadAsString(WasmMidiEngine.importMidiPhrase(write(sequence), 9, true));
        var note = result.getNotes().getFirst();
        assertEquals(9, result.getChannel());
        assertTrue(result.isDrums());
        assertEquals(54, note.getPitch());
        assertEquals(87, note.getVelocity());
        assertEquals(0.25f, note.getPositionInBeats());
        assertEquals(0.5f, note.getDurationInBeats());
    }

    @Test
    void importsOnlyMatchingNotesIfSeveralChannelsArePresent() throws Exception
    {
        var sequence = new Sequence(Sequence.PPQ, 96);
        addNote(sequence.createTrack(), 3, 60);
        addNote(sequence.createTrack(), 4, 72);
        var bytes = write(sequence);
        var result = Phrase.loadAsString(WasmMidiEngine.importMidiPhrase(bytes, 4, false));
        assertEquals(1, result.size());
        assertEquals(72, result.getNotes().getFirst().getPitch());
        assertTrue(Phrase.loadAsString(WasmMidiEngine.importMidiPhrase(bytes, 5, false)).isEmpty());
    }

    private static void addNote(Track track, int channel, int pitch) throws Exception
    {
        track.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_ON, channel, pitch, 87), 24));
        track.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_OFF, channel, pitch, 0), 72));
    }

    private static byte[] write(Sequence sequence) throws Exception
    {
        var output = new ByteArrayOutputStream();
        MidiSystem.write(sequence, 1, output);
        return output.toByteArray();
    }
}
