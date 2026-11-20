package org.jjazz.web.engine;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.HashSet;
import java.util.stream.Stream;
import org.jjazz.midi.api.DrumKit;
import org.jjazz.midi.api.Instrument;
import org.jjazz.midi.api.MidiAddress;
import org.jjazz.midi.api.keymap.KeyMapGM;
import org.jjazz.midi.api.synths.GMSynth;
import org.jjazz.midi.api.synths.GM2Synth;
import org.jjazz.midimix.api.MidiMix;
import org.jjazz.midimix.api.UserRhythmVoice;

/** Browser mix adapter. Channel assignments come from the song, while settings follow the voice. */
final class SongMix
{
    private SongMix()
    {
    }

    static String[] instrumentChoices()
    {
        var gm = GMSynth.getInstance().getGM1Bank().getInstruments();
        var drums = GM2Synth.getInstance().getGM2Bank().getInstruments().stream().filter(instrument ->
        {
            int program = instrument.getMidiAddress().getProgramChange();
            return instrument.isDrumKit() && (program == 0 || program == 32 || program == 40);
        });
        return Stream.concat(gm.stream(), drums).map(instrument ->
                instrument.getMidiAddress().getProgramChange() + "\t" + instrument.isDrumKit() + "\t"
                        + instrument.getPatchName() + "\t" + instrument.saveAsString()).toArray(String[]::new);
    }

    static String key(MidiMix mix, int channel)
    {
        var voice = mix.getRhythmVoice(channel);
        var rhythmId = voice instanceof UserRhythmVoice
                ? (voice.isDrums() ? "SpDrumsUserChannelRhythmID" : "SpUserChannelRhythmID")
                : voice.getContainer().getUniqueId();
        return rhythmId + '\t' + voice.getName();
    }

    static boolean apply(MidiMix mix, String[] settings)
    {
        Map<String, String[]> imported = new HashMap<>();
        for (String row : settings)
        {
            var fields = row.split("\t", -1);
            if (fields.length != 15 || imported.put(fields[0] + '\t' + fields[1], fields) != null)
            {
                throw new IllegalArgumentException("Invalid or duplicated mix entry");
            }
        }
        var channels = mix.getUsedChannels();
        var expectedRhythm = new HashSet<String>();
        for (int channel : channels)
        {
            if (!(mix.getRhythmVoice(channel) instanceof UserRhythmVoice)) expectedRhythm.add(key(mix, channel));
        }
        var importedRhythm = new HashSet<>(imported.keySet());
        importedRhythm.removeIf(key -> key.startsWith("SpUserChannelRhythmID\t") || key.startsWith("SpDrumsUserChannelRhythmID\t"));
        boolean compatible = expectedRhythm.equals(importedRhythm);
        if (!compatible) return false;

        for (int channel : channels)
        {
            var fields = imported.get(key(mix, channel));
            if (fields == null) continue; // A new user channel has its default settings.
            var instrumentMix = mix.getInstrumentMix(channel);
            var values = instrumentMix.getSettings();
            values.setVolume(Integer.parseInt(fields[5]));
            values.setPanoramic(Integer.parseInt(fields[6]));
            values.setTransposition(Integer.parseInt(fields[7]));
            values.setVelocityShift(Integer.parseInt(fields[8]));
            values.setReverb(Integer.parseInt(fields[9]));
            values.setChorus(Integer.parseInt(fields[10]));
            values.setVolumeEnabled(Boolean.parseBoolean(fields[11]));
            values.setPanoramicEnabled(Boolean.parseBoolean(fields[12]));
            values.setReverbEnabled(Boolean.parseBoolean(fields[13]));
            values.setChorusEnabled(Boolean.parseBoolean(fields[14]));
            instrumentMix.setInstrumentEnabled(Boolean.parseBoolean(fields[4]));
            var patch = mix.getRhythmVoice(channel).isDrums() ? getDrumKit(fields[3]) : getMelodicInstrument(fields[3]);
            if (patch != null) instrumentMix.setInstrument(patch);
        }
        return true;
    }

    private static Instrument getMelodicInstrument(String name)
    {
        var bank = GMSynth.getInstance().getGM1Bank();
        var instrument = bank.getInstrument(name);
        return instrument != null ? instrument : bank.guessInstrument(name);
    }

    private static Instrument getDrumKit(String name)
    {
        String normalized = name.toLowerCase(Locale.ROOT);
        if (normalized.contains("brush")) return drumInstrument(name, 40, DrumKit.Type.BRUSH);
        if (normalized.contains("jazz")) return drumInstrument(name, 32, DrumKit.Type.JAZZ);
        if (normalized.contains("std kit") || normalized.contains("standard")) return drumInstrument(name, 0, DrumKit.Type.STANDARD);
        return null;
    }

    private static Instrument drumInstrument(String name, int program, DrumKit.Type type)
    {
        return new Instrument(name, null, new MidiAddress(program, 0, 0, MidiAddress.BankSelectMethod.PC_ONLY),
                new DrumKit(type, KeyMapGM.getInstance()), null);
    }

    static String[] snapshot(MidiMix mix)
    {
        return mix.getUsedChannels().stream().map(channel ->
        {
            var instrumentMix = mix.getInstrumentMix(channel);
            var values = instrumentMix.getSettings();
            var instrument = instrumentMix.getInstrument();
            String patch = instrument.getPatchName();
            String instrumentId;
            if (instrument.getBank() == null)
            {
                patch = switch (instrument.getMidiAddress().getProgramChange())
                {
                    case 40 -> "Brush Kit";
                    case 32 -> "Jazz Kit";
                    default -> "Std Kit 1";
                };
                instrumentId = "FluidSynth#:#NOT_SET#_#Drums#_#" + patch;
            } else
            {
                instrumentId = instrument.saveAsString();
            }
            return channel + "\t" + key(mix, channel) + "\t" + instrumentId + "\t" + patch + "\t"
                    + instrumentMix.isMute() + "\t" + instrumentMix.isInstrumentEnabled() + "\t"
                    + values.getVolume() + "\t" + values.getPanoramic() + "\t" + values.getTransposition() + "\t"
                    + values.getVelocityShift() + "\t" + values.getReverb() + "\t" + values.getChorus() + "\t"
                    + values.isVolumeEnabled() + "\t" + values.isPanoramicEnabled() + "\t"
                    + values.isReverbEnabled() + "\t" + values.isChorusEnabled();
        }).toArray(String[]::new);
    }
}
