"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { GenreSelector } from "@/components/genre/genre-selector";
import type { PlotCandidate, PlotPointSuggestion } from "@/types/plot-suggestion";

const STRUCTURE_TYPES = [
  { value: "kishotenketsu", label: "起承転結" },
  { value: "three_act", label: "三幕構成" },
  { value: "hero_journey", label: "英雄の旅" },
  { value: "serial", label: "連載" },
  { value: "custom", label: "カスタム" },
];

export default function NewProjectPage() {
  return (
    <Suspense>
      <NewProjectForm />
    </Suspense>
  );
}

function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [structureType, setStructureType] = useState("kishotenketsu");
  const [plotPoints, setPlotPoints] = useState<PlotPointSuggestion[]>([]);
  const [fromSuggestion, setFromSuggestion] = useState(false);

  useEffect(() => {
    if (searchParams.get("from") === "suggestion") {
      const stored = sessionStorage.getItem("plot-suggestion");
      if (stored) {
        try {
          const candidate: PlotCandidate = JSON.parse(stored);
          setTitle(candidate.title);
          setDescription(candidate.description);
          setGenre(candidate.genre);
          setStructureType(candidate.structureType);
          setPlotPoints(candidate.plotPoints || []);
          setFromSuggestion(true);
          sessionStorage.removeItem("plot-suggestion");
        } catch {
          // ignore invalid data
        }
      }
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const data = {
      title,
      description,
      genre,
      structureType,
      language: "ja",
    };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create project");

      const project = await res.json();

      // Save plot points if they came from a suggestion
      if (plotPoints.length > 0) {
        await fetch("/api/plot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            structureType,
            synopsis: description,
            points: plotPoints.map((p, i) => ({
              act: p.act,
              title: p.title,
              description: p.description,
              sortOrder: i,
              isMajorTurningPoint: p.isMajorTurningPoint,
            })),
          }),
        });
      }

      router.push(`/p/${project.id}`);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          プロジェクト一覧に戻る
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>新規プロジェクト</CardTitle>
            <CardDescription>
              小説プロジェクトの基本情報を設定します
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!fromSuggestion && (
              <Link
                href="/projects/new/suggestions"
                className="mb-6 flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm transition-colors hover:bg-accent/50"
              >
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  アイデアに困っていますか？
                </span>
                <span className="text-primary underline-offset-2 hover:underline">
                  プロット候補から選択する
                </span>
              </Link>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">タイトル</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="小説のタイトル（仮題でOK）"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">概要</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="どんな物語にしたいか、簡単に書いてください"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="genre">ジャンル</Label>
                  <GenreSelector value={genre} onValueChange={setGenre} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="structureType">物語構造</Label>
                  <Select
                    name="structureType"
                    value={structureType}
                    onValueChange={setStructureType}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STRUCTURE_TYPES.map((st) => (
                        <SelectItem key={st.value} value={st.value}>
                          {st.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" asChild>
                  <Link href="/">キャンセル</Link>
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "作成中..." : "プロジェクトを作成"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
