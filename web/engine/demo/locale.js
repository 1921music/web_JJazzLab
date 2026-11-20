"use strict";

const labels = new Map(`
メインメニュー|Main menu
ファイル|File
編集|Edit
MIDIを取り込む…|Import MIDI…
音符のMIDIファイル|MIDI file for notes
選択範囲のみ再生|Play selected bars
選択区間のみ再生|Play selected song part
小節メモを表示|Show bar annotations
メモの行数|Annotation lines
選択小節から練習曲を作成…|Create practice song from selected bars…
練習曲を作成|Create practice song
開始テンポ（BPM）|Starting tempo (BPM)
終了テンポ（BPM）|Ending tempo (BPM)
段階数|Number of steps
練習曲を保存|Save practice song
練習ビュー|Easy Reader
現在のコード|Current chord
次のコード|Next chord
閉じる|Close
区間のミュート|Song part mute
ミュートなし|No tracks muted
区間パラメーターの操作|Song part parameter actions
値をコピー|Copy value
値を貼り付け|Paste value
既定値に戻す|Reset to default
前の値|Previous value
次の値|Next value
選択小節を削除|Delete selected bars
コードの発音|Chord interpretation
曲のメモ|Song memo
曲のメモ…|Song memo…
アクセント|Accent
既定|Default
通常|Normal
強調|Stronger
クラッシュシンバル|Crash cymbal
鳴らす|Play
抑える|Suppress
Hold／Shotを他の楽器にも適用|Extend Hold/Shot to more instruments
ペダルベース|Pedal bass
先取りしない|Disable anticipation
スケール|Scale
長さ|Duration
代替コード|Alternate chord
代替コードを使う条件|Use alternate chord when
区間のマーカー|Song part marker
マーカー|Marker
ランダム（30%）|Random (30%)
ランダム（50%）|Random (50%)
ランダム（70%）|Random (70%)
ツール|Tools
ウィンドウ|Window
ヘルプ|Help
新規作成|New song
曲を開く|Open song
曲を開く…|Open song…
曲を開く (.sng / .mix / .jjazzweb / .txt)|Open song (.sng / .mix / .jjazzweb / .txt)
Web用に保存|Save Web project
JJazzLab形式で書き出す|Export JJazzLab files
JJazzLab形式で書き出す…|Export JJazzLab files…
MIDI（GM）を書き出す|Export MIDI (GM)
MIDI（GM）|MIDI (GM)
元に戻す|Undo
やり直す|Redo
元に戻す (Ctrl+Z)|Undo (Ctrl+Z)
やり直す (Ctrl+Y)|Redo (Ctrl+Y)
小節を編集…|Edit bar…
セクション…|Section…
演奏区間を追加|Add song part
曲構成|Song structure
伴奏設定…|Accompaniment settings…
伴奏設定|Accompaniment settings
伴奏を更新|Refresh accompaniment
簡易入力|Quick input
言語|Language
画面の言語|Interface language
JJazzLab ユーザーガイド|JJazzLab User Guide
ファイルと編集|File and edit
演奏|Playback
再生操作|Transport
再生|Play
停止|Stop
一時停止|Pause
再生位置|Playback position
前の演奏区間|Previous song part
次の演奏区間|Next song part
クリック音|Metronome
2小節のカウントイン|Two-bar count-in
カウントイン|Count-in
カウントインの長さ|Count-in length
1小節|1 bar
2小節|2 bars
自動|Auto
テンポ (BPM)|Tempo (BPM)
ループ範囲|Loop range
ループ|Loop
ループの開始小節|First bar of loop
ループの終了小節|Last bar of loop
表示|View
コード譜|Lead sheet
曲名|Song title
コード譜の操作|Lead sheet controls
小節を編集|Edit bar
セクション|Section
小節を追加|Add bar
末尾の小節を削除|Delete last bar
拍子|Time signature
コード譜の小節|Lead sheet bars
コンパクト|Compact
横ズーム|Horizontal zoom
曲構成の横ズーム|Song structure horizontal zoom
全体表示|Fit to width
演奏順|Song parts
ミキサー|Mix Console
リセット|Reset channels
マスター|Master
全Mute|Mute all
Solo解除|Clear solo
.mixを書き出す|Export .mix
ミックスを読み込む…|Import mix…
トラックを表示|Show tracks
表示するリズム|Rhythm to display
トラック名|Track name
トラック名を変更…|Rename track…
トラックを削除…|Delete track…
種別|Type
メロディー|Melodic
ドラム|Drums
音符を編集|Edit notes
ユーザートラックに複製|Clone as user track
このトラックをMIDIで書き出す|Export this track as MIDI
ピアノロールへドラッグして音符をコピー|Drag to the piano roll to copy notes
ヒューマナイズ|Humanize
ヒューマナイズ…|Humanize…
タイミングのばらつき|Timing randomness
タイミングの前後|Timing bias
ベロシティのばらつき|Velocity randomness
選択した音符だけ|Selected notes only
縦ズーム|Vertical zoom
ピアノロールの縦ズーム|Piano roll vertical zoom
コード表示の移調|Transpose displayed chords
コード表示の移調…|Transpose displayed chords…
表示キー|Display key
コンサートキー|Concert pitch
選択区間を編集…|Edit selected song parts…
区間パラメーター|Song-part parameters
リズム切り替えを解除|Remove rhythm change
表示項目…|Visible parameters…
コンパクト表示の項目|Parameters shown in compact view
全音符を表示|Fit all notes
選択を反転|Invert selection
音符を試聴|Audition notes
このトラックをSolo|Solo this track
再生位置に追従|Follow playback
伴奏トラックの上書き|Override accompaniment tracks
伴奏トラックの上書き…|Override accompaniment tracks…
元のトラック|Original track
置き換えるリズム|Replacement rhythm
置き換えるトラック|Replacement track
この上書きを解除|Remove this override
区間のカスタムフレーズ|Song-part custom phrase
区間のカスタムフレーズ…|Song-part custom phrase…
伴奏トラック|Accompaniment track
元のフレーズに戻す|Restore the original phrase
区間のドラム変形|Song-part drum transforms
区間のドラム変形…|Song-part drum transforms…
追加する変形|Transform to add
楽器別の強弱補正|Velocity offsets by drum sound
バスドラム|Bass drum
スネア|Snare
ハイハット|Hi-hat
タム|Toms
クラッシュ|Crash
シンバル|Cymbals
パーカッション|Percussion
MIDI設定|MIDI settings
曲のコピーを保存…|Save a copy…
演奏順に展開した曲を保存…|Save an unfolded song…
新規曲のテンプレートにする|Use as the new-song template
標準テンプレートに戻す|Restore the default template
MIDIチャンネル|MIDI channel
移調（半音）|Transpose (semitones)
ベロシティ補正|Velocity shift
音色を送信|Send instrument
音色を検索|Search instruments
音色を試聴|Audition instrument
音量を送信|Send volume
パンを送信|Send pan
コード進行|Chord progression
1小節に1コード。空白、改行、カンマ、または | で区切ります。|One chord per bar. Separate chords with a space, newline, comma, or a vertical bar.
リズムエンジン|Rhythm engine
曲ファイルの指定どおり|Use the song's rhythms
Yamaha / YamJJazzスタイル|Yamaha / YamJJazz styles
jjSwing — ジャズのスウィング（4/4）|jjSwing — jazz swing (4/4)
バリエーション|Variation
ベースの奏法|Bass style
ドラムの奏法|Drums style
Auto（バリエーションに合わせる）|Auto (follow the variation)
スタイル|Style
同梱のYamJJazzスタイル|Bundled YamJJazz styles
選択なし|None
公開スタイル集を読み込む|Load the public style library
JJazzLab公開スタイル集|JJazzLab public style library
カテゴリー|Category
すべて|All
スタイル名で検索|Search styles by name
公開スタイル|Public styles
Jazz、Bossa、Waltz…|Jazz, Bossa, Waltz…
選択なし（ファイルまたは8Beat）|None (file or 8Beat)
元データに問題があるスタイルは「利用不可」と表示します。|Styles with invalid source data are marked unavailable.
音源ライセンス|Sound engine licenses
コード|Chords
複数コードは「Cmaj7 3:G7」のように、コードの前に拍位置を指定します。|Enter several chords as Cmaj7 3:G7, with beat numbers before the chords.
セクション名|Section name
キャンセル|Cancel
適用|Apply
演奏区間|Song part
区間名|Part name
リズム|Rhythm
音色|Instrument
小節の操作|Bar actions
コードを編集|Edit chord
セクションを編集|Edit section
コピー|Copy
貼り付け|Paste
コードを削除|Clear chords
小節を挿入|Insert bar
最終小節にする|Set end bar
ここから再生|Play from here
曲構成の操作|Song part actions
演奏区間を編集|Edit song part
複製|Duplicate
削除|Delete
ピアノロール|Piano roll
ピアノロールを閉じる|Close piano roll
ユーザートラック|User track
ユーザートラックを追加|Add user track
音符編集|Note editing
編集ツール|Edit tools
選択|Select
描画|Draw
消去|Erase
グリッドに合わせる|Snap to grid
グリッド|Grid
クオンタイズ|Quantize
この位置から再生|Play from here
ベロシティ|Velocity
ピアノロールの横ズーム|Piano roll horizontal zoom
音符グリッド|Note grid
ベロシティレーン|Velocity lane
音符の値|Note properties
位置（拍）|Position (beats)
長さ（拍）|Length (beats)
ドラッグで音符を移動。音符の右端をドラッグして長さを変更します。|Drag to move notes or drag the right edge to resize them.
チャンネル設定|Channel settings
チャンネル設定…|Channel settings…
チャンネルを元に戻す|Reset channel
再生位置を譜面に表示|Show playback position on the score
1段の小節数|Bars per row
曲中で変化|Mixed time signatures
小節メモ|Bar annotation
小節メモを編集|Edit bar annotation
ループの折り返し位置にする|Set loop restart bar
ループの折り返し位置|Loop restart bar
強弱|Intensity
フィル|Fill
テンポ比|Tempo factor
リバーブ|Reverb
コーラス|Chorus
有効|Enabled
停止中|Stopped
一時停止中|Paused
演奏中|Playing
カウントイン|Counting in
次回の再生から変更を反映します。|Changes will be applied on the next play.
次回の再生からテンポを反映します。|The new tempo will be applied on the next play.
コードを1つ以上入力してください。|Enter at least one chord.
MIDIを生成しています…|Preparing accompaniment…
選択した小節は曲構成の演奏順に含まれていません。|The selected bar is outside the song structure.
終了小節を含めて繰り返します。|The loop includes the last bar.
変更は次の折り返しから適用します。|Changes take effect at the next loop boundary.
ループ範囲が不正です。|Invalid loop range.
セクション名は空欄や重複を避けてください。|Enter a unique section name.
譜面の上限は1024小節です。|The lead sheet is limited to 1024 bars.
Web用の曲ファイルを1つ選択してください。|Select one Web project file.
.sng と、必要に応じて同じ名前の .mix を選択してください。|Select a .sng file and, optionally, a .mix file with the same name.
曲ファイルの譜面または演奏順が不正です。|The file contains an invalid lead sheet or song structure.
ミックスのチャンネル数が不正です。|The mix contains an invalid number of channels.
曲に譜面セクションと演奏区間が必要です。|A song must contain a lead sheet section and a song part.
公開スタイル集を取得しています…|Downloading the public style library…
公開スタイル集を読み込み済み|Public style library loaded
公開スタイル集を再試行|Retry loading the public style library
（利用不可）| (unavailable)
元ファイルのMIDIデータが不正です。|The original file has invalid MIDI data.
元ファイルに空のスタイル区間があり、エンジンが読み込めません。|The engine cannot load the empty style section in the original file.
スタイルの既定値|Style default
Wasmを読み込めませんでした。WasmGCとgzip展開に対応したブラウザで開いてください。|Could not load WebAssembly. Use a browser with WasmGC and gzip support.
jjSwingは4/4専用のため、この曲の拍子に対応するスタイルで演奏します。|jjSwing uses 4/4. A compatible style is used for the other meters.
スタイルやトラックが異なるため、既定ミックスを使用しました。|The default mix was used because styles or tracks differ.
jjSwingの伴奏を生成できませんでした。コード表記を確認してください。|Could not generate jjSwing accompaniment. Check your chord symbols.
音源を準備しています。初回はSoundFontを約6MBダウンロードします…|Preparing the sound engine. The first play downloads a 6 MB SoundFont…
SoundFontを読み込んでいます…|Loading the SoundFont…
SoundFontを取得できませんでした。ネット接続を確認して再生を押してください。|Could not download the SoundFont. Check the connection and press Play to retry.
取得したSoundFontが不正です。|The downloaded SoundFont is invalid.
AudioWorkletに対応したPC版ChromeまたはEdgeで開いてください。|Use a desktop browser with AudioWorklet support.
Autoでは選んだバリエーションの奏法に従います。ベースとドラムを手動指定することもできます。生成した全小節に同じバリエーションを適用します。ブラシなど一部の打楽器は近似音です。|Auto follows the variation. Bass and drums can be set manually. The variation applies to every generated bar. Some percussion sounds, including brushes, are approximations.
を使う場合は、同じ名前の元スタイル（.sty / .prs / .bcs / .sst）も一緒に選びます。|files require a matching base style (.sty / .prs / .bcs / .sst).
を約2.4MB取得します。ファイル保存は不要です。| downloads about 2.4 MB directly into the page.
音源:|Sound engine:
(MIT) / TimGM6mb — Tim Brechbill (GPL-2.0)。初回の再生にはネット接続が必要です。|(MIT) / TimGM6mb — Tim Brechbill (GPL-2.0). The first play requires an internet connection.
`.trim().split("\n").map(line => line.split(/\|(?=[^|]*$)/u)));

let uiLanguage = (navigator.languages?.[0] ?? navigator.language).toLowerCase().startsWith("ja") ? "ja" : "en";
try { uiLanguage = localStorage.getItem("jjazzlab.language") || uiLanguage; } catch { /* Preference storage is optional. */ }
if (!["ja", "en"].includes(uiLanguage)) uiLanguage = "en";
const t = (ja, en = labels.get(ja) ?? ja) => uiLanguage === "ja" ? ja : en;
const translatedText = new Map();
function localizedText(node, ja, en) {
    translatedText.set(node, [ja, en]);
    node.textContent = t(ja, en);
}
const localeBindings = [];
const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
for (let node; (node = textNodes.nextNode());) {
    const original = node.data.trim();
    if (labels.has(original)) {
        const source = node.data;
        localeBindings.push(() => { node.data = source.replace(original, t(original)); });
    }
}
for (const node of document.querySelectorAll("[aria-label], [title], [placeholder]")) {
    for (const attribute of ["aria-label", "title", "placeholder"]) {
        const original = node.getAttribute(attribute);
        if (labels.has(original)) localeBindings.push(() => node.setAttribute(attribute, t(original)));
    }
}
function applyLanguage(language) {
    uiLanguage = language;
    document.documentElement.lang = language;
    document.querySelector("#ui-language").value = language;
    localeBindings.forEach(apply => apply());
    for (const [node, [ja, en]] of translatedText) node.textContent = t(ja, en);
}
applyLanguage(uiLanguage);
