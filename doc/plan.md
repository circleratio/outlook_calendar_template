# 実装計画: Outlook 予定表テンプレートアドイン

入力: [spec.md](spec.md)

コマンドはすべて PowerShell で実行する（Git Bash には `node` / `npm` の PATH が通っていないため）。

## 依存関係

```
S1 ─┬─ S2 (core) ──┬─ S4 (app) ─┐
    │              │            ├─ S6 (taskpane) ─ S7 (build) ─ S8 (手動確認) ─ S9 (最終確認)
    └─ S3 (office) ┴────────────┘
         S5 (manifest) ─────────────────────────────┘
```

- S2（core）と S3（office）、S5（manifest）は S1 の後に並行して実装できる。
- S4 は S2 と S3 のインターフェース（型）に依存する。
- S6 は S2〜S4 がそろってから着手する。

## S1. プロジェクトの初期化

やること:
- `git init`、`.gitignore`（`node_modules/`、`dist/`、`coverage/`）を作成する。
- `package.json` を作成し、開発依存をインストールする: `typescript`、`webpack`、`webpack-cli`、`webpack-dev-server`、`ts-loader`、`html-webpack-plugin`、`copy-webpack-plugin`、`@types/office-js`、`jest`、`ts-jest`、`@types/jest`、`jest-environment-jsdom`、`office-addin-dev-certs`、`office-addin-manifest`。
- `tsconfig.json`（`strict: true`、`target: ES2020`、`lib: ["ES2020", "DOM"]`）と `jest.config.js` を作成する。
- spec.md の 7 章にある npm スクリプト（`dev-server`、`build`、`test`、`validate`）を定義する。

完了条件:
- `npm test`（テスト 0 件の状態で `--passWithNoTests`）と `npx tsc --noEmit` が成功する。

## S2. core 層の実装とテスト

やること:
- `src/core/attendees.ts`、`placeholder.ts`、`template.ts`、`storage.ts` を、spec.md 5 章のシグネチャどおりに実装する。
- `tests/core/*.test.ts` に、spec.md 8 章の観点でテストを書く。

完了条件:
- `npm test` で core のテストがすべて成功する。
- `src/core/` が `Office` を参照していない（`Office.` で grep して 0 件）。

## S3. office 層の実装

やること:
- `src/office/appointment.ts`: `promisify` ヘルパーと `createOfficeAppointmentGateway()`。
- `src/office/settings.ts`: `createOfficeSettingsGateway()`。

完了条件:
- `npx tsc --noEmit` が成功する（Office.js の型と整合している）。
- 動作は S8 の手動確認で検証する。

## S4. app 層（テンプレート適用）の実装とテスト

やること:
- `src/app/applyTemplate.ts` を、spec.md 5 章の処理順どおりに実装する。
- `tests/app/applyTemplate.test.ts` に、モックの `AppointmentGateway` を使い、spec.md 8 章の ①〜⑯ をテストする。

完了条件:
- `npm test` で ①〜⑯ がすべて成功する。

## S5. マニフェストとアイコン

やること:
- `manifest.xml` を作成する（新しい GUID を発行、spec.md 3 章の内容、URL は `https://localhost:3000/`）。
- `assets/` に 16/32/64/80/128 px のアイコン（PNG）を用意する。

完了条件:
- `npm run validate` が成功する。

## S6. 作業ウィンドウ（画面）の実装

やること:
- `src/taskpane/taskpane.html`、`taskpane.css`、`taskpane.ts`（`Office.onReady`、画面の切り替え、メッセージバー）。
- `views/listView.ts`、`manageView.ts`、`editView.ts` を spec.md 5 章の画面仕様どおりに実装する。
- 保存処理: `readOnly` を確認 → 検証 → `exceedsLimit` で容量を確認 → `settings.save`。失敗したらメモリ上の一覧を元に戻す（spec.md 6 章）。
- 読み込み失敗時は `readOnly` にして、［新規作成］の代わりに［初期化］を表示する（spec.md 5 章）。

完了条件:
- `npx tsc --noEmit` が成功する。
- 画面の動作は S8 で確認する。

## S7. ビルド設定

やること:
- `webpack.config.js`: エントリー `taskpane`、`html-webpack-plugin`、`assets/` と `manifest.xml` のコピー。本番ビルドではマニフェスト内の `https://localhost:3000/` を定数 `urlProd` に置き換える。開発サーバーは `office-addin-dev-certs` の証明書を使い、ポート 3000 で起動する。
- 開発用証明書をインストールする: `npx office-addin-dev-certs install`（ユーザーの確認ダイアログが出る）。

完了条件:
- `npm run build` が成功し、`dist/` に `taskpane.html`、`taskpane.js`、`assets/`、`manifest.xml` が出力される。
- `npm run dev-server` の起動後、ブラウザーで `https://localhost:3000/taskpane.html` が証明書エラーなしで開く。

## S8. 手動動作確認（新しい Outlook）

準備:

```powershell
npm run dev-server
```

ブラウザーで `https://aka.ms/olksideload` を開き、「Add-Ins for Outlook」ダイアログの「My add-ins → Add a custom add-in → Add from File」で `manifest.xml` を登録する。

requirement.md の「使いかた」と突き合わせて確認する:

| # | 操作 | 期待結果 |
|---|---|---|
| 1 | 予定表で 2026/11/05 10:00〜10:30 を選び、新しいイベントを作成する | 作成フォームのリボンに「テンプレート」ボタンが表示される |
| 2 | ボタンを押す | 作業ウィンドウが開き、テンプレートが 0 件のため案内と［新規作成］が表示される |
| 3 | テンプレート「定例会議」を作成する（件名 `{日付} 定例会議`、本文 `{開始時刻}〜{終了時刻}` と改行を含む 2 行、場所、必須出席者 `a@example.com`、会議時間 60） | 保存すると一覧に表示される |
| 4 | 「定例会議」を選んで［適用］を押す | 件名 `2026/11/05(木) 定例会議`、終了日時 11:00、本文 `10:00〜11:00`（改行が保持される）、場所、必須出席者が設定され、成功メッセージが表示される |
| 5 | 必須出席者に `a@example.com` を手動で入れてから、もう一度適用する | 出席者が重複して追加されない |
| 6 | 会議時間を空欄にしたテンプレートを適用する | 終了日時が変わらない |
| 7 | 不正なメールアドレスや 51 文字の名前で保存する | エラーが表示され、保存されない |
| 8 | テンプレートを編集・削除する（インラインの確認表示を経由） | 一覧に反映される |
| 9 | 作業ウィンドウを閉じて開き直す。Outlook on the web でも開く | 同じテンプレートが表示される（roamingSettings） |
| 10 | 内容を確認して［送信］を押す | 出席者に会議開催通知が届く |
| 11 | 本文を入力してからテンプレートを適用する | テンプレートの本文が先頭に挿入され、入力済みの本文が次の行以降に残る |
| 12 | 署名が自動で入るフォーム、および Teams 会議をオンにしたフォームに適用する | 署名と Teams の参加情報が残る |
| 13 | 同じテンプレートをもう一度適用する | 本文が先頭に重ねて挿入される |
| 14 | `roamingSettings` の `eventTemplates` を壊れた値にして、作業ウィンドウを開き直す | 警告が表示され、［新規作成］が表示されず、既存の値が変更されない |
| 15 | 14 の状態で［初期化］→［やめる］を押し、次に［初期化］→［初期化する］を押す | ［やめる］では値が変わらない。［初期化する］で成功メッセージと 0 件の案内が表示され、新規作成して保存できる |
| 16 | 終日イベントのフォームに、会議時間ありのテンプレートを適用する | 終日のまま変わらず、本文などの他の項目は設定される |
| 17 | 開催者として既存のイベントを開いてテンプレートを適用し、［送信］を押す | 変更内容が設定され、更新通知を送信できる |
| 18 | 同じアドレスを必須と任意の両方に入れたテンプレートを適用する | 必須出席者にだけ追加される |
| 19 | 名前だけを入力して保存する | エラーが表示され、保存されない |
| 20 | 出席者のないテンプレートを適用する | 完了メッセージに「送信または保存してください」と表示され、［保存］で保存できる |
| 21 | 機能の追加前に保存したテンプレートがある状態で作業ウィンドウを開く | 警告なしで一覧に表示され、編集画面の公開範囲は「変更しない」になっている |
| 22 | 公開範囲が「非公開」のテンプレートを適用して保存し、別のユーザーの予定表で確認する | フォームの非公開がオンになり、別のユーザーには詳細が表示されない |
| 23 | 非公開にしたフォームに、公開範囲が「公開」のテンプレートを適用する | フォームの非公開がオフになる |
| 24 | 非公開にしたフォームに、公開範囲が「変更しない」のテンプレートを適用する | フォームの非公開がオンのまま変わらない |
| 25 | カテゴリ一覧にある名前を 2 つ指定したテンプレートを適用して保存し、開き直す | フォームに 2 つのカテゴリが表示され、保存後も残る |
| 26 | 同じカテゴリがすでに付いたフォームに適用する。別のカテゴリが付いたフォームにも適用する | 重複せず、既存のカテゴリも残る |
| 27 | カテゴリ一覧にない名前を指定したテンプレートを適用する | 「カテゴリ」のエラーが表示され、他の項目は設定される |
| 28 | 新しい Outlook アプリで 25 を実行する | Outlook on the web と同じ結果になる |

完了条件:
- 1〜28 のすべてが期待結果どおりである。

## S9. 最終確認

やること:
- `npm test`、`npx tsc --noEmit`、`npm run validate`、`npm run build` をすべて実行する。
- requirement.md の「要求仕様」の各項目を、実装箇所（ファイル）と S8 の確認結果に対応付けて漏れがないことを確認する。
- 実装中に spec.md から変更した点があれば、spec.md と requirement.md を更新する。
- `coverage/` などの副産物を削除する。

完了条件:
- すべてのコマンドが成功し、要求仕様の全項目が実装・確認済みである。
