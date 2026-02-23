"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Map, Users, Globe, MessagesSquare } from "lucide-react";

export interface ChatSession {
  id: string;
  topic: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

const TOPIC_CONFIG: Record<string, { label: string; icon: typeof MessageSquare }> = {
  plot: { label: "プロット", icon: Map },
  characters: { label: "キャラクター", icon: Users },
  world: { label: "世界観", icon: Globe },
  general: { label: "一般", icon: MessagesSquare },
};

interface SessionListProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: (topic: string) => void;
}

export function SessionList({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
}: SessionListProps) {
  return (
    <div className="flex h-full w-56 flex-col border-r bg-muted/30">
      <div className="border-b p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">新規チャット</p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(TOPIC_CONFIG).map(([topic, config]) => {
            const Icon = config.icon;
            return (
              <Button
                key={topic}
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => onNewSession(topic)}
              >
                <Icon className="h-3 w-3" />
                {config.label}
              </Button>
            );
          })}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {sessions.map((session) => {
            const topicConf = TOPIC_CONFIG[session.topic];
            const Icon = topicConf?.icon || MessageSquare;
            return (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent",
                  activeSessionId === session.id && "bg-accent font-medium"
                )}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {session.title || topicConf?.label || "新規チャット"}
                </span>
              </button>
            );
          })}
          {sessions.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              セッションがありません
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
