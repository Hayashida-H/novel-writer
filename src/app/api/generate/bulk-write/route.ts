import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { chapters, agentTasks } from "@/lib/db/schema";
import { eq, asc, and, inArray } from "drizzle-orm";
import { getClaudeClient } from "@/lib/claude/client";
import { AgentPipeline } from "@/lib/agents/pipeline";
import { generateChapterSummary } from "@/lib/agents/summary";
import { updateForeshadowingFromCheck } from "@/lib/agents/foreshadowing-updater";
import { extractContentFromCheck } from "@/lib/agents/content-extractor";
import type { StreamEvent } from "@/types/agent";
import type { PipelineStep } from "@/lib/agents/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min (Vercel hobby plan limit)

// Pipeline order: cascading context — each step builds on all previous
function buildWritingPipeline(chapterNumber: number): PipelineStep[] {
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
          content: `第${chapterNumber}話の詳細なシーン構成を作成してください。各シーンのビート、伏線の配置・回収ポイントを含めてください。`,
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
          content: `第${chapterNumber}話の本文を校正してください。文章の品質、表現の一貫性、誤字脱字を確認し、修正版を出力してください。`,
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
          content: `第${chapterNumber}話の整合性をチェックしてください。前話との矛盾、タイムラインの整合性、キャラクターの言動の一貫性を確認してください。執筆原文と編集後の両方を比較し、編集で意図せず失われた要素がないかも確認してください。`,
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
    const { projectId, startChapter = 1 } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = getDb();

    // Get chapters that need writing
    const allChapters = await db
      .select()
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(asc(chapters.chapterNumber));

    const chaptersToWrite = allChapters.filter(
      (c) => c.chapterNumber >= startChapter && (!c.content || c.content.length === 0)
    );

    if (chaptersToWrite.length === 0) {
      return new Response(JSON.stringify({ error: "No chapters to write" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Heartbeat as data event every 10s to keep proxy/browser alive
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(`data: {"type":"heartbeat"}\n\n`)
            );
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 10_000);

        function send(event: StreamEvent & Record<string, unknown>) {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        try {
          send({
            type: "pipeline_plan",
            plan: { steps: [] },
            message: "bulk-write",
            totalChapters: chaptersToWrite.length,
            chapterList: chaptersToWrite.map((c) => ({
              id: c.id,
              number: c.chapterNumber,
              title: c.title,
            })),
          });

          let totalWords = 0;

          for (let ci = 0; ci < chaptersToWrite.length; ci++) {
            const chapter = chaptersToWrite[ci];

            send({
              type: "agent_start",
              agentType: "coordinator",
              message: `chapter_start`,
              chapterNumber: chapter.chapterNumber,
              chapterId: chapter.id,
              progress: `${ci + 1}/${chaptersToWrite.length}`,
            });

            const client = getClaudeClient();
            const pipeline = new AgentPipeline(client);
            const steps = buildWritingPipeline(chapter.chapterNumber);

            // Cancel stale running/queued tasks for this chapter
            await db
              .update(agentTasks)
              .set({ status: "cancelled", completedAt: new Date() })
              .where(
                and(
                  eq(agentTasks.projectId, projectId),
                  eq(agentTasks.chapterId, chapter.id),
                  inArray(agentTasks.status, ["queued", "running"])
                )
              );

            // Create task records
            for (const step of steps) {
              await db.insert(agentTasks).values({
                projectId,
                chapterId: chapter.id,
                agentType: step.agentType,
                taskType: step.taskType,
                status: "queued",
                inputContext: { description: step.description },
              });
            }

            const results = await pipeline.execute({
              projectId,
              chapterId: chapter.id,
              steps,
              onEvent: (event) => {
                send({ ...event, chapterNumber: chapter.chapterNumber });
              },
            });

            // Save content
            const editorResult = results.find((r) => r.agentType === "editor");
            const writerResult = results.find((r) => r.agentType === "writer");
            const finalContent = editorResult?.content || writerResult?.content;

            if (finalContent) {
              await db
                .update(chapters)
                .set({
                  content: finalContent,
                  wordCount: finalContent.length,
                  status: "draft",
                  updatedAt: new Date(),
                })
                .where(eq(chapters.id, chapter.id));

              totalWords += finalContent.length;

              // Generate summary for context of next chapters
              try {
                await generateChapterSummary(chapter.id);
              } catch (err) {
                console.error(`Failed to generate summary for chapter ${chapter.chapterNumber}:`, err);
              }

              // Update foreshadowing statuses from continuity checker output
              const continuityResult = results.find((r) => r.agentType === "continuity_checker");
              if (continuityResult?.content) {
                try {
                  const { updated: fsUpdated, errors: fsErrors } = await updateForeshadowingFromCheck(
                    projectId,
                    chapter.id,
                    continuityResult.content
                  );
                  if (fsUpdated > 0) {
                    send({
                      type: "agent_complete",
                      agentType: "continuity_checker",
                      message: `foreshadowing_updated`,
                      chapterNumber: chapter.chapterNumber,
                      foreshadowingUpdated: fsUpdated,
                    });
                  }
                  if (fsErrors.length > 0) {
                    console.warn(`Foreshadowing update warnings for chapter ${chapter.chapterNumber}:`, fsErrors);
                  }
                } catch (err) {
                  console.error(`Failed to update foreshadowing for chapter ${chapter.chapterNumber}:`, err);
                }

                // Extract new characters and world settings from continuity checker output
                try {
                  const { newCharacters: charsAdded, newWorldSettings: settingsAdded, errors: extractErrors } =
                    await extractContentFromCheck(projectId, continuityResult.content);
                  if (charsAdded > 0 || settingsAdded > 0) {
                    send({
                      type: "agent_complete",
                      agentType: "continuity_checker",
                      message: `content_extracted`,
                      chapterNumber: chapter.chapterNumber,
                      newCharacters: charsAdded,
                      newWorldSettings: settingsAdded,
                    });
                  }
                  if (extractErrors.length > 0) {
                    console.warn(`Content extraction warnings for chapter ${chapter.chapterNumber}:`, extractErrors);
                  }
                } catch (err) {
                  console.error(`Failed to extract content for chapter ${chapter.chapterNumber}:`, err);
                }
              }
            }

            send({
              type: "agent_complete",
              agentType: "writer",
              message: `chapter_complete`,
              chapterNumber: chapter.chapterNumber,
              wordCount: finalContent?.length || 0,
            });
          }

          send({
            type: "pipeline_complete",
            message: "bulk_complete",
            totalChapters: chaptersToWrite.length,
            totalWords,
          });

          clearInterval(heartbeatInterval);
          controller.close();
        } catch (error) {
          console.error("Bulk write error:", error);
          send({
            type: "error",
            message: error instanceof Error ? error.message : "一括執筆に失敗しました",
          });
          clearInterval(heartbeatInterval);
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
    console.error("Bulk write API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
