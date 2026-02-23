import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { agentConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAllDefaultConfigs } from "@/lib/agents/prompts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const db = getDb();
    const configs = await db
      .select()
      .from(agentConfigs)
      .where(eq(agentConfigs.projectId, projectId));

    // If no configs exist yet, return defaults
    if (configs.length === 0) {
      const defaults = getAllDefaultConfigs().map((d) => ({
        id: null,
        projectId,
        agentType: d.agentType,
        systemPrompt: d.systemPrompt,
        model: d.model,
        temperature: d.temperature,
        maxTokens: d.maxTokens,
        customInstructions: null,
        styleProfile: null,
        isActive: true,
        isDefault: true,
      }));
      return NextResponse.json(defaults);
    }

    return NextResponse.json(configs.map((c) => ({ ...c, isDefault: false })));
  } catch (error) {
    console.error("Failed to fetch agent configs:", error);
    return NextResponse.json({ error: "Failed to fetch agent configs" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      agentType,
      systemPrompt,
      model,
      temperature,
      maxTokens,
      customInstructions,
      styleProfile,
      isActive,
    } = body;

    if (!projectId || !agentType) {
      return NextResponse.json(
        { error: "projectId and agentType are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if config exists
    const existing = await db
      .select()
      .from(agentConfigs)
      .where(and(eq(agentConfigs.projectId, projectId), eq(agentConfigs.agentType, agentType)))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      const [updated] = await db
        .update(agentConfigs)
        .set({
          systemPrompt,
          model,
          temperature,
          maxTokens,
          customInstructions,
          styleProfile,
          isActive,
          updatedAt: new Date(),
        })
        .where(and(eq(agentConfigs.projectId, projectId), eq(agentConfigs.agentType, agentType)))
        .returning();
      return NextResponse.json(updated);
    } else {
      // Insert new
      const [created] = await db
        .insert(agentConfigs)
        .values({
          projectId,
          agentType,
          systemPrompt,
          model,
          temperature,
          maxTokens,
          customInstructions,
          styleProfile,
          isActive: isActive ?? true,
        })
        .returning();
      return NextResponse.json(created, { status: 201 });
    }
  } catch (error) {
    console.error("Failed to update agent config:", error);
    return NextResponse.json({ error: "Failed to update agent config" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const db = getDb();
    const defaults = getAllDefaultConfigs();

    const values = defaults.map((d) => ({
      projectId,
      agentType: d.agentType,
      systemPrompt: d.systemPrompt,
      model: d.model,
      temperature: d.temperature,
      maxTokens: d.maxTokens,
    }));

    const configs = await db.insert(agentConfigs).values(values).returning();
    return NextResponse.json(configs, { status: 201 });
  } catch (error) {
    console.error("Failed to initialize agent configs:", error);
    return NextResponse.json({ error: "Failed to initialize agent configs" }, { status: 500 });
  }
}
