# Novel Writer - プロジェクトガイド

## 概要

Web小説執筆支援アプリ。複数のAIエージェントが協調して小説の構成・執筆・校正を行う。
Next.js (App Router) + Drizzle ORM + Neon (PostgreSQL) + Claude API。

## 技術スタック

- **フレームワーク**: Next.js (App Router), TypeScript
- **DB**: Neon (PostgreSQL) + Drizzle ORM
- **AI**: Claude API (@anthropic-ai/sdk)
- **UI**: shadcn/ui + Tailwind CSS
- **デプロイ**: Vercel (Hobby プラン, maxDuration=300秒)
- **認証**: カスタム認証 (`requireAuth`)

## エージェントシステム

### 8人のエージェント (`src/types/agent.ts`)

| エージェント | 略称 | モデル | 役割 |
|---|---|---|---|
| coordinator | Co | Sonnet 4 | 執筆計画の立案 |
| plot_architect | Pl | Sonnet 4 | シーン構成・ビート作成 |
| world_builder | Wb | Sonnet 4 | 舞台・環境設定 |
| character_manager | Cm | Sonnet 4 | キャラクターブリーフ |
| writer | Wr | **Opus 4.6** | 本文執筆 (唯一のOpus) |
| editor | Ed | Sonnet 4 | 編集・校正 |
| continuity_checker | Cc | Sonnet 4 | 整合性チェック |
| fixer | Fx | Sonnet 4 | 構成修正（Cc指摘の自動修正） |

### プロンプト管理の重要な設計判断

**`systemPrompt` と `maxTokens` は常にコードから取得する**（`src/lib/agents/context-builder.ts` の `buildAgentContext`）。

- プロジェクト作成時に `agentConfigs` テーブルにプロンプトがコピーされるが、コード側で更新してもDBの古い値が使われてしまう問題があった
- 解決: コードのデフォルト (`src/lib/agents/prompts/*.ts`) を常に優先
- DBは `model`, `temperature`, `customInstructions`, `styleProfile` のみ使用
- プロンプト更新はコード変更 → デプロイで全プロジェクトに即反映

### プロンプトファイル構成

```
src/lib/agents/prompts/
├── index.ts              # 全エージェント登録、CONSULTATION_RULES 付与
├── coordinator.ts
├── plot-architect.ts
├── character-manager.ts
├── writer.ts             # 文字数制約なし、あらすじの内容量に応じて執筆
├── editor.ts             # maxTokens=16384（全文+フィードバック出力用）
├── world-builder.ts
├── continuity-checker.ts
└── fixer.ts              # JSON出力（synopsisRevisions, newForeshadowing, characterUpdates）
```

## 3つのパイプライン

### 1. 執筆パイプライン（執筆ページ）

**API**: `POST /api/agents/execute-step` (ステップごとに実行)
**フロー**: Co → Pl → Wb → Cm → Wr → Ed (6ステップ、dependsOnで依存関係あり)
**UI**: `src/components/write/writing-dashboard.tsx`

渡すコンテキスト (`formatOptions` のデフォルト):
- あらすじ (plotSynopsis)
- 登場人物、世界設定、伏線、用語集
- 文体参照 (styleReferences)
- 各話のあらすじ (includeChapterSynopses: true)
- 章固有コンテキスト (前話の本文・要約、今話のあらすじ) ← `buildChapterContext`
- プロットポイントは**渡さない** (includePlotPoints: false)

### 2. 構成チェックパイプライン（構成ページ）

**API**: `POST /api/agents/execute` (mode: "custom")
**フロー**: Cc → Fx (2ステップ)
**UI**: `src/components/structure/structure-editor.tsx`

渡すコンテキスト:
- あらすじ、登場人物、世界設定、伏線、用語集
- 各話のあらすじ (includeChapterSynopses: true)
- プロットポイント: **渡さない**
- 文体参照: **渡さない**
- Ccのメッセージに `synopsisInfo`（構成画面の章・話あらすじ一覧）を直接埋め込み

Fxの出力JSON:
```json
{
  "synopsisRevisions": [{ "chapterNumber": 1, "synopsis": "修正後" }],
  "newForeshadowing": [{ "title": "...", "description": "...", "targetChapter": 5, "priority": "high" }],
  "characterUpdates": [{ "name": "キャラ名", "field": "arcDescription", "value": "更新内容" }],
  "changesSummary": "変更要約"
}
```
→ クライアント側で各API (chapters, foreshadowing, characters) に振り分けて保存

### 3. 整合性チェックパイプライン（チェックページ）

**API**: `POST /api/agents/execute` (mode: "custom")
**UI**: `src/components/consistency/consistency-checker.tsx`

渡すコンテキスト:
- あらすじ、登場人物、世界設定、伏線、用語集
- 選択された話の本文をメッセージに直接埋め込み
- プロットポイント: **渡さない**

## チャプターの3つのテキストフィールド

| フィールド | 時点 | 長さ | 用途 |
|---|---|---|---|
| `synopsis` | 執筆前 | 自由 | 構成で作成するあらすじ（話の計画） |
| `summaryBrief` | 執筆後 | ~200文字 | 自動生成要約（一覧表示用） |
| `summaryDetailed` | 執筆後 | ~800文字 | 自動生成詳細要約（コンテキスト用） |

- `synopsis`: 構成ページで設定。構成チェックや執筆パイプラインで使用
- `summaryBrief`/`summaryDetailed`: 執筆完了後に `generateChapterSummary` で自動生成
- 執筆ダッシュボードのチャプターダイアログに要約表示あり

## コンテキストビルダー (`src/lib/agents/context-builder.ts`)

### FormatContextOptions

各パイプラインが渡す情報を制御:
```typescript
interface FormatContextOptions {
  includePlotPoints?: boolean;       // デフォルト: true
  includeStyleReferences?: boolean;  // デフォルト: true
  includeChapterSummaries?: boolean; // デフォルト: true
  includeChapterSynopses?: boolean;  // デフォルト: false
}
```

### buildChapterContext

章固有のコンテキスト（今話のあらすじ、前話の本文・要約）。
`chapterId` 指定時に自動で呼ばれる。

## タスク管理

### agent_tasks テーブル

各パイプラインステップの実行記録。ステータス: queued → running → completed/failed/cancelled。

### staleタスク対策

- `execute/route.ts`: パイプライン開始時に同じ `chapterId`（またはnull）の running/queued タスクを自動キャンセル
- SSEストリーム切断時も `send(event)` を try-catch で保護し、DB更新は確実に実行
- `agent-tasks DELETE`: `chapterId` 指定で全タスク物理削除（再実行用）

### 再実行フロー

「最初から執筆」ボタン → `DELETE /api/agent-tasks?projectId=xxx&chapterId=yyy` で全タスク物理削除 → クリーンな状態からパイプライン実行

## ナビゲーション構成

サイドバー順序: 準備 → 執筆 → チェック → 設定

## 診断ログ（一時的）

`execute-step/route.ts` に以下の診断ログが残っている（問題解決後に削除予定）:
- DB agentConfigs の存在チェック
- systemPrompt のバージョン検出 (OLD/NEW)
- rawContent / extracted content の文字数

## 開発メモ

- Vercel Hobbyプランのため `maxDuration=300` 秒制限あり
- `npm run build` で型チェック確認
- コミット時は `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` を付与
