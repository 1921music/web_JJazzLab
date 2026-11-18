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
        sink.selectClasses(name -> name.equals("java.util.concurrent.locks.ReentrantReadWriteLock")
                || name.startsWith("java.util.concurrent.locks.ReentrantReadWriteLock$"))
                .replacePackage("java.util.concurrent.locks", platform + ".locks");
        sink.selectClasses(name -> name.equals("org.openide.util.Lookup")
                || name.equals("org.openide.util.NbPreferences") || name.equals("org.openide.util.Exceptions"))
                .replacePackage("org.openide.util", platform + ".netbeans");
        sink.selectClasses("org.openide.awt.StatusDisplayer"::equals)
                .replacePackage("org.openide.awt", platform + ".status");
        sink.selectClasses("org.jjazz.utilities.api.ResUtil"::equals)
                .replacePackage("org.jjazz.utilities.api", platform + ".resources");
        sink.selectClasses("javax.swing.filechooser.FileNameExtensionFilter"::equals)
                .replacePackage("javax.swing.filechooser", platform + ".filechooser");
    }
}
