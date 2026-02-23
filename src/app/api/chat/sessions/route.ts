import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { chatSessions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
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
    const sessions = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.projectId, projectId))
      .orderBy(desc(chatSessions.updatedAt));

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Failed to fetch chat sessions:", error);
    return NextResponse.json({ error: "Failed to fetch chat sessions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await req.json();
    const { projectId, topic, title } = body;

    if (!projectId || !topic) {
      return NextResponse.json(
        { error: "projectId and topic are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const [session] = await db
      .insert(chatSessions)
      .values({
        projectId,
        topic,
        title: title || null,
      })
      .returning();

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("Failed to create chat session:", error);
    return NextResponse.json({ error: "Failed to create chat session" }, { status: 500 });
  }
}
