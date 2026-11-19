
# JJazzLab

## Web MIDI engine

This fork adds an experimental browser engine for [JJazzLab](https://github.com/jjazzboss/JJazzLab). It uses TeaVM 0.16.0 to compile the accompaniment generator to WebAssembly GC. The port starts from JJazzLab [`cd1944afd`](https://github.com/jjazzboss/JJazzLab/commit/cd1944afdf8a18b659cdbf63538b6df625a515ec), a commit after the 5.2.1 release.

- Generate an accompaniment from a raw Yamaha style (`.sty`, `.sst`, or `.prs`) or the built-in jjSwing engine with its dedicated walking-bass and drums generators. The current API takes one chord per bar.
- The Web module in [`web/engine`](web/engine) supplies browser-compatible services and TeaVM substitutions for desktop dependencies. jjSwing has a small dependency-injection factory for standalone initialization; its music-generation algorithms are preserved.
- A standalone HTML demo lets you edit chords, play with TinySoundFont and TimGM6mb, loop bars, mix parts and download MIDI. It includes 8Beat and jjSwing; jjSwing exposes bass/drums playing styles and adapts XG drum articulations to available TimGM6mb sounds.

From the repository root on Windows, run the following commands in PowerShell 7 with WSL 2 available.

```powershell
./scripts/wsl-dev.ps1
./scripts/wsl-build.ps1 -Engine
```

The setup script provisions a dedicated Ubuntu 24.04 distribution with JDK 25, Maven, and Python 3. Edit and commit in the Windows checkout. The build script syncs the source to WSL and writes `engine.wasm` and `engine.wasm-runtime.js` to `web/engine/target/wasm-diagnostics/` inside the WSL checkout. Open the generated `WSL_image/midi-demo.html` in a browser with WasmGC support. The demo embeds the compressed engine and works from `file://`.

See the [build and API guide](web/engine/README.md) and the [design notes](docs/wasm-engine-design.md) for details in Japanese. See [LICENSE](LICENSE) for the upstream license text.

## JJazzLab desktop application

JJazzLab is a complete and open application dedicated to backing tracks generation. You type in chord symbols, select a rhythm (music style), then the application generates a complete backing track with drums, bass, guitar, piano, strings, etc. 

The objective is to generate **interesting backing tracks**, i.e tracks which are: 
- realistic
- non-boring (with variations and dynamics)
- easily customizable, even for complex songs

*The JJazzLab UI (available in several languages thanks to the JJazzLab community):* 
![JJazzLab screenshot](https://github.com/jjazzboss/JJazzLab/blob/master/graphics/JJazzLabFullScreen.png)

JJazzLab embeds its own customized software synth based on [FluidSynth](https://www.fluidsynth.org/). For even better sounds, just connect JJazzLab to VST plugins via a virtual Midi cable and a VST host.

## Community

JJazzLab has 35.000+ users from 90+ countries. It’s a jam buddy to have fun practicing at home or learn new stuff. It’s also a great tool for teaching or early-stage composing.

## Videos

Check out the demos of the [JJazzLab YouTube channel](https://www.youtube.com/channel/UC0L3SwjY6bhTj6jsbOYzzAw).

## An open architecture

JJazzLab is based on the [Apache Netbeans Platform](https://netbeans.apache.org/front/main/index.html) which provides a reliable and extensible application architecture via plugins.

Developers can easily add music generation capabilities or try new ideas, without taking care of all the "plumbing".

## JJazzLab Toolkit for developers

The [JJazzLab Toolkit](https://github.com/jjazzboss/JJazzLabToolkit)  is a single standalone jar (all dependencies included) which contains the JJazzLab core (no GUI).

It makes it easy to experiment with JJazzLab models and algorithms, or create your own plugins.

## Download 

Visit **[www.jjazzlab.org](https://www.jjazzlab.org)** for ready-to-use installers for Win, Linux and Mac.

## License

Lesser GPL v2 (LGPL v2.1)

## Documentation

[https://jjazzlab.gitbook.io/user-guide/](https://jjazzlab.gitbook.io/user-guide)

[https://jjazzlab.gitbook.io/developer-guide/](https://jjazzlab.gitbook.io/developer-guide/)

## Contact

For more information use the Contact page at [www.jjazzlab.org](https://www.jjazzlab.org)

