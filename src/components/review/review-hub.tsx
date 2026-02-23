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
  BookOpen,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  Heart,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Smartphone,
} from "lucide-react";
import {
  ANNOTATION_TYPE_LABELS,
  type AnnotationType,
} from "@/types/annotation";

interface ChapterItem {
  id: string;
  chapterNumber: number;
  title: string | null;
  content: string | null;
  wordCount: number | null;
  status: string;
}

interface AnnotationItem {
  id: string;
  chapterId: string;
  chapterVersionId: string;
  paragraphIndex: number;
  startOffset: number | null;
  endOffset: number | null;
  anchorText: string | null;
  comment: string;
  annotationType: string;
  status: string;
  resolutionNote: string | null;
}

const TYPE_ICONS: Record<string, typeof MessageSquare> = {
  comment: MessageSquare,
  issue: AlertTriangle,
  suggestion: Lightbulb,
  praise: Heart,
};

const TYPE_COLORS: Record<string, string> = {
  comment: "border-l-blue-500",
  issue: "border-l-red-500",
  suggestion: "border-l-amber-500",
  praise: "border-l-green-500",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "未処理",
  submitted: "送信済",
  processing: "処理中",
  resolved: "解決済",
  dismissed: "却下",
};

interface ReviewHubProps {
  projectId: string;
}

export function ReviewHub({ projectId }: ReviewHubProps) {
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<ChapterItem | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [showAnnotationDialog, setShowAnnotationDialog] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState({
    paragraphIndex: 0,
    anchorText: "",
    comment: "",
    annotationType: "comment" as string,
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/chapters?projectId=${projectId}`);
        if (res.ok) setChapters(await res.json());
      } catch (error) {
        console.error("Failed to load chapters:", error);
      }
    }
    load();
  }, [projectId]);

  useEffect(() => {
    if (!selectedChapter) return;
    async function load() {
      try {
        const res = await fetch(`/api/annotations?chapterId=${selectedChapter!.id}`);
        if (res.ok) setAnnotations(await res.json());
      } catch (error) {
        console.error("Failed to load annotations:", error);
      }
    }
    load();
  }, [selectedChapter]);

  const handleAddAnnotation = useCallback(async () => {
    if (!selectedChapter || !newAnnotation.comment) return;
    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: selectedChapter.id,
          chapterVersionId: selectedChapter.id, // simplified: use chapter id as version id
          paragraphIndex: newAnnotation.paragraphIndex,
          anchorText: newAnnotation.anchorText || null,
          comment: newAnnotation.comment,
          annotationType: newAnnotation.annotationType,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setAnnotations((prev) => [...prev, created]);
        setNewAnnotation({ paragraphIndex: 0, anchorText: "", comment: "", annotationType: "comment" });
        setShowAnnotationDialog(false);
      }
    } catch (error) {
      console.error("Failed to add annotation:", error);
    }
  }, [selectedChapter, newAnnotation]);

  const handleResolve = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch("/api/annotations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      }
    } catch (error) {
      console.error("Failed to update annotation:", error);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/annotations?id=${id}`, { method: "DELETE" });
      if (res.ok) setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error("Failed to delete annotation:", error);
    }
  }, []);

  // Split content into paragraphs for display
  const paragraphs = selectedChapter?.content
    ? selectedChapter.content.split("\n").filter((p) => p.trim())
    : [];

  return (
    <>
      <div className="flex h-full gap-4">
        {/* Chapter List Sidebar */}
        <div className="w-64 shrink-0 space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">章を選択</h3>
          {chapters.length === 0 ? (
            <p className="text-xs text-muted-foreground">章がまだありません</p>
          ) : (
            chapters.map((chapter) => (
              <Card
                key={chapter.id}
                className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                  selectedChapter?.id === chapter.id ? "border-primary bg-accent/30" : ""
                }`}
                onClick={() => setSelectedChapter(chapter)}
              >
                <CardHeader className="py-3">
                  <CardTitle className="text-xs">
                    第{chapter.chapterNumber}章: {chapter.title || "無題"}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 text-xs">
                    <span>{(chapter.wordCount || 0).toLocaleString()}字</span>
                    {chapter.content && (
                      <a
                        href={`/p/${projectId}/review/chapters/${chapter.id}`}
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                        title="モバイルリーダーで開く"
                      >
                        <Smartphone className="h-3 w-3" />
                        読む
                      </a>
                    )}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          {!selectedChapter ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">レビューする章を選択してください</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  第{selectedChapter.chapterNumber}章: {selectedChapter.title || "無題"}
                </h2>
                <Button size="sm" onClick={() => setShowAnnotationDialog(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  指摘を追加
                </Button>
              </div>

              {/* Content with annotation highlights */}
              <div className="rounded-lg border">
                <div className="max-h-[50vh] overflow-y-auto p-6">
                  {paragraphs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">本文がまだありません</p>
                  ) : (
                    <div className="space-y-3 font-serif text-sm leading-relaxed">
                      {paragraphs.map((para, idx) => {
                        const paraAnnotations = annotations.filter(
                          (a) => a.paragraphIndex === idx
                        );
                        return (
                          <div key={idx} className="group relative">
                            <p
                              className={
                                paraAnnotations.length > 0
                                  ? "border-l-2 border-amber-400 pl-3"
                                  : ""
                              }
                            >
                              {para}
                            </p>
                            {paraAnnotations.length > 0 && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {paraAnnotations.length}件の指摘
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Annotations List */}
              <div>
                <h3 className="mb-2 text-sm font-medium">
                  指摘・コメント ({annotations.length})
                </h3>
                {annotations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">指摘がまだありません</p>
                ) : (
                  <div className="space-y-2">
                    {annotations.map((ann) => {
                      const TypeIcon = TYPE_ICONS[ann.annotationType] || MessageSquare;
                      const typeLabel = ANNOTATION_TYPE_LABELS[ann.annotationType as AnnotationType];
                      return (
                        <Card
                          key={ann.id}
                          className={`border-l-4 ${TYPE_COLORS[ann.annotationType] || ""}`}
                        >
                          <CardHeader className="flex flex-row items-start gap-2 py-3">
                            <TypeIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {typeLabel?.ja || ann.annotationType}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {STATUS_LABELS[ann.status] || ann.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  段落 {ann.paragraphIndex + 1}
                                </span>
                              </div>
                              {ann.anchorText && (
                                <p className="mt-1 text-xs italic text-muted-foreground">
                                  「{ann.anchorText}」
                                </p>
                              )}
                              <p className="mt-1 text-sm">{ann.comment}</p>
                              {ann.resolutionNote && (
                                <p className="mt-1 text-xs text-green-600">
                                  解決: {ann.resolutionNote}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {ann.status !== "resolved" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-green-600"
                                  onClick={() => handleResolve(ann.id, "resolved")}
                                  title="解決済みにする"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {ann.status !== "dismissed" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground"
                                  onClick={() => handleResolve(ann.id, "dismissed")}
                                  title="却下する"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleDelete(ann.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </CardHeader>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Annotation Dialog */}
      <Dialog open={showAnnotationDialog} onOpenChange={setShowAnnotationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>指摘を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>種類</Label>
              <Select
                value={newAnnotation.annotationType}
                onValueChange={(v) =>
                  setNewAnnotation({ ...newAnnotation, annotationType: v })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ANNOTATION_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label.ja}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>対象段落（番号）</Label>
              <Select
                value={String(newAnnotation.paragraphIndex)}
                onValueChange={(v) =>
                  setNewAnnotation({ ...newAnnotation, paragraphIndex: parseInt(v) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paragraphs.map((p, i) => (
                    <SelectItem key={i} value={String(i)}>
                      段落{i + 1}: {p.slice(0, 30)}…
                    </SelectItem>
                  ))}
                  {paragraphs.length === 0 && (
                    <SelectItem value="0">段落1</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>引用テキスト（任意）</Label>
              <Textarea
                value={newAnnotation.anchorText}
                onChange={(e) =>
                  setNewAnnotation({ ...newAnnotation, anchorText: e.target.value })
                }
                rows={2}
                placeholder="指摘箇所のテキストを貼り付け"
              />
            </div>

            <div>
              <Label>コメント</Label>
              <Textarea
                value={newAnnotation.comment}
                onChange={(e) =>
                  setNewAnnotation({ ...newAnnotation, comment: e.target.value })
                }
                rows={3}
                placeholder="この箇所について..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnnotationDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAddAnnotation} disabled={!newAnnotation.comment}>
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
