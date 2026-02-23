import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ClaudeClient } from "@/lib/claude/client";
import { getDb } from "@/lib/db";
import { characters, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildProjectContext, formatContextForPrompt } from "@/lib/agents/context-builder";
import { CHARACTERS_GENERATION_PROMPT } from "@/lib/generation/prompts";
import { parseJsonArray } from "@/lib/generation/parsers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const VALID_ROLES = ["protagonist", "antagonist", "supporting", "minor"] as const;
type CharacterRole = (typeof VALID_ROLES)[number];

function toValidRole(role: string | undefined): CharacterRole {
  if (role && VALID_ROLES.includes(role as CharacterRole)) return role as CharacterRole;
  return "supporting";
}

interface GeneratedCharacter {
  name: string;
  role: string;
  description?: string;
  appearance?: string;
  personality?: string;
  speechPattern?: string;
  backstory?: string;
  goals?: string;
  arcDescription?: string;
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

    const userMessage = `以下のプロジェクト情報に基づいて、4-6名のキャラクターを生成してください。

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
            systemPrompt: CHARACTERS_GENERATION_PROMPT,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.8,
            maxTokens: 8192,
            onStream: (text: string) => {
              fullResponse += text;
              const data = JSON.stringify({ type: "stream", text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          const parsed = parseJsonArray<GeneratedCharacter>(fullResponse);
          const saved = [];
          for (const char of parsed) {
            const [item] = await db
              .insert(characters)
              .values({
                projectId,
                name: char.name,
                role: toValidRole(char.role),
                description: char.description || null,
                appearance: char.appearance || null,
                personality: char.personality || null,
                speechPattern: char.speechPattern || null,
                backstory: char.backstory || null,
                goals: char.goals || null,
                arcDescription: char.arcDescription || null,
              })
              .returning();
            saved.push(item);
          }

          const doneData = JSON.stringify({ type: "done", items: saved });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Character generation error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "キャラクター生成に失敗しました",
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
    console.error("Character generation API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
