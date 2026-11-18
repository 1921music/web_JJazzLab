# Wasmエンジンの開発

WindowsのリポジトリルートからPowerShell 7で実行します。

```powershell
./scripts/wsl-dev.ps1
./scripts/wsl-build.ps1 -Broad
```

`-Broad` はモデル、生成、YamJJazzなどのクラスを広く保持して、TeaVMの依存エラーを調べます。引数なしでは、同じMIDI生成の入口を少数のクラス保持指定で調べます。どちらも調査用ビルドです。`-SyncOnly` はソースの同期だけを実行します。編集とコミットはWindows側で行います。

開発環境を破棄する場合は `./scripts/wsl-dev.ps1 -Remove -WhatIf` で対象を確認し、`-Remove` を指定します。WSLの登録解除とともにVHDX内の作業コピー、ツール、キャッシュが削除されます。
