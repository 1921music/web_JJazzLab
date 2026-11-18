package org.jjazz.web.engine.platform.clipboard;

public class UnsupportedFlavorException extends Exception
{
    public UnsupportedFlavorException(DataFlavor flavor)
    {
        super(flavor == null ? null : flavor.getHumanPresentableName());
    }
}
