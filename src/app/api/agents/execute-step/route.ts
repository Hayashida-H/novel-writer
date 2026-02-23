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
  formatContextForPrompt,
} from "@/lib/agents/context-builder";
import { generateChapterSummary } from "@/lib/agents/summary";
import { updateForeshadowingFromCheck } from "@/lib/agents/foreshadowing-updater";
import { extractContentFromCheck } from "@/lib/agents/content-extractor";
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
          content: `第${chapterNumber}話の本文を執筆してください。シーン構成、舞台設定、キャラクターブリーフに基づいて、読者を引き込む文章で執筆してください。`,
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
          content: `第${chapterNumber}話の本文を校正してください。文章の品質、表現の一貫性、誤字脱字、読みやすさを確認し、修正版を出力してください。`,
        },
      ],
      dependsOn: [4],
    },
    {
      agentType: "continuity_checker",
      taskType: "check",
      description: `第${chapterNumber}話の整合性チェック`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}話の整合性をチェックしてください。前話との矛盾、タイムラインの整合性、キャラクターの言動の一貫性、世界設定との矛盾がないか確認してください。執筆原文と編集後の両方を比較し、編集で意図せず失われた要素がないかも確認してください。`,
        },
      ],
      dependsOn: [4, 5],
    },
  ];
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
    const contextPrompt = formatContextForPrompt(projectContext);
    const agentContext = await buildAgentContext(projectId, step.agentType, chapterId);

    // Enrich messages with project context + dependent outputs
    const contextParts: string[] = [contextPrompt];
    if (step.dependsOn) {
      for (const depIdx of step.dependsOn) {
        const depOutput = dependentOutputs.get(depIdx);
        if (depOutput) {
          contextParts.push(`## 前のステップの出力\n${depOutput}`);
        }
      }
    }

    const contextMessage: ClaudeMessage = {
      role: "user",
      content: `以下はプロジェクトのコンテキスト情報です：\n\n${contextParts.join("\n\n---\n\n")}`,
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

        // Save output to DB
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

        // Post-step actions based on agent type
        if (step.agentType === "writer") {
          await db
            .update(chapters)
            .set({
              content: result.output.content,
              wordCount: result.output.content.length,
              status: "draft",
              updatedAt: new Date(),
            })
            .where(eq(chapters.id, chapterId));
        }

        if (step.agentType === "editor") {
          const cleanContent = result.output.content
            .replace(/<!-- SPLIT_SUGGESTION:[\s\S]*?-->/g, "")
            .trim();

          await db
            .update(chapters)
            .set({
              content: cleanContent,
              wordCount: cleanContent.length,
              status: "draft",
              updatedAt: new Date(),
            })
            .where(eq(chapters.id, chapterId));
        }

        if (step.agentType === "continuity_checker") {
          try {
            await generateChapterSummary(chapterId);
          } catch (err) {
            console.error("Failed to generate summary:", err);
          }
          try {
            await updateForeshadowingFromCheck(projectId, chapterId, result.rawContent);
          } catch (err) {
            console.error("Failed to update foreshadowing:", err);
          }
          try {
            await extractContentFromCheck(projectId, result.rawContent);
          } catch (err) {
            console.error("Failed to extract content:", err);
          }
        }

        send({
          type: "agent_complete",
          agentType: step.agentType,
          output: result.output,
        });
        close();
      } catch (error) {
        await db
          .update(agentTasks)
          .set({
            status: "failed",
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          })
          .where(eq(agentTasks.id, taskRecord.id));

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
