package org.jjazz.web.engine.platform.swing;

import org.jjazz.web.engine.platform.beans.PropertyChangeSupport;

/** Swing notification entry points share the engine's synchronous dispatcher. */
public final class SwingPropertyChangeSupport extends PropertyChangeSupport
{
    public SwingPropertyChangeSupport(Object source)
    {
        super(source);
    }
}
