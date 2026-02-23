import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ClaudeClient } from "@/lib/claude/client";
import { getDb } from "@/lib/db";
import { plotStructure, plotPoints, arcs, projects } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildProjectContext, formatContextForPrompt } from "@/lib/agents/context-builder";
import { ARCS_FROM_PLOT_GENERATION_PROMPT } from "@/lib/generation/prompts";
import { parseJsonArray } from "@/lib/generation/parsers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface GeneratedArc {
  arcNumber: number;
  title: string;
  description: string;
  plotPointIndices: number[];
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = getDb();

    // Check for existing arcs
    const existingArcs = await db
      .select()
      .from(arcs)
      .where(eq(arcs.projectId, projectId));

    if (existingArcs.length > 0) {
      return new Response(
        JSON.stringify({ error: "既存の章を削除してから再生成してください" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

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

    // Get plot structure and points
    const [structure] = await db
      .select()
      .from(plotStructure)
      .where(eq(plotStructure.projectId, projectId))
      .limit(1);

    if (!structure) {
      return new Response(JSON.stringify({ error: "プロット構成が見つかりません" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const points = await db
      .select()
      .from(plotPoints)
      .where(eq(plotPoints.plotStructureId, structure.id))
      .orderBy(asc(plotPoints.sortOrder));

    if (points.length === 0) {
      return new Response(JSON.stringify({ error: "プロットポイントがありません" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build context
    const context = await buildProjectContext(projectId);
    const contextText = formatContextForPrompt(context);

    // Build user message with plot points list
    let userMessage = `以下のプロジェクトのプロットポイントを、論理的な章（アーク）にグループ化してください。

タイトル: ${project.title}
ジャンル: ${project.genre || "未設定"}
概要: ${project.description || "未設定"}
構造タイプ: ${structure.structureType}

## プロットポイント一覧
`;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      userMessage += `[${i}] 【${p.act}】${p.title}: ${p.description}${p.isMajorTurningPoint ? " ★転換点" : ""}\n`;
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
            systemPrompt: ARCS_FROM_PLOT_GENERATION_PROMPT,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.7,
            maxTokens: 4096,
            onStream: (text: string) => {
              fullResponse += text;
              const data = JSON.stringify({ type: "stream", text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          const parsed = parseJsonArray<GeneratedArc>(fullResponse);

          // Map plotPointIndices to actual plotPoint IDs
          const saved = [];
          for (const arc of parsed) {
            const plotPointIds = arc.plotPointIndices
              .filter((idx) => idx >= 0 && idx < points.length)
              .map((idx) => points[idx].id);

            const [item] = await db
              .insert(arcs)
              .values({
                projectId,
                arcNumber: arc.arcNumber,
                title: arc.title,
                description: arc.description || null,
                plotPointIds,
              })
              .returning();
            saved.push(item);
          }

          const doneData = JSON.stringify({ type: "done", items: saved });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Arc generation error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "章構成の生成に失敗しました",
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
    console.error("Chapters-from-plot API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
