import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects, plotStructure } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const db = getDb();
    const result = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.updatedAt));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { title, description, genre, structureType, language } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const [project] = await db
      .insert(projects)
      .values({
        title,
        description: description || null,
        genre: genre || null,
        language: language || "ja",
        status: "preparation",
      })
      .returning();

    // Create default plot structure
    if (structureType) {
      await db.insert(plotStructure).values({
        projectId: project.id,
        structureType: structureType as "kishotenketsu" | "three_act" | "hero_journey" | "custom",
      });
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
