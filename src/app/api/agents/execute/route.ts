import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { agentTasks, chapters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getClaudeClient } from "@/lib/claude/client";
import { createSSEStream } from "@/lib/claude/streaming";
import { AgentPipeline } from "@/lib/agents/pipeline";
import { generateChapterSummary } from "@/lib/agents/summary";
import type { StreamEvent } from "@/types/agent";
import type { PipelineStep } from "@/lib/agents/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min for long pipelines

// Default writing pipeline: the standard sequence for generating a chapter
function buildWritingPipeline(chapterNumber: number): PipelineStep[] {
  return [
    {
      agentType: "coordinator",
      taskType: "plan",
      description: `第${chapterNumber}章の執筆計画を立案`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}章の執筆計画を立ててください。シーン構成、登場人物、重要なイベント、伏線の扱いを含めてください。`,
        },
      ],
    },
    {
      agentType: "plot_architect",
      taskType: "outline",
      description: `第${chapterNumber}章のシーン構成・ビート作成`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}章の詳細なシーン構成を作成してください。各シーンのビート（展開ポイント）、伏線の配置・回収ポイントを含めてください。`,
        },
      ],
      dependsOn: [0],
    },
    {
      agentType: "world_builder",
      taskType: "setting",
      description: `第${chapterNumber}章の舞台・環境設定`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}章で必要な舞台設定・環境描写の詳細を提供してください。場所、時間帯、雰囲気、五感で感じる要素を含めてください。`,
        },
      ],
      dependsOn: [0],
    },
    {
      agentType: "character_manager",
      taskType: "briefing",
      description: `第${chapterNumber}章の登場人物ブリーフ`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}章に登場するキャラクターのブリーフィングを作成してください。各キャラの現在の心理状態、この章での目的、他キャラとの関係性の変化を含めてください。`,
        },
      ],
      dependsOn: [0],
    },
    {
      agentType: "writer",
      taskType: "write",
      description: `第${chapterNumber}章の本文執筆`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}章の本文を執筆してください。前のステップで作成されたシーン構成、舞台設定、キャラクターブリーフに基づいて、読者を引き込む文章で執筆してください。`,
        },
      ],
      dependsOn: [1, 2, 3],
    },
    {
      agentType: "editor",
      taskType: "review",
      description: `第${chapterNumber}章の編集・校正`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}章の本文を校正してください。文章の品質、表現の一貫性、誤字脱字、読みやすさを確認し、修正版を出力してください。`,
        },
      ],
      dependsOn: [4],
    },
    {
      agentType: "continuity_checker",
      taskType: "check",
      description: `第${chapterNumber}章の整合性チェック`,
      messages: [
        {
          role: "user",
          content: `第${chapterNumber}章の整合性をチェックしてください。前章との矛盾、タイムラインの整合性、キャラクターの言動の一貫性、世界設定との矛盾がないか確認してください。`,
        },
      ],
      dependsOn: [5],
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, chapterId, mode = "write", customSteps } = body as {
      projectId: string;
      chapterId?: string;
      mode?: "write" | "edit" | "custom";
      customSteps?: PipelineStep[];
    };

    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = getDb();
    const client = getClaudeClient();
    const pipeline = new AgentPipeline(client);

    // Determine chapter number for default pipeline
    let chapterNumber = 1;
    if (chapterId) {
      const chapterRows = await db
        .select({ chapterNumber: chapters.chapterNumber })
        .from(chapters)
        .where(eq(chapters.id, chapterId))
        .limit(1);
      if (chapterRows[0]) {
        chapterNumber = chapterRows[0].chapterNumber;
      }
    }

    // Build steps based on mode
    let steps: PipelineStep[];
    if (mode === "custom" && customSteps) {
      steps = customSteps;
    } else if (mode === "edit") {
      // Simplified pipeline for editing: just editor + continuity checker
      steps = [
        {
          agentType: "editor",
          taskType: "review",
          description: `第${chapterNumber}章の再編集`,
          messages: [
            {
              role: "user",
              content: `第${chapterNumber}章を再編集してください。文章の品質向上、表現の改善を行ってください。`,
            },
          ],
        },
        {
          agentType: "continuity_checker",
          taskType: "check",
          description: `第${chapterNumber}章の整合性再チェック`,
          messages: [
            {
              role: "user",
              content: `編集後の第${chapterNumber}章の整合性を再チェックしてください。`,
            },
          ],
          dependsOn: [0],
        },
      ];
    } else {
      steps = buildWritingPipeline(chapterNumber);
    }

    // Create SSE stream
    const { stream, send, close } = createSSEStream();

    // Run pipeline in the background
    (async () => {
      try {
        // Create task records for tracking
        const taskIds: string[] = [];
        for (const step of steps) {
          const [task] = await db
            .insert(agentTasks)
            .values({
              projectId,
              chapterId: chapterId || null,
              agentType: step.agentType,
              taskType: step.taskType,
              status: "queued",
              inputContext: { description: step.description },
            })
            .returning();
          taskIds.push(task.id);
        }

        const results = await pipeline.execute({
          projectId,
          chapterId,
          steps,
          onEvent: async (event: StreamEvent) => {
            send(event);

            // Update task status in DB
            if (event.type === "agent_start" && event.agentType) {
              const stepIndex = steps.findIndex((s) => s.agentType === event.agentType);
              if (stepIndex >= 0 && taskIds[stepIndex]) {
                await db
                  .update(agentTasks)
                  .set({ status: "running", startedAt: new Date() })
                  .where(eq(agentTasks.id, taskIds[stepIndex]));
              }
            }

            if (event.type === "agent_complete" && event.agentType && event.output) {
              const stepIndex = steps.findIndex((s) => s.agentType === event.agentType);
              if (stepIndex >= 0 && taskIds[stepIndex]) {
                await db
                  .update(agentTasks)
                  .set({
                    status: "completed",
                    completedAt: new Date(),
                    output: event.output.content,
                    tokenUsage: {
                      inputTokens: event.output.tokenUsage.input,
                      outputTokens: event.output.tokenUsage.output,
                    },
                  })
                  .where(eq(agentTasks.id, taskIds[stepIndex]));
              }
            }
          },
        });

        // Save the writer's output as chapter content
        const writerResult = results.find((r) => r.agentType === "writer");
        // Use editor output if available (it's the polished version)
        const editorResult = results.find((r) => r.agentType === "editor");
        const finalContent = editorResult?.content || writerResult?.content;

        if (finalContent && chapterId) {
          await db
            .update(chapters)
            .set({
              content: finalContent,
              wordCount: finalContent.length,
              status: "draft",
              updatedAt: new Date(),
            })
            .where(eq(chapters.id, chapterId));

          // Auto-generate chapter summary
          try {
            await generateChapterSummary(chapterId);
          } catch (err) {
            console.error("Failed to generate chapter summary:", err);
            // Non-fatal: don't fail the pipeline for summary generation
          }
        }

        close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pipeline execution failed";
        send({ type: "error", message });
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
    console.error("Failed to start pipeline:", error);
    return new Response(JSON.stringify({ error: "Failed to start pipeline" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
