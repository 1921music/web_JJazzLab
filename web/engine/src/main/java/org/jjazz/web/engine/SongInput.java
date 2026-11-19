package org.jjazz.web.engine;

import java.util.ArrayList;
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

/** Columns in the browser-to-Wasm song input. Bar and beat positions are zero based. */
record SongInput(String title, String meter, int tempo, int bars,
                 String[] sectionNames, int[] sectionBars,
                 String[] chords, int[] chordBars, float[] chordBeats,
                 String[] partNames, int[] partSections, String[] partParameters,
                 String[] userTrackNames, String[] userPhrases)
{
    Song createSong(Rhythm rhythm) throws Exception
    {
        if (sectionNames.length == 0 || sectionNames.length != sectionBars.length || sectionBars[0] != 0
                || partNames.length == 0 || partNames.length != partSections.length || partNames.length != partParameters.length
                || chords.length != chordBars.length || chords.length != chordBeats.length
                || userTrackNames.length != userPhrases.length)
        {
            throw new IllegalArgumentException("Invalid song input columns");
        }

        var timeSignature = TimeSignature.valueOf(meter);
        if (timeSignature != rhythm.getTimeSignature())
        {
            throw new IllegalArgumentException("The selected rhythm uses a different time signature");
        }

        var factory = SongFactory.getDefault();
        var chordFactory = CLI_Factory.getDefault();
        var leadSheet = factory.createEmptyChordLeadSheet(sectionNames[0], timeSignature, bars, null);
        for (int i = 1; i < sectionNames.length; i++)
        {
            leadSheet.addSection(chordFactory.createSection(sectionNames[i], timeSignature, sectionBars[i], leadSheet));
        }
        for (int i = 0; i < chords.length; i++)
        {
            leadSheet.addItem(chordFactory.createChordSymbol(chords[i], new Position(chordBars[i], chordBeats[i])));
        }

        var structure = new SongStructureImpl(leadSheet);
        var parts = new ArrayList<SongPart>();
        int startBar = 0;
        for (int i = 0; i < partNames.length; i++)
        {
            var section = leadSheet.getSection(sectionBars[partSections[i]]);
            var part = structure.createSongPart(rhythm, partNames[i], startBar, section, false);
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
                for (var parameter : rhythm.getRhythmParameters())
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
        song.setTempo(tempo == 0 ? rhythm.getPreferredTempo() : tempo);
        for (int i = 0; i < userTrackNames.length; i++)
        {
            song.setUserPhrase(userTrackNames[i], Phrase.loadAsString(userPhrases[i]));
        }
        return song;
    }

    private static <T> void setParameter(SongStructureImpl structure, SongPart part, RhythmParameter<T> parameter, String savedValue) throws java.text.ParseException
    {
        var value = parameter.loadFromString(savedValue);
        if (value != null && parameter.isValidValue(value))
        {
            structure.setRhythmParameterValue(part, parameter, value);
        }
    }
}
