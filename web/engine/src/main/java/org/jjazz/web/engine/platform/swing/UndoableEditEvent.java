package org.jjazz.web.engine.platform.swing;

import java.util.EventObject;
import org.jjazz.web.engine.platform.undo.UndoableEdit;

public class UndoableEditEvent extends EventObject
{
    private final UndoableEdit edit;

    public UndoableEditEvent(Object source, UndoableEdit edit)
    {
        super(source);
        this.edit = edit;
    }

    public UndoableEdit getEdit()
    {
        return edit;
    }
}
