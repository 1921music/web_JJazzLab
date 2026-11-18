package org.jjazz.web.engine;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.jjazz.web.engine.platform.beans.PropertyChangeSupport;
import org.jjazz.web.engine.platform.locks.ReentrantReadWriteLock;
import org.jjazz.web.engine.platform.netbeans.Lookup;
import org.jjazz.web.engine.platform.prefs.Preferences;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PlatformSubstitutionTest
{
    @Test
    void resolvesExplicitServicesLazilyAndKeepsTheirIdentity()
    {
        var lookup = new Lookup();
        var constructions = new AtomicInteger();
        lookup.register(CharSequence.class, () -> new StringBuilder("service " + constructions.incrementAndGet()));
        assertNull(lookup.lookup(String.class));
        assertEquals(0, constructions.get());
        var service = lookup.lookup(CharSequence.class);
        assertSame(service, lookup.lookup(CharSequence.class));
        assertEquals(List.of(service), lookup.lookupAll(CharSequence.class));
        assertEquals(1, constructions.get());
    }

    @Test
    void sendsRealPropertyChangesToBothListenerScopes()
    {
        var sender = new Object();
        var support = new PropertyChangeSupport(sender);
        var seen = new ArrayList<String>();
        support.addPropertyChangeListener(event ->
        {
            assertSame(sender, event.getSource());
            seen.add(event.getPropertyName());
        });
        support.addPropertyChangeListener("tempo", event -> seen.add(event.getOldValue() + "->" + event.getNewValue()));
        support.firePropertyChange("tempo", 120, 120);
        support.firePropertyChange("tempo", 120, 90);
        support.firePropertyChange("name", "", "Song");
        assertEquals(List.of("tempo", "120->90", "name"), seen);
    }

    @Test
    void storesPreferencesWithinTheirNode()
    {
        var root = Preferences.userRoot();
        var one = root.node("/web-platform-test/one");
        var two = root.node("/web-platform-test/two");
        one.putInt("tempo", 100);
        assertEquals(100, root.node("/web-platform-test").node("one").getInt("tempo", 60));
        assertEquals(60, two.getInt("tempo", 60));
        one.remove("tempo");
        assertEquals(60, one.getInt("tempo", 60));
    }

    @Test
    void permitsNestedReadsDuringWritesAndRejectsAReadToWriteUpgrade()
    {
        var lock = new ReentrantReadWriteLock();
        var reader = lock.readLock();
        var writer = lock.writeLock();
        reader.lock();
        assertThrows(IllegalStateException.class, writer::lock);
        reader.unlock();
        writer.lock();
        reader.lock();
        writer.lock();
        writer.unlock();
        assertTrue(lock.isWriteLockedByCurrentThread());
        reader.unlock();
        writer.unlock();
        assertFalse(lock.isWriteLockedByCurrentThread());
        assertThrows(IllegalMonitorStateException.class, writer::unlock);
    }
}
