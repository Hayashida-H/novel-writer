import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { agentTasks, chapters } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const status = req.nextUrl.searchParams.get("status") as typeof agentTasks.$inferSelect.status | null;
    const db = getDb();

    const items = await db
      .select()
      .from(agentTasks)
      .where(
        status
          ? and(eq(agentTasks.projectId, projectId), eq(agentTasks.status, status))
          : eq(agentTasks.projectId, projectId)
      )
      .orderBy(desc(agentTasks.createdAt));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch agent tasks:", error);
    return NextResponse.json({ error: "Failed to fetch agent tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { projectId, chapterId, agentType, taskType, inputContext } = body;

    if (!projectId || !agentType || !taskType) {
      return NextResponse.json(
        { error: "projectId, agentType, and taskType are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const [task] = await db
      .insert(agentTasks)
      .values({
        projectId,
        chapterId: chapterId || null,
        agentType,
        taskType,
        inputContext: inputContext || {},
      })
      .returning();

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create agent task:", error);
    return NextResponse.json({ error: "Failed to create agent task" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { id, status, output, errorMessage, tokenUsage } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    const updates: Record<string, unknown> = {};

    if (status) {
      updates.status = status;
      if (status === "running") updates.startedAt = new Date();
      if (status === "completed" || status === "failed") updates.completedAt = new Date();
    }
    if (output !== undefined) updates.output = output;
    if (errorMessage !== undefined) updates.errorMessage = errorMessage;
    if (tokenUsage !== undefined) updates.tokenUsage = tokenUsage;

    const [updated] = await db
      .update(agentTasks)
      .set(updates)
      .where(eq(agentTasks.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If task completed with output and has a chapterId, update chapter content
    if (status === "completed" && output && updated.chapterId && updated.taskType === "write") {
      await db
        .update(chapters)
        .set({
          content: output,
          wordCount: output.length,
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(chapters.id, updated.chapterId));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update agent task:", error);
    return NextResponse.json({ error: "Failed to update agent task" }, { status: 500 });
  }
}

// Cancel all running/queued tasks for a project
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const db = getDb();
    const cancelled = await db
      .update(agentTasks)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(
        and(
          eq(agentTasks.projectId, projectId),
          inArray(agentTasks.status, ["queued", "running"])
        )
      )
      .returning({ id: agentTasks.id });

    return NextResponse.json({ cancelled: cancelled.length });
  } catch (error) {
    console.error("Failed to cancel agent tasks:", error);
    return NextResponse.json({ error: "Failed to cancel agent tasks" }, { status: 500 });
  }
}
