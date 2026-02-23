import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { characterRelationships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
      .from(characterRelationships)
      .where(eq(characterRelationships.projectId, projectId));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch relationships:", error);
    return NextResponse.json({ error: "Failed to fetch relationships" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { projectId, characterAId, characterBId, relationshipType, description, evolvesTo } = body;

    if (!projectId || !characterAId || !characterBId || !relationshipType) {
      return NextResponse.json(
        { error: "projectId, characterAId, characterBId, and relationshipType are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const [item] = await db
      .insert(characterRelationships)
      .values({
        projectId,
        characterAId,
        characterBId,
        relationshipType,
        description: description || null,
        evolvesTo: evolvesTo || null,
      })
      .returning();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create relationship:", error);
    return NextResponse.json({ error: "Failed to create relationship" }, { status: 500 });
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
      .update(characterRelationships)
      .set(updates)
      .where(eq(characterRelationships.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update relationship:", error);
    return NextResponse.json({ error: "Failed to update relationship" }, { status: 500 });
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
    await db.delete(characterRelationships).where(eq(characterRelationships.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete relationship:", error);
    return NextResponse.json({ error: "Failed to delete relationship" }, { status: 500 });
  }
}
