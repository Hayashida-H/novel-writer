import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { glossary } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

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
      .from(glossary)
      .where(eq(glossary.projectId, projectId))
      .orderBy(asc(glossary.category), asc(glossary.term));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch glossary:", error);
    return NextResponse.json({ error: "Failed to fetch glossary" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { projectId, term, reading, category, description, relatedCharacterIds } = body;

    if (!projectId || !term || !description) {
      return NextResponse.json(
        { error: "projectId, term, and description are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const [item] = await db
      .insert(glossary)
      .values({
        projectId,
        term,
        reading: reading || null,
        category: category || null,
        description,
        relatedCharacterIds: relatedCharacterIds || [],
      })
      .returning();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create glossary entry:", error);
    return NextResponse.json({ error: "Failed to create glossary entry" }, { status: 500 });
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
      .update(glossary)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(glossary.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update glossary entry:", error);
    return NextResponse.json({ error: "Failed to update glossary entry" }, { status: 500 });
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
    await db.delete(glossary).where(eq(glossary.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete glossary entry:", error);
    return NextResponse.json({ error: "Failed to delete glossary entry" }, { status: 500 });
  }
}
