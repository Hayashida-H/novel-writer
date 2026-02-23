import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import {
  chapters,
  characters,
  plotStructure,
  plotPoints,
  worldSettings,
  foreshadowing,
  styleReferences,
  agentConfigs,
} from "@/lib/db/schema";
import type { AgentType } from "@/types/agent";
import type { AgentContext } from "./base-agent";
import { getDefaultConfig } from "./prompts";

export interface ProjectContext {
  characters: { name: string; role: string; description: string | null; speechPattern: string | null }[];
  plotSynopsis: string | null;
  plotPoints: { title: string; description: string; act: string }[];
  worldSettings: { category: string; title: string; content: string }[];
  previousChapters: { chapterNumber: number; title: string | null; summaryBrief: string | null }[];
  activeForeshadowing: {
    title: string;
    description: string;
    status: string;
    plantedContext: string | null;
    targetChapter: number | null;
  }[];
  styleReferences: { title: string; styleNotes: string | null; sampleText: string | null }[];
}

export async function buildProjectContext(projectId: string): Promise<ProjectContext> {
  const [
    projectCharacters,
    projectPlot,
    projectPlotPoints,
    projectWorldSettings,
    projectChapters,
    projectForeshadowing,
    projectStyleRefs,
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
          eq(foreshadowing.status, "planted")
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
  ]);

  return {
    characters: projectCharacters,
    plotSynopsis: projectPlot[0]?.synopsis ?? null,
    plotPoints: projectPlotPoints,
    worldSettings: projectWorldSettings,
    previousChapters: projectChapters,
    activeForeshadowing: projectForeshadowing,
    styleReferences: projectStyleRefs,
  };
}

export async function buildAgentContext(
  projectId: string,
  agentType: AgentType,
  chapterId?: string
): Promise<AgentContext> {
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

  return {
    projectId,
    chapterId,
    systemPrompt: dbConfig?.systemPrompt ?? defaultConfig.systemPrompt,
    model: dbConfig?.model ?? defaultConfig.model,
    temperature: dbConfig?.temperature ?? defaultConfig.temperature,
    maxTokens: dbConfig?.maxTokens ?? defaultConfig.maxTokens,
    customInstructions: dbConfig?.customInstructions ?? undefined,
    styleProfile: dbConfig?.styleProfile ?? undefined,
  };
}

export function formatContextForPrompt(context: ProjectContext): string {
  const sections: string[] = [];

  if (context.plotSynopsis) {
    sections.push(`## あらすじ\n${context.plotSynopsis}`);
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
    const fsList = context.activeForeshadowing
      .map(
        (f) =>
          `- **${f.title}**: ${f.description}（状態: ${f.status}${f.targetChapter ? ` / 回収予定: 第${f.targetChapter}章` : ""}）`
      )
      .join("\n");
    sections.push(`## 未回収の伏線\n${fsList}`);
  }

  if (context.previousChapters.length > 0) {
    const chList = context.previousChapters
      .map(
        (ch) =>
          `- 第${ch.chapterNumber}章${ch.title ? `「${ch.title}」` : ""}: ${ch.summaryBrief ?? "要約なし"}`
      )
      .join("\n");
    sections.push(`## これまでの章\n${chList}`);
  }

  if (context.styleReferences.length > 0) {
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
