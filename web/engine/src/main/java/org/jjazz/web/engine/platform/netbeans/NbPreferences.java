package org.jjazz.web.engine.platform.netbeans;

import org.jjazz.web.engine.platform.prefs.Preferences;

public final class NbPreferences
{
    private NbPreferences()
    {
    }

    public static Preferences forModule(Class<?> type)
    {
        String name = type.getName();
        int end = name.lastIndexOf('.');
        return root().node(end < 0 ? "<unnamed>" : name.substring(0, end).replace('.', '/'));
    }

    public static Preferences root()
    {
        return Preferences.userRoot();
    }
}
