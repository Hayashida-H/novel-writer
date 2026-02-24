"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  FastForward,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ListTree,
  Square,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { AGENT_LABELS, type AgentType } from "@/types/agent";

interface ArcItem {
  id: string;
  projectId: string;
  arcNumber: number;
  title: string;
  description: string | null;
}

interface ChapterItem {
  id: string;
  chapterNumber: number;
  title: string | null;
  synopsis: string | null;
  content: string | null;
  wordCount: number | null;
  status: string;
  arcId: string | null;
}

interface TaskItem {
  id: string;
  projectId: string;
  chapterId: string | null;
  agentType: string;
  taskType: string;
  status: string;
  output: string | null;
  errorMessage: string | null;
  tokenUsage: { inputTokens?: number; outputTokens?: number } | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const CHAPTER_STATUS_LABELS: Record<string, { ja: string; color: string }> = {
  outlined: { ja: "アウトライン", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
  drafting: { ja: "下書き中", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  draft: { ja: "下書き", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" },
  editing: { ja: "編集中", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  reviewed: { ja: "レビュー済", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  final: { ja: "最終版", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

const AGENT_ABBREVS: Record<AgentType, string> = {
  coordinator: "Co",
  plot_architect: "Pl",
  world_builder: "Wb",
  character_manager: "Ch",
  writer: "Wr",
  editor: "Ed",
  continuity_checker: "Cc",
};

const AGENT_ORDER: AgentType[] = [
  "coordinator",
  "plot_architect",
  "world_builder",
  "character_manager",
  "writer",
  "editor",
  "continuity_checker",
];

function getAgentStatusesForChapter(
  chapterId: string,
  tasks: TaskItem[]
): Map<AgentType, "completed" | "running" | "not_started"> {
  const statuses = new Map<AgentType, "completed" | "running" | "not_started">();
  for (const agentType of AGENT_ORDER) {
    const chapterTasks = tasks.filter(
      (t) => t.chapterId === chapterId && t.agentType === agentType
    );
    if (chapterTasks.some((t) => t.status === "completed")) {
      statuses.set(agentType, "completed");
    } else if (chapterTasks.some((t) => t.status === "running" || t.status === "queued")) {
      statuses.set(agentType, "running");
    } else {
      statuses.set(agentType, "not_started");
    }
  }
  return statuses;
}

/** Check if a chapter has a partially completed pipeline (some done, some not) */
function hasResumableProgress(chapterId: string, tasks: TaskItem[]): boolean {
  const statuses = getAgentStatusesForChapter(chapterId, tasks);
  const hasCompleted = Array.from(statuses.values()).some((s) => s === "completed");
  const hasNotStarted = Array.from(statuses.values()).some((s) => s === "not_started");
  const hasRunning = Array.from(statuses.values()).some((s) => s === "running");
  return hasCompleted && hasNotStarted && !hasRunning;
}

interface WritingDashboardProps {
  projectId: string;
}

export function WritingDashboard({ projectId }: WritingDashboardProps) {
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [arcs, setArcs] = useState<ArcItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<ChapterItem | null>(null);
  const [collapsedArcs, setCollapsedArcs] = useState<Set<string>>(new Set());
  const [writingChapterId, setWritingChapterId] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent-tasks?projectId=${projectId}`);
      if (res.ok) setTasks(await res.json());
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => {
    async function load() {
      try {
        const [chapRes, arcRes, taskRes] = await Promise.all([
          fetch(`/api/chapters?projectId=${projectId}`),
          fetch(`/api/arcs?projectId=${projectId}`),
          fetch(`/api/agent-tasks?projectId=${projectId}`),
        ]);
        if (chapRes.ok) setChapters(await chapRes.json());
        if (arcRes.ok) setArcs(await arcRes.json());
        if (taskRes.ok) setTasks(await taskRes.json());
      } catch (error) {
        console.error("Failed to load:", error);
      }
    }
    load();
  }, [projectId]);

  // Poll tasks when active tasks exist
  useEffect(() => {
    const hasActive = tasks.some((t) => t.status === "running" || t.status === "queued");
    if (!hasActive) return;
    const interval = setInterval(() => refreshTasks(), 5000);
    return () => clearInterval(interval);
  }, [tasks, refreshTasks]);

  const handleUpdateChapter = useCallback(async (id: string, content: string) => {
    try {
      await fetch("/api/chapters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content }),
      });
      setChapters((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, content, wordCount: content.length } : c
        )
      );
    } catch (error) {
      console.error("Failed to update chapter:", error);
    }
  }, []);

  // Execute a single pipeline step via SSE, returns true on success
  const executeStep = useCallback(async (chapterId: string, stepIndex: number): Promise<boolean> => {
    try {
      const res = await fetch("/api/agents/execute-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, chapterId, stepIndex }),
      });

      if (!res.ok) return false;
      if (!res.body) return false;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let success = true;

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
            if (event.type === "error") success = false;
            if (event.type === "agent_start" || event.type === "agent_complete") {
              await refreshTasks();
            }
          } catch { /* ignore */ }
        }
      }

      return success;
    } catch {
      return false;
    }
  }, [projectId, refreshTasks]);

  // Recover content from agent_tasks when chapter is empty but agents completed
  const handleRecoverContent = useCallback(async (chapterId: string) => {
    try {
      const res = await fetch("/api/agents/recover-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, chapterId }),
      });
      if (res.ok) {
        const data = await res.json();
        setChapters((prev) =>
          prev.map((c) => (c.id === chapterId ? { ...c, content: data.chapter.content, wordCount: data.chapter.wordCount, status: data.chapter.status } : c))
        );
      }
    } catch (error) {
      console.error("Failed to recover content:", error);
    }
  }, [projectId]);

  // Step-by-step pipeline execution
  const executeStepByStep = useCallback(async (chapterId: string, startStep: number) => {
    setWritingChapterId(chapterId);
    try {
      for (let i = startStep; i < AGENT_ORDER.length; i++) {
        const ok = await executeStep(chapterId, i);
        if (!ok) {
          console.error(`Step ${i} (${AGENT_ORDER[i]}) failed`);
          break;
        }
      }

      // Final refresh
      const [chapRes, taskRes] = await Promise.all([
        fetch(`/api/chapters?projectId=${projectId}`),
        fetch(`/api/agent-tasks?projectId=${projectId}`),
      ]);
      let latestChapters: ChapterItem[] = [];
      if (chapRes.ok) {
        latestChapters = await chapRes.json();
        setChapters(latestChapters);
      }
      if (taskRes.ok) setTasks(await taskRes.json());

      // Auto-recover content if chapter is empty after pipeline completion
      const targetChapter = latestChapters.find((c) => c.id === chapterId);
      if (targetChapter && !targetChapter.content) {
        console.log("[dashboard] Chapter content empty after pipeline, auto-recovering...");
        await handleRecoverContent(chapterId);
      }
    } catch (error) {
      console.error("Step-by-step execution failed:", error);
    } finally {
      setWritingChapterId(null);
    }
  }, [projectId, executeStep, refreshTasks, handleRecoverContent]);

  // Start writing from scratch (all 7 steps)
  const handleWriteEpisode = useCallback(async (chapterId: string) => {
    // Cancel stale tasks first
    await fetch(`/api/agent-tasks?projectId=${projectId}`, { method: "DELETE" });
    // Reset task state so agent icons go back to white (not_started)
    setTasks((prev) => prev.filter((t) => t.chapterId !== chapterId));
    await executeStepByStep(chapterId, 0);
  }, [projectId, executeStepByStep]);

  // Resume from first incomplete step
  const handleResumeEpisode = useCallback(async (chapterId: string) => {
    const statuses = getAgentStatusesForChapter(chapterId, tasks);
    let startStep = 0;
    for (let i = 0; i < AGENT_ORDER.length; i++) {
      if (statuses.get(AGENT_ORDER[i]) === "completed") {
        startStep = i + 1;
      } else {
        break;
      }
    }
    await executeStepByStep(chapterId, startStep);
  }, [executeStepByStep, tasks]);

  const handleForceCancel = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent-tasks?projectId=${projectId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWritingChapterId(null);
        await refreshTasks();
      }
    } catch (error) {
      console.error("Failed to cancel tasks:", error);
    }
  }, [projectId, refreshTasks]);

  const toggleArcCollapse = useCallback((arcId: string) => {
    setCollapsedArcs((prev) => {
      const next = new Set(prev);
      if (next.has(arcId)) next.delete(arcId);
      else next.add(arcId);
      return next;
    });
  }, []);

  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "queued");

  // Render agent status icons for a chapter
  const renderAgentIcons = (chapterId: string) => {
    const statuses = getAgentStatusesForChapter(chapterId, tasks);
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex gap-0.5">
          {AGENT_ORDER.map((agentType) => {
            const status = statuses.get(agentType) || "not_started";
            const label = AGENT_LABELS[agentType];
            const abbrev = AGENT_ABBREVS[agentType];
            let colorClass = "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
            if (status === "completed") {
              colorClass = "bg-green-200 text-green-700 dark:bg-green-900 dark:text-green-300";
            } else if (status === "running") {
              colorClass = "bg-blue-200 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
            }
            return (
              <Tooltip key={agentType}>
                <TooltipTrigger asChild>
                  <span
                    className={`inline-flex h-5 w-6 items-center justify-center rounded text-[10px] font-bold ${colorClass} ${status === "running" ? "animate-pulse" : ""}`}
                  >
                    {abbrev}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {label.ja}: {status === "completed" ? "完了" : status === "running" ? "実行中" : "未実行"}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    );
  };

  const renderChapterCard = (chapter: ChapterItem) => {
    const statusInfo = CHAPTER_STATUS_LABELS[chapter.status] || CHAPTER_STATUS_LABELS.outlined;
    const isWriting = writingChapterId === chapter.id;
    const canResume = hasResumableProgress(chapter.id, tasks);
    const agentStatuses = getAgentStatusesForChapter(chapter.id, tasks);
    const allAgentsCompleted = Array.from(agentStatuses.values()).every((s) => s === "completed");
    const needsRecovery = allAgentsCompleted && !chapter.content;
    return (
      <Card key={chapter.id} className="transition-colors hover:bg-accent/50">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
              {chapter.chapterNumber}
            </div>
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setSelectedChapter(chapter)}>
              <CardTitle className="truncate text-sm">
                {chapter.title || `第${chapter.chapterNumber}話`}
              </CardTitle>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {needsRecovery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-orange-600"
                  onClick={(e) => { e.stopPropagation(); handleRecoverContent(chapter.id); }}
                  title="コンテンツ復旧"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              {canResume && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-amber-600"
                  disabled={isWriting || !!writingChapterId}
                  onClick={(e) => { e.stopPropagation(); handleResumeEpisode(chapter.id); }}
                  title="続きから"
                >
                  <FastForward className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={isWriting || !!writingChapterId}
                onClick={(e) => { e.stopPropagation(); handleWriteEpisode(chapter.id); }}
                title="最初から執筆"
              >
                {isWriting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {(chapter.wordCount || 0).toLocaleString()}字
              </span>
              <span className={`hidden items-center rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex ${statusInfo.color}`}>
                {statusInfo.ja}
              </span>
            </div>
          </div>
          {/* Agent icons + mobile meta on second row */}
          <div className="mt-1 flex items-center gap-2 pl-8">
            {renderAgentIcons(chapter.id)}
            <span className="text-xs text-muted-foreground sm:hidden">
              {(chapter.wordCount || 0).toLocaleString()}字
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium sm:hidden ${statusInfo.color}`}>
              {statusInfo.ja}
            </span>
          </div>
        </CardHeader>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{chapters.length}</div>
              <p className="text-xs text-muted-foreground">
                {arcs.length > 0 ? `${arcs.length}章 / ${chapters.length}話` : "話"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{totalWords.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">総文字数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{activeTasks.length}</div>
                  <p className="text-xs text-muted-foreground">実行中タスク</p>
                </div>
                {activeTasks.length > 0 && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleForceCancel}
                    title="全タスク強制終了"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {chapters.filter((c) => c.status === "final").length}
              </div>
              <p className="text-xs text-muted-foreground">完了話</p>
            </CardContent>
          </Card>
        </div>

        {/* Link to structure page */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/p/${projectId}/prepare/structure`}>
              <ListTree className="mr-1.5 h-3.5 w-3.5" />
              構成ページへ（章/話の管理）
            </Link>
          </Button>
        </div>

        {/* Chapters List (grouped by arcs) - read only with write buttons */}
        <div>
          <h3 className="mb-3 text-sm font-medium">
            {arcs.length > 0 ? "章 / 話一覧" : "話一覧"}
          </h3>
          {chapters.length === 0 && arcs.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">まだ話がありません</p>
                <p className="mt-1 text-xs">「構成ページ」で章と話を作成してください</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {arcs.map((arc) => {
                const arcChapters = chapters.filter((c) => c.arcId === arc.id);
                const isCollapsed = collapsedArcs.has(arc.id);
                const arcWords = arcChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
                return (
                  <div key={arc.id}>
                    <div
                      className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 cursor-pointer"
                      onClick={() => toggleArcCollapse(arc.id)}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-semibold">
                        第{arc.arcNumber}章: {arc.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({arcChapters.length}話 / {arcWords.toLocaleString()}字)
                      </span>
                    </div>
                    {!isCollapsed && (
                      <div className="ml-4 mt-1 space-y-1">
                        {arcChapters.length === 0 ? (
                          <p className="py-2 text-xs text-muted-foreground">話なし</p>
                        ) : (
                          arcChapters.map((chapter) => renderChapterCard(chapter))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unassigned chapters */}
              {(() => {
                const unassigned = chapters.filter((c) => !c.arcId);
                if (unassigned.length === 0) return null;
                return (
                  <div>
                    {arcs.length > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2">
                        <span className="text-sm font-medium text-muted-foreground">未分類</span>
                        <span className="text-xs text-muted-foreground">({unassigned.length}話)</span>
                      </div>
                    )}
                    <div className={arcs.length > 0 ? "ml-4 mt-1 space-y-1" : "space-y-2"}>
                      {unassigned.map((chapter) => renderChapterCard(chapter))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

      </div>

      {/* Chapter Editor Dialog */}
      <Dialog open={!!selectedChapter} onOpenChange={(open) => !open && setSelectedChapter(null)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              第{selectedChapter?.chapterNumber}話: {selectedChapter?.title || "無題"}
            </DialogTitle>
          </DialogHeader>
          {selectedChapter && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{(selectedChapter.wordCount || 0).toLocaleString()}字</span>
                <Badge variant="outline">{CHAPTER_STATUS_LABELS[selectedChapter.status]?.ja}</Badge>
              </div>
              {selectedChapter.synopsis && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground">あらすじ</p>
                  <p className="mt-1 text-sm">{selectedChapter.synopsis}</p>
                </div>
              )}
              <div>
                <Label>本文</Label>
                <Textarea
                  value={selectedChapter.content || ""}
                  onChange={(e) =>
                    setSelectedChapter({ ...selectedChapter, content: e.target.value })
                  }
                  rows={20}
                  className="font-serif text-sm leading-relaxed"
                  placeholder="本文を入力、またはエージェントに執筆させましょう..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedChapter(null)}>
              閉じる
            </Button>
            <Button
              onClick={() => {
                if (selectedChapter) {
                  handleUpdateChapter(selectedChapter.id, selectedChapter.content || "");
                  setSelectedChapter(null);
                }
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
