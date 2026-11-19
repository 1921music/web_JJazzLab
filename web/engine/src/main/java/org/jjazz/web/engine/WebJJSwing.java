package org.jjazz.web.engine;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import javax.sound.midi.InvalidMidiDataException;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;
import org.jjazz.jjswing.api.JJSwingRhythm;
import org.jjazz.midi.api.DrumKit;
import org.jjazz.midi.api.Instrument;
import org.jjazz.midi.api.MidiAddress;
import org.jjazz.midi.api.keymap.KeyMapXG;
import org.jjazz.midi.api.synths.GMSynth;
import org.jjazz.midimix.api.MidiMix;
import org.jjazz.rhythm.api.Rhythm;
import org.jjazz.rhythmmusicgeneration.api.SongSequenceBuilder.SongSequence;
import org.jjazz.yamjjazz.rhythm.YamJJazzRhythmImpl;

/** Browser lifecycle and TimGM6mb instrument configuration for the original jjSwing generator. */
final class WebJJSwing
{
    private static JJSwingRhythm rhythm;

    static JJSwingRhythm rhythm() throws Exception
    {
        if (rhythm == null)
        {
            var directory = File.createTempFile("jjazz-swing-", ".resources");
            if (!directory.delete() || !directory.mkdir()) throw new IOException("Cannot stage jjSwing resources");
            var style = copyResource(directory, "psBase.sst");
            var extension = copyResource(directory, "psBase.yjz");
            try
            {
                var candidate = JJSwingRhythm.fromBaseRhythm(new YamJJazzRhythmImpl(style, extension));
                candidate.loadResources();
                rhythm = candidate;
            } finally
            {
                style.delete(); extension.delete(); directory.delete();
            }
        }
        return rhythm;
    }

    private static File copyResource(File directory, String name) throws IOException
    {
        var file = new File(directory, name);
        try (var input = JJSwingRhythm.class.getResourceAsStream(name); var output = new FileOutputStream(file))
        {
            if (input == null) throw new IOException("Missing jjSwing resource: " + name);
            input.transferTo(output);
        }
        return file;
    }

    static void configureMix(Rhythm rhythm, MidiMix mix)
    {
        var gm = GMSynth.getInstance().getGM1Bank();
        for (var voice : rhythm.getRhythmVoices())
        {
            var instrumentMix = mix.getInstrumentMix(voice);
            var settings = instrumentMix.getSettings();
            if (voice.isDrums())
            {
                // TimGM6mb bank 128/program 40 is Brush. PC_ONLY leaves MIDI
                // drum-channel selection to the browser adapter / GM receiver.
                instrumentMix.setInstrument(new Instrument("TimGM6mb Brush", null,
                        new MidiAddress(40, 0, 0, MidiAddress.BankSelectMethod.PC_ONLY),
                        new DrumKit(DrumKit.Type.BRUSH, KeyMapXG.getInstance()), null));
                settings.setVolume(90); settings.setPanoramic(64);
            } else
            {
                int program = switch (voice.getType())
                {
                    case BASS -> 32;
                    case CHORD1 -> 0;
                    case CHORD2 -> 26;
                    case PHRASE1 -> 73;
                    default -> 0;
                };
                instrumentMix.setInstrument(gm.getInstrument(program));
                settings.setVolume(switch (voice.getType()) { case BASS -> 73; case CHORD1 -> 54; case CHORD2 -> 38; default -> 94; });
                settings.setPanoramic(switch (voice.getType()) { case CHORD1 -> 91; case CHORD2 -> 30; case PHRASE1 -> 75; default -> 64; });
            }
            instrumentMix.setInstrumentEnabled(true);
        }
    }

    static void adaptDrumNotes(SongSequence sequence) throws InvalidMidiDataException
    {
        for (var entry : sequence.mapRvTrackId.entrySet())
        {
            if (entry.getKey().isDrums()) adaptDrumTrack(sequence.sequence.getTracks()[entry.getValue()]);
        }
    }

    static void adaptDrumTrack(Track track) throws InvalidMidiDataException
    {
        for (int i = 0; i < track.size(); i++)
        {
            if (track.get(i).getMessage() instanceof ShortMessage message)
            {
                int command = message.getCommand();
                if (command == ShortMessage.NOTE_ON || command == ShortMessage.NOTE_OFF || command == ShortMessage.POLY_PRESSURE)
                {
                    message.setMessage(command, message.getChannel(), timGmDrumNote(message.getData1()), message.getData2());
                }
            }
        }
    }

    // jjSwing's source phrases use JJazzLab SoundFont's XG layout. TimGM6mb
    // uses a GS-like layout: 25/26 are missing and 27..34 are effects, not the
    // XG brush/soft-snare/kick articulations. These are intentional approximations.
    static int timGmDrumNote(int pitch)
    {
        return switch (pitch)
        {
            case 25 -> 38;       // Brush Tap -> Brush Snare
            case 26, 28 -> 40;   // Brush Swirl / Tap Swirl -> brush sweep noise
            case 27 -> 39;       // Brush Slap -> Brush Snare variation
            case 29, 31 -> 38;   // Snare Roll / Soft -> Brush Snare (no roll sample)
            case 30 -> 85;       // XG Castanets -> GS Castanets
            case 32 -> 31;       // XG Stick -> GS Stick
            case 33 -> 36;       // Soft Kick -> Bass Drum
            case 34 -> 37;       // Open Rim -> Rim Shot
            default -> pitch;
        };
    }
}
