package org.jjazz.web.engine.midi;

import java.util.ArrayList;
import java.util.HashSet;

public class Track
{
    private final ArrayList<MidiEvent> events = new ArrayList<>();
    private final HashSet<MidiEvent> membership = new HashSet<>();
    private final MidiEvent end;

    Track()
    {
        end = new MidiEvent(new MetaMessage(new byte[]{(byte) 0xff, 47, 0}), 0);
    }

    public boolean add(MidiEvent event)
    {
        if (event == null || event == end || membership.contains(event))
        {
            return false;
        }
        long tick = event.getTick();
        if (tick > end.getTick())
        {
            end.setTick(tick);
        }
        if (event.getMessage() instanceof MetaMessage meta && meta.getType() == 47)
        {
            return true;
        }
        membership.add(event);

        int low = 0;
        int high = events.size();
        while (low < high)
        {
            int middle = (low + high) >>> 1;
            if (events.get(middle).getTick() <= tick)
            {
                low = middle + 1;
            } else
            {
                high = middle;
            }
        }
        events.add(low, event);
        return true;
    }

    public boolean remove(MidiEvent event)
    {
        return membership.remove(event) && events.remove(event);
    }

    public MidiEvent get(int index)
    {
        return index == events.size() ? end : events.get(index);
    }

    public int size()
    {
        return events.size() + 1;
    }

    public long ticks()
    {
        return end.getTick();
    }
}
