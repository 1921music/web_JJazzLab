package org.jjazz.web.engine;

import java.util.Collection;
import org.teavm.extension.spi.resources.ResourcesPolicy;

public final class EngineResources implements ResourcesPolicy
{
    @Override
    public String[] supplyResources(Collection<? extends String> classes)
    {
        if (!classes.contains(WasmMidiEngine.class.getName()) && !classes.contains(MidiGenerationProbe.class.getName()))
        {
            return new String[0];
        }
        return new String[]{
            "org/jjazz/yamjjazz/resources/YamahaRefSynth.ins",
            "org/jjazz/rhythmparametersimpl/api/Bundle.properties",
            "org/jjazz/rhythmmusicgeneration/api/Bundle.properties",
            "org/jjazz/rhythm/api/Bundle.properties",
            "org/jjazz/song/api/Bundle.properties",
            "org/jjazz/utilities/api/Bundle.properties"
        };
    }
}
