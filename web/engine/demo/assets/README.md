# Public Yamaha style collection

`jjazzlab_user_styles.zip` is an unmodified mirror of the collection linked
from [JJazzLab resources](https://www.jjazzlab.org/en/resources/):

- Source: https://www.jjazzlab.org/pkg/jjazzlab_user_styles.zip
- Size: 2,356,452 bytes
- SHA-256: `8644bc7f7ed0864e573f0760a6509910882a7aef72b32a0fc59ba9e2dc302189`
- Contents: 189 Yamaha style files in ten categories

The official website does not send an Access-Control-Allow-Origin header for
the ZIP. The browser demo therefore fetches this byte-identical mirror through
a pinned GitHub raw URL, only when the user clicks the load button. It retains
the ZIP in memory and inflates selected entries without filesystem writes,
download links or persistent application storage.

The collection retains the original authorship of the contributed styles;
the repository's source-code license does not relicense these third-party files.

186 styles were verified to generate MIDI in the current engine. Three source
files are listed but disabled because of invalid MIDI bytes or an empty CASM
style section: J-PopHit1_TyPrems.S851.STY, JazzBluesSimple.S740.sty and
JazzGtrTrio184 9K.s460.sty. The UI matches both filename and CRC so an upstream
repair is not accidentally disabled.
