"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

const GENRES = [
  "ファンタジー",
  "SF",
  "ミステリー",
  "恋愛",
  "ホラー",
  "歴史",
  "ライトノベル",
  "純文学",
  "その他",
];

const STRUCTURE_TYPES = [
  { value: "kishotenketsu", label: "起承転結" },
  { value: "three_act", label: "三幕構成" },
  { value: "hero_journey", label: "英雄の旅" },
  { value: "custom", label: "カスタム" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      genre: formData.get("genre") as string,
      structureType: formData.get("structureType") as string,
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
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">タイトル</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="小説のタイトル（仮題でOK）"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">概要</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="どんな物語にしたいか、簡単に書いてください"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="genre">ジャンル</Label>
                  <Select name="genre">
                    <SelectTrigger>
                      <SelectValue placeholder="ジャンルを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((genre) => (
                        <SelectItem key={genre} value={genre}>
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="structureType">物語構造</Label>
                  <Select name="structureType" defaultValue="kishotenketsu">
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
