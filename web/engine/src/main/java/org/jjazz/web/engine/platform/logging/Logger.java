package org.jjazz.web.engine.platform.logging;

import java.util.function.Supplier;
import java.util.logging.Level;

/** Routes warnings and errors to the host without desktop log handlers. */
public final class Logger
{
    private static final Logger INSTANCE = new Logger();

    private Logger()
    {
    }

    public static Logger getLogger(String name)
    {
        return INSTANCE;
    }

    public static Logger getLogger(String name, String resourceBundleName)
    {
        return INSTANCE;
    }

    public boolean isLoggable(Level level)
    {
        return level.intValue() >= Level.WARNING.intValue() && level != Level.OFF;
    }

    public void log(Level level, String message)
    {
        if (isLoggable(level))
        {
            System.err.println(message);
        }
    }

    public void log(Level level, String message, Object value)
    {
        if (isLoggable(level))
        {
            System.err.println(message.replace("{0}", String.valueOf(value)));
        }
    }

    public void log(Level level, String message, Object[] values)
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

    public void log(Level level, String message, Throwable error)
    {
        if (isLoggable(level))
        {
            System.err.println(message + ": " + error);
        }
    }

    public void log(Level level, Supplier<String> message)
    {
        if (isLoggable(level))
        {
            System.err.println(message.get());
        }
    }

    public void severe(String message)
    {
        log(Level.SEVERE, message);
    }

    public void warning(String message)
    {
        log(Level.WARNING, message);
    }

    public void info(String message)
    {
        log(Level.INFO, message);
    }

    public void fine(String message)
    {
        log(Level.FINE, message);
    }
}
