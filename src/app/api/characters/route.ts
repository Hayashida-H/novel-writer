import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const db = getDb();
    const items = await db
      .select()
      .from(characters)
      .where(eq(characters.projectId, projectId));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch characters:", error);
    return NextResponse.json({ error: "Failed to fetch characters" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId, name, role, description, appearance,
      personality, speechPattern, backstory, goals, arcDescription,
    } = body;

    if (!projectId || !name || !role) {
      return NextResponse.json(
        { error: "projectId, name, and role are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const [item] = await db
      .insert(characters)
      .values({
        projectId,
        name,
        role,
        description: description || null,
        appearance: appearance || null,
        personality: personality || null,
        speechPattern: speechPattern || null,
        backstory: backstory || null,
        goals: goals || null,
        arcDescription: arcDescription || null,
      })
      .returning();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create character:", error);
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
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
      .update(characters)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(characters.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update character:", error);
    return NextResponse.json({ error: "Failed to update character" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    await db.delete(characters).where(eq(characters.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete character:", error);
    return NextResponse.json({ error: "Failed to delete character" }, { status: 500 });
  }
}
