import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ============================================================
// PROJECTS
// ============================================================

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  genre: text("genre"),
  targetWordCount: integer("target_word_count"),
  language: text("language").default("ja").notNull(),
  status: text("status", {
    enum: ["preparation", "writing", "reviewing", "completed"],
  })
    .default("preparation")
    .notNull(),
  settings: jsonb("settings").default({}).$type<{
    tone?: string;
    style?: string;
    pov?: string;
    tense?: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// PLOT
// ============================================================

export const plotStructure = pgTable("plot_structure", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" })
    .unique(),
  structureType: text("structure_type", {
    enum: ["kishotenketsu", "three_act", "hero_journey", "serial", "custom"],
  })
    .default("kishotenketsu")
    .notNull(),
  synopsis: text("synopsis"),
  themes: jsonb("themes").default([]).$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const plotPoints = pgTable(
  "plot_points",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    plotStructureId: uuid("plot_structure_id")
      .notNull()
      .references(() => plotStructure.id, { onDelete: "cascade" }),
    act: text("act").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    sortOrder: integer("sort_order").notNull(),
    chapterHints: jsonb("chapter_hints").default([]).$type<number[]>(),
    isMajorTurningPoint: boolean("is_major_turning_point").default(false),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_plot_points_structure").on(table.plotStructureId, table.sortOrder)]
);

// ============================================================
// CHARACTERS
// ============================================================

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role", {
      enum: ["protagonist", "antagonist", "supporting", "minor"],
    }).notNull(),
    description: text("description"),
    appearance: text("appearance"),
    personality: text("personality"),
    speechPattern: text("speech_pattern"),
    backstory: text("backstory"),
    goals: text("goals"),
    arcDescription: text("arc_description"),
    affiliationMajor: text("affiliation_major"),
    affiliationMiddle: text("affiliation_middle"),
    affiliationMinor: text("affiliation_minor"),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_characters_project").on(table.projectId)]
);

export const characterRelationships = pgTable("character_relationships", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  characterAId: uuid("character_a_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  characterBId: uuid("character_b_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(),
  description: text("description"),
  evolvesTo: text("evolves_to"),
});

// ============================================================
// WORLD SETTINGS
// ============================================================

export const worldSettings = pgTable(
  "world_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").default({}),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_world_settings_project").on(table.projectId, table.category)]
);

// ============================================================
// ARCS (章 / セクション)
// ============================================================

export const arcs = pgTable(
  "arcs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    arcNumber: integer("arc_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    plotPointIds: jsonb("plot_point_ids").default([]).$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_arcs_project_number").on(table.projectId, table.arcNumber),
  ]
);

// ============================================================
// CHAPTERS (話 / エピソード)
// ============================================================

export const chapters = pgTable(
  "chapters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    arcId: uuid("arc_id").references(() => arcs.id, { onDelete: "set null" }),
    chapterNumber: integer("chapter_number").notNull(),
    title: text("title"),
    synopsis: text("synopsis"),
    content: text("content"),
    wordCount: integer("word_count").default(0),
    status: text("status", {
      enum: ["outlined", "drafting", "draft", "editing", "reviewed", "final"],
    })
      .default("outlined")
      .notNull(),
    summaryBrief: text("summary_brief"),
    summaryDetailed: text("summary_detailed"),
    plotPointIds: jsonb("plot_point_ids").default([]).$type<string[]>(),
    characterIds: jsonb("character_ids").default([]).$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_chapters_project_number").on(table.projectId, table.chapterNumber),
  ]
);

export const chapterVersions = pgTable(
  "chapter_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    content: text("content").notNull(),
    changeSummary: text("change_summary"),
    createdBy: text("created_by").notNull(),
    wordCount: integer("word_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_chapter_versions_unique").on(table.chapterId, table.versionNumber),
  ]
);

// ============================================================
// ANNOTATIONS (Review System)
// ============================================================

export const annotations = pgTable(
  "annotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    chapterVersionId: uuid("chapter_version_id")
      .notNull()
      .references(() => chapterVersions.id, { onDelete: "cascade" }),
    paragraphIndex: integer("paragraph_index").notNull(),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    anchorText: text("anchor_text"),
    comment: text("comment").notNull(),
    annotationType: text("annotation_type", {
      enum: ["comment", "issue", "suggestion", "praise"],
    })
      .default("comment")
      .notNull(),
    status: text("status", {
      enum: ["pending", "submitted", "processing", "resolved", "dismissed"],
    })
      .default("pending")
      .notNull(),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_annotations_chapter").on(table.chapterId, table.status)]
);

export const annotationBatches = pgTable("annotation_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  annotationIds: jsonb("annotation_ids").notNull().$type<string[]>(),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed"],
  })
    .default("pending")
    .notNull(),
  agentResponse: text("agent_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ============================================================
// AGENT SYSTEM
// ============================================================

export const agentConfigs = pgTable(
  "agent_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agentType: text("agent_type", {
      enum: [
        "coordinator",
        "plot_architect",
        "character_manager",
        "writer",
        "editor",
        "world_builder",
        "continuity_checker",
      ],
    }).notNull(),
    systemPrompt: text("system_prompt").notNull(),
    model: text("model").default("claude-sonnet-4-20250514").notNull(),
    temperature: real("temperature").default(0.7).notNull(),
    maxTokens: integer("max_tokens").default(4096).notNull(),
    customInstructions: text("custom_instructions"),
    styleProfile: text("style_profile"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_agent_configs_unique").on(table.projectId, table.agentType),
  ]
);

export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id").references(() => chapters.id, {
      onDelete: "set null",
    }),
    agentType: text("agent_type").notNull(),
    taskType: text("task_type").notNull(),
    status: text("status", {
      enum: ["pending", "queued", "running", "completed", "failed", "cancelled"],
    })
      .default("pending")
      .notNull(),
    inputContext: jsonb("input_context").default({}),
    output: text("output"),
    tokenUsage: jsonb("token_usage").default({}).$type<{
      inputTokens?: number;
      outputTokens?: number;
    }>(),
    errorMessage: text("error_message"),
    parentTaskId: uuid("parent_task_id"),
    sortOrder: integer("sort_order").default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_agent_tasks_project_status").on(table.projectId, table.status),
    index("idx_agent_tasks_chapter").on(table.chapterId),
  ]
);

// ============================================================
// CHAT SYSTEM
// ============================================================

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  topic: text("topic", {
    enum: ["plot", "characters", "world", "general"],
  }).notNull(),
  title: text("title"),
  isCommitted: boolean("is_committed").default(false),
  committedTo: jsonb("committed_to").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_chat_messages_session").on(table.sessionId, table.createdAt)]
);

// ============================================================
// FORESHADOWING (伏線管理)
// ============================================================

export const foreshadowing = pgTable(
  "foreshadowing",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    type: text("type", {
      enum: ["foreshadowing", "chekhovs_gun", "recurring_motif", "red_herring"],
    })
      .default("foreshadowing")
      .notNull(),
    status: text("status", {
      enum: ["planted", "hinted", "partially_resolved", "resolved", "abandoned"],
    })
      .default("planted")
      .notNull(),
    plantedChapterId: uuid("planted_chapter_id").references(() => chapters.id, {
      onDelete: "set null",
    }),
    plantedContext: text("planted_context"),
    targetChapter: integer("target_chapter"),
    resolvedChapterId: uuid("resolved_chapter_id").references(() => chapters.id, {
      onDelete: "set null",
    }),
    resolvedContext: text("resolved_context"),
    priority: text("priority", {
      enum: ["high", "medium", "low"],
    })
      .default("medium")
      .notNull(),
    relatedCharacterIds: jsonb("related_character_ids").default([]).$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_foreshadowing_project").on(table.projectId, table.status)]
);

// ============================================================
// STYLE REFERENCES (文体参照)
// ============================================================

export const styleReferences = pgTable(
  "style_references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sampleText: text("sample_text"),
    styleNotes: text("style_notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_style_references_project").on(table.projectId)]
);

// ============================================================
// GLOSSARY (用語集)
// ============================================================

export const glossary = pgTable(
  "glossary",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    reading: text("reading"),
    category: text("category"),
    description: text("description").notNull(),
    relatedCharacterIds: jsonb("related_character_ids").default([]).$type<string[]>(),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_glossary_project").on(table.projectId, table.category)]
);
