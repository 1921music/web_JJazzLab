package org.jjazz.web.engine.midi;

import java.util.ArrayList;

public class Sequence
{
    public static final float PPQ = 0.0f;
    private final int resolution;
    private final ArrayList<Track> tracks = new ArrayList<>();

    public Sequence(float divisionType, int resolution) throws InvalidMidiDataException
    {
        if (divisionType != PPQ || resolution <= 0 || resolution > 0x7fff)
        {
            throw new InvalidMidiDataException("Only positive PPQ resolutions are supported");
        }
        this.resolution = resolution;
    }

    public float getDivisionType()
    {
        return PPQ;
    }

    public int getResolution()
    {
        return resolution;
    }

    public Track createTrack()
    {
        var track = new Track();
        tracks.add(track);
        return track;
    }

    public boolean deleteTrack(Track track)
    {
        return tracks.remove(track);
    }

    public Track[] getTracks()
    {
        return tracks.toArray(Track[]::new);
    }

    public long getTickLength()
    {
        long duration = 0;
        for (Track track : tracks)
        {
            duration = Math.max(duration, track.ticks());
        }
        return duration;
    }
}
