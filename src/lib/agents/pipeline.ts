import type { AgentType, StreamEvent, AgentOutput, PipelinePlan } from "@/types/agent";
import { BaseAgent } from "./base-agent";
import { buildAgentContext, buildProjectContext, formatContextForPrompt } from "./context-builder";
import type { ClaudeClient, ClaudeMessage } from "@/lib/claude/client";

export interface PipelineStep {
  agentType: AgentType;
  taskType: string;
  description: string;
  messages: ClaudeMessage[];
  dependsOn?: number[];
}

export interface PipelineConfig {
  projectId: string;
  chapterId?: string;
  steps: PipelineStep[];
  onEvent?: (event: StreamEvent) => void;
}

export class AgentPipeline {
  private client: ClaudeClient;
  private agents: Map<AgentType, BaseAgent>;

  constructor(client: ClaudeClient) {
    this.client = client;
    this.agents = new Map();
  }

  private getAgent(agentType: AgentType): BaseAgent {
    if (!this.agents.has(agentType)) {
      this.agents.set(agentType, new BaseAgent(agentType, this.client));
    }
    return this.agents.get(agentType)!;
  }

  async execute(config: PipelineConfig): Promise<AgentOutput[]> {
    const { projectId, chapterId, steps, onEvent } = config;
    const results: AgentOutput[] = [];
    const stepOutputs: Map<number, string> = new Map();

    const projectContext = await buildProjectContext(projectId);
    const contextPrompt = formatContextForPrompt(projectContext);

    const plan: PipelinePlan = {
      steps: steps.map((s) => ({
        agentType: s.agentType,
        taskType: s.taskType,
        description: s.description,
      })),
    };

    onEvent?.({ type: "pipeline_plan", plan });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const agent = this.getAgent(step.agentType);
      const agentContext = await buildAgentContext(projectId, step.agentType, chapterId);

      // Inject project context and previous step outputs into messages
      const enrichedMessages = this.enrichMessages(
        step.messages,
        contextPrompt,
        step.dependsOn,
        stepOutputs
      );

      onEvent?.({ type: "agent_start", agentType: step.agentType });

      const result = await agent.execute(agentContext, enrichedMessages, (text) => {
        onEvent?.({ type: "agent_stream", agentType: step.agentType, text });
      });

      stepOutputs.set(i, result.rawContent);
      results.push(result.output);

      onEvent?.({ type: "agent_complete", agentType: step.agentType, output: result.output });
    }

    onEvent?.({ type: "pipeline_complete" });

    return results;
  }

  private enrichMessages(
    messages: ClaudeMessage[],
    contextPrompt: string,
    dependsOn: number[] | undefined,
    stepOutputs: Map<number, string>
  ): ClaudeMessage[] {
    const contextParts: string[] = [contextPrompt];

    if (dependsOn) {
      for (const depIndex of dependsOn) {
        const depOutput = stepOutputs.get(depIndex);
        if (depOutput) {
          contextParts.push(`## 前のステップの出力\n${depOutput}`);
        }
      }
    }

    const contextMessage: ClaudeMessage = {
      role: "user",
      content: `以下はプロジェクトのコンテキスト情報です：\n\n${contextParts.join("\n\n---\n\n")}`,
    };

    return [contextMessage, ...messages];
  }
}
