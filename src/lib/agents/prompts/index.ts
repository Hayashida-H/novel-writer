import type { AgentType } from "@/types/agent";
import { COORDINATOR_PROMPT, COORDINATOR_CONFIG } from "./coordinator";
import { PLOT_ARCHITECT_PROMPT, PLOT_ARCHITECT_CONFIG } from "./plot-architect";
import { CHARACTER_MANAGER_PROMPT, CHARACTER_MANAGER_CONFIG } from "./character-manager";
import { WRITER_PROMPT, WRITER_CONFIG } from "./writer";
import { EDITOR_PROMPT, EDITOR_CONFIG } from "./editor";
import { WORLD_BUILDER_PROMPT, WORLD_BUILDER_CONFIG } from "./world-builder";
import { CONTINUITY_CHECKER_PROMPT, CONTINUITY_CHECKER_CONFIG } from "./continuity-checker";

export interface DefaultAgentConfig {
  agentType: AgentType;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_CONFIGS: Record<AgentType, DefaultAgentConfig> = {
  coordinator: {
    ...COORDINATOR_CONFIG,
    systemPrompt: COORDINATOR_PROMPT,
  },
  plot_architect: {
    ...PLOT_ARCHITECT_CONFIG,
    systemPrompt: PLOT_ARCHITECT_PROMPT,
  },
  character_manager: {
    ...CHARACTER_MANAGER_CONFIG,
    systemPrompt: CHARACTER_MANAGER_PROMPT,
  },
  writer: {
    ...WRITER_CONFIG,
    systemPrompt: WRITER_PROMPT,
  },
  editor: {
    ...EDITOR_CONFIG,
    systemPrompt: EDITOR_PROMPT,
  },
  world_builder: {
    ...WORLD_BUILDER_CONFIG,
    systemPrompt: WORLD_BUILDER_PROMPT,
  },
  continuity_checker: {
    ...CONTINUITY_CHECKER_CONFIG,
    systemPrompt: CONTINUITY_CHECKER_PROMPT,
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
};
