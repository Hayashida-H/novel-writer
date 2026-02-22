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
| DB | PostgreSQL (Supabase) + Drizzle ORM |
| State管理 | Zustand |
| アイコン | Lucide React |
| フォント | Geist Sans / Mono, Noto Serif JP (リーダー用) |
| デプロイ | Vercel / Railway / Fly.io (いずれも可) |

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` を編集:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres

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
│   │   ├── page.tsx                      # ダッシュボード
│   │   ├── prepare/
│   │   │   ├── chat/page.tsx             # Claudeとのチャット
│   │   │   ├── plot/page.tsx             # プロット構造エディタ
│   │   │   ├── characters/page.tsx       # キャラクター管理
│   │   │   └── world/page.tsx            # 世界観設定
│   │   ├── write/
│   │   │   ├── page.tsx                  # 執筆ダッシュボード
│   │   │   └── chapters/[chapterId]/     # 章詳細
│   │   ├── review/
│   │   │   ├── page.tsx                  # レビューハブ
│   │   │   └── chapters/[chapterId]/     # モバイルリーダー＆アノテーション
│   │   └── agents/page.tsx               # エージェント設定
│   │
│   └── api/
│       └── projects/
│           ├── route.ts                  # GET: 一覧 / POST: 作成
│           └── [projectId]/route.ts      # GET / PUT / DELETE
│
├── components/
│   ├── ui/                               # shadcn/ui コンポーネント (16個)
│   │   ├── button.tsx, card.tsx, dialog.tsx, input.tsx,
│   │   ├── textarea.tsx, badge.tsx, tabs.tsx, separator.tsx,
│   │   ├── sheet.tsx, scroll-area.tsx, dropdown-menu.tsx,
│   │   ├── avatar.tsx, popover.tsx, tooltip.tsx, select.tsx,
│   │   └── label.tsx
│   ├── layout/
│   │   ├── sidebar.tsx                   # プロジェクトサイドバーナビゲーション
│   │   └── header.tsx                    # ヘッダー（モバイルメニュー付き）
│   ├── project/                          # (Phase 2〜)
│   ├── chat/                             # (Phase 2)
│   ├── preparation/                      # (Phase 2)
│   ├── writing/                          # (Phase 3)
│   ├── review/                           # (Phase 4)
│   └── agents/                           # (Phase 3)
│
├── lib/
│   ├── db/
│   │   ├── index.ts                      # Drizzle クライアント（遅延初期化）
│   │   └── schema.ts                     # 全14テーブルのスキーマ定義
│   ├── supabase/
│   │   └── client.ts                     # Supabase クライアント
│   ├── agents/                           # (Phase 3)
│   │   ├── base-agent.ts                 # エージェント基底クラス
│   │   ├── context-builder.ts            # コンテキスト組み立て
│   │   ├── pipeline.ts                   # パイプライン制御
│   │   └── prompts/                      # 各エージェントのシステムプロンプト
│   ├── claude/                           # (Phase 2-3)
│   │   ├── client.ts                     # Anthropic SDK ラッパー
│   │   └── streaming.ts                  # SSEストリーミングユーティリティ
│   └── utils.ts                          # shadcn/ui ユーティリティ (cn)
│
├── types/
│   ├── project.ts                        # Project, Character, Chapter等の型定義
│   ├── agent.ts                          # AgentType, StreamEvent, PipelinePlan
│   └── annotation.ts                     # Annotation, AnnotationType
│
├── hooks/                                # (Phase 2〜)
└── stores/                               # (Phase 4)
```

---

## データベーススキーマ

14テーブルで構成。`src/lib/db/schema.ts` で Drizzle ORM により定義。

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
| 3 | Drizzle ORM スキーマ定義 | ✅ | `src/lib/db/schema.ts` (14テーブル) |
| 4 | 型定義 | ✅ | `src/types/` (project, agent, annotation) |
| 5 | 基本レイアウト | ✅ | サイドバー、ヘッダー、モバイルメニュー |
| 6 | ページルーティング | ✅ | 12ルート (全ページ構造) |
| 7 | プロジェクト API | ✅ | CRUD (`/api/projects`) |
| 8 | 新規プロジェクト作成UI | ✅ | ジャンル・構造タイプ選択フォーム |

**残タスク**: Supabaseプロジェクト作成 → `.env.local` に接続情報設定 → `npm run db:push`

### Phase 2: 準備フェーズ

| # | タスク | 概要 |
|---|---|---|
| 7 | チャットUI＆ストリーミングAPI | Claude APIとのリアルタイムチャット。SSEでストリーミング応答 |
| 8 | チャットコミット機能 | チャットで決めた内容をプロジェクト設定（プロット/キャラ/世界観）に構造化して保存 |
| 9 | プロットエディタ | 起承転結タイムラインUI。プロットポイントをドラッグ＆ドロップで配置 |
| 10 | キャラクター管理 | キャラクターカード一覧＋関係図ビジュアライゼーション |
| 11 | 世界観設定 | カテゴリ別タブ（地理/魔法/文化/歴史等）で設定を管理 |

**API追加予定**:
- `POST /api/chat` - Claudeとのストリーミングチャット
- `GET/POST /api/chat/sessions` - チャットセッション管理
- `POST /api/chat/commit` - チャット結果をプロジェクトに反映
- `GET/POST /api/projects/[id]/characters` - キャラクターCRUD
- `GET/PUT /api/projects/[id]/plot` - プロット構造CRUD
- `GET/POST /api/projects/[id]/world` - 世界設定CRUD

### Phase 3: エージェントシステム

| # | タスク | 概要 |
|---|---|---|
| 12 | BaseAgent＆ContextBuilder | エージェント基底クラス（Claude API呼び出し＋ストリーミング）、トークン予算に基づくコンテキスト組み立て |
| 13 | システムプロンプト作成 | 7エージェント分の専門プロンプト設計。日本語小説に特化した指示 |
| 14 | パイプライン実行 | SSEストリーミングで各エージェントの出力をリアルタイム表示 |
| 15 | エージェント設定ページ | プロンプト・モデル・temperature等のカスタマイズUI |
| 16 | 章サマリー自動生成 | 章完了時にClaude APIでbrief/detailedサマリーを生成・保存 |
| 17 | 執筆ダッシュボード | 章一覧＋パイプラインステッパー可視化＋ストリーミング出力パネル |
| 18 | 一時停止/再開/キャンセル | パイプライン実行中のユーザー介入制御 |

**API追加予定**:
- `POST /api/agents/execute` - パイプライン実行（SSEストリーム返却）
- `GET /api/agents/status` - パイプライン状態（SSE）
- `GET/PUT /api/agents/config` - エージェント設定CRUD
- `GET/PUT /api/agents/tasks` - タスクキュー管理
- `POST /api/projects/[id]/chapters` - 章CRUD
- `GET /api/projects/[id]/chapters/[id]/versions` - バージョン履歴

### Phase 4: モバイルレビュー

| # | タスク | 概要 |
|---|---|---|
| 19 | ReaderView | Noto Serif JPの書籍風レイアウト。ダークモード対応 |
| 20 | AnnotatableParagraph＆Popover | タップで段落選択→コメント入力ポップオーバー |
| 21 | アノテーションストア | Zustandでローカル即保存＋デバウンスDB永続化 |
| 22 | バッチ送信＆編集エージェント連携 | 一括送信→編集エージェントが全指摘を処理 |
| 23 | アノテーション位置復元 | anchor_textファジーマッチングで位置追跡 |

**API追加予定**:
- `GET/POST /api/review/annotations` - アノテーションCRUD
- `POST /api/review/submit-batch` - バッチ送信→編集エージェント実行

### Phase 5: 仕上げ

| # | タスク | 概要 |
|---|---|---|
| 24 | ダッシュボード強化 | 進捗率、文字数統計、エージェント活動ログ |
| 25 | エクスポート | Markdown / プレーンテキスト / (将来) EPUB 出力 |
| 26 | レスポンシブ最終調整 | 全ページのモバイル対応チェック＆修正 |

### Future: 認証＆マルチユーザー

| タスク | 概要 |
|---|---|
| Supabase Auth導入 | メール/パスワード認証、Row Level Security |
| マルチユーザー対応 | プロジェクト共有、共同レビュー |

---

## NPMスクリプト

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動 (http://localhost:3000) |
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
| Phase 2 | プロジェクト作成 → チャットでプロット/キャラ構築 → コミットしてDB保存確認 |
| Phase 3 | エージェントパイプライン起動 → SSEストリーミングで各エージェント出力確認 |
| Phase 4 | モバイルブラウザでレビュー画面 → タップアノテーション → バッチ送信 → 編集反映確認 |
| Phase 5 | 複数章生成後、整合性チェッカーの矛盾検出、エクスポート動作確認 |
