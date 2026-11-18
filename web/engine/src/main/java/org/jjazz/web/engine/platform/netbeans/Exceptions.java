package org.jjazz.web.engine.platform.netbeans;

public final class Exceptions
{
    private Exceptions()
    {
    }

    public static void printStackTrace(Throwable error)
    {
        error.printStackTrace();
    }
}
