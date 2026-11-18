# Wasmエンジンの開発

WindowsのリポジトリルートからPowerShell 7で実行します。

```powershell
./scripts/wsl-dev.ps1
./scripts/wsl-build.ps1 -Broad
```

`-Broad` はモデル、生成、YamJJazzなどのクラスを広く保持して、TeaVMの依存エラーを調べます。引数なしでは、同じMIDI生成の入口を少数のクラス保持指定で調べます。どちらも調査用ビルドです。`-SyncOnly` はソースの同期だけを実行します。編集とコミットはWindows側で行います。

同期とビルドは専用WSL内の一時的なLinux cgroupで、CPU 6個・メモリ12 GiBを上限として実行します。WSL 2のディストリビューションごとのcgroup分離が必要です。

伴奏生成全体の診断は、JVM用のコードをコンパイルした後、TeaVMの依存解析で停止します。MIDI生成の入口からも `javax.sound.midi`、`java.beans`、Undoやクリップボード関連、並行処理の一部への依存が見つかっています。

`./scripts/wsl-build.ps1 -StyleIO` は、生のスタイルから標準MIDIのイベントとCASMを読む部分をWasmGCにコンパイルします。WSLの作業コピー内の `web/engine/target/wasm-diagnostics/` にWasmとローダーが出力されます。調査用の `countStyleNotes` と `countStyleParts` は、スタイルのバイト列を `Int8Array` で受け取り、Note OnとCASMのスタイルパートを数えます。

診断で見つかった依存は、まず `web/engine` 内のTeaVM `SubstitutionPolicy` や既存SPIへのDIで対応します。上流のJavaソースを変更するのは、差し替えによる対応が難しい場合に限ります。

`rewriteAsMidi` はJava MIDIのファイル入出力をTeaVM側で差し替え、スタイル内の元のMIDIトラックを標準MIDIに書き出す診断用の入口です。MIDI機器や音源のAPIはこの差し替えの対象外です。

開発環境を破棄する場合は `./scripts/wsl-dev.ps1 -Remove -WhatIf` で対象を確認し、`-Remove` を指定します。WSLの登録解除とともにVHDX内の作業コピー、ツール、キャッシュが削除されます。
