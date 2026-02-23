"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { PlotCandidateCard } from "@/components/suggestions/plot-candidate-card";
import { GenreSelector } from "@/components/genre/genre-selector";
import type { PlotCandidate } from "@/types/plot-suggestion";

export default function SuggestionsPage() {
  const router = useRouter();
  const [genre, setGenre] = useState<string>("");
  const [preferences, setPreferences] = useState("");
  const [homage, setHomage] = useState("");
  const [candidates, setCandidates] = useState<PlotCandidate[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSuggestions = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setCandidates([]);

    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: genre || undefined,
          preferences: preferences || undefined,
          homage: homage || undefined,
          count: 3,
        }),
      });

      if (!res.ok) throw new Error("API request failed");
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
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "done" && event.candidates) {
              setCandidates(event.candidates);
            } else if (event.type === "error") {
              setError(event.message);
            }
          } catch {
            // ignore parse errors for partial chunks
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  }, [genre, preferences, homage]);

  function handleSelect(candidate: PlotCandidate) {
    sessionStorage.setItem("plot-suggestion", JSON.stringify(candidate));
    router.push("/projects/new?from=suggestion");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <Link
          href="/projects/new"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          手動で作成する
        </Link>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              プロット候補を生成
            </CardTitle>
            <CardDescription>
              AIが面白そうなプロット候補を提案します。ジャンルや好みを指定するとより的確な提案になります。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>ジャンル（任意）</Label>
                <GenreSelector
                  value={genre}
                  onValueChange={setGenre}
                  placeholder="指定なし（おまかせ）"
                />
              </div>

              <div className="space-y-2">
                <Label>好み・希望（任意）</Label>
                <Textarea
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="例：切ない結末、群像劇、異世界転生なし..."
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>オマージュしたい逸話・歴史・物語・武器（任意）</Label>
              <Textarea
                value={homage}
                onChange={(e) => setHomage(e.target.value)}
                placeholder="例：三国志の赤壁の戦い、アーサー王伝説、エクスカリバーなど"
                rows={2}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={generateSuggestions}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : candidates.length > 0 ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    再生成
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    提案を生成
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {isGenerating && (
          <div className="mb-6 flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              プロット候補を考えています...
            </p>
          </div>
        )}

        {candidates.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {candidates.map((candidate) => (
              <PlotCandidateCard
                key={candidate.id}
                candidate={candidate}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
