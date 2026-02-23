import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { agentTasks, chapters } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getClaudeClient } from "@/lib/claude/client";
import { createSSEStream } from "@/lib/claude/streaming";
import { AgentPipeline } from "@/lib/agents/pipeline";
import { generateChapterSummary } from "@/lib/agents/summary";
import { extractContentFromCheck } from "@/lib/agents/content-extractor";
import type { StreamEvent } from "@/types/agent";
import type { PipelineStep } from "@/lib/agents/pipeline";
import { requireAuth } from "@/lib/auth";

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
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
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

    // Send pipelineId immediately so client can control it
    send({ type: "pipeline_plan", plan: { steps: [] }, message: pipeline.pipelineId });

    // Run pipeline in the background
    (async () => {
      try {
        // Cancel stale running/queued tasks for this chapter to avoid zombie accumulation
        if (chapterId) {
          await db
            .update(agentTasks)
            .set({ status: "cancelled", completedAt: new Date() })
            .where(
              and(
                eq(agentTasks.projectId, projectId),
                eq(agentTasks.chapterId, chapterId),
                inArray(agentTasks.status, ["queued", "running"])
              )
            );
        }

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
          // Extract split suggestion if present
          const splitMatch = finalContent.match(/<!-- SPLIT_SUGGESTION:\s*(\{[\s\S]*?\})\s*-->/);
          const cleanContent = finalContent.replace(/<!-- SPLIT_SUGGESTION:[\s\S]*?-->/g, "").trim();

          await db
            .update(chapters)
            .set({
              content: cleanContent,
              wordCount: cleanContent.length,
              status: "draft",
              updatedAt: new Date(),
            })
            .where(eq(chapters.id, chapterId));

          // Handle split suggestion
          if (splitMatch) {
            try {
              const splitData = JSON.parse(splitMatch[1]);
              if (splitData.should_split && splitData.split_point > 0 && cleanContent.length > 6000) {
                const splitPoint = Math.min(splitData.split_point, cleanContent.length - 500);

                // Find a natural break point near the split position
                let actualSplit = splitPoint;
                const searchRange = cleanContent.slice(Math.max(0, splitPoint - 200), Math.min(cleanContent.length, splitPoint + 200));
                const breakMatch = searchRange.match(/\n\n/);
                if (breakMatch && breakMatch.index !== undefined) {
                  actualSplit = Math.max(0, splitPoint - 200) + breakMatch.index + 2;
                }

                const firstPart = cleanContent.slice(0, actualSplit).trim();
                const secondPart = cleanContent.slice(actualSplit).trim();

                if (firstPart.length > 500 && secondPart.length > 500) {
                  // Update current chapter with first part
                  const [currentChapter] = await db
                    .select()
                    .from(chapters)
                    .where(eq(chapters.id, chapterId))
                    .limit(1);

                  await db
                    .update(chapters)
                    .set({
                      content: firstPart,
                      wordCount: firstPart.length,
                    })
                    .where(eq(chapters.id, chapterId));

                  if (currentChapter) {
                    // Shift subsequent chapters' numbers
                    const subsequentChapters = await db
                      .select()
                      .from(chapters)
                      .where(eq(chapters.projectId, projectId));

                    const toShift = subsequentChapters
                      .filter((c) => c.chapterNumber > currentChapter.chapterNumber)
                      .sort((a, b) => b.chapterNumber - a.chapterNumber);

                    for (const ch of toShift) {
                      await db
                        .update(chapters)
                        .set({ chapterNumber: ch.chapterNumber + 1 })
                        .where(eq(chapters.id, ch.id));
                    }

                    // Create new chapter with second part
                    const [newChapter] = await db
                      .insert(chapters)
                      .values({
                        projectId,
                        arcId: currentChapter.arcId,
                        chapterNumber: currentChapter.chapterNumber + 1,
                        title: currentChapter.title ? `${currentChapter.title}（後編）` : null,
                        content: secondPart,
                        wordCount: secondPart.length,
                        status: "draft",
                      })
                      .returning();

                    // Update original title
                    if (currentChapter.title) {
                      await db
                        .update(chapters)
                        .set({ title: `${currentChapter.title}（前編）` })
                        .where(eq(chapters.id, chapterId));
                    }

                    send({
                      type: "chapter_split",
                      originalId: chapterId,
                      newChapterId: newChapter.id,
                      reason: splitData.reason,
                    } as unknown as StreamEvent);
                  }
                }
              }
            } catch (err) {
              console.error("Failed to handle split suggestion:", err);
            }
          }

          // Auto-generate chapter summary
          try {
            await generateChapterSummary(chapterId);
          } catch (err) {
            console.error("Failed to generate chapter summary:", err);
            // Non-fatal: don't fail the pipeline for summary generation
          }
        }

        // Auto-extract new characters/world settings from continuity checker
        const continuityResult = results.find((r) => r.agentType === "continuity_checker");
        if (continuityResult?.content) {
          try {
            const extracted = await extractContentFromCheck(projectId, continuityResult.content);
            if (extracted.newCharacters > 0 || extracted.newWorldSettings > 0) {
              send({
                type: "content_extracted",
                newCharacters: extracted.newCharacters,
                newWorldSettings: extracted.newWorldSettings,
              } as unknown as StreamEvent);
            }
          } catch (err) {
            console.error("Failed to extract content from continuity check:", err);
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
