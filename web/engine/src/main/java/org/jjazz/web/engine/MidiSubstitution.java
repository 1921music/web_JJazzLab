package org.jjazz.web.engine;

import org.teavm.extension.spi.substitution.SubstitutionPolicy;
import org.teavm.extension.spi.substitution.SubstitutionSink;

public final class MidiSubstitution implements SubstitutionPolicy
{
    @Override
    public void contribute(SubstitutionSink sink)
    {
        sink.substitutePackage("javax.sound.midi", "org.jjazz.web.engine.midi");
    }
}
