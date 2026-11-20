# JJazzLab Web

[English](README.md) · 日本語

**[Web版を開く（GitHub Pages）](https://1921music.github.io/web_JJazzLab/)**

コード譜から伴奏を作り、ブラウザで練習できるJJazzLabの派生版です。Webで曲を新しく作ることも、Java版JJazzLabで作った曲を取り込んで練習し、編集内容を持ち帰ることもできます。

公開中のソースコミットは、ページ下部のソースリンクか[配信情報](https://1921music.github.io/web_JJazzLab/deployment.json)で確認できます。

## 使い方

1. PC版のChromeまたはEdgeで開きます。新規曲はコード譜の小節をダブルクリックして編集します。たとえば `Cmaj7 3:G7` と入力すると、1拍目にCmaj7、3拍目にG7が入ります。
2. Java版の曲を使う場合は「ファイル → 曲を開く…」で `.sng` を選びます。ミックスも取り込む場合は、同名の `.mix` を一緒に選びます。
3. 再生を押すと伴奏が準備されます。小節や演奏区間を選んでループしたり、ミキサーで各パートの音量を調整したりできます。ピアノロールではユーザートラックの音符を追加・編集できます。
4. Web用の編集ファイルは「Web用に保存」で `.jjazzweb` に保存します。Java版に戻す場合は「JJazzLab形式で書き出す」のZIPを解凍し、`.sng` と同名の `.mix` を同じフォルダーに置いてから `.sng` を開きます。スタイルがZIPに含まれる場合は、必要に応じてJava版にも登録してください。MIDI（GM）、WAV、MP3にも書き出せます。

### PWAとしてインストール

PWA対応版を配信したURLをChromeまたはEdgeで開き、アドレスバーのインストール操作か「ウィンドウ → アプリをインストール…」を選びます。インストール後は専用ウィンドウで起動します。PWAの配信にはHTTPSまたは開発用のlocalhostを使います。

既定音源のTimGM6mb（約6 MB）は最初の再生時に取得します。PWA版では取得後の音源とアプリ本体がブラウザに保存され、オフラインで起動・再生できます。公開スタイル集の読み込みにはネット接続が必要です。

### 単一HTMLをダウンロードして使う

単一HTML版の配布先は [GitHub Releases](https://github.com/1921music/web_JJazzLab/releases) です。配布ファイルが掲載されたら、リリースの **Assets** から `midi-demo.html` をダウンロードし、ChromeまたはEdgeで直接開いてください。Webサーバーを立てずに `file://` から利用できます。

このPWA対応版の単一HTMLは **2,074,794 B（約2.07 MB）** です。HTMLには伴奏エンジンと音源のプログラムが入っています。既定のSoundFont自体は再生時の取得なので、未取得の状態で既定音源を鳴らすにはネット接続が必要です。手持ちの対応する `.sf2` を選んで再生することもできます。

## Java版JJazzLabとの違い

| 項目 | Web版の動作と注意点 |
| --- | --- |
| 曲とスタイル | `.sng` の区間ごとの拍子・リズム・バリエーションに従います。標準Yamahaスタイル、YamJJazz、jjSwingを利用できます。手持ちの `.yjz` には同名のベーススタイルが必要です。リズムが見つからない場合は再生時に代替し、元の指定を本家形式の書き出しに残します。 |
| 発音とミックス | ブラウザではTinySoundFontとTimGM6mbを使用します。Java版のFluidSynthとは音色、ブラシなどの打楽器、リバーブやコーラスの響きが異なります。Web版のミキサー設定を書き出すには `.mix` を使います。GMのMIDI書き出しでは打楽器をチャンネル10にまとめるため、パートごとの音量・パンはWAV／MP3や `.mix` で保持してください。 |
| MIDI機器 | 対応ブラウザでWeb MIDIを許可すると、外部機器への出力、MIDI Learn、MIDI Thru、鍵盤コード追従を使えます。専用のJavaプラグイン、FluidSynth固有のプリセット、OSオーディオドライバーの選択はJava版の機能です。 |
| 保存と復元 | 選んだ曲やスタイルはブラウザ内で処理します。設定や最近の曲はブラウザの保存領域にあり、端末・ブラウザプロファイル・配信元ごとに分かれます。サイトデータを消す前や端末を移すときは、必要な曲をファイルに書き出してください。フォルダーから開く機能はブラウザの対応とアクセス許可が必要です。 |

各機能の対応範囲と検証結果は[本家との機能比較チェックリスト](docs/desktop-web-feature-checklist.md)を参照してください。動作を報告するときは「ヘルプ → バージョンと診断」でビルドIDを確認できます。

## 上流と実装

上流の [JJazzLab 5.2.1](https://github.com/jjazzboss/JJazzLab/releases/tag/5.2.1) をベースにしています。タグ `5.2.1` が指すフォークの基準コミットは [`cd1944afdf8a18b659cdbf63538b6df625a515ec`](https://github.com/jjazzboss/JJazzLab/commit/cd1944afdf8a18b659cdbf63538b6df625a515ec) です。

- Javaの曲モデルと伴奏生成を再利用し、TeaVM 0.16.0でWebAssembly GCにコンパイルします。デスクトップに依存するサービスにはWeb向けの実装を用意し、コード譜やミキサーなどの画面はHTML・CSS・JavaScriptで実装しています。[エンジンの開発ガイド](web/engine/README.md)
- 発音にはEmscriptenでWasm化したTinySoundFontとAudioWorkletを使います。TimGM6mbは固定リビジョンから取得します。対応するローカルのGM用SoundFont（`.sf2`、16 MB以下）も選べます。[音源の実装と検証](web/audio/README.md)

## ビルドと公開

WindowsのリポジトリルートでPowerShell 7を使います。初回はWSL 2の開発環境をセットアップします。

```powershell
./scripts/wsl-dev.ps1
./scripts/wsl-build.ps1 -Engine
node scripts/publish-pages.mjs WSL_image/pwa
```

生成物は `WSL_image/pwa/` と `WSL_image/midi-demo.html` です。上のNodeコマンドは配信ファイルの確認用です。公開は、確認済みのソースコミットを `origin` にプッシュした後、同じコマンドに `--publish` を付けて実行します。配信元は `gh-pages` ブランチのルートです。検証コマンドと公開後の確認方法は[開発ガイドの公開手順](web/engine/README.md#github-pagesへの公開)を参照してください。

## ライセンスと出典

JJazzLab本体と本リポジトリの上流由来部分は[LGPL 2.1](LICENSE)です。[TinySoundFontはMIT](web/audio/vendor/LICENSE)、[TimGM6mbはGPL-2.0-only](web/audio/vendor/TimGM6mb-LICENSE.txt)です。公開Yamahaスタイル集の配布元とハッシュは[スタイル集の出典](web/engine/demo/assets/README.md)に記録しています。デスクトップ版の操作については[上流のユーザーガイド](https://jjazzlab.gitbook.io/user-guide/)を参照してください。
