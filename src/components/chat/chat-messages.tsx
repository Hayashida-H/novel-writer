"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  streamingContent?: string;
}

export function ChatMessages({ messages, streamingContent }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !streamingContent) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Bot className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-sm">メッセージを送って会話を始めましょう</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {streamingContent && (
          <MessageBubble
            message={{
              id: "streaming",
              role: "assistant",
              content: streamingContent,
            }}
            isStreaming
          />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {isStreaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current opacity-70" />
        )}
      </div>
    </div>
  );
}
