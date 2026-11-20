package org.jjazz.web.engine;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Future;
import org.jjazz.rhythm.spi.StubRhythmProvider;
import org.jjazz.rhythmdatabase.api.DefaultRhythmDatabaseImpl;
import org.jjazz.rhythmdatabase.api.RhythmDatabase;
import org.jjazz.rhythmdatabase.spi.SharedRdbInstanceProvider;
import org.jjazz.utilities.api.MultipleErrorsReport;
import org.openide.util.NbPreferences;

/** Supplies the desktop importers with rhythms for their intermediate song model. */
final class WebImportRhythmDatabase implements SharedRdbInstanceProvider
{
    private final RhythmDatabase database;

    WebImportRhythmDatabase()
    {
        var provider = StubRhythmProvider.getDefault();
        var data = new DefaultRhythmDatabaseImpl(NbPreferences.forModule(WebImportRhythmDatabase.class));
        for (var rhythm : provider.getBuiltinRhythms(new MultipleErrorsReport()))
        {
            data.addRhythmInstance(provider, rhythm);
        }
        database = data;
    }

    @Override public Future<?> initialize() { return CompletableFuture.completedFuture(database); }
    @Override public boolean isInitialized() { return true; }
    @Override public RhythmDatabase get() { return database; }
    @Override public void markForStartupRefresh(boolean refresh) {}
    @Override public boolean isMarkedForStartupRefresh() { return false; }
}
