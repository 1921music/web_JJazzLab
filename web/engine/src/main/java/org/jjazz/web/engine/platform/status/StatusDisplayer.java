package org.jjazz.web.engine.platform.status;

/** Headless sink for optional desktop status-bar messages. */
public final class StatusDisplayer
{
    private static final StatusDisplayer INSTANCE = new StatusDisplayer();

    private StatusDisplayer()
    {
    }

    public static StatusDisplayer getDefault()
    {
        return INSTANCE;
    }

    public void setStatusText(String text)
    {
    }
}
