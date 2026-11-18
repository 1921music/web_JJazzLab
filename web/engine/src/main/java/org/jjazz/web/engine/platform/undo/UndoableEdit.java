package org.jjazz.web.engine.platform.undo;

public interface UndoableEdit
{
    void undo();

    boolean canUndo();

    void redo();

    boolean canRedo();

    void die();

    boolean addEdit(UndoableEdit edit);

    boolean replaceEdit(UndoableEdit edit);

    boolean isSignificant();

    String getPresentationName();

    String getUndoPresentationName();

    String getRedoPresentationName();
}
