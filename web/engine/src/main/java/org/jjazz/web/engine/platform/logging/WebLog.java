package org.jjazz.web.engine.platform.logging;

import java.util.function.Supplier;
import java.util.logging.Level;

/** Routes warnings and errors to the host without desktop log handlers. */
public final class WebLog
{
    private WebLog()
    {
    }

    public static boolean isLoggable(Level level)
    {
        return level == Level.WARNING || level == Level.SEVERE;
    }

    public static void log(Level level, String message)
    {
        if (isLoggable(level))
        {
            System.err.println(message);
        }
    }

    public static void log(Level level, String message, Object value)
    {
        if (isLoggable(level))
        {
            System.err.println(message.replace("{0}", String.valueOf(value)));
        }
    }

    public static void log(Level level, String message, Object[] values)
    {
        if (isLoggable(level))
        {
            for (int i = 0; i < values.length; i++)
            {
                message = message.replace("{" + i + "}", String.valueOf(values[i]));
            }
            System.err.println(message);
        }
    }

    public static void log(Level level, String message, Throwable error)
    {
        if (isLoggable(level))
        {
            System.err.println(message + ": " + error);
        }
    }

    public static void log(Level level, Supplier<String> message)
    {
        if (isLoggable(level))
        {
            System.err.println(message.get());
        }
    }

    public static void severe(String message)
    {
        log(Level.SEVERE, message);
    }

    public static void severe(Supplier<String> message) { log(Level.SEVERE, message); }
    public static void warning(Supplier<String> message) { log(Level.WARNING, message); }
    public static void info(Supplier<String> message) { log(Level.INFO, message); }
    public static void fine(Supplier<String> message) { log(Level.FINE, message); }
    public static void finest(Supplier<String> message) { log(Level.FINEST, message); }

    public static void warning(String message)
    {
        log(Level.WARNING, message);
    }

    public static void info(String message)
    {
        log(Level.INFO, message);
    }

    public static void fine(String message)
    {
        log(Level.FINE, message);
    }

    public static void finest(String message)
    {
        log(Level.FINEST, message);
    }
}
