import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { chatMessages, chatSessions, characters, worldSettings, glossary } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildProjectContext, formatContextForPrompt } from "@/lib/agents/context-builder";
import { ClaudeClient } from "@/lib/claude/client";
import type { ClaudeMessage } from "@/lib/claude/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REFLECTION_INSTRUCTION = `

## 自動反映ルール
会話の中で登場人物の設定変更、新しい世界観設定、新しい用語などが確定した場合、
応答の末尾に以下の形式でメタデータを含めてください（ユーザーには表示されません）。
提案段階や検討中の内容は含めず、会話で合意・確定した内容のみを反映してください。

<!-- REFLECT: [
  {"type": "character_create", "data": {"name": "名前", "role": "役割", "description": "説明"}},
  {"type": "character_update", "data": {"name": "既存キャラ名", "description": "新しい説明"}},
  {"type": "world_create", "data": {"category": "カテゴリ", "title": "タイトル", "content": "内容"}},
  {"type": "glossary_create", "data": {"term": "用語", "reading": "読み", "category": "カテゴリ", "description": "説明"}}
] -->`;

interface ReflectAction {
  type: "character_create" | "character_update" | "world_create" | "glossary_create";
  data: Record<string, string>;
}

async function applyReflections(
  projectId: string,
  actions: ReflectAction[]
): Promise<{ target: string; action: string }[]> {
  const db = getDb();
  const applied: { target: string; action: string }[] = [];

  for (const act of actions) {
    try {
      switch (act.type) {
        case "character_create": {
          const { name, role, description } = act.data;
          const validRoles = ["protagonist", "antagonist", "supporting", "minor"] as const;
          type CharacterRole = (typeof validRoles)[number];
          const safeRole: CharacterRole = validRoles.includes(role as CharacterRole) ? (role as CharacterRole) : "minor";
          if (name && role) {
            await db.insert(characters).values({
              projectId,
              name,
              role: safeRole,
              description: description || null,
            });
            applied.push({ target: "登場人物", action: `「${name}」を追加` });
          }
          break;
        }
        case "character_update": {
          const { name, ...updates } = act.data;
          if (name) {
            const existing = await db
              .select()
              .from(characters)
              .where(eq(characters.projectId, projectId));
            const match = existing.find((c) => c.name === name);
            if (match) {
              const setData: Record<string, unknown> = { updatedAt: new Date() };
              if (updates.description) setData.description = updates.description;
              if (updates.personality) setData.personality = updates.personality;
              if (updates.backstory) setData.backstory = updates.backstory;
              if (updates.speechPattern) setData.speechPattern = updates.speechPattern;
              if (updates.goals) setData.goals = updates.goals;
              await db.update(characters).set(setData).where(eq(characters.id, match.id));
              applied.push({ target: "登場人物", action: `「${name}」を更新` });
            }
          }
          break;
        }
        case "world_create": {
          const { category, title, content } = act.data;
          if (category && title && content) {
            await db.insert(worldSettings).values({ projectId, category, title, content });
            applied.push({ target: "世界設定", action: `「${title}」を追加` });
          }
          break;
        }
        case "glossary_create": {
          const { term, reading, category, description } = act.data;
          if (term && description) {
            await db.insert(glossary).values({
              projectId,
              term,
              reading: reading || null,
              category: category || null,
              description,
            });
            applied.push({ target: "用語集", action: `「${term}」を追加` });
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to apply reflection ${act.type}:`, error);
    }
  }

  return applied;
}

function extractReflections(text: string): { cleanText: string; actions: ReflectAction[] } {
  const reflectPattern = /<!-- REFLECT:\s*([\s\S]*?)\s*-->/g;
  let actions: ReflectAction[] = [];
  const cleanText = text.replace(reflectPattern, "").trim();

  let match;
  reflectPattern.lastIndex = 0;
  while ((match = reflectPattern.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        actions = actions.concat(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }

  return { cleanText, actions };
}

const TOPIC_SYSTEM_PROMPTS: Record<string, string> = {
  plot: `あなたは小説のプロット構成を支援するアシスタントです。
ユーザーと対話しながら、物語の構造・展開・転換点を一緒に考えます。
具体的な提案をしつつ、ユーザーの創造性を尊重してください。
回答は日本語でお願いします。`,

  characters: `あなたは小説のキャラクター設計を支援するアシスタントです。
ユーザーと対話しながら、登場人物の性格・背景・動機・関係性を一緒に深掘りします。
キャラクターに深みを持たせるための質問や提案を積極的にしてください。
回答は日本語でお願いします。`,

  world: `あなたは小説の世界観構築を支援するアシスタントです。
ユーザーと対話しながら、舞台設定・歴史・文化・ルールを一緒に設計します。
設定の矛盾を指摘し、物語に活きる設定になるよう導いてください。
回答は日本語でお願いします。`,

  general: `あなたは小説執筆を総合的に支援するアシスタントです。
プロット、キャラクター、世界観、文体、テーマなど、あらゆる相談に対応します。
ユーザーの創作を前に進めるための具体的なアドバイスを心がけてください。
回答は日本語でお願いします。`,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, content } = body;

    if (!sessionId || !content) {
      return new Response(JSON.stringify({ error: "sessionId and content are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = getDb();

    // Get session info
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Save user message
    await db.insert(chatMessages).values({
      sessionId,
      role: "user",
      content,
    });

    // Get conversation history
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt));

    // Build project context
    const projectContext = await buildProjectContext(session.projectId);
    const contextPrompt = formatContextForPrompt(projectContext);

    // Build system prompt with reflection instructions
    const topicPrompt = TOPIC_SYSTEM_PROMPTS[session.topic] || TOPIC_SYSTEM_PROMPTS.general;
    const systemPrompt = contextPrompt
      ? `${topicPrompt}${REFLECTION_INSTRUCTION}\n\n---\n\n## プロジェクトのコンテキスト\n${contextPrompt}`
      : `${topicPrompt}${REFLECTION_INSTRUCTION}`;

    // Build messages for Claude
    const messages: ClaudeMessage[] = history.map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

    // Stream response
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = new ClaudeClient();

          await client.chat({
            model: "claude-sonnet-4-20250514",
            systemPrompt,
            messages,
            temperature: 0.7,
            maxTokens: 4096,
            onStream: (text: string) => {
              fullResponse += text;
              const data = JSON.stringify({ type: "stream", text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          // Extract and apply reflections
          const { cleanText, actions } = extractReflections(fullResponse);

          // Save assistant message to DB (clean text without reflection tags)
          await db.insert(chatMessages).values({
            sessionId,
            role: "assistant",
            content: cleanText,
          });

          // Apply reflections to project data
          if (actions.length > 0) {
            const applied = await applyReflections(session.projectId, actions);
            if (applied.length > 0) {
              const reflectData = JSON.stringify({ type: "reflect", applied });
              controller.enqueue(encoder.encode(`data: ${reflectData}\n\n`));
            }
          }

          // Update session title if it's the first exchange
          if (history.length <= 1 && !session.title) {
            const title = content.length > 30 ? content.slice(0, 30) + "…" : content;
            await db
              .update(chatSessions)
              .set({ title, updatedAt: new Date() })
              .where(eq(chatSessions.id, sessionId));
          } else {
            await db
              .update(chatSessions)
              .set({ updatedAt: new Date() })
              .where(eq(chatSessions.id, sessionId));
          }

          const doneData = JSON.stringify({ type: "done" });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Chat stream error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "Unknown error",
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
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
