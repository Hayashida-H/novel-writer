import type { AgentType, AgentOutput } from "@/types/agent";
import type { ClaudeClient, ClaudeMessage, StreamCallback } from "@/lib/claude/client";

export interface AgentContext {
  projectId: string;
  chapterId?: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  customInstructions?: string;
  styleProfile?: string;
  additionalContext?: Record<string, unknown>;
}

export interface AgentResult {
  output: AgentOutput;
  rawContent: string;
  stopReason: string | null;
}

export class BaseAgent {
  protected agentType: AgentType;
  protected client: ClaudeClient;

  constructor(agentType: AgentType, client: ClaudeClient) {
    this.agentType = agentType;
    this.client = client;
  }

  async execute(
    context: AgentContext,
    messages: ClaudeMessage[],
    onStream?: StreamCallback
  ): Promise<AgentResult> {
    const systemPrompt = this.buildSystemPrompt(context);

    const response = await this.client.chat({
      model: context.model,
      systemPrompt,
      messages,
      temperature: context.temperature,
      maxTokens: context.maxTokens,
      onStream,
    });

    return {
      output: {
        agentType: this.agentType,
        taskType: "general",
        content: response.content,
        tokenUsage: {
          input: response.usage.inputTokens,
          output: response.usage.outputTokens,
        },
      },
      rawContent: response.content,
      stopReason: response.stopReason,
    };
  }

  protected buildSystemPrompt(context: AgentContext): string {
    let prompt = context.systemPrompt;

    if (context.customInstructions) {
      prompt += `\n\n## プロジェクト固有の指示\n${context.customInstructions}`;
    }

    if (context.styleProfile) {
      prompt += `\n\n## 文体プロファイル\n${context.styleProfile}`;
    }

    return prompt;
  }
}
