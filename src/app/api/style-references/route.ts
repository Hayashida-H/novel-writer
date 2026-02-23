import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { styleReferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const db = getDb();
    const refs = await db
      .select()
      .from(styleReferences)
      .where(eq(styleReferences.projectId, projectId));

    return NextResponse.json(refs);
  } catch (error) {
    console.error("Failed to fetch style references:", error);
    return NextResponse.json({ error: "Failed to fetch style references" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, title, sampleText, styleNotes } = body;

    if (!projectId || !title) {
      return NextResponse.json(
        { error: "projectId and title are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const [ref] = await db
      .insert(styleReferences)
      .values({
        projectId,
        title,
        sampleText: sampleText || null,
        styleNotes: styleNotes || null,
      })
      .returning();

    return NextResponse.json(ref, { status: 201 });
  } catch (error) {
    console.error("Failed to create style reference:", error);
    return NextResponse.json({ error: "Failed to create style reference" }, { status: 500 });
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
      .update(styleReferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(styleReferences.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update style reference:", error);
    return NextResponse.json({ error: "Failed to update style reference" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    await db.delete(styleReferences).where(eq(styleReferences.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete style reference:", error);
    return NextResponse.json({ error: "Failed to delete style reference" }, { status: 500 });
  }
}
