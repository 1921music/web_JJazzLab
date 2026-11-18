package org.jjazz.web.engine.platform.beans;

import java.util.EventListener;

@FunctionalInterface
public interface PropertyChangeListener extends EventListener
{
    void propertyChange(PropertyChangeEvent event);
}
