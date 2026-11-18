package org.jjazz.web.engine.platform.resources;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

/** Loads only the default-language bundles packaged with the Web engine. */
public final class ResUtil
{
    private static final Map<String, Properties> BUNDLES = new HashMap<>();

    private ResUtil()
    {
    }

    public static String getString(Class<?> type, String key, Object... parameters)
    {
        String name = type.getName();
        int separator = name.lastIndexOf('.');
        String path = separator < 0 ? "Bundle.properties"
                : name.substring(0, separator).replace('.', '/') + "/Bundle.properties";
        return format(BUNDLES.computeIfAbsent(path, ResUtil::read).getProperty(key, key), parameters);
    }

    public static String getCommonString(String key, Object... parameters)
    {
        String bundle = "org/jjazz/utilities/api/Bundle.properties";
        return format(BUNDLES.computeIfAbsent(bundle, ResUtil::read).getProperty(key, key), parameters);
    }

    private static Properties read(String path)
    {
        var props = new Properties();
        try (var stream = ResUtil.class.getClassLoader().getResourceAsStream(path))
        {
            if (stream != null)
            {
                props.load(new InputStreamReader(stream, StandardCharsets.UTF_8));
            }
        } catch (IOException ex)
        {
            throw new IllegalStateException("Could not read " + path, ex);
        }
        return props;
    }

    private static String format(String template, Object[] parameters)
    {
        for (int i = 0; i < parameters.length; i++)
        {
            template = template.replace("{" + i + "}", String.valueOf(parameters[i]));
        }
        return template;
    }
}
