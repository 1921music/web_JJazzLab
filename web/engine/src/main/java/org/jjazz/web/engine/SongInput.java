package org.jjazz.web.engine;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.IdentityHashMap;
import org.jjazz.chordleadsheet.spi.item.CLI_Factory;
import org.jjazz.harmony.api.Position;
import org.jjazz.harmony.api.TimeSignature;
import org.jjazz.phrase.api.Phrase;
import org.jjazz.rhythm.api.Rhythm;
import org.jjazz.rhythm.api.RhythmParameter;
import org.jjazz.song.api.Song;
import org.jjazz.song.spi.SongFactory;
import org.jjazz.songstructure.SongStructureImpl;
import org.jjazz.songstructure.api.SongPart;
import org.jjazz.yamjjazz.rhythm.YamJJazzAdaptedRhythmImpl;
import org.jjazz.yamjjazz.rhythm.api.YamJJazzRhythm;
import org.jjazz.yamjjazz.rhythm.api.YamJJazzRhythmProvider;
import org.jjazz.yamjjazz.rhythm.api.YamahaRhythmProvider;

/** Columns in the browser-to-Wasm song input. Bar and beat positions are zero based. */
record SongInput(String title, int tempo, int bars,
                 String[] sectionNames, int[] sectionBars, String[] sectionMeters,
                 String[] chords, int[] chordBars, float[] chordBeats,
                 String[] partNames, int[] partSections, String[] partParameters,
                 String[] userTrackNames, String[] userPhrases)
{
    Song createSong(Rhythm[] sources, int[] partSources) throws Exception
    {
        if (sectionNames.length == 0 || sectionNames.length != sectionBars.length || sectionNames.length != sectionMeters.length || sectionBars[0] != 0
                || partNames.length == 0 || partNames.length != partSections.length || partNames.length != partParameters.length
                || partNames.length != partSources.length
                || chords.length != chordBars.length || chords.length != chordBeats.length
                || userTrackNames.length != userPhrases.length)
        {
            throw new IllegalArgumentException("Invalid song input columns");
        }

        var factory = SongFactory.getDefault();
        var chordFactory = CLI_Factory.getDefault();
        var leadSheet = factory.createEmptyChordLeadSheet(sectionNames[0], TimeSignature.valueOf(sectionMeters[0]), bars, null);
        for (int i = 1; i < sectionNames.length; i++)
        {
            leadSheet.addSection(chordFactory.createSection(sectionNames[i], TimeSignature.valueOf(sectionMeters[i]), sectionBars[i], leadSheet));
        }
        for (int i = 0; i < chords.length; i++)
        {
            leadSheet.addItem(chordFactory.createChordSymbol(chords[i], new Position(chordBars[i], chordBeats[i])));
        }

        var structure = new SongStructureImpl(leadSheet);
        var parts = new ArrayList<SongPart>();
        var adapted = new IdentityHashMap<Rhythm, EnumMap<TimeSignature, Rhythm>>();
        int startBar = 0;
        for (int i = 0; i < partNames.length; i++)
        {
            var section = leadSheet.getSection(sectionBars[partSections[i]]);
            var meter = section.getData().getTimeSignature();
            var rhythm = sources[partSources[i]];
            var rhythms = adapted.computeIfAbsent(rhythm, source -> new EnumMap<>(TimeSignature.class));
            rhythms.putIfAbsent(rhythm.getTimeSignature(), rhythm);
            var partRhythm = rhythms.get(meter);
            if (partRhythm == null)
            {
                if (!(rhythm instanceof YamJJazzRhythm yamaha))
                {
                    throw new IllegalArgumentException("The selected rhythm cannot be adapted to " + meter);
                }
                var provider = yamaha.isExtendedRhythm() ? YamJJazzRhythmProvider.RP_ID : YamahaRhythmProvider.RP_ID;
                partRhythm = new YamJJazzAdaptedRhythmImpl(provider, yamaha, meter);
                partRhythm.loadResources();
                rhythms.put(meter, partRhythm);
            }
            var part = structure.createSongPart(partRhythm, partNames[i], startBar, section, false);
            parts.add(part);
            startBar += part.getNbBars();
        }
        structure.performWriteAPImethodThrowing(structure.addSongPartsOperation(parts));
        for (int i = 0; i < parts.size(); i++)
        {
            for (String entry : partParameters[i].split("\n"))
            {
                if (entry.isEmpty()) continue;
                int separator = entry.indexOf('\t');
                if (separator < 1) throw new IllegalArgumentException("Invalid rhythm parameter entry");
                String id = entry.substring(0, separator);
                String value = entry.substring(separator + 1);
                for (var parameter : parts.get(i).getRhythm().getRhythmParameters())
                {
                    if (parameter.getId().equals(id))
                    {
                        setParameter(structure, parts.get(i), parameter, value);
                        break;
                    }
                }
            }
        }

        var song = factory.createSong(title, structure, true);
        song.setTempo(tempo == 0 ? parts.get(0).getRhythm().getPreferredTempo() : tempo);
        for (int i = 0; i < userTrackNames.length; i++)
        {
            song.setUserPhrase(userTrackNames[i], Phrase.loadAsString(userPhrases[i]));
        }
        return song;
    }

    private static <T> void setParameter(SongStructureImpl structure, SongPart part, RhythmParameter<T> parameter, String savedValue)
    {
        T value;
        try
        {
            value = parameter.loadFromString(savedValue);
        } catch (ParseException ex)
        {
            // Saved values can refer to a variation or instrument of the source rhythm.
            // JJazzLab restores the destination parameter's default in that case.
            return;
        }
        if (value != null && parameter.isValidValue(value))
        {
            structure.setRhythmParameterValue(part, parameter, value);
        }
    }
}
