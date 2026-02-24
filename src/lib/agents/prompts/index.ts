import type { AgentType } from "@/types/agent";
import { COORDINATOR_PROMPT, COORDINATOR_CONFIG } from "./coordinator";
import { PLOT_ARCHITECT_PROMPT, PLOT_ARCHITECT_CONFIG } from "./plot-architect";
import { CHARACTER_MANAGER_PROMPT, CHARACTER_MANAGER_CONFIG } from "./character-manager";
import { WRITER_PROMPT, WRITER_CONFIG } from "./writer";
import { EDITOR_PROMPT, EDITOR_CONFIG } from "./editor";
import { WORLD_BUILDER_PROMPT, WORLD_BUILDER_CONFIG } from "./world-builder";
import { CONTINUITY_CHECKER_PROMPT, CONTINUITY_CHECKER_CONFIG } from "./continuity-checker";
import { FIXER_PROMPT, FIXER_CONFIG } from "./fixer";

export interface DefaultAgentConfig {
  agentType: AgentType;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

// Shared consultation rules appended to all agent prompts
const CONSULTATION_RULES = `

## 変更ルール
- 既存の設定（登場人物、世界観、プロット）を変更する場合は、変更理由を明記すること
- 大幅な変更（登場人物の死亡、設定の根本的変更、プロットの大きな方向転換）は出力に \`"requires_consultation": true\` フラグを付け、変更内容と理由を記載すること
- 軽微な修正（誤字、表現改善、補足説明の追加）は自動適用可
- 新規の登場人物や世界設定を追加する場合は、既存設定との整合性を必ず確認すること`;

function withConsultation(prompt: string): string {
  return prompt + CONSULTATION_RULES;
}

const DEFAULT_CONFIGS: Record<AgentType, DefaultAgentConfig> = {
  coordinator: {
    ...COORDINATOR_CONFIG,
    systemPrompt: withConsultation(COORDINATOR_PROMPT),
  },
  plot_architect: {
    ...PLOT_ARCHITECT_CONFIG,
    systemPrompt: withConsultation(PLOT_ARCHITECT_PROMPT),
  },
  character_manager: {
    ...CHARACTER_MANAGER_CONFIG,
    systemPrompt: withConsultation(CHARACTER_MANAGER_PROMPT),
  },
  writer: {
    ...WRITER_CONFIG,
    systemPrompt: withConsultation(WRITER_PROMPT),
  },
  editor: {
    ...EDITOR_CONFIG,
    systemPrompt: withConsultation(EDITOR_PROMPT),
  },
  world_builder: {
    ...WORLD_BUILDER_CONFIG,
    systemPrompt: withConsultation(WORLD_BUILDER_PROMPT),
  },
  continuity_checker: {
    ...CONTINUITY_CHECKER_CONFIG,
    systemPrompt: withConsultation(CONTINUITY_CHECKER_PROMPT),
  },
  fixer: {
    ...FIXER_CONFIG,
    systemPrompt: withConsultation(FIXER_PROMPT),
  },
};

export function getDefaultConfig(agentType: AgentType): DefaultAgentConfig {
  return DEFAULT_CONFIGS[agentType];
}

export function getAllDefaultConfigs(): DefaultAgentConfig[] {
  return Object.values(DEFAULT_CONFIGS);
}

export {
  COORDINATOR_PROMPT,
  PLOT_ARCHITECT_PROMPT,
  CHARACTER_MANAGER_PROMPT,
  WRITER_PROMPT,
  EDITOR_PROMPT,
  WORLD_BUILDER_PROMPT,
  CONTINUITY_CHECKER_PROMPT,
  FIXER_PROMPT,
};
