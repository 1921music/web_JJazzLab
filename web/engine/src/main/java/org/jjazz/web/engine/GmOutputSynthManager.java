package org.jjazz.web.engine;

import java.beans.PropertyChangeListener;
import org.jjazz.midi.api.synths.GMSynth;
import org.jjazz.outputsynth.api.OutputSynth;
import org.jjazz.outputsynth.spi.OutputSynthManager;

/** Supplies the General MIDI output configuration used for file export. */
public final class GmOutputSynthManager implements OutputSynthManager
{
    private static final class Shared
    {
        static final OutputSynthManager INSTANCE = new GmOutputSynthManager();
    }

    private final OutputSynth output = new OutputSynth(GMSynth.getInstance());

    public GmOutputSynthManager()
    {
        output.getUserSettings().setSendModeOnUponPlay(OutputSynth.UserSettings.SendModeOnUponPlay.GM);
    }

    public static OutputSynthManager getDefault()
    {
        return Shared.INSTANCE;
    }

    @Override
    public OutputSynth getDefaultOutputSynth()
    {
        return output;
    }

    @Override
    public OutputSynth getMidiDeviceOutputSynth(String name)
    {
        return output;
    }

    @Override
    public void setMidiDeviceOutputSynth(String name, OutputSynth synth)
    {
        throw new UnsupportedOperationException("The Web engine exports a fixed General MIDI configuration");
    }

    @Override
    public void refresh()
    {
    }

    @Override
    public void addPropertyChangeListener(PropertyChangeListener listener)
    {
    }

    @Override
    public void addPropertyChangeListener(String property, PropertyChangeListener listener)
    {
    }

    @Override
    public void removePropertyChangeListener(PropertyChangeListener listener)
    {
    }

    @Override
    public void removePropertyChangeListener(String property, PropertyChangeListener listener)
    {
    }
}
