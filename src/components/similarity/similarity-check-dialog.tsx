"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ExternalLink } from "lucide-react";

interface SimilarWork {
  title: string;
  author?: string;
  url?: string;
  similarity: "high" | "medium" | "low";
  similarPoints: string;
  differencePoints: string;
}

interface SimilarityResult {
  similarWorks: SimilarWork[];
  overallAssessment: string;
  uniqueElements: string[];
}

interface SimilarityCheckInput {
  synopsis: string;
  genre?: string;
  themes?: string[];
  plotPoints?: { act: string; title: string; description: string }[];
}

interface SimilarityCheckDialogProps {
  input: SimilarityCheckInput;
  trigger?: React.ReactNode;
}

const SIMILARITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const SIMILARITY_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export function SimilarityCheckDialog({ input, trigger }: SimilarityCheckDialogProps) {
  const [open, setOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<SimilarityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/similarity-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) throw new Error("API request failed");

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "チェックに失敗しました");
    } finally {
      setIsChecking(false);
    }
  }, [input]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    if (!result && !isChecking) {
      handleCheck();
    }
  }, [result, isChecking, handleCheck]);

  return (
    <>
      {trigger ? (
        <div onClick={handleOpen}>{trigger}</div>
      ) : (
        <Button variant="outline" size="sm" onClick={handleOpen} disabled={!input.synopsis}>
          <Search className="mr-1.5 h-3.5 w-3.5" />
          類似チェック
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              類似作品チェック
            </DialogTitle>
          </DialogHeader>

          {isChecking && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">類似作品を調べています...</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={handleCheck}>
                再試行
              </Button>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              {/* Similar Works */}
              {result.similarWorks.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">類似作品</h4>
                  {result.similarWorks.map((work, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{work.title}</span>
                          {work.author && (
                            <span className="text-xs text-muted-foreground">/ {work.author}</span>
                          )}
                          {work.url && (
                            <a
                              href={work.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <Badge className={SIMILARITY_COLORS[work.similarity] || ""}>
                          類似度: {SIMILARITY_LABELS[work.similarity] || work.similarity}
                        </Badge>
                      </div>
                      <div className="text-xs space-y-1">
                        <p>
                          <span className="font-medium text-amber-600 dark:text-amber-400">類似点: </span>
                          {work.similarPoints}
                        </p>
                        <p>
                          <span className="font-medium text-green-600 dark:text-green-400">差別化: </span>
                          {work.differencePoints}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  顕著に類似する作品は見つかりませんでした
                </div>
              )}

              {/* Unique Elements */}
              {result.uniqueElements && result.uniqueElements.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">独自性のある要素</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.uniqueElements.map((elem, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {elem}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Overall Assessment */}
              {result.overallAssessment && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <h4 className="mb-1 text-sm font-medium">総合評価</h4>
                  <p className="text-xs text-muted-foreground">{result.overallAssessment}</p>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleCheck} disabled={isChecking}>
                  {isChecking ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  再チェック
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
