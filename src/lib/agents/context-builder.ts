import { getDb } from "@/lib/db";
import { eq, and, inArray, lt, asc, desc } from "drizzle-orm";
import {
  chapters,
  characters,
  plotStructure,
  plotPoints,
  worldSettings,
  foreshadowing,
  styleReferences,
  agentConfigs,
  glossary,
} from "@/lib/db/schema";
import type { AgentType } from "@/types/agent";
import type { AgentContext } from "./base-agent";
import { getDefaultConfig } from "./prompts";

export interface ProjectContext {
  characters: { name: string; role: string; description: string | null; speechPattern: string | null }[];
  plotSynopsis: string | null;
  plotPoints: { id: string; title: string; description: string; act: string }[];
  worldSettings: { category: string; title: string; content: string }[];
  previousChapters: { chapterNumber: number; title: string | null; synopsis: string | null; summaryBrief: string | null }[];
  activeForeshadowing: {
    title: string;
    description: string;
    status: string;
    plantedContext: string | null;
    targetChapter: number | null;
  }[];
  styleReferences: { title: string; styleNotes: string | null; sampleText: string | null }[];
  glossaryTerms: { term: string; reading: string | null; category: string | null; description: string }[];
}

/** Options to control which sections are included in the formatted context */
export interface FormatContextOptions {
  includePlotPoints?: boolean;
  includeStyleReferences?: boolean;
  includeChapterSummaries?: boolean;
  includeChapterSynopses?: boolean;
}

/** Chapter-specific context for writing agents */
export interface ChapterContext {
  chapterNumber: number;
  title: string | null;
  synopsis: string | null;
  chapterPlotPoints: { title: string; description: string; act: string }[];
  previousChapterSummary: string | null;
  recentChapterSummaries: { chapterNumber: number; title: string | null; summaryDetailed: string | null }[];
}

export async function buildProjectContext(projectId: string): Promise<ProjectContext> {
  const db = getDb();
  const [
    projectCharacters,
    projectPlot,
    projectPlotPoints,
    projectWorldSettings,
    projectChapters,
    projectForeshadowing,
    projectStyleRefs,
    projectGlossary,
  ] = await Promise.all([
    db
      .select({
        name: characters.name,
        role: characters.role,
        description: characters.description,
        speechPattern: characters.speechPattern,
      })
      .from(characters)
      .where(eq(characters.projectId, projectId)),
    db
      .select({ synopsis: plotStructure.synopsis })
      .from(plotStructure)
      .where(eq(plotStructure.projectId, projectId))
      .limit(1),
    db
      .select({
        id: plotPoints.id,
        title: plotPoints.title,
        description: plotPoints.description,
        act: plotPoints.act,
      })
      .from(plotPoints)
      .innerJoin(plotStructure, eq(plotPoints.plotStructureId, plotStructure.id))
      .where(eq(plotStructure.projectId, projectId))
      .orderBy(plotPoints.sortOrder),
    db
      .select({
        category: worldSettings.category,
        title: worldSettings.title,
        content: worldSettings.content,
      })
      .from(worldSettings)
      .where(eq(worldSettings.projectId, projectId))
      .orderBy(worldSettings.sortOrder),
    db
      .select({
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        synopsis: chapters.synopsis,
        summaryBrief: chapters.summaryBrief,
      })
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(chapters.chapterNumber),
    db
      .select({
        title: foreshadowing.title,
        description: foreshadowing.description,
        status: foreshadowing.status,
        plantedContext: foreshadowing.plantedContext,
        targetChapter: foreshadowing.targetChapter,
      })
      .from(foreshadowing)
      .where(
        and(
          eq(foreshadowing.projectId, projectId),
          inArray(foreshadowing.status, ["planted", "hinted", "partially_resolved"])
        )
      ),
    db
      .select({
        title: styleReferences.title,
        styleNotes: styleReferences.styleNotes,
        sampleText: styleReferences.sampleText,
      })
      .from(styleReferences)
      .where(
        and(
          eq(styleReferences.projectId, projectId),
          eq(styleReferences.isActive, true)
        )
      ),
    db
      .select({
        term: glossary.term,
        reading: glossary.reading,
        category: glossary.category,
        description: glossary.description,
      })
      .from(glossary)
      .where(eq(glossary.projectId, projectId))
      .orderBy(glossary.category, glossary.term),
  ]);

  return {
    characters: projectCharacters,
    plotSynopsis: projectPlot[0]?.synopsis ?? null,
    plotPoints: projectPlotPoints,
    worldSettings: projectWorldSettings,
    previousChapters: projectChapters,
    activeForeshadowing: projectForeshadowing,
    styleReferences: projectStyleRefs,
    glossaryTerms: projectGlossary,
  };
}

/**
 * Build chapter-specific context: synopsis, plot points for this chapter,
 * and previous chapters' content/summaries.
 */
export async function buildChapterContext(
  projectId: string,
  chapterId: string,
  allPlotPoints: ProjectContext["plotPoints"]
): Promise<ChapterContext> {
  const db = getDb();

  // Get current chapter
  const [chapter] = await db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1);

  if (!chapter) {
    return {
      chapterNumber: 0,
      title: null,
      synopsis: null,
      chapterPlotPoints: [],
      previousChapterSummary: null,
      recentChapterSummaries: [],
    };
  }

  // Get plot points assigned to this chapter
  const chapterPlotPointIds = (chapter.plotPointIds as string[]) || [];
  const chapterPlotPoints = chapterPlotPointIds.length > 0
    ? allPlotPoints.filter((pp) => chapterPlotPointIds.includes(pp.id))
    : [];

  // Get previous chapters for context (summaryDetailed only — no full content)
  const prevChapters = await db
    .select({
      chapterNumber: chapters.chapterNumber,
      title: chapters.title,
      summaryDetailed: chapters.summaryDetailed,
    })
    .from(chapters)
    .where(
      and(
        eq(chapters.projectId, projectId),
        lt(chapters.chapterNumber, chapter.chapterNumber)
      )
    )
    .orderBy(asc(chapters.chapterNumber));

  // Immediately previous chapter — detailed summary only
  const immediatePrev = prevChapters.length > 0 ? prevChapters[prevChapters.length - 1] : null;
  const previousChapterSummary = immediatePrev?.summaryDetailed ?? null;

  // Earlier chapter summaries (up to 5 chapters back, excluding the immediately previous)
  const recentSummaries = prevChapters
    .slice(0, -1)
    .slice(-5)
    .map((ch) => ({
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      summaryDetailed: ch.summaryDetailed,
    }));

  return {
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    synopsis: chapter.synopsis,
    chapterPlotPoints,
    previousChapterSummary,
    recentChapterSummaries: recentSummaries,
  };
}

export async function buildAgentContext(
  projectId: string,
  agentType: AgentType,
  chapterId?: string
): Promise<AgentContext> {
  const db = getDb();
  const configRows = await db
    .select()
    .from(agentConfigs)
    .where(
      and(
        eq(agentConfigs.projectId, projectId),
        eq(agentConfigs.agentType, agentType)
      )
    )
    .limit(1);

  const dbConfig = configRows[0];
  const defaultConfig = getDefaultConfig(agentType);

  // Always use code defaults for systemPrompt and maxTokens —
  // these are maintained in code and must propagate updates immediately.
  // DB is used for model, temperature, and per-project customization fields.
  return {
    projectId,
    chapterId,
    systemPrompt: defaultConfig.systemPrompt,
    model: dbConfig?.model ?? defaultConfig.model,
    temperature: dbConfig?.temperature ?? defaultConfig.temperature,
    maxTokens: defaultConfig.maxTokens,
    customInstructions: dbConfig?.customInstructions ?? undefined,
    styleProfile: dbConfig?.styleProfile ?? undefined,
  };
}

export function formatContextForPrompt(
  context: ProjectContext,
  chapterContext?: ChapterContext,
  options?: FormatContextOptions
): string {
  const opts = {
    includePlotPoints: true,
    includeStyleReferences: true,
    includeChapterSummaries: true,
    includeChapterSynopses: false,
    ...options,
  };

  const sections: string[] = [];

  if (context.plotSynopsis) {
    sections.push(`## あらすじ\n${context.plotSynopsis}`);
  }

  // Plot points (all) - optional
  if (opts.includePlotPoints && context.plotPoints.length > 0) {
    const ppList = context.plotPoints
      .map((pp) => `- [${pp.act}] **${pp.title}**: ${pp.description}`)
      .join("\n");
    sections.push(`## プロットポイント（全体）\n${ppList}`);
  }

  // Chapter-specific context (for writing pipeline)
  if (chapterContext) {
    const chSections: string[] = [];
    chSections.push(`# 今回の話: 第${chapterContext.chapterNumber}話${chapterContext.title ? `「${chapterContext.title}」` : ""}`);

    if (chapterContext.synopsis) {
      chSections.push(`## この話のあらすじ\n${chapterContext.synopsis}`);
    }

    if (chapterContext.chapterPlotPoints.length > 0) {
      const cpList = chapterContext.chapterPlotPoints
        .map((pp) => `- [${pp.act}] **${pp.title}**: ${pp.description}`)
        .join("\n");
      chSections.push(`## この話で扱うプロットポイント\n${cpList}`);
    }

    // Previous chapter (summary only)
    if (chapterContext.previousChapterSummary) {
      chSections.push(`## 前話（第${chapterContext.chapterNumber - 1}話）の要約\n${chapterContext.previousChapterSummary}`);
    }

    // Earlier chapter summaries
    if (chapterContext.recentChapterSummaries.length > 0) {
      const summList = chapterContext.recentChapterSummaries
        .map((ch) => `- 第${ch.chapterNumber}話${ch.title ? `「${ch.title}」` : ""}: ${ch.summaryDetailed ?? "要約なし"}`)
        .join("\n");
      chSections.push(`## それ以前の話の要約\n${summList}`);
    }

    sections.push(chSections.join("\n\n"));
  }

  if (context.characters.length > 0) {
    const charList = context.characters
      .map((c) => `- **${c.name}**（${c.role}）: ${c.description ?? "設定なし"}${c.speechPattern ? ` / 話し方: ${c.speechPattern}` : ""}`)
      .join("\n");
    sections.push(`## 登場人物\n${charList}`);
  }

  if (context.worldSettings.length > 0) {
    const settings = context.worldSettings
      .map((w) => `### ${w.category}: ${w.title}\n${w.content}`)
      .join("\n\n");
    sections.push(`## 世界設定\n${settings}`);
  }

  if (context.activeForeshadowing.length > 0) {
    const statusLabels: Record<string, string> = {
      planted: "設置済み・未示唆",
      hinted: "示唆済み",
      partially_resolved: "部分的に回収",
    };
    const fsList = context.activeForeshadowing
      .map((f) => {
        const label = statusLabels[f.status] || f.status;
        let line = `- **${f.title}** [${label}]: ${f.description}`;
        if (f.targetChapter) line += `（回収予定: 第${f.targetChapter}章）`;
        if (f.plantedContext) line += `\n  設置文脈: ${f.plantedContext}`;
        return line;
      })
      .join("\n");
    sections.push(`## 未回収の伏線\n${fsList}`);
  }

  // Chapter synopses (構成のあらすじ) - optional
  if (opts.includeChapterSynopses && context.previousChapters.length > 0) {
    const synList = context.previousChapters
      .map(
        (ch) =>
          `- 第${ch.chapterNumber}話${ch.title ? `「${ch.title}」` : ""}: ${ch.synopsis ?? "あらすじなし"}`
      )
      .join("\n");
    sections.push(`## 各話のあらすじ\n${synList}`);
  }

  // Chapter summaries (執筆後の要約) - optional
  if (opts.includeChapterSummaries && !chapterContext && context.previousChapters.length > 0) {
    const chList = context.previousChapters
      .filter((ch) => ch.summaryBrief)
      .map(
        (ch) =>
          `- 第${ch.chapterNumber}話${ch.title ? `「${ch.title}」` : ""}: ${ch.summaryBrief}`
      )
      .join("\n");
    if (chList) {
      sections.push(`## 執筆済みの話の要約\n${chList}`);
    }
  }

  if (context.glossaryTerms.length > 0) {
    const glossaryList = context.glossaryTerms
      .map((g) => `- **${g.term}**${g.reading ? `（${g.reading}）` : ""}${g.category ? ` [${g.category}]` : ""}: ${g.description}`)
      .join("\n");
    sections.push(`## 用語集\n${glossaryList}`);
  }

  // Style references - optional
  if (opts.includeStyleReferences && context.styleReferences.length > 0) {
    const styleList = context.styleReferences
      .map(
        (s) =>
          `### ${s.title}\n${s.styleNotes ?? ""}${s.sampleText ? `\n\n参考文:\n> ${s.sampleText.slice(0, 500)}` : ""}`
      )
      .join("\n\n");
    sections.push(`## 文体参照\n${styleList}`);
  }

  return sections.join("\n\n---\n\n");
}
