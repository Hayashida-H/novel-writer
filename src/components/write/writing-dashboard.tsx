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
} from "lucide-react";
import { AGENT_LABELS, type AgentType } from "@/types/agent";

interface ChapterItem {
  id: string;
  chapterNumber: number;
  title: string | null;
  synopsis: string | null;
  content: string | null;
  wordCount: number | null;
  status: string;
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

interface WritingDashboardProps {
  projectId: string;
}

export function WritingDashboard({ projectId }: WritingDashboardProps) {
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<ChapterItem | null>(null);
  const [showNewChapter, setShowNewChapter] = useState(false);
  const [newChapter, setNewChapter] = useState({ title: "", synopsis: "" });
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskConfig, setTaskConfig] = useState({
    agentType: "writer" as string,
    taskType: "write",
    chapterId: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [chapRes, taskRes] = await Promise.all([
          fetch(`/api/chapters?projectId=${projectId}`),
          fetch(`/api/agent-tasks?projectId=${projectId}`),
        ]);
        if (chapRes.ok) setChapters(await chapRes.json());
        if (taskRes.ok) setTasks(await taskRes.json());
      } catch (error) {
        console.error("Failed to load:", error);
      }
    }
    load();
  }, [projectId]);

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
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setChapters((prev) => [...prev, created]);
        setNewChapter({ title: "", synopsis: "" });
        setShowNewChapter(false);
      }
    } catch (error) {
      console.error("Failed to create chapter:", error);
    }
  }, [newChapter, chapters, projectId]);

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

  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "queued");

  return (
    <>
      <div className="space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{chapters.length}</div>
              <p className="text-xs text-muted-foreground">章</p>
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
              <p className="text-xs text-muted-foreground">完了章</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowNewChapter(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            章を追加
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

        {/* Chapters List */}
        <div>
          <h3 className="mb-3 text-sm font-medium">章一覧</h3>
          {chapters.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">まだ章がありません</p>
                <p className="mt-1 text-xs">「章を追加」から始めましょう</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {chapters.map((chapter) => {
                const statusInfo = CHAPTER_STATUS_LABELS[chapter.status] || CHAPTER_STATUS_LABELS.outlined;
                return (
                  <Card
                    key={chapter.id}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() => setSelectedChapter(chapter)}
                  >
                    <CardHeader className="flex flex-row items-center gap-3 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {chapter.chapterNumber}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm">
                          {chapter.title || `第${chapter.chapterNumber}章`}
                        </CardTitle>
                        {chapter.synopsis && (
                          <CardDescription className="line-clamp-1 text-xs">
                            {chapter.synopsis}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {(chapter.wordCount || 0).toLocaleString()}字
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.ja}
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
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

      {/* New Chapter Dialog */}
      <Dialog open={showNewChapter} onOpenChange={setShowNewChapter}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>章を追加</DialogTitle>
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
                placeholder="この章で起こる出来事..."
              />
            </div>
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
              <Label>対象章（任意）</Label>
              <Select
                value={taskConfig.chapterId}
                onValueChange={(v) => setTaskConfig({ ...taskConfig, chapterId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="章を選択..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">なし（プロジェクト全体）</SelectItem>
                  {chapters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      第{c.chapterNumber}章 {c.title || ""}
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
              第{selectedChapter?.chapterNumber}章: {selectedChapter?.title || "無題"}
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
