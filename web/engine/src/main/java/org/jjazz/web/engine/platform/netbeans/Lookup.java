package org.jjazz.web.engine.platform.netbeans;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

/** A registry with explicit bindings for the services available in a worker. */
public class Lookup
{
    public static final Lookup EMPTY = new Lookup();
    private static final Lookup DEFAULT = new Lookup();

    private final Map<Class<?>, List<Binding<?>>> bindings = new HashMap<>();

    public static Lookup getDefault()
    {
        return DEFAULT;
    }

    public <T> void register(Class<T> type, Supplier<? extends T> supplier)
    {
        bindings.computeIfAbsent(type, key -> new ArrayList<>()).add(new Binding<>(supplier));
    }

    public <T> T lookup(Class<T> type)
    {
        var services = bindings.get(type);
        return services == null ? null : type.cast(services.getFirst().get());
    }

    public <T> Collection<? extends T> lookupAll(Class<T> type)
    {
        var services = bindings.get(type);
        if (services == null)
        {
            return List.of();
        }
        var instances = new ArrayList<T>(services.size());
        for (var service : services)
        {
            instances.add(type.cast(service.get()));
        }
        return instances;
    }

    private static final class Binding<T>
    {
        private final Supplier<? extends T> supplier;
        private T instance;
        private boolean initializing;

        Binding(Supplier<? extends T> supplier)
        {
            this.supplier = Objects.requireNonNull(supplier);
        }

        T get()
        {
            if (instance != null)
            {
                return instance;
            }
            if (initializing)
            {
                throw new IllegalStateException("Circular Web service initialization");
            }
            initializing = true;
            try
            {
                instance = Objects.requireNonNull(supplier.get());
                return instance;
            } finally
            {
                initializing = false;
            }
        }
    }
}
