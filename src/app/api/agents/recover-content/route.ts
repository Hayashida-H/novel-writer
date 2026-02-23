import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { agentTasks, chapters } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Extract the corrected prose from editor output.
 * Expected format: "--- 修正後本文 ---\n...\n--- フィードバック ---\n..."
 */
function extractEditorContent(raw: string): string {
  const startMarker = /---\s*修正後本文\s*---/;
  const endMarker = /---\s*フィードバック\s*---/;

  const startMatch = raw.match(startMarker);
  if (startMatch && startMatch.index !== undefined) {
    const contentStart = startMatch.index + startMatch[0].length;
    const endMatch = raw.match(endMarker);
    if (endMatch && endMatch.index !== undefined) {
      return raw.slice(contentStart, endMatch.index).trim();
    }
    return raw.slice(contentStart).trim();
  }

  // Old JSON format — not usable as content
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.includes('"corrections"')) {
    return "";
  }

  return raw.replace(/<!-- SPLIT_SUGGESTION:[\s\S]*?-->/g, "").trim();
}

/**
 * POST: Recover chapter content from agent_tasks output.
 * Looks for the latest completed editor output (falls back to writer).
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { projectId, chapterId } = await req.json();

    if (!projectId || !chapterId) {
      return NextResponse.json(
        { error: "projectId and chapterId required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Try editor first, then writer
    for (const agentType of ["editor", "writer"] as const) {
      const [task] = await db
        .select()
        .from(agentTasks)
        .where(
          and(
            eq(agentTasks.projectId, projectId),
            eq(agentTasks.chapterId, chapterId),
            eq(agentTasks.agentType, agentType),
            eq(agentTasks.status, "completed")
          )
        )
        .orderBy(desc(agentTasks.completedAt))
        .limit(1);

      if (task?.output) {
        const content = agentType === "editor"
          ? extractEditorContent(task.output)
          : task.output.replace(/<!-- SPLIT_SUGGESTION:[\s\S]*?-->/g, "").trim();

        // Skip empty content (e.g. old JSON format editor output)
        if (!content) continue;

        const [updated] = await db
          .update(chapters)
          .set({
            content,
            wordCount: content.length,
            status: "draft",
            updatedAt: new Date(),
          })
          .where(eq(chapters.id, chapterId))
          .returning();

        return NextResponse.json({
          success: true,
          source: agentType,
          contentLength: content.length,
          chapter: updated,
        });
      }
    }

    return NextResponse.json(
      { error: "No completed writer or editor output found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Recover content error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
