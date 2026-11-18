package org.jjazz.web.engine.platform.filechooser;

import java.io.File;

/** Filename matching used to select a MIDI synth reader. */
public final class FileNameExtensionFilter
{
    private final String description;
    private final String[] extensions;

    public FileNameExtensionFilter(String description, String... extensions)
    {
        this.description = description;
        this.extensions = extensions.clone();
    }

    public String getDescription()
    {
        return description;
    }

    public String[] getExtensions()
    {
        return extensions.clone();
    }

    public boolean accept(File file)
    {
        if (file == null || file.isDirectory())
        {
            return file != null;
        }
        String name = file.getName();
        int separator = name.lastIndexOf('.');
        if (separator <= 0)
        {
            return false;
        }
        String suffix = name.substring(separator + 1);
        for (String extension : extensions)
        {
            if (suffix.equalsIgnoreCase(extension))
            {
                return true;
            }
        }
        return false;
    }
}
