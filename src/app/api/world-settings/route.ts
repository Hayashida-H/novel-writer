import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { worldSettings } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
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

    const db = getDb();
    const items = await db
      .select()
      .from(worldSettings)
      .where(eq(worldSettings.projectId, projectId))
      .orderBy(asc(worldSettings.category), asc(worldSettings.sortOrder));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch world settings:", error);
    return NextResponse.json({ error: "Failed to fetch world settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { projectId, category, title, content, sortOrder } = body;

    if (!projectId || !category || !title || !content) {
      return NextResponse.json(
        { error: "projectId, category, title, and content are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const [item] = await db
      .insert(worldSettings)
      .values({
        projectId,
        category,
        title,
        content,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create world setting:", error);
    return NextResponse.json({ error: "Failed to create world setting" }, { status: 500 });
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
      .update(worldSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(worldSettings.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update world setting:", error);
    return NextResponse.json({ error: "Failed to update world setting" }, { status: 500 });
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
    await db.delete(worldSettings).where(eq(worldSettings.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete world setting:", error);
    return NextResponse.json({ error: "Failed to delete world setting" }, { status: 500 });
  }
}
