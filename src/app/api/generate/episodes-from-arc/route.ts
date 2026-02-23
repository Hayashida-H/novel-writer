import { NextRequest } from "next/server";
import { ClaudeClient } from "@/lib/claude/client";
import { getDb } from "@/lib/db";
import { arcs, chapters, plotPoints, projects } from "@/lib/db/schema";
import { eq, and, inArray, max } from "drizzle-orm";
import { buildProjectContext, formatContextForPrompt } from "@/lib/agents/context-builder";
import { EPISODES_FROM_ARC_GENERATION_PROMPT } from "@/lib/generation/prompts";
import { parseJsonArray } from "@/lib/generation/parsers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface GeneratedEpisode {
  episodeNumber: number;
  title: string;
  synopsis: string;
  plotPointIndices: number[];
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, arcId } = await req.json();
    if (!projectId || !arcId) {
      return new Response(
        JSON.stringify({ error: "projectId and arcId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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

    // Get the arc
    const [arc] = await db
      .select()
      .from(arcs)
      .where(and(eq(arcs.id, arcId), eq(arcs.projectId, projectId)))
      .limit(1);

    if (!arc) {
      return new Response(JSON.stringify({ error: "章が見つかりません" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get related plot points
    const arcPlotPointIds = (arc.plotPointIds as string[]) || [];
    let relatedPoints: { id: string; act: string; title: string; description: string; isMajorTurningPoint: boolean | null }[] = [];
    if (arcPlotPointIds.length > 0) {
      relatedPoints = await db
        .select({
          id: plotPoints.id,
          act: plotPoints.act,
          title: plotPoints.title,
          description: plotPoints.description,
          isMajorTurningPoint: plotPoints.isMajorTurningPoint,
        })
        .from(plotPoints)
        .where(inArray(plotPoints.id, arcPlotPointIds));
    }

    // Build context
    const context = await buildProjectContext(projectId);
    const contextText = formatContextForPrompt(context);

    // Build user message
    let userMessage = `以下の章（アーク）について、話（エピソード）を設計してください。

タイトル: ${project.title}
ジャンル: ${project.genre || "未設定"}

## 章の情報
章番号: ${arc.arcNumber}
章タイトル: ${arc.title}
章概要: ${arc.description || "なし"}

## 関連プロットポイント
`;

    for (let i = 0; i < relatedPoints.length; i++) {
      const p = relatedPoints[i];
      userMessage += `[${i}] 【${p.act}】${p.title}: ${p.description}${p.isMajorTurningPoint ? " ★転換点" : ""}\n`;
    }

    if (contextText) {
      userMessage += `\n---\n\n${contextText}`;
    }

    // Get max chapter number for sequential numbering
    const [maxResult] = await db
      .select({ maxNum: max(chapters.chapterNumber) })
      .from(chapters)
      .where(eq(chapters.projectId, projectId));

    let nextChapterNumber = (maxResult?.maxNum ?? 0) + 1;

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = new ClaudeClient();
          await client.chat({
            model: "claude-sonnet-4-20250514",
            systemPrompt: EPISODES_FROM_ARC_GENERATION_PROMPT,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.7,
            maxTokens: 4096,
            onStream: (text: string) => {
              fullResponse += text;
              const data = JSON.stringify({ type: "stream", text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          const parsed = parseJsonArray<GeneratedEpisode>(fullResponse);

          // Map plotPointIndices to actual plotPoint IDs and save
          const saved = [];
          for (const episode of parsed) {
            const episodePlotPointIds = episode.plotPointIndices
              .filter((idx) => idx >= 0 && idx < relatedPoints.length)
              .map((idx) => relatedPoints[idx].id);

            const [item] = await db
              .insert(chapters)
              .values({
                projectId,
                arcId,
                chapterNumber: nextChapterNumber++,
                title: episode.title,
                synopsis: episode.synopsis || null,
                status: "outlined",
                plotPointIds: episodePlotPointIds,
              })
              .returning();
            saved.push(item);
          }

          const doneData = JSON.stringify({ type: "done", items: saved });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Episode generation error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "エピソード生成に失敗しました",
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
    console.error("Episodes-from-arc API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
