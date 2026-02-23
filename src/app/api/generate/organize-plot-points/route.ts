import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ClaudeClient } from "@/lib/claude/client";
import { getDb } from "@/lib/db";
import { plotStructure, plotPoints, projects } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildProjectContext, formatContextForPrompt } from "@/lib/agents/context-builder";
import { ORGANIZE_PLOT_POINTS_PROMPT } from "@/lib/generation/prompts";
import { parseJsonArray } from "@/lib/generation/parsers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface OrganizedPoint {
  originalIndex: number;
  act: string;
  title: string;
  description: string;
  chapterHints: number[];
  isMajorTurningPoint: boolean;
  sortOrder: number;
  removed: boolean;
  mergedFrom: number[];
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

    const [structure] = await db
      .select()
      .from(plotStructure)
      .where(eq(plotStructure.projectId, projectId))
      .limit(1);

    if (!structure) {
      return new Response(
        JSON.stringify({ error: "プロット構成が見つかりません" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const existingPoints = await db
      .select()
      .from(plotPoints)
      .where(eq(plotPoints.plotStructureId, structure.id))
      .orderBy(asc(plotPoints.sortOrder));

    if (existingPoints.length === 0) {
      return new Response(
        JSON.stringify({ error: "整理するプロットポイントがありません" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const context = await buildProjectContext(projectId);
    const contextText = formatContextForPrompt(context);

    let userMessage = `以下のプロットポイントを整理・再構成してください。

タイトル: ${project.title}
ジャンル: ${project.genre || "未設定"}
概要: ${project.description || "未設定"}
構造タイプ: ${structure.structureType}
あらすじ: ${structure.synopsis || "未設定"}

## 現在のプロットポイント（${existingPoints.length}件）
`;

    for (let i = 0; i < existingPoints.length; i++) {
      const p = existingPoints[i];
      const hints = (p.chapterHints as number[]) || [];
      userMessage += `[${i}] 【${p.act}】${p.title}: ${p.description}${p.isMajorTurningPoint ? " ★転換点" : ""}${hints.length > 0 ? ` (章: ${hints.join(",")})` : ""}\n`;
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
            systemPrompt: ORGANIZE_PLOT_POINTS_PROMPT,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.5,
            maxTokens: 8192,
            onStream: (text: string) => {
              fullResponse += text;
              const data = JSON.stringify({ type: "stream", text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          const parsed = parseJsonArray<OrganizedPoint>(fullResponse);

          // Collect indices to delete (removed + merged into others)
          const mergedIndices = new Set<number>();
          for (const op of parsed) {
            if (op.mergedFrom) {
              for (const idx of op.mergedFrom) mergedIndices.add(idx);
            }
          }

          const toDelete = new Set<number>();
          for (const op of parsed) {
            if (op.removed) toDelete.add(op.originalIndex);
          }
          // Also delete merged source points (but not the target)
          for (const idx of mergedIndices) {
            // Only delete if this index is not the originalIndex of a non-removed point
            const isKept = parsed.some((p) => p.originalIndex === idx && !p.removed);
            if (!isKept) toDelete.add(idx);
          }

          // Delete removed points
          for (const idx of toDelete) {
            if (idx >= 0 && idx < existingPoints.length) {
              await db.delete(plotPoints).where(eq(plotPoints.id, existingPoints[idx].id));
            }
          }

          // Update remaining points
          const updated = [];
          for (const op of parsed) {
            if (op.removed) continue;
            if (op.originalIndex < 0 || op.originalIndex >= existingPoints.length) continue;

            const point = existingPoints[op.originalIndex];
            const [result] = await db
              .update(plotPoints)
              .set({
                act: op.act,
                title: op.title,
                description: op.description,
                chapterHints: op.chapterHints || [],
                isMajorTurningPoint: op.isMajorTurningPoint || false,
                sortOrder: op.sortOrder,
              })
              .where(eq(plotPoints.id, point.id))
              .returning();
            updated.push(result);
          }

          // Sort by sortOrder for response
          updated.sort((a, b) => a.sortOrder - b.sortOrder);

          const doneData = JSON.stringify({ type: "done", items: updated });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Organize plot points error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "プロットポイントの整理に失敗しました",
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
    console.error("Organize plot points API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
