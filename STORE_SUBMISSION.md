# Microsoft Edge Add-ons 申請前の確認

確認日：2026-10-11

## 現在の状態

- Manifest V3。機能はプロンプトの保存・検索・整理・コピーに限定。
- 要求する権限は `storage` と `clipboardWrite` の2つ。ホスト権限なし。
- 外部通信・リモートコード・外部フォント・分析ツール・アカウント・自動同期なし。
- 日本語・英語のUIと拡張機能情報あり。
- 英語のmanifest説明は125文字に修正済み（上限132文字）。
- ユニットテスト10件、ブラウザーテスト38項目が成功。
- 掲載用ロゴ：`store-assets/logo-300.png`。
- 申請パッケージ：`dist/edge-prompt-library-0.1.0.zip`。manifestはZIP直下。

## 申請前に用意するもの

1. Microsoft Edge拡張機能の開発者アカウントをPartner Centerで用意。
2. `PRIVACY.md` をログイン不要の公開URLで掲載し、申請フォームにURLを入力。
3. 日本語・英語のストア説明を入力。下の文章をそのまま使えます。
4. 掲載用ロゴを登録。現在の300×300px PNGを使用できます。
5. 推奨：日英のスクリーンショットを用意。規格は640×480または1280×800px、最大6枚。`test-results` の440×600px画像は、そのままでは掲載規格に合いません。縦横を引き伸ばさず、規定サイズの枠に余白とともに配置してください。
6. 推奨：問い合わせ用メールアドレス、またはサポートページを登録。

バージョン0.1.0のままでも申請できます。正式リリースを1.0.0と呼ぶ場合は、manifest・設定画面・パッケージ名をそろえて更新してから提出してください。

## 会社のPCで試す項目

- 展開した拡張機能の利用が会社の管理ポリシーで許可されていること。
- アイコンからの初回表示、連続した開閉、Edge再起動後のデータ保持。
- 日本語IMEの変換確定ではコピーせず、確定後のEnterでコピーすること。
- カードクリックとショートカットからのコピー。Alt + Shift + Pが競合しないこと。
- タグ未選択、タグ選択・解除、お気に入りとの組み合わせ。
- 会社の表示倍率（125% / 150%など）で、カード・設定・編集画面が使えること。
- JSON書き出し、別プロファイルへの追加・置換読み込み。タイトル・タグ・改行を含む本文、使用回数、設定が復元されること。
- 実際に使う件数での表示速度。

開発版からストア版へ切り替える前に、登録したデータをJSONでバックアップしてください。機能確認には、まず会社の機密情報を含まないサンプルを使うと確認しやすくなります。

## 申請フォームの文章

### Single purpose

Store, organize, find, and copy reusable prompts in a lightweight local library within Microsoft Edge.

### Permission justification: storage

Stores user-created prompts, tags, favorites, preferences, copy counts, last-used timestamps, creation timestamps, and unfinished drafts locally on the user's device. The extension does not use storage.sync or transmit this information externally.

### Permission justification: clipboardWrite

Copies the complete text of the prompt selected by the user to the clipboard when the user clicks a prompt card or presses Enter using the optional keyboard controls. The extension never reads the clipboard.

### Remote code

No remote code. All JavaScript, styles, and icons are included in the extension package. The extension makes no external connections.

### Data practices

申請フォームの選択肢は、以下の実態と一致するよう入力してください。

- 開発者や第三者へのデータ送信・収集は行わない。
- プロンプトなど、ユーザーが入力したデータを端末内で保存・処理する。
- コピー操作で選択された本文をクリップボードへ書き込む。
- 明示的な操作でJSONファイルを書き出す。
- 閲覧履歴・Webページ内容・クリップボードの内容を読み取らない。

### Description — 日本語

Prompt Libraryは、よく使うプロンプトをMicrosoft Edgeですぐに呼び出せる、軽量なローカル専用ライブラリーです。ツールバーのアイコンから開き、カードをクリックするだけでプロンプト全文をクリップボードへコピーできます。

タイトル・タグ・本文の横断検索、タグによる絞り込み、お気に入りに対応。お気に入りを優先しながら、名前順・使用頻度順・最近使った順に並べられます。2行のコンパクトなカードで、標準サイズでは縦に約10枚を表示できます。

日本語・英語の切り替え、ポップアップのサイズ変更、無効にできるキーボード操作を設定にまとめています。JSONバックアップと復元で別PCへ移行でき、選択したプロンプト集だけを書き出して共有することもできます。

アカウント登録や外部通信は不要です。プロンプト・設定・使用履歴はこの端末内に保存され、外部へ送信されません。自動同期はありません。

### Description — English

Prompt Library is a lightweight, local-only library for the prompts you use every day in Microsoft Edge. Open it from the toolbar and click a card to copy the complete prompt to your clipboard.

Search across titles, tags, and content. Filter by real tags, mark favorites, and sort by prompt name, usage frequency, or recent use. Favorites stay at the top within your results. Compact two-row cards display about ten prompts vertically at the standard popup size.

Settings include Japanese and English, three popup sizes, and optional keyboard controls. Export and restore JSON backups to move your library to another computer, or export selected prompts as a shareable collection without settings or usage history.

No accounts, external connections, or automatic sync. Your prompts, preferences, and usage history stay on this device and are never sent externally.

### Notes for certification

No account, credentials, network connection, AI service, or access to a corporate website is required. Start with an empty library, click the plus button, and add any sample title, tags, and prompt content. Click the resulting card to copy its complete content. Verify favorites and tag filtering. Open Settings to change language, size, sort order, and keyboard controls, or to export/import JSON. The default suggested keyboard shortcut is Alt + Shift + P, subject to browser shortcut conflicts. No permissions to access website content are requested.

## 公式資料

- [公開手順・掲載素材・権限の説明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Microsoft Edge Add-ons開発者ポリシー](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)
- [manifestの短い説明文の上限](https://developer.chrome.com/docs/extensions/reference/manifest/description)
- [開発者アカウント登録](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)

コードと現行要件を確認した結果です。審査の承認を保証するものではありません。申請や外部への公開はまだ行っていません。
