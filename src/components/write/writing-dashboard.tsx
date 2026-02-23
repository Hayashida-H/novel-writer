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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Pause,
  Plus,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Pencil,
  Bot,
  Sparkles,
  BookOpen,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderPlus,
} from "lucide-react";
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

const TASK_STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  queued: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: XCircle,
};

// Agent abbreviations for status icons
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

interface WritingDashboardProps {
  projectId: string;
}

export function WritingDashboard({ projectId }: WritingDashboardProps) {
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [arcs, setArcs] = useState<ArcItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<ChapterItem | null>(null);
  const [showNewChapter, setShowNewChapter] = useState(false);
  const [newChapter, setNewChapter] = useState({ title: "", synopsis: "", arcId: "" });
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskConfig, setTaskConfig] = useState({
    agentType: "writer" as string,
    taskType: "write",
    chapterId: "",
  });
  const [showNewArc, setShowNewArc] = useState(false);
  const [newArc, setNewArc] = useState({ title: "", description: "" });
  const [editingArc, setEditingArc] = useState<ArcItem | null>(null);
  const [collapsedArcs, setCollapsedArcs] = useState<Set<string>>(new Set());

  const [isCreatingChapters, setIsCreatingChapters] = useState(false);
  const [generatingArcId, setGeneratingArcId] = useState<string | null>(null);
  const [writingChapterId, setWritingChapterId] = useState<string | null>(null);
  const [isBulkWriting, setIsBulkWriting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

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

  // 5g: Poll tasks when active tasks exist
  useEffect(() => {
    const hasActive = tasks.some((t) => t.status === "running" || t.status === "queued");
    if (!hasActive) return;
    const interval = setInterval(() => refreshTasks(), 5000);
    return () => clearInterval(interval);
  }, [tasks, refreshTasks]);

  const handleCreateChapter = useCallback(async () => {
    if (!newChapter.title) return;
    try {
      const nextNumber = chapters.length > 0
        ? Math.max(...chapters.map((c) => c.chapterNumber)) + 1
        : 1;

      const res = await fetch("/api/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          chapterNumber: nextNumber,
          title: newChapter.title,
          synopsis: newChapter.synopsis || null,
          arcId: newChapter.arcId || null,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setChapters((prev) => [...prev, created]);
        setNewChapter({ title: "", synopsis: "", arcId: "" });
        setShowNewChapter(false);
      }
    } catch (error) {
      console.error("Failed to create chapter:", error);
    }
  }, [newChapter, chapters, projectId]);

  const handleCreateArc = useCallback(async () => {
    if (!newArc.title) return;
    try {
      const res = await fetch("/api/arcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: newArc.title,
          description: newArc.description || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setArcs((prev) => [...prev, created]);
        setNewArc({ title: "", description: "" });
        setShowNewArc(false);
      }
    } catch (error) {
      console.error("Failed to create arc:", error);
    }
  }, [newArc, projectId]);

  const handleUpdateArc = useCallback(async () => {
    if (!editingArc) return;
    try {
      const res = await fetch("/api/arcs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingArc.id,
          title: editingArc.title,
          description: editingArc.description,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setArcs((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setEditingArc(null);
      }
    } catch (error) {
      console.error("Failed to update arc:", error);
    }
  }, [editingArc]);

  const handleDeleteArc = useCallback(async (arcId: string) => {
    try {
      const res = await fetch(`/api/arcs?id=${arcId}`, { method: "DELETE" });
      if (res.ok) {
        setArcs((prev) => prev.filter((a) => a.id !== arcId));
        setChapters((prev) => prev.map((c) => c.arcId === arcId ? { ...c, arcId: null } : c));
      }
    } catch (error) {
      console.error("Failed to delete arc:", error);
    }
  }, []);

  // 5e: Delete chapter (話)
  const handleDeleteChapter = useCallback(async (chapterId: string) => {
    try {
      const res = await fetch(`/api/chapters?id=${chapterId}`, { method: "DELETE" });
      if (res.ok) {
        setChapters((prev) => prev.filter((c) => c.id !== chapterId));
        if (selectedChapter?.id === chapterId) setSelectedChapter(null);
      }
    } catch (error) {
      console.error("Failed to delete chapter:", error);
    }
  }, [selectedChapter]);

  const toggleArcCollapse = useCallback((arcId: string) => {
    setCollapsedArcs((prev) => {
      const next = new Set(prev);
      if (next.has(arcId)) next.delete(arcId);
      else next.add(arcId);
      return next;
    });
  }, []);

  const handleStartTask = useCallback(async () => {
    if (!taskConfig.agentType || !taskConfig.taskType) return;
    try {
      const res = await fetch("/api/agent-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          chapterId: taskConfig.chapterId || null,
          agentType: taskConfig.agentType,
          taskType: taskConfig.taskType,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setTasks((prev) => [created, ...prev]);
        setShowTaskDialog(false);
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  }, [taskConfig, projectId]);

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

  // 5a: AI arc generation from plot (SSE)
  const handleCreateChaptersFromPlot = useCallback(async () => {
    setIsCreatingChapters(true);
    try {
      const res = await fetch("/api/generate/chapters-from-plot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(err.error || "章の生成に失敗しました");
        return;
      }
      if (!res.body) return;

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
              setArcs((prev) => [...prev, ...event.items]);
            } else if (event.type === "error") {
              alert(event.message || "章の生成に失敗しました");
            }
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error("Failed to create chapters from plot:", error);
    } finally {
      setIsCreatingChapters(false);
    }
  }, [projectId]);

  // 5b: Episode generation per arc (SSE)
  const handleGenerateEpisodes = useCallback(async (arcId: string) => {
    setGeneratingArcId(arcId);
    try {
      const res = await fetch("/api/generate/episodes-from-arc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, arcId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(err.error || "話の生成に失敗しました");
        return;
      }
      if (!res.body) return;

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
              setChapters((prev) => [...prev, ...event.items]);
            } else if (event.type === "error") {
              alert(event.message || "話の生成に失敗しました");
            }
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error("Failed to generate episodes:", error);
    } finally {
      setGeneratingArcId(null);
    }
  }, [projectId]);

  // 5c: Per-episode writing via agent pipeline (SSE)
  const handleWriteEpisode = useCallback(async (chapterId: string) => {
    setWritingChapterId(chapterId);
    try {
      const res = await fetch("/api/agents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, chapterId, mode: "write" }),
      });

      if (!res.ok) {
        alert("執筆の開始に失敗しました");
        return;
      }
      if (!res.body) return;

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
            if (event.type === "agent_start" || event.type === "agent_complete") {
              await refreshTasks();
            } else if (event.type === "pipeline_complete") {
              const [chapRes, taskRes] = await Promise.all([
                fetch(`/api/chapters?projectId=${projectId}`),
                fetch(`/api/agent-tasks?projectId=${projectId}`),
              ]);
              if (chapRes.ok) setChapters(await chapRes.json());
              if (taskRes.ok) setTasks(await taskRes.json());
            }
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error("Episode write failed:", error);
    } finally {
      setWritingChapterId(null);
    }
  }, [projectId, refreshTasks]);

  const handleBulkWrite = useCallback(async () => {
    setIsBulkWriting(true);
    setBulkProgress("準備中...");
    try {
      const res = await fetch("/api/generate/bulk-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) throw new Error("Bulk write failed");
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
            if (event.chapterNumber && event.message === "chapter_start") {
              setBulkProgress(`第${event.chapterNumber}章を執筆中... (${event.progress})`);
            } else if (event.message === "chapter_complete") {
              const chapRes = await fetch(`/api/chapters?projectId=${projectId}`);
              if (chapRes.ok) setChapters(await chapRes.json());
            } else if (event.type === "pipeline_complete" && event.message === "bulk_complete") {
              setBulkProgress("");
            }
          } catch { /* ignore */ }
        }
      }

      const chapRes = await fetch(`/api/chapters?projectId=${projectId}`);
      if (chapRes.ok) setChapters(await chapRes.json());
    } catch (error) {
      console.error("Bulk write failed:", error);
    } finally {
      setIsBulkWriting(false);
      setBulkProgress("");
    }
  }, [projectId]);

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

  // Render a chapter card (shared between arc-grouped and unassigned)
  const renderChapterCard = (chapter: ChapterItem) => {
    const statusInfo = CHAPTER_STATUS_LABELS[chapter.status] || CHAPTER_STATUS_LABELS.outlined;
    const isWriting = writingChapterId === chapter.id;
    return (
      <Card
        key={chapter.id}
        className="transition-colors hover:bg-accent/50"
      >
        <CardHeader className="flex flex-row items-center gap-3 py-2 px-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
            {chapter.chapterNumber}
          </div>
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setSelectedChapter(chapter)}
          >
            <CardTitle className="text-sm">
              {chapter.title || `第${chapter.chapterNumber}話`}
            </CardTitle>
            {chapter.synopsis && (
              <CardDescription className="line-clamp-1 text-xs">
                {chapter.synopsis}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {renderAgentIcons(chapter.id)}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={isWriting || !!writingChapterId}
              onClick={(e) => { e.stopPropagation(); handleWriteEpisode(chapter.id); }}
              title="執筆"
            >
              {isWriting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              {(chapter.wordCount || 0).toLocaleString()}字
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.ja}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={(e) => { e.stopPropagation(); handleDeleteChapter(chapter.id); }}
              title="削除"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4">
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
              <div className="text-2xl font-bold">{activeTasks.length}</div>
              <p className="text-xs text-muted-foreground">実行中タスク</p>
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

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowNewArc(true)}>
            <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
            章を追加
          </Button>
          <Button size="sm" onClick={() => setShowNewChapter(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            話を追加
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateChaptersFromPlot}
            disabled={isCreatingChapters}
          >
            {isCreatingChapters ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isCreatingChapters ? "AI生成中..." : "プロットから章を作成"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkWrite}
            disabled={isBulkWriting || chapters.length === 0}
          >
            {isBulkWriting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isBulkWriting ? "執筆中..." : "一括執筆"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setTaskConfig({ agentType: "writer", taskType: "write", chapterId: "" });
              setShowTaskDialog(true);
            }}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            タスク実行
          </Button>
        </div>

        {/* Bulk Writing Progress */}
        {bulkProgress && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardContent className="flex items-center gap-3 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {bulkProgress}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Chapters List (grouped by arcs) */}
        <div>
          <h3 className="mb-3 text-sm font-medium">
            {arcs.length > 0 ? "章 / 話一覧" : "話一覧"}
          </h3>
          {chapters.length === 0 && arcs.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">まだ話がありません</p>
                <p className="mt-1 text-xs">「プロットから章を作成」で始めましょう</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {arcs.map((arc) => {
                const arcChapters = chapters.filter((c) => c.arcId === arc.id);
                const isCollapsed = collapsedArcs.has(arc.id);
                const arcWords = arcChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
                const isGenerating = generatingArcId === arc.id;
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
                      <div className="ml-auto flex gap-1">
                        {/* 5b: Generate episodes button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={isGenerating || !!generatingArcId}
                          onClick={(e) => { e.stopPropagation(); handleGenerateEpisodes(arc.id); }}
                          title="話を生成"
                        >
                          {isGenerating ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); setEditingArc(arc); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDeleteArc(arc.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="ml-4 mt-1 space-y-1">
                        {arcChapters.length === 0 ? (
                          <p className="py-2 text-xs text-muted-foreground">
                            話なし — Sparkles ボタンで話を生成
                          </p>
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
                        <span className="text-xs text-muted-foreground">
                          ({unassigned.length}話)
                        </span>
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

        {/* Recent Tasks */}
        <div>
          <h3 className="mb-3 text-sm font-medium">タスク履歴</h3>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">タスク履歴なし</p>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 10).map((task) => {
                const StatusIcon = TASK_STATUS_ICONS[task.status] || Clock;
                const agentLabel = AGENT_LABELS[task.agentType as AgentType];
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <StatusIcon
                      className={`h-4 w-4 ${
                        task.status === "running"
                          ? "animate-spin text-blue-500"
                          : task.status === "completed"
                            ? "text-green-500"
                            : task.status === "failed"
                              ? "text-red-500"
                              : "text-muted-foreground"
                      }`}
                    />
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">
                        {agentLabel?.ja || task.agentType} - {task.taskType}
                      </p>
                      {task.errorMessage && (
                        <p className="text-xs text-red-500">{task.errorMessage}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {task.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Chapter (話) Dialog */}
      <Dialog open={showNewChapter} onOpenChange={setShowNewChapter}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>話を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>タイトル</Label>
              <Input
                value={newChapter.title}
                onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })}
                placeholder="出発の朝"
              />
            </div>
            <div>
              <Label>あらすじ</Label>
              <Textarea
                value={newChapter.synopsis}
                onChange={(e) => setNewChapter({ ...newChapter, synopsis: e.target.value })}
                rows={3}
                placeholder="この話で起こる出来事..."
              />
            </div>
            {arcs.length > 0 && (
              <div>
                <Label>所属する章（任意）</Label>
                <Select
                  value={newChapter.arcId}
                  onValueChange={(v) => setNewChapter({ ...newChapter, arcId: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="未分類" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">未分類</SelectItem>
                    {arcs.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        第{a.arcNumber}章: {a.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChapter(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateChapter} disabled={!newChapter.title}>
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Arc (章) Dialog */}
      <Dialog open={showNewArc} onOpenChange={setShowNewArc}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>章を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>章タイトル</Label>
              <Input
                value={newArc.title}
                onChange={(e) => setNewArc({ ...newArc, title: e.target.value })}
                placeholder="冒険の始まり"
              />
            </div>
            <div>
              <Label>概要（任意）</Label>
              <Textarea
                value={newArc.description}
                onChange={(e) => setNewArc({ ...newArc, description: e.target.value })}
                rows={2}
                placeholder="この章の概要..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewArc(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateArc} disabled={!newArc.title}>
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Arc Dialog */}
      <Dialog open={!!editingArc} onOpenChange={(open) => !open && setEditingArc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>章を編集</DialogTitle>
          </DialogHeader>
          {editingArc && (
            <div className="space-y-4">
              <div>
                <Label>章タイトル</Label>
                <Input
                  value={editingArc.title}
                  onChange={(e) => setEditingArc({ ...editingArc, title: e.target.value })}
                />
              </div>
              <div>
                <Label>概要</Label>
                <Textarea
                  value={editingArc.description || ""}
                  onChange={(e) => setEditingArc({ ...editingArc, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingArc(null)}>
              キャンセル
            </Button>
            <Button onClick={handleUpdateArc} disabled={!editingArc?.title}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Execution Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>タスクを実行</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>エージェント</Label>
              <Select
                value={taskConfig.agentType}
                onValueChange={(v) => setTaskConfig({ ...taskConfig, agentType: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AGENT_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label.ja}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>タスクタイプ</Label>
              <Select
                value={taskConfig.taskType}
                onValueChange={(v) => setTaskConfig({ ...taskConfig, taskType: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="write">執筆</SelectItem>
                  <SelectItem value="edit">編集</SelectItem>
                  <SelectItem value="review">レビュー</SelectItem>
                  <SelectItem value="outline">アウトライン</SelectItem>
                  <SelectItem value="check">整合性チェック</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>対象話（任意）</Label>
              <Select
                value={taskConfig.chapterId}
                onValueChange={(v) => setTaskConfig({ ...taskConfig, chapterId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="話を選択..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">なし（プロジェクト全体）</SelectItem>
                  {chapters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      第{c.chapterNumber}話 {c.title || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleStartTask}>
              <Play className="mr-1.5 h-3.5 w-3.5" />
              実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chapter Editor Dialog */}
      <Dialog open={!!selectedChapter} onOpenChange={(open) => !open && setSelectedChapter(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
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
