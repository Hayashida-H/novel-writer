import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { plotStructure, plotPoints } from "@/lib/db/schema";
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

    // Get plot structure
    const [structure] = await db
      .select()
      .from(plotStructure)
      .where(eq(plotStructure.projectId, projectId))
      .limit(1);

    if (!structure) {
      return NextResponse.json({ structure: null, points: [] });
    }

    // Get plot points
    const points = await db
      .select()
      .from(plotPoints)
      .where(eq(plotPoints.plotStructureId, structure.id))
      .orderBy(asc(plotPoints.sortOrder));

    return NextResponse.json({ structure, points });
  } catch (error) {
    console.error("Failed to fetch plot:", error);
    return NextResponse.json({ error: "Failed to fetch plot" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { projectId, structureType, synopsis, themes, points: pointsData } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const db = getDb();

    // Create or update structure
    const existing = await db
      .select()
      .from(plotStructure)
      .where(eq(plotStructure.projectId, projectId))
      .limit(1);

    let structure;
    if (existing.length > 0) {
      [structure] = await db
        .update(plotStructure)
        .set({
          structureType: structureType || existing[0].structureType,
          synopsis: synopsis ?? existing[0].synopsis,
          themes: themes ?? existing[0].themes,
          updatedAt: new Date(),
        })
        .where(eq(plotStructure.projectId, projectId))
        .returning();
    } else {
      [structure] = await db
        .insert(plotStructure)
        .values({
          projectId,
          structureType: structureType || "kishotenketsu",
          synopsis: synopsis || null,
          themes: themes || [],
        })
        .returning();
    }

    // Add points if provided
    let points: typeof plotPoints.$inferSelect[] = [];
    if (pointsData && pointsData.length > 0) {
      const values = pointsData.map((p: { act: string; title: string; description: string; sortOrder: number; chapterHints?: number[]; isMajorTurningPoint?: boolean }, i: number) => ({
        plotStructureId: structure.id,
        act: p.act,
        title: p.title,
        description: p.description,
        sortOrder: p.sortOrder ?? i,
        chapterHints: p.chapterHints || [],
        isMajorTurningPoint: p.isMajorTurningPoint || false,
      }));

      points = await db.insert(plotPoints).values(values).returning();
    }

    return NextResponse.json({ structure, points }, { status: 201 });
  } catch (error) {
    console.error("Failed to create/update plot:", error);
    return NextResponse.json({ error: "Failed to create/update plot" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { type } = body;

    if (type === "structure") {
      const { id, clearPoints, type: _type, ...updates } = body;
      if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
      }
      const db = getDb();

      // If structureType changed and clearPoints requested, delete all points
      if (clearPoints && updates.structureType) {
        await db.delete(plotPoints).where(eq(plotPoints.plotStructureId, id));
      }

      const [updated] = await db
        .update(plotStructure)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(plotStructure.id, id))
        .returning();
      return NextResponse.json({ ...updated, pointsCleared: !!clearPoints });
    } else {
      // Update a plot point
      const { id, ...updates } = body;
      if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
      }
      const db = getDb();
      delete updates.type;
      const [updated] = await db
        .update(plotPoints)
        .set(updates)
        .where(eq(plotPoints.id, id))
        .returning();
      return NextResponse.json(updated);
    }
  } catch (error) {
    console.error("Failed to update plot:", error);
    return NextResponse.json({ error: "Failed to update plot" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const id = req.nextUrl.searchParams.get("id");
    const type = req.nextUrl.searchParams.get("type") || "point";

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    if (type === "structure") {
      await db.delete(plotStructure).where(eq(plotStructure.id, id));
    } else {
      await db.delete(plotPoints).where(eq(plotPoints.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete plot:", error);
    return NextResponse.json({ error: "Failed to delete plot" }, { status: 500 });
  }
}
