import { NextRequest } from "next/server";
import { ClaudeClient } from "@/lib/claude/client";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildProjectContext, formatContextForPrompt } from "@/lib/agents/context-builder";
import { NAROU_KEYWORDS_PROMPT } from "@/lib/generation/prompts";
import { parseJsonArray } from "@/lib/generation/parsers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface GeneratedKeyword {
  keyword: string;
  category: string;
  reason: string;
}

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = getDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const context = await buildProjectContext(projectId);
    const contextText = formatContextForPrompt(context);

    let userMessage = `以下のプロジェクト情報に基づいて、なろう・カクヨム向けのキーワードを提案してください。

タイトル: ${project.title}
ジャンル: ${project.genre || "未設定"}
概要: ${project.description || "未設定"}
`;

    if (contextText) {
      userMessage += `\n---\n\n${contextText}`;
    }

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = new ClaudeClient();
          await client.chat({
            model: "claude-sonnet-4-20250514",
            systemPrompt: NAROU_KEYWORDS_PROMPT,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.7,
            maxTokens: 4096,
            onStream: (text: string) => {
              fullResponse += text;
              const data = JSON.stringify({ type: "stream", text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          const parsed = parseJsonArray<GeneratedKeyword>(fullResponse);

          const doneData = JSON.stringify({ type: "done", items: parsed });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Narou keywords generation error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "キーワード生成に失敗しました",
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
    console.error("Narou keywords API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
