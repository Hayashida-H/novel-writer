"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, FileType } from "lucide-react";

export default function ExportPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExport = async (format: "markdown" | "plaintext") => {
    setIsExporting(format);
    try {
      const res = await fetch(
        `/api/export?projectId=${projectId}&format=${format}`
      );

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "エクスポートに失敗しました");
        return;
      }

      const blob = await res.blob();
      const filename = format === "markdown" ? "novel.md" : "novel.txt";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("エクスポートに失敗しました");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <Header projectId={projectId} title="エクスポート" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div>
            <h2 className="text-xl font-bold">小説をエクスポート</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              執筆した小説をファイルとしてダウンロードできます
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Markdown</CardTitle>
                  <CardDescription>
                    見出し・装飾付きのMarkdown形式
                  </CardDescription>
                </div>
                <Badge variant="secondary">.md</Badge>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  章タイトル、メタデータ付き。GitHubやObsidianで閲覧可能。
                </p>
                <Button
                  className="w-full"
                  onClick={() => handleExport("markdown")}
                  disabled={!!isExporting}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  {isExporting === "markdown" ? "ダウンロード中..." : "Markdownでダウンロード"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-3">
                <FileType className="h-8 w-8 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">プレーンテキスト</CardTitle>
                  <CardDescription>装飾なしのテキスト形式</CardDescription>
                </div>
                <Badge variant="secondary">.txt</Badge>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  シンプルなテキスト形式。どのエディタでも開ける。
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExport("plaintext")}
                  disabled={!!isExporting}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  {isExporting === "plaintext" ? "ダウンロード中..." : "テキストでダウンロード"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
