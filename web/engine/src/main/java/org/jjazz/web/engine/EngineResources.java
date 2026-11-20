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
            "org/jjazz/jjswing/api/psBase.sst",
            "org/jjazz/jjswing/api/psBase.yjz",
            "org/jjazz/jjswing/bass/db/WalkingBassMidiDB.mid",
            "org/jjazz/jjswing/bass/db/WalkingBass2feelAMidiDB.mid",
            "org/jjazz/jjswing/bass/db/WalkingBass2feelBMidiDB.mid",
            "org/jjazz/jjswing/drums/db/drums44DB.mid",
            "org/jjazz/jjswing/Bundle.properties",
            "org/jjazz/phrasetransform/Bundle.properties",
            "org/jjazz/phrasetransform/resources/CabasaEighths.mid",
            "org/jjazz/phrasetransform/resources/Congas1-2bar.mid",
            "org/jjazz/phrasetransform/resources/Congas2-2bar.mid",
            "org/jjazz/phrasetransform/resources/Congas3-2bar.mid",
            "org/jjazz/phrasetransform/resources/Congas4-2bar.mid",
            "org/jjazz/phrasetransform/resources/CowBellBeat.mid",
            "org/jjazz/phrasetransform/resources/ShakerSixteenths.mid",
            "org/jjazz/phrasetransform/resources/Tambourine2-4.mid",
            "org/jjazz/phrasetransform/resources/TambourineEighths.mid",
            "org/jjazz/phrasetransform/resources/TambourineOffBeat.mid",
            "org/jjazz/phrasetransform/resources/TambourineSixteenths.mid",
            "org/jjazz/phrasetransform/resources/TriangleEighths.mid",
            "org/jjazz/phrasetransform/resources/TriangleSixteenths.mid",
            "org/jjazz/rhythmparametersimpl/api/Bundle.properties",
            "org/jjazz/rhythmmusicgeneration/api/Bundle.properties",
            "org/jjazz/rhythm/api/Bundle.properties",
            "org/jjazz/song/api/Bundle.properties",
            "org/jjazz/utilities/api/Bundle.properties"
        };
    }
}
