import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { projects, chapters } from "@/lib/db/schema";

export interface ExportOptions {
  includeMetadata?: boolean;
  includeSynopsis?: boolean;
}

export async function exportProjectAsMarkdown(
  projectId: string,
  options: ExportOptions = {}
): Promise<string> {
  const { includeMetadata = true, includeSynopsis = false } = options;

  const db = getDb();
  const [projectRows, projectChapters] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db
      .select()
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(chapters.chapterNumber),
  ]);

  const project = projectRows[0];
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const lines: string[] = [];

  // Title
  lines.push(`# ${project.title}`);
  lines.push("");

  // Metadata
  if (includeMetadata) {
    if (project.description) {
      lines.push(`> ${project.description}`);
      lines.push("");
    }
    if (project.genre) {
      lines.push(`**ジャンル**: ${project.genre}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Chapters
  for (const chapter of projectChapters) {
    const title = chapter.title
      ? `第${chapter.chapterNumber}章　${chapter.title}`
      : `第${chapter.chapterNumber}章`;

    lines.push(`## ${title}`);
    lines.push("");

    if (includeSynopsis && chapter.synopsis) {
      lines.push(`*${chapter.synopsis}*`);
      lines.push("");
    }

    if (chapter.content) {
      lines.push(chapter.content);
    } else {
      lines.push("*（未執筆）*");
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export async function exportChapterAsMarkdown(chapterId: string): Promise<string> {
  const db = getDb();
  const chapterRows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1);

  const chapter = chapterRows[0];
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const title = chapter.title
    ? `第${chapter.chapterNumber}章　${chapter.title}`
    : `第${chapter.chapterNumber}章`;

  const lines: string[] = [];
  lines.push(`## ${title}`);
  lines.push("");

  if (chapter.content) {
    lines.push(chapter.content);
  }

  return lines.join("\n");
}
