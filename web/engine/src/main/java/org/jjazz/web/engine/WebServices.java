package org.jjazz.web.engine;

import org.jjazz.chordleadsheet.item.CLI_FactoryImpl;
import org.jjazz.chordleadsheet.spi.item.CLI_Factory;
import org.jjazz.midi.api.keymap.StdKeyMapProvider;
import org.jjazz.midi.spi.KeyMapProvider;
import org.jjazz.midi.spi.MidiSynthFileReader;
import org.jjazz.midi.spi.MidiSynthManager;
import org.jjazz.midimix.MidiMixManagerImpl;
import org.jjazz.midimix.spi.MidiMixManager;
import org.jjazz.midimix.spi.RhythmVoiceInstrumentProvider;
import org.jjazz.outputsynth.api.CakewalkInsFileReader;
import org.jjazz.outputsynth.spi.OutputSynthManager.DefaultRhythmVoiceInstrumentProviderImpl;
import org.jjazz.phrasetransform.DefaultPhraseTransformProvider;
import org.jjazz.phrasetransform.spi.PhraseTransformProvider;
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
        registry.register(RhythmVoiceInstrumentProvider.class, DefaultRhythmVoiceInstrumentProviderImpl::new);
        registry.register(MidiSynthFileReader.class, CakewalkInsFileReader::new);
        registry.register(MidiSynthManager.class, WebMidiSynthManager::new);
        registry.register(KeyMapProvider.class, StdKeyMapProvider::new);
        registry.register(PhraseTransformProvider.class, DefaultPhraseTransformProvider::new);
        installed = true;
    }
}
