package org.jjazz.web.engine.platform.beans;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;

/** Delivers model changes synchronously on the engine's worker. */
public class PropertyChangeSupport
{
    private final Object source;
    private final List<PropertyChangeListener> listeners = new ArrayList<>();
    private final HashMap<String, List<PropertyChangeListener>> named = new HashMap<>();

    public PropertyChangeSupport(Object source)
    {
        this.source = Objects.requireNonNull(source);
    }

    public void addPropertyChangeListener(PropertyChangeListener listener)
    {
        if (listener != null)
        {
            listeners.add(listener);
        }
    }

    public void removePropertyChangeListener(PropertyChangeListener listener)
    {
        listeners.remove(listener);
    }

    public void addPropertyChangeListener(String property, PropertyChangeListener listener)
    {
        if (property != null && listener != null)
        {
            named.computeIfAbsent(property, key -> new ArrayList<>()).add(listener);
        }
    }

    public void removePropertyChangeListener(String property, PropertyChangeListener listener)
    {
        var local = named.get(property);
        if (local != null)
        {
            local.remove(listener);
            if (local.isEmpty())
            {
                named.remove(property);
            }
        }
    }

    public void firePropertyChange(String property, boolean oldValue, boolean newValue)
    {
        if (oldValue != newValue)
        {
            firePropertyChange(property, Boolean.valueOf(oldValue), Boolean.valueOf(newValue));
        }
    }

    public void firePropertyChange(String property, int oldValue, int newValue)
    {
        if (oldValue != newValue)
        {
            firePropertyChange(property, Integer.valueOf(oldValue), Integer.valueOf(newValue));
        }
    }

    public void firePropertyChange(String property, Object oldValue, Object newValue)
    {
        if (!hasListeners(property))
        {
            return;
        }
        firePropertyChange(new PropertyChangeEvent(source, property, oldValue, newValue));
    }

    public void firePropertyChange(PropertyChangeEvent event)
    {
        Object oldValue = event.getOldValue();
        if (oldValue != null && oldValue.equals(event.getNewValue()))
        {
            return;
        }
        var common = listeners.toArray(PropertyChangeListener[]::new);
        var local = named.get(event.getPropertyName());
        var specific = local == null ? null : local.toArray(PropertyChangeListener[]::new);
        for (var listener : common)
        {
            listener.propertyChange(event);
        }
        if (specific != null)
        {
            for (var listener : specific)
            {
                listener.propertyChange(event);
            }
        }
    }

    public boolean hasListeners(String property)
    {
        return !listeners.isEmpty() || named.containsKey(property);
    }
}
