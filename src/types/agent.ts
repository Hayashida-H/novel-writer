import type { InferSelectModel } from "drizzle-orm";
import type { agentConfigs, agentTasks } from "@/lib/db/schema";

export type AgentConfig = InferSelectModel<typeof agentConfigs>;
export type AgentTask = InferSelectModel<typeof agentTasks>;

export type AgentType =
  | "coordinator"
  | "plot_architect"
  | "character_manager"
  | "writer"
  | "editor"
  | "world_builder"
  | "continuity_checker";

export type TaskStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";

export const AGENT_LABELS: Record<AgentType, { ja: string; en: string }> = {
  coordinator: { ja: "コーディネーター", en: "Coordinator" },
  plot_architect: { ja: "プロット構成", en: "Plot Architect" },
  character_manager: { ja: "キャラクター管理", en: "Character Manager" },
  writer: { ja: "執筆", en: "Writer" },
  editor: { ja: "編集・校正", en: "Editor" },
  world_builder: { ja: "世界観設定", en: "World Builder" },
  continuity_checker: { ja: "整合性チェック", en: "Continuity Checker" },
};

export interface StreamEvent {
  type: "agent_start" | "agent_stream" | "agent_complete" | "pipeline_plan" | "pipeline_paused" | "pipeline_complete" | "error";
  agentType?: AgentType;
  text?: string;
  output?: AgentOutput;
  plan?: PipelinePlan;
  message?: string;
}

export interface AgentOutput {
  agentType: AgentType;
  taskType: string;
  content: string;
  structured?: Record<string, unknown>;
  tokenUsage: {
    input: number;
    output: number;
  };
}

export interface PipelinePlan {
  steps: {
    agentType: AgentType;
    taskType: string;
    description: string;
  }[];
}
