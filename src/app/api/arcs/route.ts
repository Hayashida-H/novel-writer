import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { arcs, chapters } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req, ["manager", "reviewer"]);
    if (authResult instanceof NextResponse) return authResult;

    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const db = getDb();
    const result = await db
      .select()
      .from(arcs)
      .where(eq(arcs.projectId, projectId))
      .orderBy(asc(arcs.arcNumber));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch arcs:", error);
    return NextResponse.json({ error: "Failed to fetch arcs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { projectId, arcNumber, title, description } = await req.json();
    if (!projectId || !title) {
      return NextResponse.json({ error: "projectId and title are required" }, { status: 400 });
    }

    const db = getDb();

    // Auto-assign arcNumber if not provided
    let finalArcNumber = arcNumber;
    if (!finalArcNumber) {
      const existing = await db
        .select({ arcNumber: arcs.arcNumber })
        .from(arcs)
        .where(eq(arcs.projectId, projectId))
        .orderBy(asc(arcs.arcNumber));
      finalArcNumber = existing.length > 0 ? existing[existing.length - 1].arcNumber + 1 : 1;
    }

    const [created] = await db
      .insert(arcs)
      .values({
        projectId,
        arcNumber: finalArcNumber,
        title,
        description: description || null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create arc:", error);
    return NextResponse.json({ error: "Failed to create arc" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { id, title, description, arcNumber } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (arcNumber !== undefined) updates.arcNumber = arcNumber;

    const [updated] = await db
      .update(arcs)
      .set(updates)
      .where(eq(arcs.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update arc:", error);
    return NextResponse.json({ error: "Failed to update arc" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();

    // Unset arcId on chapters that belong to this arc (set null due to onDelete: "set null")
    await db
      .update(chapters)
      .set({ arcId: null, updatedAt: new Date() })
      .where(eq(chapters.arcId, id));

    await db.delete(arcs).where(eq(arcs.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete arc:", error);
    return NextResponse.json({ error: "Failed to delete arc" }, { status: 500 });
  }
}
