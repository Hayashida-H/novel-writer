import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { annotations, annotationBatches, chapterVersions, chapters } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req, ["manager", "reviewer"]);
    if (authResult instanceof NextResponse) return authResult;

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
    const authResult = await requireAuth(req, ["manager", "reviewer"]);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const {
      chapterId,
      paragraphIndex,
      startOffset,
      endOffset,
      anchorText,
      comment,
      annotationType,
    } = body;

    if (!chapterId || paragraphIndex == null || !comment) {
      return NextResponse.json(
        { error: "chapterId, paragraphIndex, and comment are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Get or create a chapter version for this chapter
    let [latestVersion] = await db
      .select()
      .from(chapterVersions)
      .where(eq(chapterVersions.chapterId, chapterId))
      .orderBy(desc(chapterVersions.versionNumber))
      .limit(1);

    if (!latestVersion) {
      // Auto-create version 1 from current chapter content
      const [chapter] = await db
        .select({ content: chapters.content, wordCount: chapters.wordCount })
        .from(chapters)
        .where(eq(chapters.id, chapterId))
        .limit(1);

      [latestVersion] = await db
        .insert(chapterVersions)
        .values({
          chapterId,
          versionNumber: 1,
          content: chapter?.content || "",
          changeSummary: "初期バージョン（自動作成）",
          createdBy: "system",
          wordCount: chapter?.wordCount || 0,
        })
        .returning();
    }

    const [item] = await db
      .insert(annotations)
      .values({
        chapterId,
        chapterVersionId: latestVersion.id,
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
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

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
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

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
