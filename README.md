# Prompt Library for Microsoft Edge

軽量・ローカル専用のプロンプトライブラリー。日本語 / English対応。

## Edgeに読み込む

1. Edgeで `edge://extensions` を開く。
2. 「開発者モード」をオンにする。
3. 「展開して読み込み」を押し、このプロジェクトの **`extension` フォルダ**を選ぶ。
4. ツールバーの拡張機能メニューからPrompt Libraryを表示・ピン留めする。

初回は空のライブラリーです。「＋」でプロンプトを登録してください。テスト用プロンプトは製品に含みません。

## 普段の使い方

- カードをクリックすると本文全体をコピー。コピー成功時だけ使用回数と最終使用日時を更新します。
- タイトル・タグ・本文を横断検索。スペース区切りの複数語はAND検索です。
- タグとお気に入りで絞り込み。タグとお気に入りは組み合わせられます。
- タグ欄には登録済みのタグのみを、カードのタグと同じ色で表示します。タグを選んでいない状態では全件を表示し、選択中のタグをもう一度押すと解除します。「すべて」ボタンはありません。
- お気に入りでの絞り込みは、並び順の右側の☆ボタンで切り替えます。
- ☆はお気に入り、鉛筆は編集です。それぞれの操作でコピーは発生しません。
- **Alt + Shift + P → 検索 → ↓ / ↑ → Enter**。`/`でも検索欄に移動できます。
- 日本語入力の変換中はEnterによるコピーを行いません。

ショートカットが他の拡張機能と競合している場合、`edge://extensions/shortcuts` でキーを割り当ててください。設定画面にもリンクがあります。設定の「キーボード操作」をオフにすると、開くショートカットと独自の一覧操作を無効にします。Tabなど標準のアクセシビリティ操作は使えます。

## 設定にまとめたもの

| 設定 | 内容 |
|---|---|
| 言語 | ブラウザーに合わせる / 日本語 / English |
| 並び順 | プロンプト名 / 使用頻度 / 最近使った順。すべてお気に入り優先 |
| サイズ | 小 360×480 / 中 440×600 / 大 760×600px。大は2列 |
| カード | 2行固定。1行目にタイトル・使用回数・操作、2行目にタグ・本文プレビュー。標準サイズで縦に10枚 |
| バックアップ | 全プロンプト・お気に入り・設定・使用履歴をJSONに書き出す |
| 読み込み | 追加、または全体の置き換え。置き換えには確認があります |
| 共有 | 選択したプロンプトのみJSONに書き出す。お気に入り・使用履歴・設定は除外 |

追加読み込みでは、タイトル・本文・タグの組み合わせが同じプロンプトを重複追加しません。既存と同じIDでも内容が異なる場合は、新しいIDで両方を残します。

別PCへの移行は、元のPCでバックアップを書き出し、移行先のPCで「読み込む → 置き換える」を選びます。自動同期はありません。

編集内容は書きかけとして端末内に保存されます。キャンセル後も同じプロンプトを開くと復元します。新規作成の「書きかけを破棄」で消せます。書きかけはバックアップ・共有には含みません。

## 軽量化と性能

実行時の外部依存 **0**。フレームワーク・外部フォント・AI API・分析ツールを使用しません。ビルド不要のHTML / CSS / JavaScriptで構成しています。

- CSSと画面の骨組みを先に表示。ポップアップはサービスワーカー起動を待ちません。
- 初回のカード描画は最大40件。残りは「さらに表示」で追加します。
- カードの本文プレビューは最大400文字。コピー対象は本文全体です。
- タグは最初の12個を表示。多い場合は検索できるタグ選択画面から選べます。
- バックグラウンド処理はショートカットイベント時のみ。定期実行や常駐タイマーはありません。
- 目標は**0.5秒以内に操作可能**。環境差があるため、すべてのPCや高負荷時の絶対保証はできません。

実測値・条件は [PERFORMANCE.md](PERFORMANCE.md) を参照してください。

上限は2,000件、JSONファイルは4MB、タイトル160文字、本文100,000文字、タグ最大12個（各40文字）です。保存時にもバックアップファイルが4MB以内に収まるか確認します。

## プライバシーと権限

**外部通信は一切行いません。データはこの端末内の `chrome.storage.local` に保存されます。** アカウント・サーバー・自動同期はありません。CSPの `connect-src 'none'` でも外部接続を制限しています。

- `storage`：プロンプト・設定・使用履歴・書きかけの保存。
- `clipboardWrite`：クリック・Enter操作によるクリップボードへのコピー。
- ホスト権限、閲覧履歴、ページ内容、クリップボード読み取り権限は要求しません。

ユーザーが明示的に書き出すJSONファイルにはプロンプト本文が含まれます。共有先への送信はユーザー自身で行います。ブラウザー自体の更新・通信は、この拡張機能の通信とは別です。

[プライバシーポリシー / Privacy policy](PRIVACY.md)

## 開発・検証

```powershell
npm.cmd test
npm.cmd run preview
```

プレビューは `http://127.0.0.1:4317/extension/popup.html`。localhost専用のモックを使い、Edge拡張機能とは別のデータを保存します。プレビュー用コードは拡張機能パッケージに含みません。

実際のEdgeでの自動テスト（Playwrightが必要）：

```powershell
node tests/browser.mjs "<Playwrightが入っているnode_modulesの絶対パス>"
```

通常のEdgeプロファイルには触れず、`test-results/edge-profile` のテスト専用プロファイルを使います。スクリーンショット・測定結果も `test-results` に出力します。テストではコピー結果を検証するため、テストブラウザーに限りクリップボード読み取りを許可します。製品は読み取り権限を持ちません。

## 公開用ZIP

```powershell
npm.cmd run package
```

`dist/edge-prompt-library-1.0.0.zip` を作成します。`manifest.json` はZIPの直下にあります。開発用サーバー・テスト・スクリーンショットは含みません。バージョンはmanifestから自動で取得し、設定画面にも同じ値を表示します。

公開先はMicrosoft Edge Add-onsです。Partner Centerで申請します。公開前に通常のEdgeでもツールバー操作・ショートカット競合・高DPIでの表示を確認し、プライバシーポリシーをアクセス可能なURLで公開して、掲載用の説明・画像を用意してください。申請や公開はまだ行っていません。

GitHub Pages用のプライバシーポリシーは `docs/index.html`、日英の掲載画像とロゴは `store-assets` にあります。[登録手順・入力する文章](STORE_SUBMISSION.md)を参照してください。

ポリシーの文面を変更した場合は `npm.cmd run privacy-page` でHTMLを再生成してください。`npm.cmd run check-release` は説明文の長さ・バージョン・権限・アイコンと掲載画像の寸法などを検証します。

## English

A lightweight, local-only prompt library for Microsoft Edge. Load the `extension` folder from `edge://extensions` in developer mode. Pin the extension, add a prompt, and click a card to copy it.

Search titles, tags, and content; combine tags with favorites. Favorites stay first in every sort order. Cards use two compact rows. Settings include Japanese / English, three popup sizes, name / usage / recency sorting, optional keyboard controls, JSON backup and restore, and selected collection exports.

Default shortcut: **Alt + Shift + P**, then type to search, use arrow keys to select, and Enter to copy. You can disable optional keyboard controls in Settings.

No external connections, accounts, telemetry, or automatic sync. Data stays in this device's extension storage. Export a backup to move it to another computer. Collection exports exclude settings, favorites, and usage history. See [PRIVACY.md](PRIVACY.md).
