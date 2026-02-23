import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { projects, chapters } from "@/lib/db/schema";

export async function exportProjectAsPlaintext(projectId: string): Promise<string> {
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

  lines.push(project.title);
  lines.push("＝".repeat(project.title.length));
  lines.push("");

  for (const chapter of projectChapters) {
    const title = chapter.title
      ? `第${chapter.chapterNumber}章　${chapter.title}`
      : `第${chapter.chapterNumber}章`;

    lines.push(title);
    lines.push("－".repeat(title.length));
    lines.push("");

    if (chapter.content) {
      lines.push(chapter.content);
    }

    lines.push("");
    lines.push("");
  }

  return lines.join("\n");
}
