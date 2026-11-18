package org.jjazz.web.engine.platform.netbeans;

import java.util.Collection;
import java.util.function.Supplier;

/** A registry with explicit bindings for the services available in a worker. */
public class Lookup
{
    public static final Lookup EMPTY = new Lookup();
    private static final Lookup DEFAULT = new Lookup(WebServiceRegistry.DEFAULT);
    private final WebServiceRegistry registry;

    public Lookup()
    {
        this(new WebServiceRegistry());
    }

    private Lookup(WebServiceRegistry registry)
    {
        this.registry = registry;
    }

    public static Lookup getDefault()
    {
        return DEFAULT;
    }

    public <T> void register(Class<T> type, Supplier<? extends T> supplier)
    {
        registry.register(type, supplier);
    }

    public <T> T lookup(Class<T> type)
    {
        return registry.lookup(type);
    }

    public <T> Collection<? extends T> lookupAll(Class<T> type)
    {
        return registry.lookupAll(type);
    }
}
