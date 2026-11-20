# JJazzLab Web

English · [日本語](README-ja.md)

**[Open JJazzLab Web on GitHub Pages](https://1921music.github.io/web_JJazzLab/)**

JJazzLab Web is a fork of JJazzLab that generates accompaniment from a chord chart so you can practice in your browser. Create a song in the web app or import a song from the Java desktop app, edit it, and export it back to the desktop app.

See the source link at the bottom of the web app or the [deployment metadata](https://1921music.github.io/web_JJazzLab/deployment.json) to find the currently deployed commit.

## Getting started

1. Open the app in desktop Chrome or Edge. Double-click a bar in the chord chart to edit it. For example, `Cmaj7 3:G7` places Cmaj7 on beat one and G7 on beat three.
2. To open a song from the desktop app, choose **File → Open song…** and select its `.sng` file. To import the mix, select the matching `.mix` file with the same base name at the same time.
3. Press **Play** to generate the accompaniment and start playback. Select bars or song parts to loop, adjust track levels in the mixer, or add and edit user-track notes in the piano roll.
4. Choose **Save Web project** to save a `.jjazzweb` file. To take the song back to the desktop app, choose **Export JJazzLab files**, extract the ZIP, and open the `.sng` with the matching `.mix` in the same folder. If the ZIP includes styles, add them to the desktop app as needed. You can also export General MIDI, WAV, or MP3.

### Install as a PWA

Open the hosted PWA in Chrome or Edge and use the install control in the address bar or **Window → Install App…**. The installed app opens in its own window. Serve the PWA over HTTPS or use localhost for development.

The default TimGM6mb SoundFont (about 6 MB) downloads the first time you play. The PWA stores the app and the downloaded SoundFont in the browser for offline startup and playback. Loading the public style collection requires an internet connection.

### Download the standalone HTML

The standalone build is distributed through [GitHub Releases](https://github.com/1921music/web_JJazzLab/releases). When the file is available, download `midi-demo.html` from the release's **Assets** and open it directly in Chrome or Edge. It runs from `file://` without a web server.

The standalone HTML for this build is **2,074,794 bytes (about 2.07 MB)**. It contains the accompaniment engine and the synthesizer code. The default SoundFont downloads at playback time, so the first download requires an internet connection. You can also choose a compatible local `.sf2` file.

## Differences from the Java desktop app

| Area | Web app behavior |
| --- | --- |
| Songs and styles | Playback follows the time signature, rhythm, and variation for each song part in the `.sng` file. The web app supports standard Yamaha styles, YamJJazz, and jjSwing. A custom `.yjz` needs a matching base style with the same name. If a rhythm is unavailable, playback uses a substitute and the JJazzLab-format export retains the original rhythm reference. |
| Sound and mixing | The web app uses TinySoundFont and TimGM6mb. Instrument sounds, percussion such as brushes, reverb, and chorus differ from the desktop app's FluidSynth setup. Use `.mix` to export mixer settings. GM MIDI export groups percussion on channel 10. Use WAV or MP3 to capture the rendered mix, or `.mix` to retain per-track level and pan settings. |
| MIDI devices | Grant Web MIDI permission in a compatible browser for external output, MIDI Learn, MIDI Thru, and keyboard-driven accompaniment. Java plugins, FluidSynth-specific presets, and OS audio driver selection are desktop features. |
| Local storage and recovery | The browser processes the songs and styles you select. Settings and recent songs are stored separately for each device, browser profile, and site origin. Export your songs before clearing site data or moving to another device. Opening from a folder requires browser support and permission to access it. |

See the [desktop and web feature checklist](docs/desktop-web-feature-checklist.md) for coverage and test results. Include the build ID from **Help → Version and Diagnostics** when reporting an issue.

## Upstream and implementation

The fork is based on [JJazzLab 5.2.1](https://github.com/jjazzboss/JJazzLab/releases/tag/5.2.1). The upstream tag `5.2.1` points to the base commit [`cd1944afdf8a18b659cdbf63538b6df625a515ec`](https://github.com/jjazzboss/JJazzLab/commit/cd1944afdf8a18b659cdbf63538b6df625a515ec).

- The web app reuses the Java song model and accompaniment generator, compiled to WebAssembly GC with TeaVM 0.16.0. Browser-specific services handle desktop dependencies. HTML, CSS, and JavaScript implement the chord chart, mixer, and other screens. [Engine development guide (Japanese)](web/engine/README.md)
- Emscripten builds TinySoundFont to WebAssembly for playback through AudioWorklet. The app downloads TimGM6mb from a pinned revision. You can also choose a compatible local GM SoundFont (`.sf2`, up to 16 MB). [Audio implementation and testing](web/audio/README.md)

## Build and publish

Run these commands from the repository root on Windows using PowerShell 7. The first command sets up the WSL 2 development environment.

```powershell
./scripts/wsl-dev.ps1
./scripts/wsl-build.ps1 -Engine
node scripts/publish-pages.mjs WSL_image/pwa
```

The build produces `WSL_image/pwa/` for GitHub Pages and `WSL_image/midi-demo.html` for GitHub Releases. The Node.js command above is a dry run. To publish, push the reviewed source commit to `origin`, then run the same command with `--publish`. GitHub Pages serves the files from the root of the `gh-pages` branch. See the [publishing guide (Japanese)](web/engine/README.md#github-pagesへの公開) for testing and deployment checks.

## Licenses and credits

JJazzLab and the parts of this repository inherited from upstream are licensed under the [LGPL 2.1](LICENSE). [TinySoundFont](web/audio/vendor/LICENSE) is MIT licensed and [TimGM6mb](web/audio/vendor/TimGM6mb-LICENSE.txt) is GPL-2.0-only. See the [public Yamaha style collection credits](web/engine/demo/assets/README.md) for its source and checksum, and the [upstream user guide](https://jjazzlab.gitbook.io/user-guide/) for desktop app instructions.
