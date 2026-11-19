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


def encode_gzip(data):
    return base64.b64encode(gzip.compress(data, compresslevel=9, mtime=0)).decode("ascii")


def inline_script(source):
    # Prevent raw-text closing tags in JavaScript from terminating the HTML element.
    return "<script>\n" + re.sub(r"</script", r"<\\/script", source, flags=re.IGNORECASE) + "\n</script>"


def package(engine_dir, output):
    template = (DEMO / "index.html").read_text(encoding="utf-8")
    stylesheet = (DEMO / "demo.css").read_text(encoding="utf-8")
    runtime = (engine_dir / "engine.wasm-runtime.js").read_text(encoding="utf-8")
    demo = (DEMO / "demo.js").read_text(encoding="utf-8")
    wasm = encode_gzip((engine_dir / "engine.wasm").read_bytes())
    synth = encode_gzip((DEMO.parents[1] / "audio/target/synth.wasm").read_bytes())
    worklet = (DEMO / "synth-worklet.js").read_text(encoding="utf-8")
    player = (DEMO / "player.js").read_text(encoding="utf-8")
    midi = (DEMO / "midi.js").read_text(encoding="utf-8")
    archive = (DEMO / "style-archive.js").read_text(encoding="utf-8")
    with ZipFile(STYLE_ARCHIVE) as styles:
        style = encode_gzip(styles.read("8Beat.T160.STY"))
    data = f'const embeddedWasm = "{wasm}";\nconst embeddedStyle = "{style}";'
    data += f'\nconst embeddedSynth = "{synth}";\nconst embeddedWorklet = {json.dumps(worklet)};'
    licenses = "\n\n".join((DEMO.parents[1] / path).read_text(encoding="utf-8") for path in
                           ["audio/vendor/LICENSE", "audio/vendor/TimGM6mb-LICENSE.txt", "audio/vendor/GPL-2.0.txt"])
    html = template.replace("<!-- DEMO_STYLE -->", f"<style>\n{stylesheet}</style>").replace(
        "<!-- DEMO_SCRIPTS -->", inline_script(runtime) + "\n" + inline_script(data + "\n" + midi + "\n" + archive + "\n" + player + "\n" + demo)
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
