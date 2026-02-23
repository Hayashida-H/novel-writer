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

export type PipelineState = "idle" | "running" | "paused" | "cancelled" | "completed" | "error";

// Global registry of active pipelines for control from external API
const activePipelines = new Map<string, AgentPipeline>();

export function getPipeline(pipelineId: string): AgentPipeline | undefined {
  return activePipelines.get(pipelineId);
}

export function getActivePipelineIds(): string[] {
  return Array.from(activePipelines.keys());
}

export class AgentPipeline {
  private client: ClaudeClient;
  private agents: Map<AgentType, BaseAgent>;
  private _state: PipelineState = "idle";
  private _pipelineId: string;
  private pauseResolver: (() => void) | null = null;
  private currentStepIndex: number = 0;
  private totalSteps: number = 0;

  constructor(client: ClaudeClient) {
    this.client = client;
    this.agents = new Map();
    this._pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  get state(): PipelineState {
    return this._state;
  }

  get pipelineId(): string {
    return this._pipelineId;
  }

  get progress(): { current: number; total: number } {
    return { current: this.currentStepIndex, total: this.totalSteps };
  }

  pause(): void {
    if (this._state === "running") {
      this._state = "paused";
    }
  }

  resume(): void {
    if (this._state === "paused" && this.pauseResolver) {
      this._state = "running";
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }

  cancel(): void {
    if (this._state === "running" || this._state === "paused") {
      this._state = "cancelled";
      // If paused, unblock the wait so the loop can exit
      if (this.pauseResolver) {
        this.pauseResolver();
        this.pauseResolver = null;
      }
    }
  }

  private isCancelled(): boolean {
    return this._state === "cancelled";
  }

  private async waitWhilePaused(onEvent?: (event: StreamEvent) => void): Promise<void> {
    if (this._state !== "paused") return;
    onEvent?.({ type: "pipeline_paused" });
    await new Promise<void>((resolve) => {
      this.pauseResolver = resolve;
    });
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

    this._state = "running";
    this.totalSteps = steps.length;
    this.currentStepIndex = 0;

    // Register in global registry
    activePipelines.set(this._pipelineId, this);

    try {
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
        // Check for cancellation (use getter to avoid TS flow narrowing)
        if (this.state === "cancelled") {
          onEvent?.({ type: "error", message: "パイプラインがキャンセルされました" });
          break;
        }

        // Check for pause
        if (this.state === "paused") {
          await this.waitWhilePaused(onEvent);
          // After resume, check if cancelled during pause
          if (this.isCancelled()) {
            onEvent?.({ type: "error", message: "パイプラインがキャンセルされました" });
            break;
          }
        }

        this.currentStepIndex = i;
        const step = steps[i];
        const agent = this.getAgent(step.agentType);
        const agentContext = await buildAgentContext(projectId, step.agentType, chapterId);

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

        // Check for consultation flag in output
        if (result.rawContent.includes('"requires_consultation"') && result.rawContent.includes("true")) {
          onEvent?.({
            type: "consultation_required",
            agentType: step.agentType,
            message: result.rawContent,
          } as unknown as StreamEvent);
          // Pause pipeline for user to review
          this._state = "paused";
          await this.waitWhilePaused(onEvent);
          if (this.isCancelled()) {
            onEvent?.({ type: "error", message: "パイプラインがキャンセルされました" });
            break;
          }
        }
      }

      if (this.state !== "cancelled") {
        this._state = "completed";
        onEvent?.({ type: "pipeline_complete" });
      }
    } catch (error) {
      this._state = "error";
      throw error;
    } finally {
      activePipelines.delete(this._pipelineId);
    }

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
