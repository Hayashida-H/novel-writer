import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { annotations, annotationBatches, chapters } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getClaudeClient } from "@/lib/claude/client";
import { createSSEStream } from "@/lib/claude/streaming";
import { buildAgentContext } from "@/lib/agents/context-builder";
import { BaseAgent } from "@/lib/agents/base-agent";
import { generateChapterSummary } from "@/lib/agents/summary";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, chapterId, annotationIds } = body as {
      projectId: string;
      chapterId: string;
      annotationIds?: string[];
    };

    if (!projectId || !chapterId) {
      return new Response(
        JSON.stringify({ error: "projectId and chapterId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();

    // Fetch chapter content
    const chapterRows = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);

    const chapter = chapterRows[0];
    if (!chapter || !chapter.content) {
      return new Response(
        JSON.stringify({ error: "Chapter not found or has no content" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch annotations (all pending for this chapter, or specific IDs)
    let chapterAnnotations;
    if (annotationIds && annotationIds.length > 0) {
      chapterAnnotations = await db
        .select()
        .from(annotations)
        .where(inArray(annotations.id, annotationIds));
    } else {
      chapterAnnotations = await db
        .select()
        .from(annotations)
        .where(
          and(
            eq(annotations.chapterId, chapterId),
            eq(annotations.status, "pending")
          )
        );
    }

    if (chapterAnnotations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No annotations to process" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create batch record
    const [batch] = await db
      .insert(annotationBatches)
      .values({
        projectId,
        chapterId,
        annotationIds: chapterAnnotations.map((a) => a.id),
        status: "processing",
      })
      .returning();

    // Mark annotations as submitted
    for (const ann of chapterAnnotations) {
      await db
        .update(annotations)
        .set({ status: "submitted", updatedAt: new Date() })
        .where(eq(annotations.id, ann.id));
    }

    // Build the annotation summary for the editor agent
    const paragraphs = chapter.content.split("\n").filter((p) => p.trim());
    const annotationSummary = chapterAnnotations
      .map((ann) => {
        const paraText = paragraphs[ann.paragraphIndex]?.slice(0, 100) || "(段落不明)";
        return `- [${ann.annotationType}] 段落${ann.paragraphIndex + 1}「${paraText}…」: ${ann.comment}${ann.anchorText ? ` (対象: "${ann.anchorText}")` : ""}`;
      })
      .join("\n");

    // Create SSE stream
    const { stream, send, close } = createSSEStream();

    (async () => {
      try {
        const client = getClaudeClient();
        const editorContext = await buildAgentContext(projectId, "editor", chapterId);
        const editor = new BaseAgent("editor", client);

        send({ type: "agent_start", agentType: "editor" });

        const result = await editor.execute(
          editorContext,
          [
            {
              role: "user",
              content: `以下の章の本文に対して、読者からの指摘が${chapterAnnotations.length}件あります。
すべての指摘を考慮して、章全体の修正版を出力してください。

## 現在の本文

${chapter.content}

## 読者からの指摘

${annotationSummary}

## 指示

- 各指摘を検討し、妥当なものは修正に反映してください
- 文体や文脈の一貫性を保ってください
- 修正版の本文全体を出力してください（修正箇所だけでなく全文）
- 最後に「## 修正内容」セクションで、どの指摘にどう対応したか簡潔に記載してください`,
            },
          ],
          (text) => {
            send({ type: "agent_stream", agentType: "editor", text });
          }
        );

        send({ type: "agent_complete", agentType: "editor", output: result.output });

        // Extract the revised content (everything before "## 修正内容")
        let revisedContent = result.rawContent;
        const changeLogIndex = revisedContent.indexOf("## 修正内容");
        let changeLog: string | null = null;
        if (changeLogIndex > 0) {
          changeLog = revisedContent.slice(changeLogIndex);
          revisedContent = revisedContent.slice(0, changeLogIndex).trim();
        }

        // Update chapter with revised content
        await db
          .update(chapters)
          .set({
            content: revisedContent,
            wordCount: revisedContent.length,
            updatedAt: new Date(),
          })
          .where(eq(chapters.id, chapterId));

        // Update batch as completed
        await db
          .update(annotationBatches)
          .set({
            status: "completed",
            agentResponse: changeLog || result.rawContent.slice(0, 2000),
          })
          .where(eq(annotationBatches.id, batch.id));

        // Mark annotations as resolved
        for (const ann of chapterAnnotations) {
          await db
            .update(annotations)
            .set({
              status: "resolved",
              resolutionNote: "バッチ修正で対応済み",
              updatedAt: new Date(),
            })
            .where(eq(annotations.id, ann.id));
        }

        // Re-generate summary for updated chapter
        try {
          await generateChapterSummary(chapterId);
        } catch (err) {
          console.error("Failed to regenerate summary:", err);
        }

        send({ type: "pipeline_complete" });
        close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Batch processing failed";
        send({ type: "error", message });

        // Mark batch as failed
        await db
          .update(annotationBatches)
          .set({ status: "failed" })
          .where(eq(annotationBatches.id, batch.id));

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
    console.error("Failed to start batch review:", error);
    return new Response(
      JSON.stringify({ error: "Failed to start batch review" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
