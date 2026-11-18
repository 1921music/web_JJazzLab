package org.jjazz.web.engine.platform.swing;

import java.util.EventListener;

@FunctionalInterface
public interface UndoableEditListener extends EventListener
{
    void undoableEditHappened(UndoableEditEvent event);
}
