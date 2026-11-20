"""Package the built engine and a bundled style into an offline HTML demo."""

import base64
import gzip
import html as html_lib
import json
import re
import sys
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZipFile


DEMO = Path(__file__).resolve().parent
STYLE_ARCHIVE = (
    DEMO.parents[2] / "plugins/YamJJazz/src/main/resources"
    / "org/jjazz/yamjjazz/rhythm/api/resources/YamahaDefaultFiles.zip"
)
DESKTOP_SOUNDFONT_INS = (
    DEMO.parents[2] / "plugins/FluidSynthEmbeddedSynth/src/main/resources"
    / "org/jjazz/fluidsynthembeddedsynth/api/resources/JJazzLabSoundFont_FluidSynth.ins"
)
DESKTOP_TRANSPORT = (
    DEMO.parents[2] / "app/MusicControlActions/src/main/resources"
    / "org/jjazz/musiccontrolactions/resources"
)
DESKTOP_OPEN = (
    DEMO.parents[2] / "app/SongEditorManager/src/main/resources"
    / "org/jjazz/songeditormanager/resources/OpenFile24.png"
)
DESKTOP_MIXER = DEMO.parents[2] / "app/MixConsole/src/main/resources/org/jjazz/mixconsole/resources"
DESKTOP_PIANO = DEMO.parents[2] / "app/PianoRoll/src/main/resources/org/jjazz/pianoroll"
DESKTOP_CHORD_PROGRESSIONS = (DEMO.parents[2] / "app/CL_EditorImpl/src/main/resources/org/jjazz/cl_editorimpl"
                              / "actions/resources/ChordProgressions.txt")


def encode_gzip(data):
    return base64.b64encode(gzip.compress(data, compresslevel=9, mtime=0)).decode("ascii")


def inline_script(source):
    # Prevent raw-text closing tags in JavaScript from terminating the HTML element.
    return "<script>\n" + re.sub(r"</script", r"<\\/script", source, flags=re.IGNORECASE) + "\n</script>"


def desktop_mixer_patches():
    banks = {"GM Bank": {}, "Drums": {}}
    bank = None
    for line in DESKTOP_SOUNDFONT_INS.read_text(encoding="utf-8").splitlines():
        section = re.fullmatch(r"\[(.+)\]", line.strip())
        if section:
            bank = section[1]
            continue
        patch = re.match(r"^(\d+)\s*=\s*(.+?)\s*\{\{", line)
        if bank in banks and patch:
            program, name = patch.groups()
            banks[bank][int(program)] = {"patch": name, "id": f"FluidSynth#:#NOT_SET#_#{bank}#_#{name}"}
    if set(banks["GM Bank"]) != set(range(128)) or not {0, 32, 40} <= banks["Drums"].keys():
        raise ValueError("Incomplete desktop SoundFont patch list")
    return banks


def desktop_icon_styles():
    icons = {
        "previous": ("PreviousSongpart-24x24.png",),
        "stop": ("StopButton-24x24.png", "StopButtonOn-24x24.png"),
        "play": ("PlayButton-24x24.png", "PlayButtonOn-24x24.png"),
        "pause": ("PauseButton-24x24.png", "PauseButtonOn-24x24.png"),
        "next": ("NextSongpart-24x24.png",),
        "loop": ("Loop-OFF-24x24.png", "Loop-ON-24x24.png"),
        "point": ("PlaybackPointOFF-24x24.png", "PlaybackPointON-24x24.png"),
        "click": ("Click-OFF-24x24.png", "Click-ON-24x24.png"),
        "precount": ("precount2-OFF-24x24.png", "precount2-ON-24x24.png"),
        "open": (DESKTOP_OPEN,),
        "mute": (DESKTOP_MIXER / "MuteOff_Icon-21x21.png", DESKTOP_MIXER / "MuteOn_Icon-21x21.png"),
        "solo": (DESKTOP_MIXER / "SoloOff_Icon-21x21.png", DESKTOP_MIXER / "SoloOn_Icon-21x21.png"),
        "channel-settings": (DESKTOP_MIXER / "Settings11x11.png",),
        "roll-select": tuple(DESKTOP_PIANO / "edittools/resources" / f"Selection{state}.png" for state in ("OFF", "ON")),
        "roll-draw": tuple(DESKTOP_PIANO / "edittools/resources" / f"Pencil{state}.png" for state in ("OFF", "ON")),
        "roll-erase": tuple(DESKTOP_PIANO / "edittools/resources" / f"Eraser{state}.png" for state in ("OFF", "ON")),
        "roll-snap": tuple(DESKTOP_PIANO / "actions/resources" / f"Snap{state}.png" for state in ("OFF", "ON")),
        "roll-play": (DESKTOP_PIANO / "actions/resources/PlayEditor-OFF.png",),
    }
    for family in ("User", "Drums", "Bass", "Guitar", "Keyboard", "HornSection", "Strings", "Notes"):
        icons[f"track-{family.lower()}"] = (DESKTOP_MIXER / f"{family}-48x48.png",)
    rules = []
    for icon, images in icons.items():
        for index, image in enumerate(images):
            encoded = base64.b64encode((DESKTOP_TRANSPORT / image).read_bytes()).decode("ascii")
            pressed = '[aria-pressed="true"]' if index else ""
            rules.append(f'[data-icon="{icon}"]{pressed} {{ background-image: url(data:image/png;base64,{encoded}); }}')
    return "\n".join(rules)


def package(engine_dir, output):
    template = (DEMO / "index.html").read_text(encoding="utf-8")
    stylesheet = (DEMO / "demo.css").read_text(encoding="utf-8") + "\n" + desktop_icon_styles()
    locale = (DEMO / "locale.js").read_text(encoding="utf-8")
    runtime = (engine_dir / "engine.wasm-runtime.js").read_text(encoding="utf-8")
    demo = (DEMO / "demo.js").read_text(encoding="utf-8")
    wasm = encode_gzip((engine_dir / "engine.wasm").read_bytes())
    synth = encode_gzip((DEMO.parents[1] / "audio/target/synth.wasm").read_bytes())
    worklet = (DEMO / "synth-worklet.js").read_text(encoding="utf-8")
    player = (DEMO / "player.js").read_text(encoding="utf-8")
    audio_export = (DEMO / "audio-export.js").read_text(encoding="utf-8")
    midi = (DEMO / "midi.js").read_text(encoding="utf-8")
    song_files = (DEMO / "song-files.js").read_text(encoding="utf-8")
    song_editor = (DEMO / "song-editor.js").read_text(encoding="utf-8")
    song_print = (DEMO / "song-print.js").read_text(encoding="utf-8")
    song_folder = (DEMO / "song-folder.js").read_text(encoding="utf-8")
    song_history = (DEMO / "song-history.js").read_text(encoding="utf-8")
    song_tabs = (DEMO / "song-tabs.js").read_text(encoding="utf-8")
    piano_roll = (DEMO / "piano-roll.js").read_text(encoding="utf-8")
    archive = (DEMO / "style-archive.js").read_text(encoding="utf-8")
    rhythm_library = (DEMO / "rhythm-library.js").read_text(encoding="utf-8")
    with ZipFile(STYLE_ARCHIVE) as styles:
        style = encode_gzip(styles.read("8Beat.T160.STY"))
        jazz_waltz = encode_gzip(styles.read("JazzWaltzMed.S351.sst"))
        disco_house = encode_gzip(styles.read("DiscoHouse.S145.prs"))
    with ZipFile(STYLE_ARCHIVE.with_name("YamJJazzDefaultFiles.zip")) as source:
        names = set(source.namelist())
        extended_styles = {}
        for name in sorted(names):
            if not name.endswith(".yjz"):
                continue
            base = next(name[:-3] + ext for ext in ("sty", "prs", "bcs", "sst") if name[:-3] + ext in names)
            extended_styles[name] = {"baseName": base, "base": encode_gzip(source.read(base)), "extension": encode_gzip(source.read(name))}
    data = f'const embeddedWasm = "{wasm}";\nconst embeddedStyle = "{style}";'
    data += f'\nconst embeddedJazzWaltz = "{jazz_waltz}";'
    data += f'\nconst embeddedDiscoHouse = "{disco_house}";'
    data += f'\nconst embeddedExtendedStyles = {json.dumps(extended_styles)};'
    data += f'\nconst embeddedDesktopMixerPatches = {json.dumps(desktop_mixer_patches())};'
    data += f'\nconst embeddedChordProgressions = {json.dumps(DESKTOP_CHORD_PROGRESSIONS.read_text(encoding="utf-8"))};'
    data += f'\nconst embeddedSynth = "{synth}";\nconst embeddedWorklet = {json.dumps(worklet)};'
    licenses = "\n\n".join((DEMO.parents[1] / path).read_text(encoding="utf-8") for path in
                           ["audio/vendor/LICENSE", "audio/vendor/TimGM6mb-LICENSE.txt", "audio/vendor/GPL-2.0.txt",
                            "../core/EmbeddedSynth/src/main/java/org/jjazz/embeddedsynth/lame/LICENSE"])
    html = template.replace("<!-- DEMO_STYLE -->", f"<style>\n{stylesheet}</style>").replace(
        "<!-- DEMO_SCRIPTS -->", inline_script(runtime) + "\n" + inline_script("\n".join([data, locale, midi, song_files, archive, rhythm_library, player, audio_export, song_editor, song_print, song_folder, song_history, song_tabs, piano_roll, demo]))
    ).replace("<!-- AUDIO_LICENSES -->", "<pre>" + html_lib.escape(licenses) + "</pre>")
    output.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, delete=False) as staged:
        temporary = Path(staged.name)
        try:
            staged.write(html)
            staged.close()
            temporary.replace(output)
        finally:
            temporary.unlink(missing_ok=True)
    print(f"Packaged {output}")


if __name__ == "__main__":
    package(Path(sys.argv[1]), Path(sys.argv[2]))
