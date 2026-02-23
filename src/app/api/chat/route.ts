import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildProjectContext, formatContextForPrompt } from "@/lib/agents/context-builder";
import { ClaudeClient } from "@/lib/claude/client";
import type { ClaudeMessage } from "@/lib/claude/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    // Build system prompt
    const topicPrompt = TOPIC_SYSTEM_PROMPTS[session.topic] || TOPIC_SYSTEM_PROMPTS.general;
    const systemPrompt = contextPrompt
      ? `${topicPrompt}\n\n---\n\n## プロジェクトのコンテキスト\n${contextPrompt}`
      : topicPrompt;

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

          // Save assistant message to DB
          await db.insert(chatMessages).values({
            sessionId,
            role: "assistant",
            content: fullResponse,
          });

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
