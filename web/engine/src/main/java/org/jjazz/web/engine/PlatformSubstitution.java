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
        sink.substitutePackage("java.awt.datatransfer", platform + ".clipboard");
        sink.substitutePackage("javax.swing.event", platform + ".swing");
        sink.substitutePackage("javax.swing.undo", platform + ".undo");
        sink.selectClasses("java.util.StringJoiner"::equals)
                .replacePackage("java.util", platform + ".util");
        sink.selectClasses("java.util.logging.Logger"::equals)
                .replacePackage("java.util.logging", platform + ".logging");
        sink.selectClasses(name -> name.equals("java.util.concurrent.locks.ReentrantReadWriteLock")
                || name.startsWith("java.util.concurrent.locks.ReentrantReadWriteLock$"))
                .replacePackage("java.util.concurrent.locks", platform + ".locks");
        sink.selectClasses(name -> name.equals("org.openide.util.Lookup") || name.equals("org.openide.util.NbPreferences"))
                .replacePackage("org.openide.util", platform + ".netbeans");
    }
}
