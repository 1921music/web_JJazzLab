package org.jjazz.web.engine;

import org.jjazz.chordleadsheet.item.CLI_FactoryImpl;
import org.jjazz.chordleadsheet.spi.item.CLI_Factory;
import org.jjazz.midi.spi.MidiSynthFileReader;
import org.jjazz.midimix.MidiMixManagerImpl;
import org.jjazz.midimix.spi.MidiMixManager;
import org.jjazz.outputsynth.api.CakewalkInsFileReader;
import org.jjazz.song.SongContextFactoryImpl;
import org.jjazz.song.SongFactoryImpl;
import org.jjazz.song.spi.SongContextFactory;
import org.jjazz.song.spi.SongFactory;
import org.jjazz.web.engine.platform.netbeans.Lookup;

final class WebServices
{
    private static boolean installed;

    private WebServices()
    {
    }

    static void install()
    {
        if (installed)
        {
            return;
        }
        var registry = Lookup.getDefault();
        registry.register(SongFactory.class, SongFactoryImpl::new);
        registry.register(SongContextFactory.class, SongContextFactoryImpl::new);
        registry.register(CLI_Factory.class, CLI_FactoryImpl::new);
        registry.register(MidiMixManager.class, MidiMixManagerImpl::new);
        registry.register(MidiSynthFileReader.class, CakewalkInsFileReader::new);
        installed = true;
    }
}
