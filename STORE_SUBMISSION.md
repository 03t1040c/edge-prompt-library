# Microsoft Edge Add-ons 申請前の確認

更新日：2026-10-23

## 現在の状態

- Manifest V3。機能はプロンプトの保存・検索・整理・コピーに限定。
- 要求する権限は `storage` と `clipboardWrite` の2つ。ホスト権限なし。
- 外部通信・リモートコード・外部フォント・分析ツール・アカウント・自動同期なし。
- 日本語・英語のUIと拡張機能情報あり。
- 英語のmanifest説明は125文字に修正済み（上限132文字）。
- ユニットテスト10件、ブラウザーテスト39項目、最終回帰テスト15項目が成功。[最終チェック結果](FINAL_CHECK.md)を参照。
- 掲載用ロゴ：`store-assets/logo-300.png`。
- 最新パッケージ：`dist/edge-prompt-library-1.0.1.zip`。起動を軽くし、画面切り替え・同時保存・バックアップの不具合を修正した更新版です。manifestはZIP直下。
- GitHub Pages用プライバシーポリシー：`docs/index.html`。`PRIVACY.md` から生成しています。
- 日本語の掲載画像：`store-assets/library-ja-1280x800.png`、`store-assets/settings-ja-1280x800.png`。
- 英語の掲載画像：`store-assets/library-en-1280x800.png`、`store-assets/settings-en-1280x800.png`。
- 掲載画像はサンプルデータを入れた実際の拡張機能の画面に説明枠を付けたものです。拡張機能パッケージに枠やサンプルデータは含みません。
- バージョン・説明の文字数・権限・アイコン・掲載画像を自動検証する `npm.cmd run check-release` を追加済み。

## 申請前に用意するもの

1. Microsoft Edge拡張機能の開発者アカウントをPartner Centerで用意。
2. 下の手順で `docs/index.html` をGitHub Pagesで公開し、申請フォームにURLを入力。
3. 日本語・英語のストア説明を入力。下の文章をそのまま使えます。
4. 掲載用ロゴを登録。現在の300×300px PNGを使用できます。
5. 日英それぞれ上記の1280×800px画像を2枚登録できます。スクリーンショット自体は任意ですが、規定サイズで準備済みです。`test-results` の440×600px画像は提出しません。
6. 推奨：問い合わせ用メールアドレス、またはサポートページを登録。

現在は速度改善版1.0.1です。設定画面はmanifestからバージョンを取得します。すでに登録した製品の更新では、別の拡張機能を新規作成せず、既存製品のPackagesから更新版ZIPを登録してください。ストアへの反映はまだ行っていません。

## GitHub Pagesでポリシーを公開

Gitのoriginに設定されているリポジトリは `03t1040c/edge-prompt-library` です。以下はそのリポジトリに `/docs` を配置する前提です。リポジトリの公開状態とPagesの有効化は、まだ確認できていません。

1. 変更済みの `docs/index.html` と `docs/.nojekyll` をGitHubリポジトリに反映します。GitHubのWeb画面からアップロードしても構いません。`.nojekyll` は空ファイルで、独自の静的HTMLをそのまま配信するためのものです。
2. リポジトリの **Settings → Pages** を開きます。
3. **Build and deployment → Source → Deploy from a branch** を選びます。
4. 公開用ブランチ（通常は `main`）と **`/docs`** を選び、**Save**。
5. ビルドが成功したら **Visit site** で表示します。
6. ログアウトしたブラウザーやInPrivateでも、日本語・Englishの本文が読めることを確認します。

設定後の想定URLは **`https://03t1040c.github.io/edge-prompt-library/`** です。現在公開済みのURLとして案内しているものではありません。独自ドメインや別リポジトリを使う場合は、Pagesに表示された実際のURLを申請に使用してください。

GitHub FreeでPagesを使う場合、公開元のリポジトリはpublicである必要があります。ソースコード全体を公開したくない場合は、ポリシー用の別のpublicリポジトリにこのHTMLだけを配置する方法もあります。既存リポジトリの公開設定は自動では変更していません。

このHTMLの配信はポリシー公開用です。拡張機能が起動時にGitHubへアクセスすることはなく、外部通信なしの動作は変わりません。

## Partner Centerでの登録・提出

1. [Partner Center](https://partner.microsoft.com/dashboard)に**個人用Microsoftアカウント（MSA）**でサインインします。Microsoft Edgeプログラムの登録料は無料です。仕事・学校アカウントだけではEdgeプログラムに登録できません。
2. 初回は **Account settings → Programs → Microsoft Edge → Get started**。個人制作として公開するなら **Individual** を選びます。会社として公開する場合は **Company** を選び、会社の確認手続きを進めます。国・地域とアカウント種別は登録後に変更できないため、入力時に確認してください。
3. 登録確認が完了したら **Home → Workspaces → Edge → Create new extension**。
4. **Packages** に `dist/edge-prompt-library-1.0.1.zip` をアップロードし、検証結果を確認します。
5. **Availability** では一般公開なら **Public**。検索には出さずURLで配布する場合は **Hidden**。公開する国・地域も選びます。
6. **Properties** で機能に合うカテゴリーを選びます。サポート先のURLやメールアドレスは任意ですが、用意しておくと問い合わせを受けられます。
7. **Privacy** に下のSingle purpose、権限2件の理由を貼り付けます。Remote codeは **No**。公開確認したGitHub PagesのURLをPrivacy policy URLに入力します。データ利用の申告は、外部収集・送信なし、端末内保存・クリップボード書き込み・JSON書き出しという実態と一致させてください。
8. **Store listings** で日本語・英語のページを開き、下の説明文、`logo-300.png`、各言語の2枚の掲載画像を登録します。日本語・英語が自動で検出されなければ、言語の追加を確認してください。
9. 必要な入力がCompleteになったら **Publish**。提出画面の **Notes for certification** に下の審査メモを貼り、最後の **Publish** で審査に提出します。
10. 審査状況はPartner Centerで確認します。公式案内では審査に最大7営業日かかる場合があります。審査通過後は選んだ公開設定で公開されます。

公開前に登録データをJSONバックアップしてください。開発版とストア版で拡張機能のIDが異なる場合、ローカルデータは自動移行されません。ストア版でバックアップを読み込んで移行します。

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
- [GitHub Pagesの作成](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [GitHub Pagesの公開元の設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

コードと現行要件を確認した結果です。審査の承認を保証するものではありません。申請や外部への公開はまだ行っていません。
