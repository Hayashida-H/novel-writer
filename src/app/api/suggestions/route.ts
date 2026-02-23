import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ClaudeClient } from "@/lib/claude/client";
import type { PlotCandidate } from "@/types/plot-suggestion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `あなたは創造的な小説プロット提案の専門家です。
魅力的で独創的な小説のプロット候補を提案してください。

各候補には以下を含めてください：
1. タイトル（印象的で興味を引くもの）
2. あらすじ（2-3文で物語の核心を伝える）
3. ジャンル（以下から1つ：ファンタジー、SF、ミステリー、恋愛、ホラー、歴史、ライトノベル、純文学、その他）
4. テーマ（2-4個のキーワード）
5. 推奨する物語構造（kishotenketsu / three_act / hero_journey のいずれか）
6. 構造に合わせた主要プロットポイント（3-4個）
7. この物語の魅力ポイント（1文）

回答は以下のJSON配列形式で出力してください。JSONのみを出力し、それ以外のテキストは含めないでください：

[
  {
    "title": "タイトル",
    "description": "あらすじ",
    "genre": "ジャンル名",
    "themes": ["テーマ1", "テーマ2"],
    "structureType": "kishotenketsu",
    "plotPoints": [
      {
        "act": "ki",
        "title": "ポイントのタイトル",
        "description": "ポイントの説明",
        "isMajorTurningPoint": false
      }
    ],
    "appeal": "魅力ポイント"
  }
]

起承転結の場合のact値: "ki", "sho", "ten", "ketsu"
三幕構成の場合のact値: "act1", "act2", "act3"
英雄の旅の場合のact値: "departure", "initiation", "return"`;

function buildUserMessage(genre?: string, preferences?: string, homage?: string, count = 3): string {
  const parts = [`${count}つの小説プロット候補を提案してください。`];

  if (genre) {
    parts.push(`ジャンル: ${genre}`);
  } else {
    parts.push("ジャンルは自由に選んでください。多様性を持たせてください。");
  }

  if (preferences) {
    parts.push(`ユーザーの好み・希望: ${preferences}`);
  }

  if (homage) {
    parts.push(`オマージュ・参考にしたい作品や要素: ${homage}`);
  }

  parts.push("それぞれ異なるテイストの候補を提示してください。");

  return parts.join("\n");
}

function parseJsonResponse(text: string): PlotCandidate[] {
  let cleaned = text.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("No JSON array found in response");
  }

  const jsonStr = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(jsonStr);

  return parsed.map((item: Omit<PlotCandidate, "id">, index: number) => ({
    ...item,
    id: `candidate-${index}-${Date.now()}`,
  }));
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { genre, preferences, homage, count = 3 } = body;

    const userMessage = buildUserMessage(genre, preferences, homage, count);

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = new ClaudeClient();

          await client.chat({
            model: "claude-sonnet-4-20250514",
            systemPrompt: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.9,
            maxTokens: 8192,
            onStream: (text: string) => {
              fullResponse += text;
              const data = JSON.stringify({ type: "stream", text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          const candidates = parseJsonResponse(fullResponse);
          const doneData = JSON.stringify({ type: "done", candidates });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Suggestion stream error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "提案の生成に失敗しました",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Suggestion API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
