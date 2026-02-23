import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ClaudeClient } from "@/lib/claude/client";
import { getDb } from "@/lib/db";
import { foreshadowing, projects, characters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildProjectContext, formatContextForPrompt } from "@/lib/agents/context-builder";
import { FORESHADOWING_GENERATION_PROMPT } from "@/lib/generation/prompts";
import { parseJsonArray } from "@/lib/generation/parsers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const VALID_TYPES = ["foreshadowing", "chekhovs_gun", "recurring_motif", "red_herring"] as const;
type ForeshadowingType = (typeof VALID_TYPES)[number];
const VALID_PRIORITIES = ["high", "medium", "low"] as const;
type ForeshadowingPriority = (typeof VALID_PRIORITIES)[number];

function toValidType(t: string | undefined): ForeshadowingType {
  if (t && VALID_TYPES.includes(t as ForeshadowingType)) return t as ForeshadowingType;
  return "foreshadowing";
}

function toValidPriority(p: string | undefined): ForeshadowingPriority {
  if (p && VALID_PRIORITIES.includes(p as ForeshadowingPriority)) return p as ForeshadowingPriority;
  return "medium";
}

interface GeneratedForeshadowing {
  title: string;
  description: string;
  type: string;
  priority: string;
  plantedContext?: string;
  targetChapter?: number;
  relatedCharacterNames?: string[];
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = getDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const context = await buildProjectContext(projectId);
    const contextText = formatContextForPrompt(context);

    // Fetch character list for name → id resolution
    const charList = await db
      .select({ id: characters.id, name: characters.name })
      .from(characters)
      .where(eq(characters.projectId, projectId));
    const charNameToId = new Map(charList.map((c) => [c.name, c.id]));

    const userMessage = `以下のプロジェクト情報に基づいて、5-8個の伏線を設計してください。

タイトル: ${project.title}
ジャンル: ${project.genre || "未設定"}
概要: ${project.description || "未設定"}

${contextText ? `\n---\n\n${contextText}` : ""}`;

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = new ClaudeClient();
          await client.chat({
            model: "claude-sonnet-4-20250514",
            systemPrompt: FORESHADOWING_GENERATION_PROMPT,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.8,
            maxTokens: 8192,
            onStream: (text: string) => {
              fullResponse += text;
              const data = JSON.stringify({ type: "stream", text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          const parsed = parseJsonArray<GeneratedForeshadowing>(fullResponse);
          const saved = [];
          for (const fs of parsed) {
            // Resolve character names to IDs
            const relatedCharacterIds = (fs.relatedCharacterNames || [])
              .map((name) => charNameToId.get(name))
              .filter((id): id is string => !!id);

            const [item] = await db
              .insert(foreshadowing)
              .values({
                projectId,
                title: fs.title,
                description: fs.description,
                type: toValidType(fs.type),
                status: "planted",
                priority: toValidPriority(fs.priority),
                plantedContext: fs.plantedContext || null,
                targetChapter: fs.targetChapter || null,
                relatedCharacterIds,
              })
              .returning();
            saved.push(item);
          }

          const doneData = JSON.stringify({ type: "done", items: saved });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Foreshadowing generation error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "伏線生成に失敗しました",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Foreshadowing generation API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
