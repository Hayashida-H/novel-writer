"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Plus,
  FileText,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  ShieldCheck,
  Square,
} from "lucide-react";
import { ConsistencyResultDisplay } from "@/components/consistency/consistency-result-display";
import { parseConsistencyResult, type ConsistencyResult } from "@/lib/agents/consistency-parser";

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
  wordCount: number | null;
  status: string;
  arcId: string | null;
}

interface StructureEditorProps {
  projectId: string;
}

export function StructureEditor({ projectId }: StructureEditorProps) {
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [arcs, setArcs] = useState<ArcItem[]>([]);
  const [showNewChapter, setShowNewChapter] = useState(false);
  const [newChapter, setNewChapter] = useState({ title: "", synopsis: "", arcId: "" });
  const [showNewArc, setShowNewArc] = useState(false);
  const [newArc, setNewArc] = useState({ title: "", description: "" });
  const [editingArc, setEditingArc] = useState<ArcItem | null>(null);
  const [editingChapter, setEditingChapter] = useState<ChapterItem | null>(null);
  const [collapsedArcs, setCollapsedArcs] = useState<Set<string>>(new Set());
  const [isCreatingChapters, setIsCreatingChapters] = useState(false);
  const [generatingArcId, setGeneratingArcId] = useState<string | null>(null);
  const [isStructureChecking, setIsStructureChecking] = useState(false);
  const [structureCheckResult, setStructureCheckResult] = useState<ConsistencyResult | null>(null);
  const [fixSummary, setFixSummary] = useState("");
  const [agentStatuses, setAgentStatuses] = useState<Record<string, "idle" | "running" | "completed">>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [chapRes, arcRes] = await Promise.all([
          fetch(`/api/chapters?projectId=${projectId}`),
          fetch(`/api/arcs?projectId=${projectId}`),
        ]);
        if (chapRes.ok) setChapters(await chapRes.json());
        if (arcRes.ok) setArcs(await arcRes.json());
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
        body: JSON.stringify({ projectId, title: newArc.title, description: newArc.description || null }),
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
        body: JSON.stringify({ id: editingArc.id, title: editingArc.title, description: editingArc.description }),
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

  const handleDeleteChapter = useCallback(async (chapterId: string) => {
    try {
      const res = await fetch(`/api/chapters?id=${chapterId}`, { method: "DELETE" });
      if (res.ok) {
        setChapters((prev) => prev.filter((c) => c.id !== chapterId));
      }
    } catch (error) {
      console.error("Failed to delete chapter:", error);
    }
  }, []);

  const handleUpdateChapter = useCallback(async () => {
    if (!editingChapter) return;
    try {
      const res = await fetch("/api/chapters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingChapter.id,
          title: editingChapter.title,
          synopsis: editingChapter.synopsis,
          arcId: editingChapter.arcId || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setChapters((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
        setEditingChapter(null);
      }
    } catch (error) {
      console.error("Failed to update chapter:", error);
    }
  }, [editingChapter]);

  const toggleArcCollapse = useCallback((arcId: string) => {
    setCollapsedArcs((prev) => {
      const next = new Set(prev);
      if (next.has(arcId)) next.delete(arcId);
      else next.add(arcId);
      return next;
    });
  }, []);

  // AI arc generation from plot (SSE)
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

  // Episode generation per arc (SSE)
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

  // Structure-level consistency check + plot fix (2-step pipeline)
  const handleStructureCheck = useCallback(async () => {
    setIsStructureChecking(true);
    setStructureCheckResult(null);
    setFixSummary("");
    setAgentStatuses({ continuity_checker: "idle", fixer: "idle" });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build current synopsis list for plot_architect
    const synopsisParts: string[] = [];
    const sortedArcs = [...arcs].sort((a, b) => a.arcNumber - b.arcNumber);
    for (const arc of sortedArcs) {
      const arcChapters = chapters
        .filter((c) => c.arcId === arc.id)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
      const chLines = arcChapters
        .map((c) => `- 第${c.chapterNumber}話「${c.title || "無題"}」: ${c.synopsis || "あらすじなし"}`)
        .join("\n");
      synopsisParts.push(`## 第${arc.arcNumber}章「${arc.title}」\n${arc.description || ""}\n${chLines}`);
    }
    const unassigned = chapters.filter((c) => !c.arcId).sort((a, b) => a.chapterNumber - b.chapterNumber);
    if (unassigned.length > 0) {
      const lines = unassigned
        .map((c) => `- 第${c.chapterNumber}話「${c.title || "無題"}」: ${c.synopsis || "あらすじなし"}`)
        .join("\n");
      synopsisParts.push(`## 未分類\n${lines}`);
    }
    const synopsisInfo = synopsisParts.join("\n\n");

    try {
      const res = await fetch("/api/agents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          mode: "custom",
          customSteps: [
            {
              agentType: "continuity_checker",
              taskType: "structure_check",
              description: "構成の整合性チェック",
              messages: [
                {
                  role: "user",
                  content: `プロジェクトの構成（章立て・各話のあらすじ）の整合性をチェックしてください。
以下の観点で確認してください（本文の校正ではなく構成レベルのチェックです）:
1. ストーリーフロー: 章間の展開が論理的に繋がっているか
2. キャラクターアーク: 登場・退場・成長のタイミング
3. 伏線の構造: 設置と回収のタイミング、残り章数での処理可能性
4. 章のバランス: 各章の目的の明確さ

以下が現在の章・話の構成です（これが正式なあらすじです。コンテキスト情報の「これまでの話」は執筆後の要約なので、未執筆の話は「要約なし」になっています。こちらを優先してください）:

${synopsisInfo}`,
                },
              ],
            },
            {
              agentType: "fixer",
              taskType: "structure_fix",
              description: "構成チェックに基づく修正",
              dependsOn: [0],
              messages: [
                {
                  role: "user",
                  content: `前ステップの構成チェック結果に基づいて、指摘された問題を修正してください。

現在の構成:
${synopsisInfo}

修正対象:
- あらすじの修正・作成（欠落している話、矛盾がある話）
- 伏線エントリの追加（不足が指摘された場合）
- キャラクター設定の補足（成長アークが不明確な場合）
- 修正不要な箇所はスキップしてください

以下のJSON形式のみを出力してください。他のテキストは含めないでください:
{
  "synopsisRevisions": [
    { "chapterNumber": 話番号, "synopsis": "修正後のあらすじ" }
  ],
  "newForeshadowing": [
    { "title": "伏線タイトル", "description": "説明", "targetChapter": 回収予定話番号, "priority": "high | medium | low" }
  ],
  "characterUpdates": [
    { "name": "キャラ名", "field": "arcDescription | goals | backstory", "value": "更新内容" }
  ],
  "changesSummary": "変更内容の要約"
}`,
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Check failed");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let checkContent = "";
      let fixerContent = "";

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
            if (event.type === "agent_start" && event.agentType) {
              setAgentStatuses((prev) => ({ ...prev, [event.agentType]: "running" }));
            } else if (event.type === "agent_complete" && event.agentType && event.output?.content) {
              setAgentStatuses((prev) => ({ ...prev, [event.agentType]: "completed" }));
              if (event.agentType === "continuity_checker") {
                checkContent = event.output.content;
              } else if (event.agentType === "fixer") {
                fixerContent = event.output.content;
              }
            } else if (event.type === "error") {
              throw new Error(event.message || "チェック中にエラーが発生しました");
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }

      // Parse check results
      if (checkContent) {
        setStructureCheckResult(parseConsistencyResult(checkContent));
      }

      // Parse and apply fixer output
      if (fixerContent) {
        try {
          const jsonMatch = fixerContent.match(/\{[\s\S]*"synopsisRevisions"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const summaryParts: string[] = [];

            // 1. Apply synopsis revisions
            if (parsed.synopsisRevisions && Array.isArray(parsed.synopsisRevisions)) {
              let synopsisCount = 0;
              for (const rev of parsed.synopsisRevisions) {
                const chapter = chapters.find((c) => c.chapterNumber === rev.chapterNumber);
                if (chapter && rev.synopsis) {
                  const updateRes = await fetch("/api/chapters", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: chapter.id, synopsis: rev.synopsis }),
                  });
                  if (updateRes.ok) synopsisCount++;
                }
              }
              if (synopsisCount > 0) summaryParts.push(`${synopsisCount}話のあらすじを修正`);
            }

            // 2. Create new foreshadowing entries
            if (parsed.newForeshadowing && Array.isArray(parsed.newForeshadowing)) {
              let fsCount = 0;
              for (const fs of parsed.newForeshadowing) {
                if (fs.title && fs.description) {
                  const fsRes = await fetch("/api/foreshadowing", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      projectId,
                      title: fs.title,
                      description: fs.description,
                      targetChapter: fs.targetChapter || null,
                      priority: fs.priority || "medium",
                    }),
                  });
                  if (fsRes.ok) fsCount++;
                }
              }
              if (fsCount > 0) summaryParts.push(`${fsCount}件の伏線を追加`);
            }

            // 3. Update character settings
            if (parsed.characterUpdates && Array.isArray(parsed.characterUpdates)) {
              let charCount = 0;
              // Fetch current characters to find IDs by name
              const charRes = await fetch(`/api/characters?projectId=${projectId}`);
              if (charRes.ok) {
                const existingChars = await charRes.json();
                for (const update of parsed.characterUpdates) {
                  const char = existingChars.find((c: { name: string }) => c.name === update.name);
                  if (char && update.field && update.value) {
                    const updateRes = await fetch("/api/characters", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: char.id, [update.field]: update.value }),
                    });
                    if (updateRes.ok) charCount++;
                  }
                }
              }
              if (charCount > 0) summaryParts.push(`${charCount}件のキャラクター設定を更新`);
            }

            // Refresh chapters
            const chapRes = await fetch(`/api/chapters?projectId=${projectId}`);
            if (chapRes.ok) setChapters(await chapRes.json());

            const detail = summaryParts.length > 0 ? summaryParts.join("、") : "修正なし";
            setFixSummary(
              parsed.changesSummary
                ? `${parsed.changesSummary}（${detail}）`
                : detail
            );
          }
        } catch (e) {
          console.error("Failed to apply fixes:", e);
          setFixSummary("自動修正に失敗しました。チェック結果を参考に手動で修正してください。");
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // User cancelled
      } else {
        console.error("Structure check error:", error);
        setStructureCheckResult({
          overallConsistency: "low",
          issues: [
            {
              severity: "error",
              category: "system",
              description: error instanceof Error ? error.message : "構成チェックに失敗しました",
            },
          ],
          foreshadowingUpdates: [],
          newCharacters: [],
          newWorldSettings: [],
        });
      }
    } finally {
      setIsStructureChecking(false);
      setAgentStatuses({});
      abortControllerRef.current = null;
    }
  }, [projectId, arcs, chapters]);

  const handleCancelStructureCheck = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);

  const STATUS_LABELS: Record<string, string> = {
    outlined: "アウトライン",
    drafting: "下書き中",
    draft: "下書き",
    editing: "編集中",
    reviewed: "レビュー済",
    final: "最終版",
  };

  const renderChapterRow = (chapter: ChapterItem) => (
    <div key={chapter.id} className="rounded-lg border px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
          {chapter.chapterNumber}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{chapter.title || `第${chapter.chapterNumber}話`}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{(chapter.wordCount || 0).toLocaleString()}字</span>
        <span className="shrink-0 text-xs text-muted-foreground">{STATUS_LABELS[chapter.status] || chapter.status}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setEditingChapter(chapter)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-destructive"
          onClick={() => handleDeleteChapter(chapter.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {chapter.synopsis && (
        <p className="mt-1 ml-9 text-xs text-muted-foreground whitespace-pre-wrap">{chapter.synopsis}</p>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{arcs.length}</div>
              <p className="text-xs text-muted-foreground">章</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{chapters.length}</div>
              <p className="text-xs text-muted-foreground">話</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{totalWords.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">総文字数</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
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
            onClick={handleStructureCheck}
            disabled={isStructureChecking || (arcs.length === 0 && chapters.length === 0)}
          >
            {isStructureChecking ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isStructureChecking ? "チェック中..." : "構成チェック"}
          </Button>
        </div>

        {/* Structure Check Result */}
        {(isStructureChecking || structureCheckResult || fixSummary) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                構成チェック{fixSummary ? " & 修正" : ""}結果
              </CardTitle>
              {isStructureChecking && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelStructureCheck}
                  title="チェックを停止"
                >
                  <Square className="mr-1.5 h-3.5 w-3.5" />
                  停止
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isStructureChecking ? (
                <div className="space-y-3">
                  {/* Agent icons */}
                  <div className="flex items-center gap-3">
                    {[
                      { key: "continuity_checker", abbrev: "Cc", label: "整合性チェック" },
                      { key: "fixer", abbrev: "Fx", label: "修正担当" },
                    ].map(({ key, abbrev, label }) => {
                      const status = agentStatuses[key] || "idle";
                      const colorClass =
                        status === "completed"
                          ? "bg-green-200 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : status === "running"
                            ? "bg-blue-200 text-blue-700 dark:bg-blue-900 dark:text-blue-300 animate-pulse"
                            : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
                      return (
                        <span
                          key={key}
                          className={`inline-flex h-6 w-7 items-center justify-center rounded text-[10px] font-bold ${colorClass}`}
                          title={label}
                        >
                          {abbrev}
                        </span>
                      );
                    })}
                    <span className="text-sm text-muted-foreground">
                      {agentStatuses.fixer === "running"
                        ? "修正担当が対応中..."
                        : agentStatuses.fixer === "completed"
                          ? "修正を保存中..."
                          : agentStatuses.continuity_checker === "running"
                            ? "整合性をチェック中..."
                            : agentStatuses.continuity_checker === "completed"
                              ? "チェック完了、修正を開始..."
                              : "準備中..."}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <ConsistencyResultDisplay
                    result={structureCheckResult}
                    isChecking={false}
                    streamingText=""
                  />
                  {fixSummary && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        修正担当による対応
                      </p>
                      <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                        {fixSummary}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Structure List */}
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
                      className="rounded-lg border bg-muted/50 px-3 py-2 cursor-pointer"
                      onClick={() => toggleArcCollapse(arc.id)}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="text-sm font-semibold">
                          第{arc.arcNumber}章: {arc.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({arcChapters.length}話 / {arcWords.toLocaleString()}字)
                        </span>
                        <div className="ml-auto flex gap-1">
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
                      {arc.description && (
                        <p className="mt-1 ml-6 text-xs text-muted-foreground whitespace-pre-wrap">{arc.description}</p>
                      )}
                    </div>
                    {!isCollapsed && (
                      <div className="ml-4 mt-1 space-y-1">
                        {arcChapters.length === 0 ? (
                          <p className="py-2 text-xs text-muted-foreground">
                            話なし — Sparkles ボタンで話を生成
                          </p>
                        ) : (
                          arcChapters.map((chapter) => renderChapterRow(chapter))
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
                      {unassigned.map((chapter) => renderChapterRow(chapter))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showNewChapter} onOpenChange={setShowNewChapter}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>話を追加</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>タイトル</Label>
              <Input value={newChapter.title} onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })} placeholder="出発の朝" />
            </div>
            <div>
              <Label>あらすじ</Label>
              <Textarea value={newChapter.synopsis} onChange={(e) => setNewChapter({ ...newChapter, synopsis: e.target.value })} rows={3} placeholder="この話で起こる出来事..." />
            </div>
            {arcs.length > 0 && (
              <div>
                <Label>所属する章（任意）</Label>
                <Select value={newChapter.arcId || "__none__"} onValueChange={(v) => setNewChapter({ ...newChapter, arcId: v === "__none__" ? "" : v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="未分類" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">未分類</SelectItem>
                    {arcs.map((a) => (
                      <SelectItem key={a.id} value={a.id}>第{a.arcNumber}章: {a.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChapter(false)}>キャンセル</Button>
            <Button onClick={handleCreateChapter} disabled={!newChapter.title}>追加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewArc} onOpenChange={setShowNewArc}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>章を追加</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>章タイトル</Label>
              <Input value={newArc.title} onChange={(e) => setNewArc({ ...newArc, title: e.target.value })} placeholder="冒険の始まり" />
            </div>
            <div>
              <Label>概要（任意）</Label>
              <Textarea value={newArc.description} onChange={(e) => setNewArc({ ...newArc, description: e.target.value })} rows={2} placeholder="この章の概要..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewArc(false)}>キャンセル</Button>
            <Button onClick={handleCreateArc} disabled={!newArc.title}>追加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingArc} onOpenChange={(open) => !open && setEditingArc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>章を編集</DialogTitle></DialogHeader>
          {editingArc && (
            <div className="space-y-4">
              <div>
                <Label>章タイトル</Label>
                <Input value={editingArc.title} onChange={(e) => setEditingArc({ ...editingArc, title: e.target.value })} />
              </div>
              <div>
                <Label>概要</Label>
                <Textarea value={editingArc.description || ""} onChange={(e) => setEditingArc({ ...editingArc, description: e.target.value })} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingArc(null)}>キャンセル</Button>
            <Button onClick={handleUpdateArc} disabled={!editingArc?.title}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingChapter} onOpenChange={(open) => !open && setEditingChapter(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>話を編集</DialogTitle></DialogHeader>
          {editingChapter && (
            <div className="space-y-4">
              <div>
                <Label>タイトル</Label>
                <Input
                  value={editingChapter.title || ""}
                  onChange={(e) => setEditingChapter({ ...editingChapter, title: e.target.value })}
                  placeholder="話のタイトル"
                />
              </div>
              <div>
                <Label>あらすじ</Label>
                <Textarea
                  value={editingChapter.synopsis || ""}
                  onChange={(e) => setEditingChapter({ ...editingChapter, synopsis: e.target.value })}
                  rows={6}
                  placeholder="この話で起こる出来事..."
                />
              </div>
              {arcs.length > 0 && (
                <div>
                  <Label>所属する章</Label>
                  <Select
                    value={editingChapter.arcId || "__none__"}
                    onValueChange={(v) => setEditingChapter({ ...editingChapter, arcId: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">未分類</SelectItem>
                      {arcs.map((a) => (
                        <SelectItem key={a.id} value={a.id}>第{a.arcNumber}章: {a.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingChapter(null)}>キャンセル</Button>
            <Button onClick={handleUpdateChapter}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
