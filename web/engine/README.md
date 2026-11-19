# Wasmエンジンの開発

[JJazzLabの `cd1944afd`](https://github.com/jjazzboss/JJazzLab/commit/cd1944afdf8a18b659cdbf63538b6df625a515ec)（5.2.1リリース直後）をベースにしています。Javaの伴奏生成は上流版を使い、Web向けの差し替えとDIはこのモジュールに置いています。

jjSwingには、選択済みのベースリズムを受け取る `JJSwingRhythm.fromBaseRhythm` を追加しています。既存の初期化はカタログ・一時ファイル展開・スレッド実行と結び付いており、Web用のSPIがないため、この入口だけを上流クラスに追加しました。デスクトップの遅延初期化と伴奏生成アルゴリズムは維持しています。

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

`-Engine` で生成される Windows 側の `WSL_image/midi-demo.html` を、PC版ChromeまたはEdgeで開きます。HTML単体を `file://` で開いてコード進行を入力すると、MIDIの生成・ダウンロードとSoundFontによるリアルタイム再生ができます。リズムエンジンで「Yamahaスタイル」または「jjSwing」を選びます。Yamahaスタイルは同梱の8Beatか、選択したスタイルファイルを使います。

jjSwingは4/4専用で、未指定テンポは120です。ベースはWalking／2-feel／Double-note／Double-time、ドラムはBrushes・Hi-hat・Ride・Shuffle等の11奏法から選べます。Double-timeは両方を揃えると自然です。基本バリエーションはMain A-1固定で、Intro／Ending・他のMainバリエーションは現在の画面では扱いません。ベース／ドラムのMIDIフレーズDBとベーススタイルはWasmへ同梱するので、SF2以外の追加ダウンロードはありません。

音源のTinySoundFont WasmとAudioWorkletのコードもHTMLへ埋め込みます。初回の再生操作でのみ、固定リビジョンのTimGM6mb.sf2（約6MB）をHTTPSで取得します。初回はネット接続が必要です。取得失敗後は再生ボタンで再試行できます。SF2はページ内で再利用し、ページを閉じた後の永続キャッシュは実装していません。配信元のCORS許可が必要です。ビルド環境にEmscriptenがない場合は `scripts/wsl-dev.ps1` を再実行してください。

再生画面では曲全体のループを既定とし、開始・終了小節（終了を含む）を変更できます。演奏中の変更は現在のループ終了位置で適用し、ループを解除した場合はその先を曲末まで演奏します。ループを無効にしている間の範囲変更は曲末で適用します。折り返しでは音源状態を復元し、境界をまたぐノートは切ります。短いフェードでクリック音を抑えます。

ミキサーにはパート別Mute/Solo・音量（0〜150%）・panとマスター音量があります。音量は曲のMIDI音量に乗算し、panは曲の定位に加えてステレオ音声を調整します。Muteは発音中の音も止め、解除後は次のNote Onから参加します。停止・再生成時も同じIDのパートの設定とマスター音量を保持し、リセット操作で初期値に戻せます。設定はページを開き直すと初期値に戻ります。

演奏中にコード・スタイル・テンポを編集しても演奏は継続します。「伴奏を生成」で停止して新しいMIDIを生成し、次の再生は先頭（ループ有効なら指定範囲の先頭）から始まります。再生成後のループ範囲は曲全体です。

検証ページのソースは [`demo/`](demo/) にあります。ビルド時にPython 3でWasmをgzip圧縮してBase64に変換し、ローダー、画面のコード、サンプルスタイルとともにHTMLへ埋め込みます。

別の画面から使う場合、WSLの作業コピー（`/home/jjazzdev/src/web_jjazzlab`）内の `web/engine/target/wasm-diagnostics/` にある `engine.wasm` と `engine.wasm-runtime.js` をHTTPで配信し、先にローダーを読み込みます。下の `styleFile` はブラウザで選んだ生のスタイルファイルです。

```javascript
const { exports } = await TeaVM.wasmGC.load("./engine.wasm");
const midi = exports.generateMidi(new Int8Array(await styleFile.arrayBuffer()),
                                  styleFile.name, ["C", "Am7", "Dm7", "G7"], 120);
// jjSwing uses its own generators, without an uploaded style file.
const swing = exports.generateSwingMidi(["Cmaj7", "Am7", "Dm7", "G7"], 120,
                                       "walking", "brushes 1");
```

エンジンは生のYamahaスタイルからGM音色の標準MIDIファイルを生成します。`generateMidi` の戻り値はスタイル由来のパート別チャンネルを保持しており、ブラウザ再生にはそのまま使用します。初期の呼び出し口は1小節につき1コードを受け取り、テンポに `0` を指定するとスタイルの既定値を使います。

デモのダウンロード用MIDIだけは `exportGmMidi(midi, partMetadata)` で変換し、打楽器のノートをGMのch10へまとめます。トラック自体はパート別に残し、メロディーパートのチャンネルと音色、ノートの時刻・ベロシティ、テンポ、拍子、SysExは維持します。打楽器のチャンネル共通設定（音量・pan・音色等）は、元からch10にある主ドラムパートを優先し、該当パートがなければ最初の打楽器パートを使います。他の打楽器パートの設定は書き出さず、共有チャンネル上の上書きを避けます。このため、書き出したMIDIで打楽器パートごとの音量・panを独立して再現することはできません。ブラウザのミキサー設定もMIDIには焼き込みません。

`exports.getPartMetadata()` は直前に生成したMIDIのトラック番号順で、`"drums\tパート名"` または `"melodic\tパート名"` を返します。メタ情報用トラックは `null` です。チャンネル10以外の打楽器パートも、この情報で識別できます。音源・ビルド・検証の詳細は [`../audio/README.md`](../audio/README.md) を参照してください。

## 診断と上流の追跡

jjSwingの音色はTimGM6mb向けにAcoustic Bass／Piano／Jazz Guitar／Brushキットを明示設定します。元のXG打楽器配置ではノート25・26が未収録、27〜34の一部が効果音になるため、Web版jjSwingの生成結果だけにノート変換を適用します。対応表・近似の制限・検証手順は [`../audio/JJSWING-COMPATIBILITY.md`](../audio/JJSWING-COMPATIBILITY.md) を参照してください。Yamahaスタイルのノートは変換しません。

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
