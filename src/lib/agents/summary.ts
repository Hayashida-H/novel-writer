import { getDb } from "@/lib/db";
import { chapters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getClaudeClient } from "@/lib/claude/client";

const SUMMARY_SYSTEM_PROMPT = `あなたは小説の章サマリーを作成する専門家です。
与えられた章の本文を読み、以下の2種類のサマリーを**JSON形式**で出力してください。

出力フォーマット:
{
  "brief": "1-2文の簡潔なサマリー（200文字以内）。この章で何が起きたかの概要。",
  "detailed": "詳細なサマリー（800文字以内）。主要イベント、キャラクターの変化、伏線の進展、感情の転換点を含む。"
}

注意:
- 必ず有効なJSONで出力してください
- ネタバレを避ける必要はありません（内部管理用のサマリーです）
- 固有名詞はそのまま使用してください`;

export async function generateChapterSummary(chapterId: string): Promise<{
  brief: string;
  detailed: string;
}> {
  const db = getDb();
  const chapterRows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1);

  const chapter = chapterRows[0];
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);
  if (!chapter.content) throw new Error(`Chapter has no content: ${chapterId}`);

  const client = getClaudeClient();
  const response = await client.chat({
    model: "claude-sonnet-4-20250514",
    systemPrompt: SUMMARY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `以下の「第${chapter.chapterNumber}章${chapter.title ? `「${chapter.title}」` : ""}」のサマリーを作成してください。\n\n---\n\n${chapter.content}`,
      },
    ],
    temperature: 0.3,
    maxTokens: 1024,
  });

  let parsed: { brief: string; detailed: string };
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // Fallback: use first 200 chars as brief, full response as detailed
    parsed = {
      brief: response.content.slice(0, 200),
      detailed: response.content.slice(0, 800),
    };
  }

  // Save to DB
  await db
    .update(chapters)
    .set({
      summaryBrief: parsed.brief,
      summaryDetailed: parsed.detailed,
      updatedAt: new Date(),
    })
    .where(eq(chapters.id, chapterId));

  return parsed;
}
