# Novel Writer - AI小説自動生成アプリケーション

Claude APIを活用し、複数の専門AIエージェントが協調して小説を自動生成するWebアプリケーション。

## コンセプト

1. **準備フェーズ**: ユーザーがClaudeとチャットしながらプロット・キャラクター・世界観を構築
2. **自動執筆フェーズ**: 7つの専門エージェントがパイプラインで章ごとに自動執筆
3. **レビューフェーズ**: モバイルで小説形式の閲読、タップで指摘→一括送信→AI修正

---

## Tech Stack

| カテゴリ | 技術 |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| UIコンポーネント | shadcn/ui |
| AI | Claude API (@anthropic-ai/sdk) |
| DB | PostgreSQL (Neon Serverless) + Drizzle ORM |
| State管理 | Zustand |
| アイコン | Lucide React |
| フォント | Geist Sans / Mono, Noto Serif JP (リーダー用) |
| デプロイ | Vercel |

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` を作成:

```env
# Neon (Vercelダッシュボードから Neon 連携時に自動設定される)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. データベースマイグレーション

```bash
npm run db:push      # スキーマをDBに直接反映（開発時）
npm run db:generate  # マイグレーションファイル生成
npm run db:migrate   # マイグレーション実行
npm run db:studio    # Drizzle Studio（DBブラウザ）
```

### 4. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 でアクセス。

---

## ディレクトリ構成

```
src/
├── app/                                  # Next.js App Router
│   ├── layout.tsx                        # ルートレイアウト（フォント、TooltipProvider）
│   ├── page.tsx                          # / → プロジェクト一覧
│   ├── globals.css                       # Tailwind + shadcn/ui CSSテーマ
│   │
│   ├── projects/
│   │   └── new/page.tsx                  # /projects/new → 新規プロジェクト作成
│   │
│   ├── p/[projectId]/
│   │   ├── layout.tsx                    # プロジェクトレイアウト（サイドバー）
│   │   ├── page.tsx                      # ダッシュボード（クイックリンク付き）
│   │   ├── prepare/
│   │   │   ├── chat/page.tsx             # Claudeとのチャット
│   │   │   ├── plot/page.tsx             # プロット構造エディタ
│   │   │   ├── characters/page.tsx       # キャラクター管理
│   │   │   ├── world/page.tsx            # 世界観設定
│   │   │   └── foreshadowing/page.tsx    # 伏線管理
│   │   ├── write/page.tsx                # 執筆ダッシュボード
│   │   ├── review/page.tsx               # レビューハブ
│   │   ├── agents/page.tsx               # エージェント設定
│   │   └── export/page.tsx               # エクスポート
│   │
│   └── api/
│       ├── projects/
│       │   ├── route.ts                  # GET: 一覧 / POST: 作成
│       │   └── [projectId]/route.ts      # GET / PUT / DELETE
│       ├── chat/
│       │   ├── route.ts                  # POST: ストリーミングチャット（SSE）
│       │   └── sessions/
│       │       ├── route.ts              # GET / POST: セッション管理
│       │       └── [sessionId]/messages/route.ts  # GET: メッセージ一覧
│       ├── characters/
│       │   ├── route.ts                  # GET / POST / PUT / DELETE
│       │   └── relationships/route.ts    # キャラクター関係性
│       ├── chapters/route.ts             # GET / POST / PUT / DELETE
│       ├── plot/route.ts                 # GET / POST / PUT / DELETE
│       ├── world-settings/route.ts       # GET / POST / PUT / DELETE
│       ├── annotations/route.ts          # GET / POST / PUT / DELETE
│       ├── foreshadowing/route.ts        # GET / POST / PUT / DELETE
│       ├── style-references/route.ts     # GET / POST / PUT / DELETE
│       ├── agent-tasks/route.ts          # GET / POST / PUT
│       ├── agents/configs/route.ts       # GET / POST / PUT
│       └── export/route.ts              # GET: エクスポート
│
├── components/
│   ├── ui/                               # shadcn/ui コンポーネント (16個)
│   │   ├── button, card, dialog, input, textarea, badge, tabs,
│   │   ├── separator, sheet, scroll-area, dropdown-menu,
│   │   └── avatar, popover, tooltip, select, label
│   ├── layout/
│   │   ├── sidebar.tsx                   # プロジェクトサイドバーナビゲーション
│   │   └── header.tsx                    # ヘッダー（モバイルメニュー付き）
│   ├── chat/
│   │   ├── chat-container.tsx            # チャット全体制御（セッション管理・ストリーミング）
│   │   ├── chat-messages.tsx             # メッセージ表示（バブルUI・ストリーミング対応）
│   │   ├── chat-input.tsx                # メッセージ入力（Enter送信・Shift+Enter改行）
│   │   └── session-list.tsx              # セッション一覧（トピック別アイコン付き）
│   ├── plot/
│   │   └── plot-editor.tsx               # プロット構造エディタ
│   ├── characters/
│   │   └── character-list.tsx            # キャラクター一覧＆編集
│   ├── world/
│   │   └── world-settings-list.tsx       # 世界観設定一覧＆編集
│   ├── foreshadowing/
│   │   └── foreshadowing-list.tsx        # 伏線管理
│   ├── write/
│   │   └── writing-dashboard.tsx         # 執筆ダッシュボード
│   ├── review/
│   │   └── review-hub.tsx                # レビューハブ
│   └── agents/
│       ├── agent-config-list.tsx          # エージェント設定一覧
│       └── style-reference-list.tsx       # 文体参照管理
│
├── lib/
│   ├── db/
│   │   ├── index.ts                      # Drizzle クライアント（Neon serverless・遅延初期化）
│   │   └── schema.ts                     # 全15テーブルのスキーマ定義
│   ├── agents/
│   │   ├── base-agent.ts                 # エージェント基底クラス（ストリーミング対応）
│   │   ├── context-builder.ts            # プロジェクトコンテキスト組み立て
│   │   ├── pipeline.ts                   # マルチエージェントパイプライン制御
│   │   └── prompts/                      # 各エージェントのシステムプロンプト
│   │       ├── index.ts                  # 共通エクスポート＆デフォルト設定
│   │       ├── coordinator.ts            # コーディネーター
│   │       ├── plot-architect.ts         # プロット構成
│   │       ├── character-manager.ts      # キャラクター管理
│   │       ├── writer.ts                 # 執筆
│   │       ├── editor.ts                 # 編集・校正
│   │       ├── world-builder.ts          # 世界観構築
│   │       └── continuity-checker.ts     # 整合性チェック
│   ├── claude/
│   │   ├── client.ts                     # Anthropic SDK ラッパー（ストリーミング対応）
│   │   └── streaming.ts                  # SSEストリーミングユーティリティ
│   └── utils.ts                          # shadcn/ui ユーティリティ (cn)
│
├── types/
│   ├── project.ts                        # Project, Character, Chapter等の型定義
│   ├── agent.ts                          # AgentType, StreamEvent, PipelinePlan
│   └── annotation.ts                     # Annotation, AnnotationType
│
├── hooks/                                # (未実装)
└── stores/                               # (未実装)
```

---

## データベーススキーマ

15テーブルで構成。`src/lib/db/schema.ts` で Drizzle ORM により定義。

### コアエンティティ

| テーブル | 概要 | 主なカラム |
|---|---|---|
| `projects` | 小説プロジェクト | title, genre, status, language, settings |
| `plot_structure` | プロット構造（1プロジェクト1つ） | structure_type (起承転結/三幕/英雄の旅), synopsis, themes |
| `plot_points` | プロットポイント | act, title, description, sort_order, chapter_hint |
| `characters` | 登場人物 | name, role, personality, speech_pattern, backstory, goals |
| `character_relationships` | キャラクター間の関係 | character_a/b, relationship_type, evolves_to |
| `world_settings` | 世界観設定 | category (地理/魔法/文化等), title, content |

### 執筆関連

| テーブル | 概要 | 主なカラム |
|---|---|---|
| `chapters` | 章 | chapter_number, title, content, status, summary_brief/detailed |
| `chapter_versions` | 章のバージョン履歴 | version_number, content, change_summary, created_by |

### レビュー関連

| テーブル | 概要 | 主なカラム |
|---|---|---|
| `annotations` | アノテーション（指摘） | paragraph_index, start/end_offset, anchor_text, comment, type |
| `annotation_batches` | 一括送信バッチ | annotation_ids, status, agent_response |

### エージェント関連

| テーブル | 概要 | 主なカラム |
|---|---|---|
| `agent_configs` | エージェント設定 | agent_type, system_prompt, model, temperature, max_tokens |
| `agent_tasks` | タスクキュー＆実行ログ | agent_type, task_type, status, input_context, output, token_usage |

### チャット関連

| テーブル | 概要 | 主なカラム |
|---|---|---|
| `chat_sessions` | チャットセッション | topic (plot/characters/world/general), is_committed |
| `chat_messages` | チャットメッセージ | role, content, metadata |

### 伏線＆文体

| テーブル | 概要 | 主なカラム |
|---|---|---|
| `foreshadowing` | 伏線管理 | title, type (伏線/チェーホフの銃/モチーフ/ミスリード), status, planted/target_chapter, priority |
| `style_references` | 文体参照 | title, sample_text, style_notes, is_active |

---

## エージェントシステム

7つの専門エージェントがパイプラインで協調動作。各エージェントはClaude APIを個別のシステムプロンプト＋コンテキストで呼び出す。

### パイプライン（1章あたりの実行順序）

```
コーディネーター
  │  タスク計画・実行順序の決定
  ▼
プロット構成エージェント
  │  章のシーン構成・ビート・伏線のアウトライン作成
  ▼
世界観設定エージェント
  │  章で必要な舞台・環境・ルールの詳細提供
  ▼
キャラクター管理エージェント
  │  登場キャラの状態・口調・関係性ブリーフ作成
  ▼
執筆エージェント
  │  上記3つの出力＋前章末尾を受けて本文執筆
  ▼
編集・校正エージェント
  │  文章品質チェック、ユーザー指摘への対応
  ▼
整合性チェックエージェント
     章間の矛盾検出、タイムライン検証
```

### コンテキスト管理（トークン制限対策）

長編小説は全文で200Kトークンを超えるため、階層的サマリーでコンテキストを管理:

| 対象 | コンテキスト形式 | トークン目安 |
|---|---|---|
| 直前1章 | 全文 | ~8,000 |
| 2-3章前 | 詳細サマリー | ~1,000/章 |
| それ以前 | 簡易サマリー | ~200/章 |
| 登場キャラクター | キャラシート（関連者のみ） | ~3,000-8,000 |
| 世界観設定 | 関連カテゴリのみ | ~2,000-5,000 |

各章完了時にClaude APIでサマリーを自動生成し、`chapters.summary_brief` / `summary_detailed` に保存。

---

## モバイルレビューシステム

最重要のUX機能。モバイルブラウザで小説を書籍形式で閲読し、気になる箇所をタップして指摘できる。

### リーダービュー
- 書籍風レイアウト（max-width: 640px）
- Noto Serif JP フォント、行間 1.8-2.0
- フォントサイズ 16-18px（調整可能）
- ダークモード対応

### タップアノテーション操作フロー
1. 段落をタップ → ハイライト＋ポップオーバー表示
2. （任意）ロングプレスでテキスト範囲選択
3. コメント種別を選択: コメント / 問題 / 提案 / 称賛
4. コメント入力 → ローカル即保存（Zustand）→ DB永続化
5. アノテーション済み段落にカラードットを表示
6. 「修正依頼を送信」で一括バッチ送信
7. 編集エージェントが全指摘を処理して章を修正

### アノテーション位置の堅牢性
- `anchor_text`（選択テキスト）を段落インデックス・オフセットと共に保存
- 編集後の新バージョンではファジーマッチングで位置を再計算
- マッチ不可のアノテーションは「孤立」として別セクションに表示

---

## 実装ロードマップ

### Phase 1: 基盤セットアップ ✅ 完了

| # | タスク | 状態 | 成果物 |
|---|---|---|---|
| 1 | Next.js + Tailwind + TypeScript 初期化 | ✅ | プロジェクト基盤 |
| 2 | shadcn/ui セットアップ | ✅ | 16 UIコンポーネント |
| 3 | Drizzle ORM スキーマ定義 | ✅ | `src/lib/db/schema.ts` (15テーブル) |
| 4 | 型定義 | ✅ | `src/types/` (project, agent, annotation) |
| 5 | 基本レイアウト | ✅ | サイドバー、ヘッダー、モバイルメニュー |
| 6 | ページルーティング | ✅ | 14ルート (全ページ構造) |
| 7 | プロジェクト API | ✅ | CRUD (`/api/projects`) |
| 8 | 新規プロジェクト作成UI | ✅ | ジャンル・構造タイプ選択フォーム |

### Phase 2: 準備フェーズ ✅ ほぼ完了

| # | タスク | 状態 | 成果物 |
|---|---|---|---|
| 9 | チャットUI＆ストリーミングAPI | ✅ | `components/chat/*` + `/api/chat` (SSEストリーミング) |
| 10 | チャットセッション管理 | ✅ | トピック別（プロット/キャラ/世界観/一般）セッション作成・切替 |
| 11 | プロジェクトコンテキスト自動注入 | ✅ | `context-builder.ts` — キャラ・プロット・世界観・伏線をClaudeに自動送信 |
| 12 | プロットエディタ | ✅ | `plot-editor.tsx` + `/api/plot` |
| 13 | キャラクター管理 | ✅ | `character-list.tsx` + `/api/characters` (関係性含む) |
| 14 | 世界観設定 | ✅ | `world-settings-list.tsx` + `/api/world-settings` |
| 15 | 伏線管理 | ✅ | `foreshadowing-list.tsx` + `/api/foreshadowing` |
| 16 | チャットコミット機能 | ❌ | スキーマに `is_committed` / `committed_to` あり、ロジック未実装 |

### Phase 3: エージェントシステム ✅ バックエンド完了 / フロントエンド基盤完了

| # | タスク | 状態 | 成果物 |
|---|---|---|---|
| 17 | BaseAgent＆ContextBuilder | ✅ | `base-agent.ts` + `context-builder.ts` |
| 18 | システムプロンプト作成 (7エージェント) | ✅ | `prompts/` — 日本語小説に特化した専門プロンプト |
| 19 | パイプライン実行エンジン | ✅ | `pipeline.ts` — ステップ依存関係・ストリーミング対応 |
| 20 | エージェント設定ページ | ✅ | `agent-config-list.tsx` + `/api/agents/configs` |
| 21 | 文体参照管理 | ✅ | `style-reference-list.tsx` + `/api/style-references` |
| 22 | 執筆ダッシュボード | ✅ | `writing-dashboard.tsx` |
| 23 | タスクキュー API | ✅ | `/api/agent-tasks` |
| 24 | パイプライン公開APIエンドポイント | ❌ | パイプライン実行を外部から起動するAPIが未実装 |
| 25 | 章サマリー自動生成 | ❌ | 章完了時のサマリー自動生成ロジック未実装 |
| 26 | 一時停止/再開/キャンセル | ❌ | パイプラインの途中制御未実装 |

### Phase 4: レビューシステム 🔧 UI基盤のみ

| # | タスク | 状態 | 成果物 |
|---|---|---|---|
| 27 | レビューハブ | ✅ | `review-hub.tsx` |
| 28 | アノテーション API | ✅ | `/api/annotations` |
| 29 | ReaderView (書籍風レイアウト) | ❌ | Noto Serif JP設定済み、リーダーUI未実装 |
| 30 | タップアノテーション＆ポップオーバー | ❌ | |
| 31 | アノテーションストア (Zustand) | ❌ | |
| 32 | バッチ送信＆編集エージェント連携 | ❌ | |

### Phase 5: 仕上げ 🔧 一部のみ

| # | タスク | 状態 | 成果物 |
|---|---|---|---|
| 33 | エクスポート | ✅ | `/api/export` + エクスポートページ |
| 34 | ダッシュボード強化 | ❌ | 進捗率、統計、ログ表示 |
| 35 | レスポンシブ最終調整 | ❌ | |

### Future: 認証＆マルチユーザー

| タスク | 概要 |
|---|---|
| 認証導入 | NextAuth.js / Clerk 等。メール/OAuth 認証 |
| マルチユーザー対応 | プロジェクト共有、共同レビュー |
| ミドルウェア | 認証チェック・APIガード（現在は未実装） |

---

## 実装済み API エンドポイント一覧

| エンドポイント | メソッド | 概要 |
|---|---|---|
| `/api/projects` | GET / POST | プロジェクト一覧・作成 |
| `/api/projects/[projectId]` | GET / PUT / DELETE | プロジェクト詳細・更新・削除 |
| `/api/chat` | POST | Claude ストリーミングチャット（SSE） |
| `/api/chat/sessions` | GET / POST | チャットセッション一覧・作成 |
| `/api/chat/sessions/[sessionId]/messages` | GET | メッセージ履歴取得 |
| `/api/characters` | GET / POST / PUT / DELETE | キャラクターCRUD |
| `/api/characters/relationships` | GET / POST / PUT / DELETE | キャラクター関係性 |
| `/api/chapters` | GET / POST / PUT / DELETE | 章CRUD |
| `/api/plot` | GET / POST / PUT / DELETE | プロット構造CRUD |
| `/api/world-settings` | GET / POST / PUT / DELETE | 世界観設定CRUD |
| `/api/annotations` | GET / POST / PUT / DELETE | アノテーションCRUD |
| `/api/foreshadowing` | GET / POST / PUT / DELETE | 伏線CRUD |
| `/api/style-references` | GET / POST / PUT / DELETE | 文体参照CRUD |
| `/api/agent-tasks` | GET / POST / PUT | エージェントタスクキュー |
| `/api/agents/configs` | GET / POST / PUT | エージェント設定 |
| `/api/export` | GET | エクスポート |

---

## 未実装 API（今後追加予定）

| エンドポイント | 概要 |
|---|---|
| `POST /api/chat/commit` | チャット会話の内容をプロジェクト設定に構造化保存 |
| `POST /api/agents/execute` | パイプライン実行（SSEストリーム返却） |
| `GET /api/agents/status` | パイプライン実行状態（SSE） |

---

## 現在の状態と次のステップ

### 動かすための前提条件

1. **`.env.local` の作成**（リポジトリに含まれていない）:
   ```env
   DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ANTHROPIC_API_KEY=sk-ant-...
   ```

2. **DBマイグレーション実行**（`drizzle/` ディレクトリは未生成）:
   ```bash
   npm install
   npm run db:push      # 開発時はこれだけでOK
   ```

3. **開発サーバー起動**:
   ```bash
   npm run dev           # http://localhost:3001 で起動（3000は別用途使用のため）
   ```

### デプロイ戦略

**本番: Vercel + Neon**
- Vercel ダッシュボードから Neon 統合を有効化 → `DATABASE_URL` が自動設定される
- プレビューデプロイごとに Neon ブランチ DB を自動作成可能（本番データを汚さない）
- `ANTHROPIC_API_KEY` のみ手動で環境変数に追加

```bash
# 初回セットアップ
npx vercel                              # プロジェクトリンク＆初回デプロイ
# → Vercel ダッシュボード > Storage > Neon で DB 連携（DATABASE_URL 自動設定）
npx vercel env add ANTHROPIC_API_KEY    # Claude API キーのみ手動追加

# 以降のデプロイ
npx vercel            # プレビューデプロイ
npx vercel --prod     # 本番デプロイ
```

**レスポンシブ対応の優先度**:
1. リーダービュー（Phase 4）— モバイルファースト必須。スマホで読んで指摘する核心機能
2. ダッシュボード — タブレット程度の対応があると便利
3. 管理画面（プロット/キャラ/世界観/エージェント設定）— PC前提でOK

### 重要な設計メモ

**チャットのコンテキスト自動注入**: チャットAPIはセッションのプロジェクトIDから自動的にキャラクター・プロット・世界観・伏線・既存章の情報をClaude のシステムプロンプトに注入する。会話が進むほどClaudeがプロジェクト全体を理解した上で回答する設計。

**チャットコミット機能の欠落**: 現在、Claudeとの会話で決めた内容（キャラ設定、プロット展開など）を手動でUIの各管理画面から再入力する必要がある。スキーマには `chat_sessions.is_committed` / `committed_to` が用意済みだが、会話→構造化データ→DB保存のフローが未実装。

**ハイブリッド運用の検討**: 初期設定（プロット骨格・主要キャラ・世界観）はClaude Code上で対話的に作成し、JSONシードデータとしてDB投入する方式も有効。UIチャットは執筆フェーズ以降の継続的な相談に活用する想定。

---

## NPMスクリプト

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動 (http://localhost:3001) |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバー起動 |
| `npm run lint` | ESLint実行 |
| `npm run db:push` | スキーマをDBに直接反映 |
| `npm run db:generate` | マイグレーションファイル生成 |
| `npm run db:migrate` | マイグレーション実行 |
| `npm run db:studio` | Drizzle Studio起動 |

---

## 検証方法

| フェーズ | 検証内容 |
|---|---|
| Phase 1 | `npm run build` 成功、全ルートのページ表示確認 |
| Phase 2 | プロジェクト作成 → チャットでプロット/キャラ構築 → 各管理画面でのCRUD確認 |
| Phase 3 | エージェントパイプライン起動 → SSEストリーミングで各エージェント出力確認 |
| Phase 4 | モバイルブラウザでレビュー画面 → タップアノテーション → バッチ送信 → 編集反映確認 |
| Phase 5 | 複数章生成後、整合性チェッカーの矛盾検出、エクスポート動作確認 |
