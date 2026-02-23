"use client";

import { useState, useCallback } from "react";

interface UseSSEGenerationOptions<T> {
  endpoint: string;
  onItems: (items: T[]) => void;
  onError?: (message: string) => void;
}

export function useSSEGeneration<T>({
  endpoint,
  onItems,
  onError,
}: UseSSEGenerationOptions<T>) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(
    async (projectId: string, extraBody?: Record<string, unknown>) => {
      setIsGenerating(true);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, ...extraBody }),
        });

        if (!res.ok) throw new Error("API request failed");
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === "done" && event.items) {
                onItems(event.items);
              } else if (event.type === "error") {
                onError?.(event.message || "生成に失敗しました");
              }
            } catch {
              // ignore parse errors for partial chunks
            }
          }
        }
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "生成に失敗しました");
      } finally {
        setIsGenerating(false);
      }
    },
    [endpoint, onItems, onError]
  );

  return { generate, isGenerating };
}
