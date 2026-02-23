import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { annotations, annotationBatches } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const chapterId = req.nextUrl.searchParams.get("chapterId");
    const projectId = req.nextUrl.searchParams.get("projectId");

    if (!chapterId && !projectId) {
      return NextResponse.json(
        { error: "chapterId or projectId is required" },
        { status: 400 }
      );
    }

    const db = getDb();

    if (chapterId) {
      const items = await db
        .select()
        .from(annotations)
        .where(eq(annotations.chapterId, chapterId))
        .orderBy(desc(annotations.createdAt));
      return NextResponse.json(items);
    }

    // Get all annotations for project via batches
    if (projectId) {
      const batches = await db
        .select()
        .from(annotationBatches)
        .where(eq(annotationBatches.projectId, projectId))
        .orderBy(desc(annotationBatches.createdAt));
      return NextResponse.json({ batches });
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error("Failed to fetch annotations:", error);
    return NextResponse.json({ error: "Failed to fetch annotations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      chapterId,
      chapterVersionId,
      paragraphIndex,
      startOffset,
      endOffset,
      anchorText,
      comment,
      annotationType,
    } = body;

    if (!chapterId || !chapterVersionId || paragraphIndex == null || !comment) {
      return NextResponse.json(
        { error: "chapterId, chapterVersionId, paragraphIndex, and comment are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const [item] = await db
      .insert(annotations)
      .values({
        chapterId,
        chapterVersionId,
        paragraphIndex,
        startOffset: startOffset ?? null,
        endOffset: endOffset ?? null,
        anchorText: anchorText ?? null,
        comment,
        annotationType: annotationType || "comment",
      })
      .returning();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create annotation:", error);
    return NextResponse.json({ error: "Failed to create annotation" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    const [updated] = await db
      .update(annotations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(annotations.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update annotation:", error);
    return NextResponse.json({ error: "Failed to update annotation" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    await db.delete(annotations).where(eq(annotations.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete annotation:", error);
    return NextResponse.json({ error: "Failed to delete annotation" }, { status: 500 });
  }
}
