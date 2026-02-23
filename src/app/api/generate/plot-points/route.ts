import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ClaudeClient } from "@/lib/claude/client";
import { getDb } from "@/lib/db";
import { plotStructure, plotPoints, projects } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildProjectContext, formatContextForPrompt } from "@/lib/agents/context-builder";
import { PLOT_POINTS_GENERATION_PROMPT } from "@/lib/generation/prompts";
import { parseJsonArray } from "@/lib/generation/parsers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface GeneratedPlotPoint {
  act: string;
  title: string;
  description: string;
  chapterHints?: number[];
  isMajorTurningPoint?: boolean;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const { projectId, count } = await req.json();
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

    // Get existing plot structure
    const [structure] = await db
      .select()
      .from(plotStructure)
      .where(eq(plotStructure.projectId, projectId))
      .limit(1);

    if (!structure) {
      return new Response(
        JSON.stringify({ error: "Plot structure not found. Please save a structure first." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get existing point count for sortOrder offset
    const existingPoints = await db
      .select()
      .from(plotPoints)
      .where(eq(plotPoints.plotStructureId, structure.id))
      .orderBy(asc(plotPoints.sortOrder));

    const sortOrderOffset = existingPoints.length;

    const context = await buildProjectContext(projectId);
    const contextText = formatContextForPrompt(context);

    const countInstruction = count
      ? `${count}個のプロットポイントを生成してください。`
      : "物語に適した数（6-10個程度）のプロットポイントを生成してください。";

    const userMessage = `以下のプロジェクト情報に基づいて、${countInstruction}

タイトル: ${project.title}
ジャンル: ${project.genre || "未設定"}
概要: ${project.description || "未設定"}
構造タイプ: ${structure.structureType}
あらすじ: ${structure.synopsis || "未設定"}
テーマ: ${(structure.themes as string[] || []).join(", ") || "未設定"}

${existingPoints.length > 0 ? `既存のポイント（${existingPoints.length}件）:\n${existingPoints.map((p, i) => `${i + 1}. [${p.act}] ${p.title}: ${p.description}`).join("\n")}\n\n既存のポイントと重複しない新しいポイントを生成してください。` : ""}

${contextText ? `\n---\n\n${contextText}` : ""}`;

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = new ClaudeClient();
          await client.chat({
            model: "claude-sonnet-4-20250514",
            systemPrompt: PLOT_POINTS_GENERATION_PROMPT,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.8,
            maxTokens: 8192,
            onStream: (text: string) => {
              fullResponse += text;
              const data = JSON.stringify({ type: "stream", text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          const parsed = parseJsonArray<GeneratedPlotPoint>(fullResponse);
          const saved = [];
          for (let i = 0; i < parsed.length; i++) {
            const pp = parsed[i];
            const [item] = await db
              .insert(plotPoints)
              .values({
                plotStructureId: structure.id,
                act: pp.act,
                title: pp.title,
                description: pp.description,
                sortOrder: sortOrderOffset + i,
                chapterHints: pp.chapterHints || [],
                isMajorTurningPoint: pp.isMajorTurningPoint || false,
              })
              .returning();
            saved.push(item);
          }

          const doneData = JSON.stringify({ type: "done", items: saved });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Plot points generation error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "プロットポイント生成に失敗しました",
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
    console.error("Plot points generation API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
