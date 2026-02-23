import Anthropic from "@anthropic-ai/sdk";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: string | null;
}

export interface ChatOptions {
  model: string;
  systemPrompt: string;
  messages: ClaudeMessage[];
  temperature?: number;
  maxTokens?: number;
  onStream?: StreamCallback;
}

export type StreamCallback = (text: string) => void;

export class ClaudeClient {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
  }

  async chat(options: ChatOptions): Promise<ClaudeResponse> {
    const { model, systemPrompt, messages, temperature = 0.7, maxTokens = 4096, onStream } = options;

    if (onStream) {
      return this.chatStream(model, systemPrompt, messages, temperature, maxTokens, onStream);
    }

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content
      .filter((block: { type: string }): block is Anthropic.TextBlock => block.type === "text")
      .map((block: Anthropic.TextBlock) => block.text)
      .join("");

    return {
      content: textContent,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      stopReason: response.stop_reason,
    };
  }

  private async chatStream(
    model: string,
    systemPrompt: string,
    messages: ClaudeMessage[],
    temperature: number,
    maxTokens: number,
    onStream: StreamCallback
  ): Promise<ClaudeResponse> {
    const stream = this.client.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    let fullContent = "";

    stream.on("text", (text: string) => {
      fullContent += text;
      onStream(text);
    });

    const finalMessage = await stream.finalMessage();

    return {
      content: fullContent,
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
      stopReason: finalMessage.stop_reason,
    };
  }
}

let clientInstance: ClaudeClient | null = null;

export function getClaudeClient(): ClaudeClient {
  if (!clientInstance) {
    clientInstance = new ClaudeClient();
  }
  return clientInstance;
}
