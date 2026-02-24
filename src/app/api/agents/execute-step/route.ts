import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { agentTasks, chapters } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getClaudeClient } from "@/lib/claude/client";
import { createSSEStream } from "@/lib/claude/streaming";
import { BaseAgent } from "@/lib/agents/base-agent";
import {
  buildAgentContext,
  buildProjectContext,
  buildChapterContext,
  formatContextForPrompt,
} from "@/lib/agents/context-builder";
import { generateChapterSummary } from "@/lib/agents/summary";
import type { AgentType } from "@/types/agent";
import type { ClaudeMessage } from "@/lib/claude/client";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface StepDef {
  agentType: AgentType;
  taskType: string;
  description: string;
  messages: ClaudeMessage[];
  dependsOn?: number[];
}

function buildWritingPipeline(chapterNumber: number): StepDef[] {
  return [
    {
      agentType: "coordinator",
      taskType: "plan",
      description: `第${chapterNumber}話の執筆計画を立案`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}話の執筆計画を立ててください。シーン構成、登場人物、重要なイベント、伏線の扱いを含めてください。`,
        },
      ],
    },
    {
      agentType: "plot_architect",
      taskType: "outline",
      description: `第${chapterNumber}話のシーン構成・ビート作成`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}話の詳細なシーン構成を作成してください。各シーンのビート（展開ポイント）、伏線の配置・回収ポイントを含めてください。`,
        },
      ],
      dependsOn: [0],
    },
    {
      agentType: "world_builder",
      taskType: "setting",
      description: `第${chapterNumber}話の舞台・環境設定`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}話のシーン構成を踏まえ、各シーンで必要な舞台設定・環境描写の詳細を提供してください。場所、時間帯、雰囲気、五感で感じる要素を含めてください。`,
        },
      ],
      dependsOn: [0, 1],
    },
    {
      agentType: "character_manager",
      taskType: "briefing",
      description: `第${chapterNumber}話の登場人物ブリーフ`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}話のシーン構成と舞台設定を踏まえ、登場するキャラクターのブリーフィングを作成してください。各キャラの現在の心理状態、この話での目的、他キャラとの関係性の変化を含めてください。`,
        },
      ],
      dependsOn: [0, 1, 2],
    },
    {
      agentType: "writer",
      taskType: "write",
      description: `第${chapterNumber}話の本文執筆`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}話の本文を執筆してください。シーン構成、舞台設定、キャラクターブリーフに基づいて、読者を引き込む文章で執筆してください。

【重要】出力は小説の本文のみにしてください。JSON、メタデータ、構成メモ、コメントなどは一切含めないでください。読者がそのまま読める小説本文だけを出力してください。`,
        },
      ],
      dependsOn: [1, 2, 3],
    },
    {
      agentType: "editor",
      taskType: "review",
      description: `第${chapterNumber}話の編集・校正`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}話の本文を校正してください。文章の品質、表現の一貫性、誤字脱字、読みやすさを確認し、修正版を出力してください。

【重要】出力形式を厳守してください：
1. まず「--- 修正後本文 ---」と書いてから、校正済みの完全な本文を出力
2. 次に「--- フィードバック ---」と書いてから、修正箇所・評価を記載
JSONで出力しないでください。`,
        },
      ],
      dependsOn: [4],
    },
  ];
}

/**
 * Extract the corrected prose from editor output.
 * Expected format: "--- 修正後本文 ---\n...\n--- フィードバック ---\n..."
 * Falls back to stripping JSON and returning raw text.
 */
function extractEditorContent(raw: string): string {
  // Try to extract between markers
  const startMarker = /---\s*修正後本文\s*---/;
  const endMarker = /---\s*フィードバック\s*---/;

  const startMatch = raw.match(startMarker);
  if (startMatch && startMatch.index !== undefined) {
    const contentStart = startMatch.index + startMatch[0].length;
    const endMatch = raw.match(endMarker);
    if (endMatch && endMatch.index !== undefined) {
      return raw.slice(contentStart, endMatch.index).trim();
    }
    // No end marker — everything after start marker is content
    return raw.slice(contentStart).trim();
  }

  // Fallback: if the output looks like JSON, it's the old format — not usable as chapter content
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.includes('"corrections"')) {
    console.warn("[extractEditorContent] Editor output is old JSON format, cannot extract content");
    return "";
  }

  // Otherwise return raw content (might be plain text)
  return raw.replace(/<!-- SPLIT_SUGGESTION:[\s\S]*?-->/g, "").trim();
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { projectId, chapterId, stepIndex } = await req.json();

    if (!projectId || !chapterId || stepIndex === undefined) {
      return new Response(
        JSON.stringify({ error: "projectId, chapterId, stepIndex required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();

    const [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);

    if (!chapter) {
      return new Response(
        JSON.stringify({ error: "Chapter not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const allSteps = buildWritingPipeline(chapter.chapterNumber);
    if (stepIndex < 0 || stepIndex >= allSteps.length) {
      return new Response(
        JSON.stringify({ error: "Invalid stepIndex" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const step = allSteps[stepIndex];

    // Gather dependent step outputs from DB
    const dependentOutputs = new Map<number, string>();
    if (step.dependsOn) {
      for (const depIdx of step.dependsOn) {
        const depStep = allSteps[depIdx];
        const [task] = await db
          .select()
          .from(agentTasks)
          .where(
            and(
              eq(agentTasks.projectId, projectId),
              eq(agentTasks.chapterId, chapterId),
              eq(agentTasks.agentType, depStep.agentType),
              eq(agentTasks.taskType, depStep.taskType),
              eq(agentTasks.status, "completed")
            )
          )
          .orderBy(desc(agentTasks.completedAt))
          .limit(1);

        if (task?.output) {
          dependentOutputs.set(depIdx, task.output);
        }
      }
    }

    // Create task record
    const [taskRecord] = await db
      .insert(agentTasks)
      .values({
        projectId,
        chapterId,
        agentType: step.agentType,
        taskType: step.taskType,
        status: "running",
        startedAt: new Date(),
        inputContext: { description: step.description },
      })
      .returning();

    // Build context
    const client = getClaudeClient();
    const agent = new BaseAgent(step.agentType, client);
    const projectContext = await buildProjectContext(projectId);
    const chapterContext = await buildChapterContext(projectId, chapterId, projectContext.plotPoints);
    const contextPrompt = formatContextForPrompt(projectContext, chapterContext);
    const agentContext = await buildAgentContext(projectId, step.agentType, chapterId);
    console.log(`[execute-step] Starting ${step.agentType}: model=${agentContext.model}, maxTokens=${agentContext.maxTokens}`);

    // Enrich messages with project context + dependent outputs (labeled by agent)
    const contextParts: string[] = [contextPrompt];
    const AGENT_LABELS: Record<string, string> = {
      coordinator: "コーディネーター（執筆計画）",
      plot_architect: "プロット設計（シーン構成）",
      world_builder: "世界設定（舞台・環境）",
      character_manager: "キャラクターブリーフ",
      writer: "執筆済み本文",
      editor: "校正済み本文",
    };
    if (step.dependsOn) {
      for (const depIdx of step.dependsOn) {
        const depOutput = dependentOutputs.get(depIdx);
        if (depOutput) {
          const depAgent = allSteps[depIdx].agentType;
          const label = AGENT_LABELS[depAgent] || depAgent;
          contextParts.push(`## ${label}\n${depOutput}`);
        }
      }
    }

    const contextMessage: ClaudeMessage = {
      role: "user",
      content: `以下はプロジェクトのコンテキスト情報です（参考情報として読み取ってください。前ステップの出力形式を真似る必要はありません）：\n\n${contextParts.join("\n\n---\n\n")}`,
    };

    const enrichedMessages: ClaudeMessage[] = [contextMessage, ...step.messages];

    // Create SSE stream for this single step
    const { stream, send, close } = createSSEStream();

    send({ type: "agent_start", agentType: step.agentType });

    // Execute agent in background
    (async () => {
      try {
        const result = await agent.execute(agentContext, enrichedMessages, (text) => {
          send({ type: "agent_stream", agentType: step.agentType, text });
        });

        console.log(`[execute-step] ${step.agentType} completed: stopReason=${result.stopReason}, outputTokens=${result.output.tokenUsage.output}, contentLength=${result.rawContent.length}`);

        // Save output to agent_tasks DB (always do this first)
        await db
          .update(agentTasks)
          .set({
            status: "completed",
            completedAt: new Date(),
            output: result.rawContent,
            tokenUsage: {
              inputTokens: result.output.tokenUsage.input,
              outputTokens: result.output.tokenUsage.output,
            },
          })
          .where(eq(agentTasks.id, taskRecord.id));

        // Post-step actions: save chapter content (non-fatal — output is already in agent_tasks)
        if (step.agentType === "writer" || step.agentType === "editor") {
          try {
            const content = step.agentType === "editor"
              ? extractEditorContent(result.rawContent)
              : result.output.content.replace(/<!-- SPLIT_SUGGESTION:[\s\S]*?-->/g, "").trim();

            if (content) {
              await db
                .update(chapters)
                .set({
                  content,
                  wordCount: content.length,
                  status: "draft",
                  updatedAt: new Date(),
                })
                .where(eq(chapters.id, chapterId));

              console.log(`[execute-step] Chapter ${chapterId} content updated (${content.length} chars) by ${step.agentType}`);
            // Generate summary after editor saves final content
              if (step.agentType === "editor") {
                try {
                  await generateChapterSummary(chapterId);
                } catch (err) {
                  console.error("Failed to generate summary:", err);
                }
              }
            } else {
              console.warn(`[execute-step] No extractable content from ${step.agentType}, skipping chapter update`);
            }
          } catch (err) {
            console.error(`[execute-step] Failed to update chapter content for ${step.agentType}:`, err);
          }
        }

        // Always send agent_complete — output is safely stored in agent_tasks
        send({
          type: "agent_complete",
          agentType: step.agentType,
          output: result.output,
        });
        close();
      } catch (error) {
        console.error(`[execute-step] Step ${step.agentType} failed:`, error);
        try {
          await db
            .update(agentTasks)
            .set({
              status: "failed",
              completedAt: new Date(),
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            })
            .where(eq(agentTasks.id, taskRecord.id));
        } catch (dbErr) {
          console.error("[execute-step] Failed to mark task as failed:", dbErr);
        }

        send({
          type: "error",
          message: error instanceof Error ? error.message : "ステップの実行に失敗しました",
        });
        close();
      }
    })();

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Execute step error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
