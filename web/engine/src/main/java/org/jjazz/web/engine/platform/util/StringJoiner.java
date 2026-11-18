package org.jjazz.web.engine.platform.util;

import java.util.Objects;

public final class StringJoiner
{
    private final String delimiter;
    private final String prefix;
    private final String suffix;
    private final StringBuilder joined = new StringBuilder();
    private boolean hasElements;
    private String emptyValue;

    public StringJoiner(CharSequence delimiter)
    {
        this(delimiter, "", "");
    }

    public StringJoiner(CharSequence delimiter, CharSequence prefix, CharSequence suffix)
    {
        this.delimiter = Objects.requireNonNull(delimiter).toString();
        this.prefix = Objects.requireNonNull(prefix).toString();
        this.suffix = Objects.requireNonNull(suffix).toString();
        emptyValue = this.prefix + this.suffix;
    }

    public StringJoiner add(CharSequence element)
    {
        if (hasElements)
        {
            joined.append(delimiter);
        }
        joined.append(element);
        hasElements = true;
        return this;
    }

    public StringJoiner setEmptyValue(CharSequence replacement)
    {
        emptyValue = Objects.requireNonNull(replacement).toString();
        return this;
    }

    public StringJoiner merge(StringJoiner other)
    {
        if (other.hasElements)
        {
            add(other.joined.toString());
        }
        return this;
    }

    public int length()
    {
        return hasElements ? prefix.length() + joined.length() + suffix.length() : emptyValue.length();
    }

    @Override
    public String toString()
    {
        return hasElements ? prefix + joined + suffix : emptyValue;
    }
}
