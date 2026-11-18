package org.jjazz.web.engine;

import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;
import org.jjazz.midi.api.MidiSynth;
import org.jjazz.midi.api.synths.GM2Synth;
import org.jjazz.midi.api.synths.GMSynth;
import org.jjazz.midi.api.synths.GSSynth;
import org.jjazz.midi.api.synths.XGSynth;
import org.jjazz.midi.spi.MidiSynthManager;

/** Catalog of MIDI instrument definitions used by style generation. */
final class WebMidiSynthManager implements MidiSynthManager
{
    private final List<MidiSynth> synths = new ArrayList<>(List.of(
            GMSynth.getInstance(), GM2Synth.getInstance(), XGSynth.getInstance(), GSSynth.getInstance()));
    private final PropertyChangeSupport changes = new PropertyChangeSupport(this);

    @Override
    public MidiSynth getMidiSynth(String name)
    {
        return synths.stream().filter(synth -> synth.getName().equals(name)).findFirst().orElse(null);
    }

    @Override
    public List<MidiSynth> getMidiSynths()
    {
        return new ArrayList<>(synths);
    }

    @Override
    public List<MidiSynth> getMidiSynths(Predicate<MidiSynth> tester)
    {
        return synths.stream().filter(tester).toList();
    }

    @Override
    public boolean addMidiSynth(MidiSynth synth)
    {
        Objects.requireNonNull(synth);
        if (synths.contains(synth))
        {
            return false;
        }
        synths.add(synth);
        changes.firePropertyChange(PROP_MIDISYNTH_LIST, null, synth);
        return true;
    }

    @Override
    public boolean removeMidiSynth(MidiSynth synth)
    {
        boolean removed = synths.remove(synth);
        if (removed)
        {
            changes.firePropertyChange(PROP_MIDISYNTH_LIST, synth, null);
        }
        return removed;
    }

    @Override
    public void addPropertyChangeListener(PropertyChangeListener listener)
    {
        changes.addPropertyChangeListener(listener);
    }

    @Override
    public void removePropertyChangeListener(PropertyChangeListener listener)
    {
        changes.removePropertyChangeListener(listener);
    }
}
