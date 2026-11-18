package org.jjazz.web.engine.platform.clipboard;

import java.util.Objects;

/** Local transfer type token. Browser clipboard access lives outside the engine. */
public final class DataFlavor
{
    public static final DataFlavor stringFlavor = new DataFlavor(String.class, "String");
    private final Class<?> type;
    private final String name;

    public DataFlavor(Class<?> type, String name)
    {
        this.type = Objects.requireNonNull(type);
        this.name = name;
    }

    public Class<?> getRepresentationClass()
    {
        return type;
    }

    public String getHumanPresentableName()
    {
        return name;
    }

    @Override
    public boolean equals(Object other)
    {
        return other instanceof DataFlavor flavor && type == flavor.type;
    }

    @Override
    public int hashCode()
    {
        return type.hashCode();
    }
}
