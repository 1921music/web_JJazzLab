package org.jjazz.web.engine.platform.undo;

/** Undo state used by model events, with no editor or undo history manager. */
public class AbstractUndoableEdit implements UndoableEdit
{
    private boolean alive = true;
    private boolean done = true;

    @Override
    public void undo()
    {
        if (!canUndo())
        {
            throw new CannotUndoException();
        }
        done = false;
    }

    @Override
    public boolean canUndo()
    {
        return alive && done;
    }

    @Override
    public void redo()
    {
        if (!canRedo())
        {
            throw new CannotRedoException();
        }
        done = true;
    }

    @Override
    public boolean canRedo()
    {
        return alive && !done;
    }

    @Override
    public void die()
    {
        alive = false;
    }

    @Override
    public boolean addEdit(UndoableEdit edit)
    {
        return false;
    }

    @Override
    public boolean replaceEdit(UndoableEdit edit)
    {
        return false;
    }

    @Override
    public boolean isSignificant()
    {
        return true;
    }

    @Override
    public String getPresentationName()
    {
        return "";
    }

    @Override
    public String getUndoPresentationName()
    {
        String name = getPresentationName();
        return name.isEmpty() ? "Undo" : "Undo " + name;
    }

    @Override
    public String getRedoPresentationName()
    {
        String name = getPresentationName();
        return name.isEmpty() ? "Redo" : "Redo " + name;
    }
}
