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

起動時にコード譜を開きます。再生ボタンを押すと、必要な伴奏を準備して再生します。上部のツールバーには停止・一時停止・前後の演奏区間・ループ・クリック音・2小節のカウントインがあります。画面の言語は初回にブラウザ設定から決まり、ツールメニューで日本語と英語を切り替えられます。

小節をダブルクリックするか、選択して Enter またはコードの頭文字を押すと編集できます。たとえば `Cmaj7 3:G7` で、小節の先頭に Cmaj7、3拍目に G7 を置きます。Shift＋クリックでループ範囲を選びます。右クリックメニューから小節、コード、セクション、小節メモを編集でき、ループの折り返し小節も指定できます。曲構成には区間ごとのリズムとパラメーターが縦に並びます。区間をドラッグして並べ替えるか、譜面のセクションを曲構成へドラッグして挿入できます。

コードをダブルクリックすると、アクセント、Hold／Shot、スケール、代替コードと条件も設定できます。取り込んだ曲の発音指定はWebの伴奏に適用されます。代替コード欄の `NC` は、その条件でコードを省略する本家の設定に対応します。区間を条件に使う場合は、曲構成でマーカーを指定します。

ツールメニューの「練習ビュー」では現在と次のコード、小節メモが大きく表示されます。メモに `# 歌詞` の行が複数ある場合は、同じセクションを演奏するたびに行を切り替えます。「選択小節から練習曲を作成」では、開始・終了テンポと段階数を指定して、選んだ譜面を段階的なテンポで繰り返す別の `.jjazzweb` を保存できます。

Mix Consoleの「＋」でユーザートラックを追加します。既存のトラックはコード譜の「ピアノロール」か、ミキサーのトラックプレビューから開けます。描画ツールで追加し、選択ツールでドラッグして移動するか、音符の右端をドラッグして長さを変更します。ベロシティはツールバーと下のレーンで調整できます。音符編集は次の再生で反映され、Web用保存と本家向けの `.sng` の両方に含まれます。

「曲を開く」では、本家の `.sng`（曲の保存形式 v4）と、必要に応じて同名の `.mix`（v5）をまとめて選択します。読み込んだ曲は「曲ファイルの指定どおり」が既定です。標準Yamahaスタイル・YamJJazzの `.yjz`・jjSwingを区間ごとに切り替え、Yamaha／YamJJazzの拍子変換と組み合わせて演奏・ループできます。指定スタイルが見つからない場合は演奏時に代替し、保存時は元のスタイル、バリエーション、取り込んだミックスを保持します。代替スタイルのミックス調整はそのセッションの再生に使います。ユーザートラックの音符は曲頭からの拍位置を保持します。

本家に同梱されている5組の `.yjz` は、「同梱のYamJJazzスタイル」から選べます。これらを参照する `.sng` は対応するペアを自動で読み込みます。手持ちの `.yjz` を使う場合は、名前が同じ元スタイル（`.sty`／`.prs`／`.bcs`／`.sst`）と一緒に選んでください。Web用の保存ファイルと本家向けZIPの両方に、取り込んだペアを収録します。簡易入力では、初回の生成後にその `.yjz` が提供するバリエーションを選べます。

曲ファイルのバリエーションは演奏区間ごとに読み込まれ、「演奏順」で編集できます。4/4の曲でjjSwingを選ぶと、たとえば `Main B-1` はそのまま使い、jjSwingにない `Intro C-1` は `Intro A-1` に置き換えます。元の曲で複数の4/4スタイルを使っていても、曲全体をjjSwingで演奏できます。3/4の曲でjjSwingを選ぶか、曲と拍子が合わないスタイルを指定すると、同じ拍子の同梱スタイルで演奏します。3/4の代替スタイルは `JazzWaltzMed.S351.sst` です。

「Web用に保存」は `.jjazzweb` を保存します。「JJazzLab形式で書き出す」は、生成後に同名の `.sng` と `.mix` を入れたZIPを作ります。解凍後、必要に応じて同梱のスタイルを登録し、JJazzLab 5.2.1 で `.sng` を開きます。ブラウザでは音色を内蔵音源に合わせて再生します。指定された専用音色、リバーブ、コーラスの設定は、適用されたミックスから書き出すファイルにも引き継がれます。

曲エディターのChrome検証は、ビルド後に PowerShell で `$env:JJAZZ_SMOKE_SUITE = 'song-editor'` を指定して `node web/audio/test/browser-smoke.cjs WSL_image/midi-demo.html` を実行します。
公式Pop曲集から展開した `africa.sng` のパスを環境変数 `JJAZZ_AFRICA_FIXTURE` に指定すると、4/4と2/4の切り替え、および11〜13小節のループも確認します。
`JJAZZ_MULTI_STYLE_FIXTURES` に [jjazz-repertoire](https://github.com/CapoShiva/jjazz-repertoire) の `Repertoire` フォルダーを指定すると、`ANightinTunisia-Eb-Theme`、`Django-Fm-Theme`、`PetiteFleur-Dm-Theme2-Tango` の `.sng`／`.mix` を使い、スタイル・拍子の切り替えとループ、および本家形式の書き出しを確認します。

YamJJazz専用の検証は `JJAZZ_SMOKE_SUITE` を `yjz` に設定します。`JJAZZ_YJZ_FIXTURES` に公式曲集の `casa-forte.sng`、`ponteio.sng`、`across-the-universe.sng` を置いたフォルダーを指定すると、曲ファイルからの参照、拍子変更のループ、他のスタイルとの併用も確認します。

`-Engine` で生成される Windows 側の `WSL_image/midi-demo.html` を、PC版ChromeまたはEdgeで開きます。ファイルメニューからMIDIや本家形式をダウンロードできます。コード進行だけをまとめて入力する場合は「簡易入力」を開きます。「伴奏設定」でリズムエンジンを選びます。Yamahaスタイルは同梱の8Beatか、選択したスタイルファイルを使います。

jjSwingは4/4専用で、未指定テンポは120です。Main A〜Eの各1/2、Fill 5種類、Intro、Endingの計17バリエーションから選べます。既定のAutoでは、バリエーションに従ってベースとドラムの奏法が切り替わります。ベースはWalking／2-feel／Double-note／Double-time、ドラムはBrushes・Hi-hat・Ride・Shuffle等の11奏法を手動指定することもできます。Double-timeを手動指定する場合は両方を揃えると自然です。選択したバリエーションはコード進行の全小節に適用し、小節ごとの切り替えは行いません。ベース／ドラムのMIDIフレーズDBとベーススタイルはWasmへ同梱するので、SF2以外の追加ダウンロードはありません。

Yamahaモードの「公開スタイル集を読み込む」で、[公式のスタイル集](https://www.jjazzlab.org/en/resources/)と同一のZIP（約2.4MB）を遅延取得できます。公式サーバーにはCORS許可がないため、このリポジトリにミラーしたZIPを固定コミットのGitHub raw URLから取得します。ZIPと選択したスタイルはブラウザのメモリだけで保持し、ZIPファイルの保存や展開先フォルダーの作成、永続ストレージへの書き込みは行いません。ページを開いている間は再取得せず、必要なファイルだけを展開します。カテゴリー／名前で絞り込め、ローカルファイルやjjSwingへの切り替えも可能です。

収録189件中、186件のMIDI生成を確認しています。元のMIDIデータが不正な2件と、空のCASM区間を含む1件は理由付きで選択不可にします。ファイル名とCRCの両方で判別するため、元データが修正されれば自動的に対象外になります。出典とハッシュは [`demo/assets/README.md`](demo/assets/README.md) を参照してください。

公開版は [GitHub Pages](https://1921music.github.io/web_JJazzLab/) です。`gh-pages` ブランチにビルド済みの単一HTMLを配置します。更新手順はリポジトリルートの [`scripts/publish-pages.mjs`](../../scripts/publish-pages.mjs) を参照してください。

音源のTinySoundFont WasmとAudioWorkletのコードもHTMLへ埋め込みます。初回の再生操作でのみ、固定リビジョンのTimGM6mb.sf2（約6MB）をHTTPSで取得します。初回はネット接続が必要です。取得失敗後は再生ボタンで再試行できます。SF2はページ内で再利用し、ページを閉じた後の永続キャッシュは実装していません。配信元のCORS許可が必要です。ビルド環境にEmscriptenがない場合は `scripts/wsl-dev.ps1` を再実行してください。

再生画面では曲全体のループを既定とし、開始・終了小節（終了を含む）を変更できます。演奏中の変更は現在のループ終了位置で適用し、ループを解除した場合はその先を曲末まで演奏します。ループを無効にしている間の範囲変更は曲末で適用します。折り返しでは音源状態を復元し、境界をまたぐノートは切ります。短いフェードでクリック音を抑えます。

ミキサーにはパート別Mute／Solo、縦フェーダー（0〜150%）、パンとMIDIノートのプレビューがあります。マスター音量、全パートのMute切り替え、Soloの一括解除は上部にあります。フェーダーは曲のMIDI音量に乗算し、パンは曲の定位に加えてステレオ音声を調整します。Muteは発音中の音も止め、解除後は次のNote Onから参加します。

各チャンネルの音色名をクリックすると、General MIDI音色または対応ドラムキットと、リバーブ・コーラス（0〜127、有効・無効）を変更できます。変更は適用後のWeb再生に反映されます。音の響きは使用する音源に依存します。「.mixを書き出す」で単体を保存でき、「JJazzLab形式で書き出す」のZIPにも同じ設定を収録します。

演奏中にコード・スタイル・テンポを編集しても演奏は継続します。次の再生時に変更を反映します。コード譜で選んだ範囲があればループに使用し、選択がなければ曲全体をループします。

検証ページのソースは [`demo/`](demo/) にあります。ビルド時にPython 3でWasmをgzip圧縮してBase64に変換し、ローダー、画面のコード、サンプルスタイルとともにHTMLへ埋め込みます。

別の画面から使う場合、WSLの作業コピー（`/home/jjazzdev/src/web_jjazzlab`）内の `web/engine/target/wasm-diagnostics/` にある `engine.wasm` と `engine.wasm-runtime.js` をHTTPで配信し、先にローダーを読み込みます。下の `styleFile` はブラウザで選んだ生のスタイルファイルです。

```javascript
const { exports } = await TeaVM.wasmGC.load("./engine.wasm");
const midi = exports.generateMidi(new Int8Array(await styleFile.arrayBuffer()),
                                  styleFile.name, ["C", "Am7", "Dm7", "G7"], 120);
// jjSwing uses its own generators, without an uploaded style file.
const variations = exports.getSwingVariations();
const swing = exports.generateSwingMidiWithVariation(
    ["Cmaj7", "Am7", "Dm7", "G7"], 120, "Main C-1", "auto", "auto");
// The existing four-argument generateSwingMidi API defaults to Main A-1.
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
