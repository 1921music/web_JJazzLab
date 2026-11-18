# Wasmエンジンの開発

[JJazzLabの `cd1944afd`](https://github.com/jjazzboss/JJazzLab/commit/cd1944afdf8a18b659cdbf63538b6df625a515ec)（5.2.1リリース直後）をベースにしています。Javaの伴奏生成は上流版を使い、Web向けの差し替えとDIはこのモジュールに置いています。

## ビルド

WindowsのリポジトリルートからPowerShell 7で実行します。

```powershell
./scripts/wsl-dev.ps1
./scripts/wsl-build.ps1 -Engine
```

初回のセットアップで専用のWSL 2ディストリビューション `wasm_jjazzlab_dev` にUbuntu 24.04、JDK 25、Mavenを用意します。VHDXはWindows側リポジトリの `WSL_image/wasm_jjazzlab_dev/ext4.vhdx` に置きます。

`-Broad` はモデル、生成、YamJJazzなどのクラスを広く保持して、TeaVMの依存エラーを調べます。デスクトップのMIDI機器、シーケンサー、UIは保持リストから外します。引数なしでは、同じMIDI生成の入口を少数のクラス保持指定で調べます。どちらも調査用ビルドです。`-SyncOnly` はソースの同期だけを実行します。編集とコミットはWindows側で行います。

TeaVMの診断や成果物の生成だけを行う場合は、`-SkipTests` でその実行のJVMテストを省略できます。

同期とビルドは専用WSL内の一時的なLinux cgroupで、CPU 6個・メモリ12 GiBを上限として実行します。WSL 2のディストリビューションごとのcgroup分離が必要です。

## ブラウザから呼び出す

`-Engine` で生成される Windows 側の `WSL_image/midi-demo.html` を、WasmGC に対応したブラウザで開きます。HTML単体で動作し、`file://` で開いてコード進行を入力するとMIDIをダウンロードできます。スタイルは同梱の8Beatか、選択したYamahaスタイルファイルを使います。

検証ページのソースは [`demo/`](demo/) にあります。ビルド時にPython 3でWasmをgzip圧縮してBase64に変換し、ローダー、画面のコード、サンプルスタイルとともにHTMLへ埋め込みます。

別の画面から使う場合、WSLの作業コピー（`/home/jjazzdev/src/web_jjazzlab`）内の `web/engine/target/wasm-diagnostics/` にある `engine.wasm` と `engine.wasm-runtime.js` をHTTPで配信し、先にローダーを読み込みます。下の `styleFile` はブラウザで選んだ生のスタイルファイルです。

```javascript
const { exports } = await TeaVM.wasmGC.load("./engine.wasm");
const midi = exports.generateMidi(new Int8Array(await styleFile.arrayBuffer()),
                                  styleFile.name, ["C", "Am7", "Dm7", "G7"], 120);
```

エンジンは生のYamahaスタイルからGMの標準MIDIファイルを生成します。初期の呼び出し口は1小節につき1コードを受け取り、テンポに `0` を指定するとスタイルの既定値を使います。

## 診断と上流の追跡

`./scripts/wsl-build.ps1 -StyleIO` は、生のスタイルから標準MIDIのイベントとCASMを読む部分をWasmGCにコンパイルします。WSLの作業コピー内の `web/engine/target/wasm-diagnostics/` にWasmとローダーが出力されます。調査用の `countStyleNotes` と `countStyleParts` は、スタイルのバイト列を `Int8Array` で受け取り、Note OnとCASMのスタイルパートを数えます。

診断で見つかった依存は、まず `web/engine` 内のTeaVM `SubstitutionPolicy` や既存SPIへのDIで対応します。上流のJavaソースを変更するのは、差し替えによる対応が難しい場合に限ります。

Web側のサービスは `WebServices` に明示登録します。プロパティ変更通知は同期で配信し、設定はエンジン内のメモリに保持します。

`rewriteAsMidi` はJava MIDIのファイル入出力をTeaVM側で差し替え、スタイル内の元のMIDIトラックを標準MIDIに書き出す診断用の入口です。MIDI機器や音源のAPIはこの差し替えの対象外です。

上流の変更を確認するときは、Windows側のクローンで実行します。

```powershell
git remote add upstream https://github.com/jjazzboss/JJazzLab.git  # 初回のみ
git fetch upstream
git log --oneline HEAD..upstream/master
```

開発環境を破棄する場合は `./scripts/wsl-dev.ps1 -Remove -WhatIf` で対象を確認し、`-Remove` を指定します。WSLの登録解除とともにVHDX内の作業コピー、ツール、キャッシュが削除されます。
