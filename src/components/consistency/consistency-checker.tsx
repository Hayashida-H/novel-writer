"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShieldCheck,
  Sparkles,
  Loader2,
  Copy,
  Check,
  BookMarked,
  Square,
} from "lucide-react";
import { useSSEGeneration } from "@/hooks/use-sse-generation";
import { ConsistencyResultDisplay } from "@/components/consistency/consistency-result-display";
import { parseConsistencyResult, type ConsistencyResult } from "@/lib/agents/consistency-parser";

interface ChapterItem {
  id: string;
  chapterNumber: number;
  title: string | null;
  content: string | null;
  wordCount: number | null;
  status: string;
}

interface ForeshadowingItem {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  plantedContext: string | null;
  targetChapter: number | null;
}

interface NarouKeyword {
  keyword: string;
  category: string;
  reason: string;
}

const STATUS_LABELS: Record<string, string> = {
  planted: "設置済み",
  hinted: "示唆済み",
  partially_resolved: "部分的に回収",
  resolved: "回収済み",
  abandoned: "放棄",
};

const STATUS_COLORS: Record<string, string> = {
  planted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  hinted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  partially_resolved: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  abandoned: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const KEYWORD_CATEGORY_COLORS: Record<string, string> = {
  "ジャンル": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "テーマ": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "設定": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "読者層": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "要素": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

interface ConsistencyCheckerProps {
  projectId: string;
}

export function ConsistencyChecker({ projectId }: ConsistencyCheckerProps) {
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [foreshadowingItems, setForeshadowingItems] = useState<ForeshadowingItem[]>([]);
  const [foreshadowingFilter, setForeshadowingFilter] = useState<string>("active");
  const [keywords, setKeywords] = useState<NarouKeyword[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<ConsistencyResult | null>(null);
  const [checkAgentStatus, setCheckAgentStatus] = useState<"idle" | "running" | "completed">("idle");
  const abortControllerRef = useRef<AbortController | null>(null);

  const { generate: generateKeywords, isGenerating: isGeneratingKeywords } =
    useSSEGeneration<NarouKeyword>({
      endpoint: "/api/generate/narou-keywords",
      onItems: (items) => setKeywords(items),
    });

  useEffect(() => {
    async function load() {
      try {
        const [chapRes, fsRes] = await Promise.all([
          fetch(`/api/chapters?projectId=${projectId}`),
          fetch(`/api/foreshadowing?projectId=${projectId}`),
        ]);
        if (chapRes.ok) {
          const allChapters: ChapterItem[] = await chapRes.json();
          setChapters(allChapters);
          // Pre-select all chapters that have content
          const withContent = allChapters.filter((c) => c.content);
          setSelectedChapterIds(new Set(withContent.map((c) => c.id)));
        }
        if (fsRes.ok) setForeshadowingItems(await fsRes.json());
      } catch (error) {
        console.error("Failed to load:", error);
      }
    }
    load();
  }, [projectId]);

  const writtenChapters = chapters.filter((c) => c.content);

  const toggleChapter = useCallback((chapterId: string) => {
    setSelectedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedChapterIds.size === writtenChapters.length) {
      setSelectedChapterIds(new Set());
    } else {
      setSelectedChapterIds(new Set(writtenChapters.map((c) => c.id)));
    }
  }, [selectedChapterIds.size, writtenChapters]);

  const handleConsistencyCheck = useCallback(async () => {
    setIsChecking(true);
    setCheckResult(null);
    setCheckAgentStatus("idle");

    // Build chapter content for the check message
    const selectedChapters = chapters
      .filter((c) => selectedChapterIds.has(c.id) && c.content)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    if (selectedChapters.length === 0) {
      setCheckResult({
        overallConsistency: "medium",
        issues: [{ severity: "info", category: "system", description: "チェック対象の執筆済み章がありません。" }],
        foreshadowingUpdates: [],
        newCharacters: [],
        newWorldSettings: [],
      });
      setIsChecking(false);
      return;
    }

    // Include chapter content (truncate each to 4000 chars to avoid token limits)
    const chapterTexts = selectedChapters
      .map((c) => {
        const content = c.content!.length > 4000
          ? c.content!.slice(0, 4000) + "\n\n…（以降省略）"
          : c.content!;
        return `### 第${c.chapterNumber}話「${c.title || "無題"}」\n${content}`;
      })
      .join("\n\n---\n\n");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/agents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          mode: "custom",
          formatOptions: {
            includePlotPoints: false,
            includeStyleReferences: false,
            includeChapterSummaries: false,
            includeChapterSynopses: false,
          },
          customSteps: [
            {
              agentType: "continuity_checker",
              taskType: "content_check",
              description: "執筆済み本文の整合性チェック",
              messages: [
                {
                  role: "user",
                  content: `以下の執筆済み本文の整合性をチェックしてください。

チェック観点:
- キャラクターの言動・性格の一貫性（章間で矛盾がないか）
- タイムラインの整合性（時間経過、季節、天候）
- 場所・設定描写の一貫性
- 能力・スキル設定の矛盾
- 章間のストーリーの繋がり（前話の終わりと次話の始まりが自然か）
- 伏線の設置・回収状況

以下が対象の本文です:

${chapterTexts}`,
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
      let agentContent = "";
      let fullStreamText = "";
      let resultSet = false;

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
            if (event.type === "agent_start") {
              setCheckAgentStatus("running");
            } else if (event.type === "agent_stream" && event.text) {
              fullStreamText += event.text;
            } else if (event.type === "agent_complete" && event.output?.content) {
              agentContent = event.output.content;
              setCheckAgentStatus("completed");
            } else if (event.type === "pipeline_complete") {
              const content = agentContent || fullStreamText;
              if (content) {
                setCheckResult(parseConsistencyResult(content));
                resultSet = true;
              }
            } else if (event.type === "error") {
              throw new Error(event.message || "チェック中にエラーが発生しました");
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }

      // Fallback: if stream ended without pipeline_complete (e.g. timeout)
      if (!resultSet) {
        const content = agentContent || fullStreamText;
        if (content) {
          setCheckResult(parseConsistencyResult(content));
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // User cancelled
      } else {
        console.error("Consistency check error:", error);
        setCheckResult({
          overallConsistency: "low",
          issues: [
            {
              severity: "error",
              category: "system",
              description: error instanceof Error ? error.message : "整合性チェックに失敗しました",
            },
          ],
          foreshadowingUpdates: [],
          newCharacters: [],
          newWorldSettings: [],
        });
      }
    } finally {
      setIsChecking(false);
      setCheckAgentStatus("idle");
      abortControllerRef.current = null;
    }
  }, [projectId, chapters, selectedChapterIds]);

  const handleCancelCheck = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleCopyAllKeywords = useCallback(() => {
    const text = keywords.map((k) => k.keyword).join(" ");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [keywords]);

  const filteredForeshadowing =
    foreshadowingFilter === "active"
      ? foreshadowingItems.filter((f) =>
          ["planted", "hinted", "partially_resolved"].includes(f.status)
        )
      : foreshadowingFilter === "all"
        ? foreshadowingItems
        : foreshadowingItems.filter((f) => f.status === foreshadowingFilter);

  const activeFsCount = foreshadowingItems.filter((f) =>
    ["planted", "hinted", "partially_resolved"].includes(f.status)
  ).length;

  return (
    <div className="space-y-6">
      {/* Chapter Selection */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            本文 整合性チェック
          </CardTitle>
          <div className="flex gap-2">
            {isChecking && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelCheck}
                title="チェックを停止"
              >
                <Square className="mr-1.5 h-3.5 w-3.5" />
                停止
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleConsistencyCheck}
              disabled={isChecking || selectedChapterIds.size === 0}
            >
              {isChecking ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isChecking ? "チェック中..." : "チェック実行"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chapter selection */}
          {writtenChapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              執筆済みの章がありません。執筆ページで章を書いてからチェックしてください。
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  チェック対象の章を選択してください（{selectedChapterIds.size}/{writtenChapters.length}話選択中）
                </p>
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={toggleAll}>
                  {selectedChapterIds.size === writtenChapters.length ? "全解除" : "全選択"}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {writtenChapters.map((ch) => (
                  <label
                    key={ch.id}
                    className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm cursor-pointer hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={selectedChapterIds.has(ch.id)}
                      onCheckedChange={() => toggleChapter(ch.id)}
                    />
                    <span className="flex-1 truncate">
                      第{ch.chapterNumber}話: {ch.title || "無題"}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(ch.wordCount || 0).toLocaleString()}字
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Check Status / Result */}
          {isChecking ? (
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-6 w-7 items-center justify-center rounded text-[10px] font-bold ${
                  checkAgentStatus === "completed"
                    ? "bg-green-200 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : checkAgentStatus === "running"
                      ? "bg-blue-200 text-blue-700 dark:bg-blue-900 dark:text-blue-300 animate-pulse"
                      : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                }`}
                title="整合性チェック"
              >
                Cc
              </span>
              <span className="text-sm text-muted-foreground">
                {checkAgentStatus === "running"
                  ? "整合性エージェントが本文をチェック中..."
                  : checkAgentStatus === "completed"
                    ? "結果を解析中..."
                    : "準備中..."}
              </span>
            </div>
          ) : (
            <ConsistencyResultDisplay
              result={checkResult}
              isChecking={false}
              streamingText=""
              emptyMessage="執筆済みの章の本文内容をAIがチェックします。キャラクターの一貫性、タイムライン、設定の整合性を確認します。"
            />
          )}
        </CardContent>
      </Card>

      {/* Foreshadowing Summary Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookMarked className="h-4 w-4" />
            伏線サマリー
            {activeFsCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                未回収: {activeFsCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            {["active", "all", "resolved", "abandoned"].map((filter) => (
              <Button
                key={filter}
                variant={foreshadowingFilter === filter ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setForeshadowingFilter(filter)}
              >
                {filter === "active"
                  ? "未回収"
                  : filter === "all"
                    ? "全て"
                    : filter === "resolved"
                      ? "回収済み"
                      : "放棄"}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {foreshadowingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">伏線がまだ登録されていません。</p>
          ) : filteredForeshadowing.length === 0 ? (
            <p className="text-sm text-muted-foreground">該当する伏線がありません。</p>
          ) : (
            <div className="space-y-2">
              {filteredForeshadowing.map((item) => (
                <div key={item.id} className="rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[item.status] || ""}`}
                    >
                      {STATUS_LABELS[item.status] || item.status}
                    </Badge>
                    {item.targetChapter && (
                      <span className="text-xs text-muted-foreground">
                        回収予定: 第{item.targetChapter}章
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  {item.plantedContext && (
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      設置文脈: {item.plantedContext}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Narou Keywords Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            なろう・カクヨム キーワード
          </CardTitle>
          <div className="flex gap-2">
            {keywords.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleCopyAllKeywords}>
                {copiedAll ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                {copiedAll ? "コピー済み" : "全てコピー"}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => generateKeywords(projectId)}
              disabled={isGeneratingKeywords}
            >
              {isGeneratingKeywords ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isGeneratingKeywords ? "生成中..." : "キーワード生成"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {keywords.length === 0 && !isGeneratingKeywords ? (
            <p className="text-sm text-muted-foreground">
              プロジェクトの内容からなろう・カクヨム向けのキーワード・タグを自動生成します。
            </p>
          ) : isGeneratingKeywords ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              キーワードを生成しています...
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(
                keywords.reduce<Record<string, NarouKeyword[]>>((acc, kw) => {
                  const cat = kw.category || "その他";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(kw);
                  return acc;
                }, {})
              ).map(([category, items]) => (
                <div key={category}>
                  <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">
                    {category}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((kw, i) => (
                      <button
                        key={i}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${
                          KEYWORD_CATEGORY_COLORS[category] ||
                          "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}
                        title={kw.reason}
                        onClick={() => {
                          navigator.clipboard.writeText(kw.keyword);
                        }}
                      >
                        {kw.keyword}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
