package org.jjazz.web.engine;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/** Stages a raw style on TeaVM's in-memory filesystem for the JJazzLab parser. */
final class RawStyleFile implements AutoCloseable
{
    private final File directory;
    private final File file;

    RawStyleFile(byte[] bytes, String name) throws IOException
    {
        if (name.isEmpty() || name.equals(".") || name.equals("..")
                || name.indexOf('/') >= 0 || name.indexOf('\\') >= 0 || name.indexOf(':') >= 0)
        {
            throw new IllegalArgumentException("A style filename without a path is required");
        }
        SmfReader.validateStyleLayout(bytes);
        directory = File.createTempFile("jjazzlab-", ".input");
        if (!directory.delete() || !directory.mkdir())
        {
            throw new IOException("Could not create a temporary style directory");
        }
        file = new File(directory, name);
        try (var output = new FileOutputStream(file))
        {
            output.write(bytes);
        } catch (IOException | RuntimeException e)
        {
            close();
            throw e;
        }
    }

    File file()
    {
        return file;
    }

    @Override
    public void close()
    {
        file.delete();
        directory.delete();
    }
}
