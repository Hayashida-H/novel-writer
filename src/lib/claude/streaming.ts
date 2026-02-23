import type { StreamEvent } from "@/types/agent";

export function createSSEStream(): {
  stream: ReadableStream;
  send: (event: StreamEvent) => void;
  close: () => void;
} {
  let controller: ReadableStreamDefaultController | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(c) {
      controller = c;
      // Send heartbeat every 15 seconds to prevent browser/proxy timeout
      heartbeatInterval = setInterval(() => {
        if (!controller) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // Controller already closed
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 15_000);
    },
    cancel() {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      controller = null;
    },
  });

  function send(event: StreamEvent) {
    if (!controller) return;
    const data = JSON.stringify(event);
    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
  }

  function close() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (!controller) return;
    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    controller.close();
    controller = null;
  }

  return { stream, send, close };
}

export function parseSSEEvent(line: string): StreamEvent | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6).trim();
  if (data === "[DONE]") return null;
  try {
    return JSON.parse(data) as StreamEvent;
  } catch {
    return null;
  }
}
