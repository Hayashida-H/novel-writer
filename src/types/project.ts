import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  projects,
  plotStructure,
  plotPoints,
  characters,
  characterRelationships,
  worldSettings,
  chapters,
  chapterVersions,
  foreshadowing,
  styleReferences,
} from "@/lib/db/schema";

// Select types (what you get from DB)
export type Project = InferSelectModel<typeof projects>;
export type PlotStructure = InferSelectModel<typeof plotStructure>;
export type PlotPoint = InferSelectModel<typeof plotPoints>;
export type Character = InferSelectModel<typeof characters>;
export type CharacterRelationship = InferSelectModel<typeof characterRelationships>;
export type WorldSetting = InferSelectModel<typeof worldSettings>;
export type Chapter = InferSelectModel<typeof chapters>;
export type ChapterVersion = InferSelectModel<typeof chapterVersions>;

// Insert types (what you send to DB)
export type NewProject = InferInsertModel<typeof projects>;
export type NewPlotStructure = InferInsertModel<typeof plotStructure>;
export type NewPlotPoint = InferInsertModel<typeof plotPoints>;
export type NewCharacter = InferInsertModel<typeof characters>;
export type NewWorldSetting = InferInsertModel<typeof worldSettings>;
export type NewChapter = InferInsertModel<typeof chapters>;
export type Foreshadowing = InferSelectModel<typeof foreshadowing>;
export type StyleReference = InferSelectModel<typeof styleReferences>;

// Project status
export type ProjectStatus = "preparation" | "writing" | "reviewing" | "completed";

// Chapter status
export type ChapterStatus = "outlined" | "drafting" | "draft" | "editing" | "reviewed" | "final";

// Character role
export type CharacterRole = "protagonist" | "antagonist" | "supporting" | "minor";

// Plot structure type
export type PlotStructureType = "kishotenketsu" | "three_act" | "hero_journey" | "custom";
