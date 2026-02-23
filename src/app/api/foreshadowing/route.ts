import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { foreshadowing } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

    const status = req.nextUrl.searchParams.get("status") as typeof foreshadowing.$inferSelect.status | null;
    const db = getDb();

    const query = db
      .select()
      .from(foreshadowing)
      .where(
        status
          ? and(eq(foreshadowing.projectId, projectId), eq(foreshadowing.status, status))
          : eq(foreshadowing.projectId, projectId)
      )
      .orderBy(desc(foreshadowing.createdAt));

    const items = await query;
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch foreshadowing:", error);
    return NextResponse.json({ error: "Failed to fetch foreshadowing" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const {
      projectId,
      title,
      description,
      type,
      plantedChapterId,
      plantedContext,
      targetChapter,
      priority,
      relatedCharacterIds,
    } = body;

    if (!projectId || !title || !description) {
      return NextResponse.json(
        { error: "projectId, title, and description are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const [item] = await db
      .insert(foreshadowing)
      .values({
        projectId,
        title,
        description,
        type: type || "foreshadowing",
        status: "planted",
        plantedChapterId: plantedChapterId || null,
        plantedContext: plantedContext || null,
        targetChapter: targetChapter || null,
        priority: priority || "medium",
        relatedCharacterIds: relatedCharacterIds || [],
      })
      .returning();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create foreshadowing:", error);
    return NextResponse.json({ error: "Failed to create foreshadowing" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    const [updated] = await db
      .update(foreshadowing)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(foreshadowing.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update foreshadowing:", error);
    return NextResponse.json({ error: "Failed to update foreshadowing" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    await db.delete(foreshadowing).where(eq(foreshadowing.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete foreshadowing:", error);
    return NextResponse.json({ error: "Failed to delete foreshadowing" }, { status: 500 });
  }
}
