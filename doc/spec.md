# 設計: Outlook 予定表テンプレートアドイン

入力: [requirement.md](requirement.md)

## 1. 技術スタック

| 項目 | 採用 | 理由 |
|---|---|---|
| アドイン形式 | Office アドイン（Outlook Web アドイン） | 新しい Outlook で動く唯一の形式 |
| マニフェスト | アドイン専用 XML マニフェスト（`manifest.xml`） | 「Add-Ins for Outlook」ダイアログの「Add a custom add-in → Add from File」で直接サイドロードできる |
| 言語 | TypeScript 5 系 | Office.js の型定義（`@types/office-js`）を使える。TypeScript 7 は `ts-loader` / `ts-jest` が未対応のため使わない |
| UI | フレームワークを使わない DOM 操作と CSS | 画面は 3 つだけなので React などは不要。依存関係を少なく保つ |
| ビルド | webpack（`ts-loader`、`html-webpack-plugin`、`copy-webpack-plugin`） | Office アドインの標準的な構成（`yo office` の TypeScript テンプレート相当） |
| 開発用 HTTPS | `office-addin-dev-certs` で発行した証明書と `webpack-dev-server`（`https://localhost:3000`） | Office アドインは HTTPS が必須 |
| 本番ホスト | GitHub Pages（静的ホスティング） | 無料。サーバー処理は不要 |
| テスト | Jest + `ts-jest`（実行環境は `node`） | 純粋なロジックと、Office.js のモックを使った適用処理をテストする。DOM のテストはしないため jsdom は使わない（jsdom には `TextEncoder` もない） |
| 実行環境 | Node.js 24 / npm 12（開発機で確認済み） | |

## 2. ディレクトリ構成

```
outlook/
├─ manifest.xml                # dev URL (https://localhost:3000) version
├─ package.json
├─ tsconfig.json
├─ webpack.config.js           # production build rewrites manifest URLs to GitHub Pages
├─ jest.config.js
├─ assets/                     # icons (16/32/64/80/128 px)
├─ src/
│  ├─ core/                    # pure logic, no Office.js dependency
│  │  ├─ template.ts           # EventTemplate type, validation, factory
│  │  ├─ placeholder.ts        # placeholder expansion and date formatting
│  │  ├─ attendees.ts          # email parsing, dedup
│  │  └─ storage.ts            # serialize / deserialize / size check
│  ├─ office/                  # thin adapters over Office.js
│  │  ├─ appointment.ts        # AppointmentGateway (get/set fields of the compose item)
│  │  └─ settings.ts           # SettingsGateway (roamingSettings)
│  ├─ app/
│  │  └─ applyTemplate.ts      # orchestrates applying a template via the gateways
│  └─ taskpane/
│     ├─ taskpane.html
│     ├─ taskpane.css          # copied as-is by copy-webpack-plugin (no css-loader)
│     ├─ taskpane.ts           # entry point: Office.onReady, view routing, AppContext impl
│     ├─ context.ts            # AppContext / View types shared by views
│     ├─ dom.ts                # h() helper: builds DOM without innerHTML
│     └─ views/
│        ├─ listView.ts        # template list + apply
│        ├─ manageView.ts      # template list for edit/delete
│        └─ editView.ts        # create / edit form
├─ tests/
│  ├─ core/*.test.ts
│  └─ app/applyTemplate.test.ts
└─ doc/
```

依存の向き: `taskpane → app → office / core`、`office → core`。`core` は何にも依存しない。Office.js を呼ぶのは `office/` だけにして、`app` 以下はゲートウェイのインターフェース経由でテストできるようにする。

## 3. マニフェスト

| 要素 | 値 |
|---|---|
| `DisplayName` | 予定表テンプレート |
| `Requirements` | `Mailbox` 1.3 以上（`body.setAsync` に 1.3 が必要。それ以外の API は 1.1） |
| `Permissions` | `ReadWriteItem` |
| `ExtensionPoint` | `AppointmentOrganizerCommandSurface`（予定の作成フォーム／開催者モード） |
| ボタン | ラベル「テンプレート」、アクション `ShowTaskpane`（`taskpane.html`） |
| `FormSettings` | `ItemEdit` に `DesktopSettings`（`SourceLocation` = `taskpane.html`） |

- `manifest.xml` には開発用の URL（`https://localhost:3000/`）を書く。本番ビルド（`npm run build`）で webpack が GitHub Pages の URL に置き換え、`dist/manifest.xml` を出力する。
- `Id`（GUID）はプロジェクト作成時に一度だけ発行し、その後は変更しない。

## 4. データモデル

```ts
// src/core/template.ts
export interface EventTemplate {
  id: string;                  // crypto.randomUUID()
  name: string;                // required, 1-50 chars, unique (case-insensitive)
  subject: string;             // may contain placeholders
  body: string;                // plain text, may contain placeholders
  location: string;
  requiredAttendees: string[]; // email addresses
  optionalAttendees: string[];
  durationMinutes: number | null; // integer 1-1440, null = keep end time
}
```

`roamingSettings` の保存形式（キー: `eventTemplates`）:

```json
{ "version": 1, "templates": [ /* EventTemplate[] */ ] }
```

- `version` は将来スキーマを変えたときの移行に使う。読み込み時に未知の `version` だった場合や JSON が壊れていた場合は、空の一覧として扱い、警告を表示する（データは上書きしない）。
- 一覧の表示順は保存されている配列の順とする（新規作成は末尾に追加）。

## 5. モジュールと主要シグネチャ

### core/template.ts

```ts
export type ValidationError = { field: keyof EventTemplate; message: string };
export function createEmptyTemplate(): EventTemplate;
export function validateTemplate(t: EventTemplate, others: EventTemplate[]): ValidationError[];
```

検証ルール:
- `name`: 必須、50 文字以内、他のテンプレートと重複しない（大文字・小文字は区別しない）。
- `requiredAttendees` / `optionalAttendees`: 全件が `isValidEmail` を満たす。
- `durationMinutes`: `null` または 1〜1440 の整数。

### core/attendees.ts

```ts
export function parseEmailList(input: string): string[];   // split by , ; newline, trim, drop empty
export function isValidEmail(s: string): boolean;          // /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function mergeAttendees(existing: string[], toAdd: string[]): string[]; // returns only new ones, case-insensitive dedup
```

### core/placeholder.ts

```ts
export interface LocalDateTime { year: number; month: number; day: number; hours: number; minutes: number } // month: 1-12
export interface PlaceholderValues { date: string; start: string; end: string }
export function buildPlaceholderValues(start: LocalDateTime, end: LocalDateTime): PlaceholderValues;
export function expandPlaceholders(text: string, v: PlaceholderValues): string;
export function plainTextToHtml(text: string): string;     // escape &<>"' and convert \r?\n to <br>
```

- `{日付}` → `yyyy/MM/dd(曜)`（曜日は `日月火水木金土`。`Date.UTC(year, month-1, day)` の `getUTCDay()` から求めるので、実行環境のタイムゾーンに左右されない）。
- `{開始時刻}` / `{終了時刻}` → `HH:mm`（24 時間制、0 埋め）。
- 未定義の `{...}` はそのまま残す。

### core/storage.ts

```ts
export const SETTINGS_KEY = "eventTemplates";
export const MAX_BYTES = 30000; // margin below the ~32KB roamingSettings limit
export function serialize(templates: EventTemplate[]): string;
export function deserialize(raw: unknown): { templates: EventTemplate[]; warning?: string };
export function byteSize(s: string): number;               // UTF-8 bytes via TextEncoder
```

### office/appointment.ts

```ts
export interface AppointmentGateway {
  getStart(): Promise<Date>;
  getEnd(): Promise<Date>;
  setEnd(d: Date): Promise<void>;
  setSubject(s: string): Promise<void>;
  setBodyHtml(html: string): Promise<void>;
  setLocation(s: string): Promise<void>;
  getRequiredAttendees(): Promise<string[]>;
  addRequiredAttendees(emails: string[]): Promise<void>;
  getOptionalAttendees(): Promise<string[]>;
  addOptionalAttendees(emails: string[]): Promise<void>;
  toLocal(d: Date): LocalDateTime; // wraps mailbox.convertToLocalClientTime (month 0-based -> 1-based)
}
export function createOfficeAppointmentGateway(): AppointmentGateway;
```

- `*Async` のコールバックを Promise に包む共通ヘルパー `promisify` を持つ。`asyncResult.status === Failed` のときは `asyncResult.error.message` を持つ `Error` で reject する。
- 本文は `body.setAsync(html, { coercionType: Office.CoercionType.Html })` で設定する。
- 日時の表示用の変換は `Office.context.mailbox.convertToLocalClientTime` を使い、メールボックスのタイムゾーンに合わせる（ブラウザーのタイムゾーンではない）。

### office/settings.ts

```ts
export interface SettingsGateway {
  load(): unknown;                    // roamingSettings.get(SETTINGS_KEY)
  save(json: string): Promise<void>;  // set + saveAsync
}
export function createOfficeSettingsGateway(): SettingsGateway;
```

### app/applyTemplate.ts

```ts
export interface ApplyResult { failures: { field: string; message: string }[] }
export class DateTimeUnavailableError extends Error {} // thrown when step 1 fails
export async function applyTemplate(t: EventTemplate, appt: AppointmentGateway): Promise<ApplyResult>;
```

処理順:
1. `getStart()` と `getEnd()` を取得する（失敗した場合は、以降の処理を行わずに中断してエラーにする）。
2. `durationMinutes` があれば、`end = start + durationMinutes` として `setEnd()` を呼ぶ。
3. `toLocal(start)` と `toLocal(end)` からプレースホルダーの値を作る（`end` は手順 2 の結果）。
4. 件名・本文・場所のうち、空でない項目だけを設定する。件名と本文はプレースホルダーを展開し、本文は `plainTextToHtml` で HTML にする。
5. 必須・任意出席者は、既存の出席者を取得し、`mergeAttendees` で重複を除いてから追加する。追加するものがなければ API を呼ばない。

- 手順 2〜5 は項目ごとに `try/catch` し、失敗しても次の項目に進む。失敗は `failures` に集めて返し、ロールバックはしない（要求仕様どおり）。
- 項目名の表示: `終了日時`、`件名`、`本文`、`場所`、`必須出席者`、`任意出席者`。

### taskpane/

- `taskpane.ts`: `Office.onReady` の後にテンプレートを読み込み、`listView` を表示する。画面の切り替えは `main` 要素の中身を差し替えるだけの単純なルーターで行う。
- 3 つの画面:

| 画面 | 内容 | 操作 |
|---|---|---|
| 一覧（`listView`） | テンプレート名の一覧（ラジオボタン）。0 件のときは案内と［新規作成］ | ［適用］、［テンプレート管理］ |
| 管理（`manageView`） | テンプレート名の一覧と各行の［編集］［削除］ | ［新規作成］、［戻る］ |
| 編集（`editView`） | 名前、件名、本文（textarea）、場所、必須出席者、任意出席者（textarea。カンマ・セミコロン・改行区切り）、会議時間（数値。空欄可）。差し込みできるプレースホルダーの説明を表示 | ［保存］、［キャンセル］ |

- 削除の確認は、画面内のインラインの確認表示（［削除する］［やめる］）で行う。作業ウィンドウでは `window.confirm` が使えないため。
- メッセージは画面上部のメッセージバーに表示する（成功・エラー・警告の 3 種類）。

## 6. エラーハンドリング方針

| 状況 | 検出箇所 | ユーザーへの表示 |
|---|---|---|
| 設定データが壊れている／未知の version | `storage.deserialize` | 警告「保存済みテンプレートを読み込めませんでした」。保存するまで既存データは上書きしない |
| 入力検証エラー | `validateTemplate` | 該当フィールドの下にメッセージを表示し、保存しない |
| 容量オーバー（30,000 バイト超） | `editView`（保存前に `byteSize` で確認） | エラー「保存容量の上限を超えます。本文を短くするか、不要なテンプレートを削除してください」 |
| `saveAsync` の失敗 | `settings.save` | エラー「保存に失敗しました: {message}」。画面の一覧は保存前のまま（保存は毎回一覧全体を書き込むので、`roamingSettings` を元に戻す処理は不要） |
| 開始・終了日時を取得できない | `applyTemplate` 手順 1 | エラー「イベントの日時を取得できませんでした: {message}」 |
| 項目ごとの設定失敗 | `applyTemplate` 手順 2〜5 | エラー「次の項目を設定できませんでした: 件名（{message}）、…」 |
| 全項目を設定できた | | 成功「テンプレート『{name}』を適用しました。内容を確認して［送信］してください」 |

例外は `office/` で `Error` に変換し、画面側（`taskpane/views`）でメッセージにする。`core/` は例外を投げずに、検証結果を戻り値で返す。

## 7. ビルド・配布

| npm スクリプト | 内容 |
|---|---|
| `npm run dev-server` | `https://localhost:3000` で開発サーバーを起動する |
| `npm run build` | `dist/` に本番用ファイルと、GitHub Pages の URL に置き換えた `manifest.xml` を出力する |
| `npm test` | Jest でテストを実行する |
| `npm run validate` | `office-addin-manifest validate manifest.xml` でマニフェストを検証する |

サイドロードの手順（新しい Outlook / Outlook on the web 共通）:
1. 開発中: `npm run dev-server` を起動したまま、ブラウザーで `https://aka.ms/olksideload` を開き、「Add-Ins for Outlook」ダイアログの「My add-ins → Add a custom add-in → Add from File」で `manifest.xml` を登録する。
2. 本番: `dist/` を GitHub Pages に公開し、`dist/manifest.xml` を同じ手順で登録する（開発用のマニフェストは先に削除する）。

本番 URL は `https://circleratio.github.io/outlook_calendar_template/` とし、`webpack.config.js` の定数 `urlProd` で指定する。

## 8. テスト方針

| 対象 | 観点 |
|---|---|
| `placeholder` | 日付形式・曜日（月末・年末・閏日 2028/02/29）、時刻の 0 埋め、複数回の出現、未定義のプレースホルダーを残す、HTML エスケープと改行の変換 |
| `attendees` | 区切り文字の混在、前後の空白、空要素、大文字・小文字を区別しない重複除去、不正なアドレス |
| `template` | 名前の必須・長さ（50 / 51 文字）・重複（編集中の自分自身は除く）、会議時間の境界値（0 / 1 / 1440 / 1441 / 小数 / null） |
| `storage` | 往復変換、壊れた JSON、未知の version、`undefined`（未保存）、日本語を含む場合のバイト数 |
| `applyTemplate` | モックのゲートウェイで、①全項目の適用、②空の項目を設定しない、③会議時間が null なら終了日時を変えない、④`{終了時刻}` に適用後の終了時刻を使う、⑤重複する出席者を追加しない、⑥途中の失敗を集めて残りの項目を処理する、⑦日時を取得できないときに中断する |

画面（`taskpane/`）と `office/` のアダプターは自動テストの対象外とし、実際の新しい Outlook での手動確認で担保する。
