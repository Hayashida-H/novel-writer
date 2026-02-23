"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  Copy,
  Check,
  BookMarked,
} from "lucide-react";
import { useSSEGeneration } from "@/hooks/use-sse-generation";

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

interface ConsistencyIssue {
  severity: "error" | "warning" | "info";
  category: string;
  description: string;
  location?: string;
  suggestion?: string;
}

interface ConsistencyResult {
  overallConsistency: "high" | "medium" | "low";
  issues: ConsistencyIssue[];
  foreshadowingUpdates: {
    action: string;
    title: string;
    details: string;
    suggestedStatus?: string;
  }[];
  newCharacters: { name: string; role: string; description: string }[];
  newWorldSettings: { category: string; title: string; content: string }[];
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
  const [foreshadowingItems, setForeshadowingItems] = useState<ForeshadowingItem[]>([]);
  const [foreshadowingFilter, setForeshadowingFilter] = useState<string>("active");
  const [keywords, setKeywords] = useState<NarouKeyword[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<ConsistencyResult | null>(null);

  const { generate: generateKeywords, isGenerating: isGeneratingKeywords } =
    useSSEGeneration<NarouKeyword>({
      endpoint: "/api/generate/narou-keywords",
      onItems: (items) => setKeywords(items),
    });

  useEffect(() => {
    async function loadForeshadowing() {
      try {
        const res = await fetch(`/api/foreshadowing?projectId=${projectId}`);
        if (res.ok) setForeshadowingItems(await res.json());
      } catch (error) {
        console.error("Failed to load foreshadowing:", error);
      }
    }
    loadForeshadowing();
  }, [projectId]);

  const [streamingText, setStreamingText] = useState("");

  const handleConsistencyCheck = useCallback(async () => {
    setIsChecking(true);
    setCheckResult(null);
    setStreamingText("");
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
              taskType: "check",
              description: "プロジェクト全体の整合性チェック",
              messages: [
                {
                  role: "user",
                  content:
                    "プロジェクト全体の整合性チェックを実施してください。登場人物の設定矛盾、時系列の不整合、世界観の齟齬、伏線の状態を確認し、問題点をリストアップしてください。章や話がまだ完成していない場合は、現時点で存在する設定データ間の整合性をチェックしてください。",
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) throw new Error("Check failed");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let agentContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "agent_stream" && event.text) {
              setStreamingText((prev) => prev + event.text);
            } else if (event.type === "agent_complete" && event.output?.content) {
              agentContent = event.output.content;
            } else if (event.type === "pipeline_complete") {
              const result = parseConsistencyResult(agentContent);
              setCheckResult(result);
              setStreamingText("");
            } else if (event.type === "error") {
              throw new Error(event.message || "チェック中にエラーが発生しました");
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Check failed") {
              // Re-throw actual errors, ignore JSON parse errors
              if (e.message.includes("チェック") || e.message.includes("エラー")) throw e;
            }
          }
        }
      }
    } catch (error) {
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
      setStreamingText("");
    } finally {
      setIsChecking(false);
    }
  }, [projectId]);

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
      {/* Consistency Check Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            整合性チェック
          </CardTitle>
          <Button
            size="sm"
            onClick={handleConsistencyCheck}
            disabled={isChecking}
          >
            {isChecking ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isChecking ? "チェック中..." : "チェック実行"}
          </Button>
        </CardHeader>
        <CardContent>
          {!checkResult && !isChecking && (
            <p className="text-sm text-muted-foreground">
              プロジェクト全体の整合性をAIがチェックします。登場人物の設定矛盾、時系列の不整合、世界観の齟齬、伏線の状態を確認します。
            </p>
          )}
          {isChecking && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                AIが整合性をチェックしています...
              </div>
              {streamingText && (
                <div className="max-h-32 overflow-y-auto rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
                  <pre className="whitespace-pre-wrap">{streamingText.slice(-500)}</pre>
                </div>
              )}
            </div>
          )}
          {checkResult && (
            <div className="space-y-3">
              {/* Overall Consistency */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">整合性:</span>
                <Badge
                  variant="outline"
                  className={
                    checkResult.overallConsistency === "high"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : checkResult.overallConsistency === "medium"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                  }
                >
                  {checkResult.overallConsistency === "high"
                    ? "良好"
                    : checkResult.overallConsistency === "medium"
                      ? "要注意"
                      : "問題あり"}
                </Badge>
                {checkResult.issues.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    （{checkResult.issues.filter((i) => i.severity === "error").length}件のエラー、
                    {checkResult.issues.filter((i) => i.severity === "warning").length}件の警告）
                  </span>
                )}
              </div>

              {/* Issues */}
              {checkResult.issues.length > 0 && (
                <div className="space-y-2">
                  {checkResult.issues.map((issue, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
                        issue.severity === "error"
                          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                          : issue.severity === "warning"
                            ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
                            : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
                      }`}
                    >
                      {issue.severity === "error" ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      ) : issue.severity === "warning" ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                      ) : (
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {issue.category}
                          </Badge>
                          {issue.location && (
                            <span className="text-xs text-muted-foreground">{issue.location}</span>
                          )}
                        </div>
                        <p className="mt-1">{issue.description}</p>
                        {issue.suggestion && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            修正案: {issue.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Foreshadowing Updates */}
              {checkResult.foreshadowingUpdates.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">伏線の更新提案</h4>
                  <div className="space-y-1.5">
                    {checkResult.foreshadowingUpdates.map((fu, i) => (
                      <div key={i} className="rounded border p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{fu.action === "new" ? "新規" : fu.action === "status_change" ? "変更" : "警告"}</Badge>
                          <span className="font-medium">{fu.title}</span>
                          {fu.suggestedStatus && (
                            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[fu.suggestedStatus] || ""}`}>
                              → {STATUS_LABELS[fu.suggestedStatus] || fu.suggestedStatus}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{fu.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Characters & World Settings */}
              {(checkResult.newCharacters.length > 0 || checkResult.newWorldSettings.length > 0) && (
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">新規検出</h4>
                  <div className="space-y-1.5">
                    {checkResult.newCharacters.map((c, i) => (
                      <div key={`char-${i}`} className="rounded border p-2 text-sm">
                        <Badge variant="outline" className="text-xs mr-2">登場人物</Badge>
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({c.role})</span>
                        <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                      </div>
                    ))}
                    {checkResult.newWorldSettings.map((w, i) => (
                      <div key={`world-${i}`} className="rounded border p-2 text-sm">
                        <Badge variant="outline" className="text-xs mr-2">{w.category}</Badge>
                        <span className="font-medium">{w.title}</span>
                        <p className="mt-1 text-xs text-muted-foreground">{w.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {checkResult.issues.length === 0 && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  現時点で整合性に問題は検出されませんでした。
                </p>
              )}
            </div>
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
              {/* Group by category */}
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

function parseConsistencyResult(text: string): ConsistencyResult {
  const defaultResult: ConsistencyResult = {
    overallConsistency: "medium",
    issues: [],
    foreshadowingUpdates: [],
    newCharacters: [],
    newWorldSettings: [],
  };

  try {
    // Try to find JSON in the response (the prompt asks for JSON-only output)
    const jsonMatch = text.match(/\{[\s\S]*"continuityIssues"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        overallConsistency: parsed.overallConsistency || "medium",
        issues: (parsed.continuityIssues || []).map((issue: Record<string, string>) => ({
          severity: issue.severity || "info",
          category: issue.category || "general",
          description: issue.description || "",
          location: issue.location,
          suggestion: issue.suggestion,
        })),
        foreshadowingUpdates: parsed.foreshadowingUpdates || [],
        newCharacters: parsed.newCharacters || [],
        newWorldSettings: parsed.newWorldSettings || [],
      };
    }

    // Fallback: try parsing the whole text as JSON
    const parsed = JSON.parse(text.trim());
    if (parsed.continuityIssues) {
      return {
        overallConsistency: parsed.overallConsistency || "medium",
        issues: (parsed.continuityIssues || []).map((issue: Record<string, string>) => ({
          severity: issue.severity || "info",
          category: issue.category || "general",
          description: issue.description || "",
          location: issue.location,
          suggestion: issue.suggestion,
        })),
        foreshadowingUpdates: parsed.foreshadowingUpdates || [],
        newCharacters: parsed.newCharacters || [],
        newWorldSettings: parsed.newWorldSettings || [],
      };
    }
  } catch {
    // Fall through to text parsing
  }

  // Fallback: parse as plain text
  const lines = text.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const severity: ConsistencyIssue["severity"] =
        trimmed.includes("エラー") || trimmed.includes("重大")
          ? "error"
          : trimmed.includes("警告") || trimmed.includes("注意")
            ? "warning"
            : "info";
      defaultResult.issues.push({
        severity,
        category: "general",
        description: trimmed.slice(2),
      });
    }
  }

  // If no structured issues found, show the raw text as a single info item
  if (defaultResult.issues.length === 0 && text.trim()) {
    defaultResult.issues.push({
      severity: "info",
      category: "general",
      description: text.trim().slice(0, 1000),
    });
  }

  return defaultResult;
}
