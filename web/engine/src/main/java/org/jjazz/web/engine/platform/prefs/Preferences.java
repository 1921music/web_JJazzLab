package org.jjazz.web.engine.platform.prefs;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/** Preferences confined to the current engine instance's memory. */
public class Preferences
{
    private static final Preferences USER = new Preferences(new HashMap<>(), "");
    private static final Preferences SYSTEM = new Preferences(new HashMap<>(), "");

    private final Map<String, Map<String, String>> nodes;
    private final String path;
    private final Map<String, String> values;

    private Preferences(Map<String, Map<String, String>> nodes, String path)
    {
        this.nodes = nodes;
        this.path = path;
        values = nodes.computeIfAbsent(path, key -> new HashMap<>());
    }

    public static Preferences userRoot()
    {
        return USER;
    }

    public static Preferences systemRoot()
    {
        return SYSTEM;
    }

    public Preferences node(String name)
    {
        if (name.isEmpty())
        {
            return this;
        }
        return new Preferences(nodes, name.startsWith("/") ? name : path + "/" + name);
    }

    public String get(String key, String fallback)
    {
        return values.getOrDefault(Objects.requireNonNull(key), fallback);
    }

    public void put(String key, String value)
    {
        values.put(Objects.requireNonNull(key), Objects.requireNonNull(value));
    }

    public void remove(String key)
    {
        values.remove(Objects.requireNonNull(key));
    }

    public int getInt(String key, int fallback)
    {
        try
        {
            return Integer.parseInt(get(key, null));
        } catch (NumberFormatException e)
        {
            return fallback;
        }
    }

    public void putInt(String key, int value)
    {
        put(key, Integer.toString(value));
    }

    public boolean getBoolean(String key, boolean fallback)
    {
        String value = get(key, "");
        return "true".equalsIgnoreCase(value) || (!"false".equalsIgnoreCase(value) && fallback);
    }

    public void putBoolean(String key, boolean value)
    {
        put(key, Boolean.toString(value));
    }

    public float getFloat(String key, float fallback)
    {
        String value = get(key, null);
        if (value != null)
        {
            try
            {
                return Float.parseFloat(value);
            } catch (NumberFormatException e)
            {
                return fallback;
            }
        }
        return fallback;
    }

    public void putFloat(String key, float value)
    {
        put(key, Float.toString(value));
    }
}
