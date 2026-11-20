package org.jjazz.web.engine;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.IdentityHashMap;
import org.jjazz.chordleadsheet.api.item.AltDataFilter;
import org.jjazz.chordleadsheet.api.item.AltExtChordSymbol;
import org.jjazz.chordleadsheet.api.item.ChordRenderingInfo;
import org.jjazz.chordleadsheet.api.item.ChordRenderingInfo.Feature;
import org.jjazz.chordleadsheet.api.item.ExtChordSymbol;
import org.jjazz.chordleadsheet.api.item.VoidAltExtChordSymbol;
import org.jjazz.chordleadsheet.spi.item.CLI_Factory;
import org.jjazz.harmony.api.Note;
import org.jjazz.harmony.api.Position;
import org.jjazz.harmony.api.StandardScaleInstance;
import org.jjazz.harmony.api.TimeSignature;
import org.jjazz.harmony.spi.ScaleManager;
import org.jjazz.phrase.api.Phrase;
import org.jjazz.rhythm.api.AdaptedRhythm;
import org.jjazz.rhythm.api.MusicGenerationException;
import org.jjazz.rhythm.api.Rhythm;
import org.jjazz.rhythm.api.RhythmParameter;
import org.jjazz.rhythmdatabase.api.UnavailableRhythmException;
import org.jjazz.rhythmparametersimpl.api.RP_SYS_OverrideTracks;
import org.jjazz.rhythmparametersimpl.api.RP_SYS_OverrideTracksValue;
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
                 String[] userTrackNames, String[] userPhrases, String[] chordRendering)
{
    Song createSong(Rhythm[] sources, int[] partSources) throws Exception
    {
        if (sectionNames.length == 0 || sectionNames.length != sectionBars.length || sectionNames.length != sectionMeters.length || sectionBars[0] != 0
                || partNames.length == 0 || partNames.length != partSections.length || partNames.length != partParameters.length
                || partNames.length != partSources.length
                || chords.length != chordBars.length || chords.length != chordBeats.length
                || chordRendering.length != 0 && chordRendering.length != chords.length
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
            var chord = chordRendering.length == 0 ? ExtChordSymbol.get(chords[i]) : parseChord(chords[i], chordRendering[i]);
            leadSheet.addItem(chordFactory.createChordSymbol(chord, new Position(chordBars[i], chordBeats[i])));
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
            var partRhythm = adapt(rhythm, meter, adapted);
            if (partRhythm == null) throw new IllegalArgumentException("The selected rhythm cannot be adapted to " + meter);
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
                        if (parameter instanceof RP_SYS_OverrideTracks override)
                        {
                            if (!value.isBlank())
                            {
                                var restored = RP_SYS_OverrideTracksValue.loadFromString(override.getBaseRhythm(), value,
                                        destId -> resolveOverrideRhythm(destId, sources, adapted));
                                structure.setRhythmParameterValue(parts.get(i), override, restored);
                            }
                        } else
                        {
                            setParameter(structure, parts.get(i), parameter, value);
                        }
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

    private static Rhythm adapt(Rhythm rhythm, TimeSignature meter,
            IdentityHashMap<Rhythm, EnumMap<TimeSignature, Rhythm>> adapted) throws MusicGenerationException
    {
        if (rhythm.getTimeSignature() == meter) return rhythm;
        if (!(rhythm instanceof YamJJazzRhythm yamaha)) return null;
        var rhythms = adapted.computeIfAbsent(rhythm, source -> new EnumMap<>(TimeSignature.class));
        var result = rhythms.get(meter);
        if (result == null)
        {
            var provider = yamaha.isExtendedRhythm() ? YamJJazzRhythmProvider.RP_ID : YamahaRhythmProvider.RP_ID;
            result = new YamJJazzAdaptedRhythmImpl(provider, yamaha, meter);
            result.loadResources();
            rhythms.put(meter, result);
        }
        return result;
    }

    private static Rhythm resolveOverrideRhythm(String id, Rhythm[] sources,
            IdentityHashMap<Rhythm, EnumMap<TimeSignature, Rhythm>> adapted) throws UnavailableRhythmException
    {
        var fields = id.split(AdaptedRhythm.RHYTHM_ID_DELIMITER);
        var sourceId = fields.length == 3 ? fields[1] : id;
        for (var source : sources)
        {
            if (!source.getUniqueId().equalsIgnoreCase(sourceId)) continue;
            if (fields.length != 3) return source;
            try
            {
                var result = adapt(source, TimeSignature.parse(fields[2]), adapted);
                if (result != null && result.getUniqueId().equalsIgnoreCase(id)) return result;
            } catch (ParseException | MusicGenerationException | IllegalArgumentException ex)
            {
                throw new UnavailableRhythmException("Unable to adapt override rhythm " + id + ": " + ex.getMessage());
            }
        }
        throw new UnavailableRhythmException("No rhythm found for override id=" + id);
    }

    static ExtChordSymbol parseChord(String name, String value) throws ParseException
    {
        var lines = value.split("\n", -1);
        var rendering = parseRendering(lines[0]);
        if (lines.length == 1) return ExtChordSymbol.get(name, rendering, null, null);
        if (lines.length < 4) throw new IllegalArgumentException("Invalid alternate chord columns");
        var alternate = lines[1].equals("NC") ? VoidAltExtChordSymbol.getInstance()
                : AltExtChordSymbol.get(lines[1], parseRendering(lines[2]));
        var filter = lines[3].isEmpty() ? new AltDataFilter(Arrays.asList(lines).subList(4, lines.length))
                : new AltDataFilter(AltDataFilter.Random.valueOf(lines[3]));
        return ExtChordSymbol.get(name, rendering, alternate, filter);
    }

    private static ChordRenderingInfo parseRendering(String value)
    {
        var columns = value.split("\t", -1);
        if (columns.length != 3)
        {
            throw new IllegalArgumentException("Invalid chord rendering columns");
        }
        var features = EnumSet.noneOf(Feature.class);
        if (!columns[0].isEmpty())
        {
            for (String feature : columns[0].split(","))
            {
                features.add(Feature.valueOf(feature.trim()));
            }
        }
        StandardScaleInstance scale = null;
        if (!columns[1].isEmpty() && !columns[2].isEmpty())
        {
            var scales = ScaleManager.getDefault().getStandardScales();
            int index = Integer.parseInt(columns[1]);
            // The desktop serialization proxy falls back to the major scale for an unknown index.
            var standardScale = scales.get(index >= 0 && index < scales.size() ? index : 0);
            scale = new StandardScaleInstance(standardScale, new Note(Integer.parseInt(columns[2])));
        }
        return new ChordRenderingInfo(features, scale);
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
