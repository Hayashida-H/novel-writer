"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatMessages, type ChatMessage } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { SessionList, type ChatSession } from "./session-list";

interface ChatContainerProps {
  projectId: string;
}

export function ChatContainer({ projectId }: ChatContainerProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load sessions
  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch(`/api/chat/sessions?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
        }
      } catch (error) {
        console.error("Failed to load sessions:", error);
      }
    }
    loadSessions();
  }, [projectId]);

  // Load messages when session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      try {
        const res = await fetch(`/api/chat/sessions/${activeSessionId}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    }
    loadMessages();
  }, [activeSessionId]);

  const createSession = useCallback(
    async (topic: string) => {
      try {
        const res = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, topic }),
        });

        if (res.ok) {
          const session = await res.json();
          setSessions((prev) => [session, ...prev]);
          setActiveSessionId(session.id);
          setMessages([]);
        }
      } catch (error) {
        console.error("Failed to create session:", error);
      }
    },
    [projectId]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeSessionId || isLoading) return;

      // Optimistically add user message
      const tempUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content,
      };
      setMessages((prev) => [...prev, tempUserMsg]);
      setIsLoading(true);
      setStreamingContent("");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeSessionId, content }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const event = JSON.parse(data);

              if (event.type === "stream") {
                accumulated += event.text;
                setStreamingContent(accumulated);
              } else if (event.type === "done") {
                // Add final assistant message
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `assistant-${Date.now()}`,
                    role: "assistant",
                    content: accumulated,
                  },
                ]);
                setStreamingContent("");
              } else if (event.type === "error") {
                console.error("Stream error:", event.message);
                setStreamingContent("");
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }

        // Refresh session list to update titles
        const sessRes = await fetch(`/api/chat/sessions?projectId=${projectId}`);
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          setSessions(sessData);
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        setStreamingContent("");
      } finally {
        setIsLoading(false);
      }
    },
    [activeSessionId, isLoading, projectId]
  );

  return (
    <div className="flex h-full">
      <SessionList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={createSession}
      />
      <div className="flex flex-1 flex-col">
        {activeSessionId ? (
          <>
            <ChatMessages messages={messages} streamingContent={streamingContent || undefined} />
            <ChatInput onSend={sendMessage} disabled={isLoading} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">準備チャット</p>
              <p className="mt-1 text-sm">
                左のパネルから新しいチャットを始めましょう
              </p>
              <p className="mt-2 text-xs">
                プロット・キャラクター・世界観のトピックを選べます
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
