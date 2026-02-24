"use client";

import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
} from "lucide-react";
import type { ConsistencyResult } from "@/lib/agents/consistency-parser";

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

interface ConsistencyResultDisplayProps {
  result: ConsistencyResult | null;
  isChecking: boolean;
  streamingText: string;
  emptyMessage?: string;
}

export function ConsistencyResultDisplay({
  result,
  isChecking,
  streamingText,
  emptyMessage = "チェックを実行してください。",
}: ConsistencyResultDisplayProps) {
  if (!result && !isChecking) {
    return (
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  if (isChecking) {
    return (
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
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-3">
      {/* Overall Consistency */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">整合性:</span>
        <Badge
          variant="outline"
          className={
            result.overallConsistency === "high"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : result.overallConsistency === "medium"
                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }
        >
          {result.overallConsistency === "high"
            ? "良好"
            : result.overallConsistency === "medium"
              ? "要注意"
              : "問題あり"}
        </Badge>
        {result.issues.length > 0 && (
          <span className="text-xs text-muted-foreground">
            （{result.issues.filter((i) => i.severity === "error").length}件のエラー、
            {result.issues.filter((i) => i.severity === "warning").length}件の警告）
          </span>
        )}
      </div>

      {/* Issues */}
      {result.issues.length > 0 && (
        <div className="space-y-2">
          {result.issues.map((issue, i) => (
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
      {result.foreshadowingUpdates.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">伏線の更新提案</h4>
          <div className="space-y-1.5">
            {result.foreshadowingUpdates.map((fu, i) => (
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
      {(result.newCharacters.length > 0 || result.newWorldSettings.length > 0) && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">新規検出</h4>
          <div className="space-y-1.5">
            {result.newCharacters.map((c, i) => (
              <div key={`char-${i}`} className="rounded border p-2 text-sm">
                <Badge variant="outline" className="text-xs mr-2">登場人物</Badge>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">({c.role})</span>
                <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
              </div>
            ))}
            {result.newWorldSettings.map((w, i) => (
              <div key={`world-${i}`} className="rounded border p-2 text-sm">
                <Badge variant="outline" className="text-xs mr-2">{w.category}</Badge>
                <span className="font-medium">{w.title}</span>
                <p className="mt-1 text-xs text-muted-foreground">{w.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.issues.length === 0 && (
        <p className="text-sm text-green-600 dark:text-green-400">
          現時点で整合性に問題は検出されませんでした。
        </p>
      )}
    </div>
  );
}
