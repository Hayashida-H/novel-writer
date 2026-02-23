import { NextRequest } from "next/server";
import { ClaudeClient } from "@/lib/claude/client";
import { getDb } from "@/lib/db";
import { glossary, projects } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildProjectContext, formatContextForPrompt } from "@/lib/agents/context-builder";
import { GLOSSARY_GENERATION_PROMPT } from "@/lib/generation/prompts";
import { parseJsonArray } from "@/lib/generation/parsers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface GeneratedGlossaryItem {
  term: string;
  reading?: string;
  category?: string;
  description: string;
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

    const existingTerms = await db
      .select()
      .from(glossary)
      .where(eq(glossary.projectId, projectId))
      .orderBy(asc(glossary.term));

    const context = await buildProjectContext(projectId);
    const contextText = formatContextForPrompt(context);

    let userMessage = `以下のプロジェクト情報に基づいて、重要な用語を抽出してください。

タイトル: ${project.title}
ジャンル: ${project.genre || "未設定"}
概要: ${project.description || "未設定"}
`;

    if (existingTerms.length > 0) {
      userMessage += `\n既存の用語（${existingTerms.length}件）：\n`;
      userMessage += existingTerms.map((t) => `- ${t.term}`).join("\n");
      userMessage += "\n\n既存の用語と重複しない新しい用語を生成してください。";
    }

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
            systemPrompt: GLOSSARY_GENERATION_PROMPT,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.7,
            maxTokens: 4096,
            onStream: (text: string) => {
              fullResponse += text;
              const data = JSON.stringify({ type: "stream", text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          const parsed = parseJsonArray<GeneratedGlossaryItem>(fullResponse);
          const existingNames = new Set(existingTerms.map((t) => t.term));
          const filtered = parsed.filter((p) => !existingNames.has(p.term));

          const saved = [];
          for (const item of filtered) {
            const [created] = await db
              .insert(glossary)
              .values({
                projectId,
                term: item.term,
                reading: item.reading || null,
                category: item.category || null,
                description: item.description,
              })
              .returning();
            saved.push(created);
          }

          const doneData = JSON.stringify({ type: "done", items: saved });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Glossary generation error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "用語生成に失敗しました",
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
    console.error("Glossary generation API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
