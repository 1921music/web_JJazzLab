package org.jjazz.web.engine;

import org.teavm.extension.spi.substitution.SubstitutionPolicy;
import org.teavm.extension.spi.substitution.SubstitutionSink;

public final class PlatformSubstitution implements SubstitutionPolicy
{
    @Override
    public void contribute(SubstitutionSink sink)
    {
        String platform = "org.jjazz.web.engine.platform";
        sink.substitutePackage("java.beans", platform + ".beans");
        sink.substitutePackage("java.util.prefs", platform + ".prefs");
        sink.selectClasses("javax.swing.event.SwingPropertyChangeSupport"::equals)
                .replacePackage("javax.swing.event", platform + ".swing");
        sink.selectClasses(name -> name.equals("org.openide.util.Lookup") || name.equals("org.openide.util.NbPreferences"))
                .replacePackage("org.openide.util", platform + ".netbeans");
    }
}
