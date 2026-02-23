"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatMessages, type ChatMessage } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { SessionList, type ChatSession } from "./session-list";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ChatContainerProps {
  projectId: string;
}

export function ChatContainer({ projectId }: ChatContainerProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reflections, setReflections] = useState<{ target: string; action: string }[]>([]);
  const [mobileSessionOpen, setMobileSessionOpen] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

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
          setMobileSessionOpen(false);
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
                // Strip REFLECT tags from displayed content
                const displayText = accumulated.replace(/<!-- REFLECT:[\s\S]*?-->/g, "").trim();
                setStreamingContent(displayText);
              } else if (event.type === "reflect") {
                // Show reflection badges
                if (event.applied && Array.isArray(event.applied)) {
                  setReflections(event.applied);
                  setTimeout(() => setReflections([]), 5000);
                }
              } else if (event.type === "done") {
                // Add final assistant message (clean text)
                const cleanContent = accumulated.replace(/<!-- REFLECT:[\s\S]*?-->/g, "").trim();
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `assistant-${Date.now()}`,
                    role: "assistant",
                    content: cleanContent,
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
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={createSession}
        />
      </div>

      {/* Mobile session drawer */}
      <Sheet open={mobileSessionOpen} onOpenChange={setMobileSessionOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">セッション一覧</SheetTitle>
          <SessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={(id) => {
              setActiveSessionId(id);
              setMobileSessionOpen(false);
            }}
            onNewSession={createSession}
          />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col">
        {/* Mobile session selector bar */}
        <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileSessionOpen(true)}
          >
            <MessageSquare className="mr-1.5 h-4 w-4" />
            {activeSession ? activeSession.title || "チャット" : "セッション一覧"}
          </Button>
        </div>

        {activeSessionId ? (
          <>
            <ChatMessages messages={messages} streamingContent={streamingContent || undefined} />
            {reflections.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t bg-muted/30 px-4 py-2">
                {reflections.map((r, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
                  >
                    {r.target}: {r.action}
                  </span>
                ))}
              </div>
            )}
            <ChatInput onSend={sendMessage} disabled={isLoading} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center px-4">
              <p className="text-lg font-medium">準備チャット</p>
              <p className="mt-1 text-sm">
                新しいチャットを始めましょう
              </p>
              <p className="mt-2 text-xs">
                プロット・キャラクター・世界観のトピックを選べます
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 md:hidden"
                onClick={() => setMobileSessionOpen(true)}
              >
                <MessageSquare className="mr-1.5 h-4 w-4" />
                セッション一覧
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
