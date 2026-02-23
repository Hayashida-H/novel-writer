import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { chapters } from "@/lib/db/schema";
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
    const items = await db
      .select()
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(asc(chapters.chapterNumber));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch chapters:", error);
    return NextResponse.json({ error: "Failed to fetch chapters" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const { projectId, chapterNumber, title, synopsis, content, plotPointIds, characterIds, arcId } = body;

    if (!projectId || chapterNumber == null) {
      return NextResponse.json(
        { error: "projectId and chapterNumber are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const wordCount = content ? content.length : 0;
    const [item] = await db
      .insert(chapters)
      .values({
        projectId,
        chapterNumber,
        title: title || null,
        synopsis: synopsis || null,
        content: content || null,
        wordCount,
        plotPointIds: plotPointIds || [],
        characterIds: characterIds || [],
        arcId: arcId || null,
      })
      .returning();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create chapter:", error);
    return NextResponse.json({ error: "Failed to create chapter" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (updates.content) {
      updates.wordCount = updates.content.length;
    }

    const db = getDb();
    const [updated] = await db
      .update(chapters)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(chapters.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update chapter:", error);
    return NextResponse.json({ error: "Failed to update chapter" }, { status: 500 });
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
    await db.delete(chapters).where(eq(chapters.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chapter:", error);
    return NextResponse.json({ error: "Failed to delete chapter" }, { status: 500 });
  }
}
