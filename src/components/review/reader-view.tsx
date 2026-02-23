"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  Heart,
  Send,
  X,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Type,
} from "lucide-react";
import { useAnnotationStore, type LocalAnnotation } from "@/stores/annotation-store";
import type { AnnotationType } from "@/types/annotation";

interface ReaderViewProps {
  projectId: string;
  chapterId: string;
}

interface ChapterData {
  id: string;
  chapterNumber: number;
  title: string | null;
  content: string | null;
}

const ANNOTATION_TYPES: { type: AnnotationType; icon: typeof MessageSquare; label: string; color: string }[] = [
  { type: "comment", icon: MessageSquare, label: "コメント", color: "bg-blue-500" },
  { type: "issue", icon: AlertTriangle, label: "問題", color: "bg-red-500" },
  { type: "suggestion", icon: Lightbulb, label: "提案", color: "bg-amber-500" },
  { type: "praise", icon: Heart, label: "称賛", color: "bg-green-500" },
];

const DOT_COLORS: Record<string, string> = {
  comment: "bg-blue-500",
  issue: "bg-red-500",
  suggestion: "bg-amber-500",
  praise: "bg-green-500",
};

export function ReaderView({ projectId, chapterId }: ReaderViewProps) {
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(17);
  const [selectedType, setSelectedType] = useState<AnnotationType>("comment");
  const [commentText, setCommentText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const {
    annotations,
    setAnnotations,
    addAnnotation,
    removeAnnotation,
    selectedParagraph,
    showPopover,
    selectParagraph,
    setShowPopover,
    getAnnotationsForParagraph,
    getUnsyncedAnnotations,
    markSynced,
  } = useAnnotationStore();

  // Load chapter
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/chapters?id=${chapterId}`);
        if (res.ok) {
          const data = await res.json();
          setChapter(Array.isArray(data) ? data[0] : data);
        }
      } catch (error) {
        console.error("Failed to load chapter:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [chapterId]);

  // Load existing annotations
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/annotations?chapterId=${chapterId}`);
        if (res.ok) {
          const data = await res.json();
          const mapped: LocalAnnotation[] = data.map((a: Record<string, unknown>) => ({
            id: a.id,
            chapterId: a.chapterId,
            paragraphIndex: a.paragraphIndex,
            startOffset: a.startOffset,
            endOffset: a.endOffset,
            anchorText: a.anchorText,
            comment: a.comment,
            annotationType: a.annotationType,
            status: a.status,
            synced: true,
            createdAt: new Date(a.createdAt as string),
          }));
          setAnnotations(mapped);
        }
      } catch (error) {
        console.error("Failed to load annotations:", error);
      }
    }
    load();
  }, [chapterId, setAnnotations]);

  // Handle paragraph tap
  const handleParagraphTap = useCallback(
    (index: number) => {
      if (selectedParagraph === index && showPopover) {
        setShowPopover(false);
        selectParagraph(null);
      } else {
        selectParagraph(index);
        setShowPopover(true);
        setCommentText("");
      }
    },
    [selectedParagraph, showPopover, selectParagraph, setShowPopover]
  );

  // Submit annotation
  const handleSubmitAnnotation = useCallback(() => {
    if (selectedParagraph === null || !commentText.trim()) return;

    addAnnotation({
      chapterId,
      paragraphIndex: selectedParagraph,
      startOffset: null,
      endOffset: null,
      anchorText: null,
      comment: commentText.trim(),
      annotationType: selectedType,
    });

    setCommentText("");
    setShowPopover(false);
    selectParagraph(null);
  }, [selectedParagraph, commentText, selectedType, chapterId, addAnnotation, setShowPopover, selectParagraph]);

  // Sync annotations to server
  const handleSyncAnnotations = useCallback(async () => {
    const unsynced = getUnsyncedAnnotations();
    if (unsynced.length === 0) return;

    setSyncing(true);
    try {
      for (const ann of unsynced) {
        const res = await fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterId: ann.chapterId,
            chapterVersionId: ann.chapterId,
            paragraphIndex: ann.paragraphIndex,
            startOffset: ann.startOffset,
            endOffset: ann.endOffset,
            anchorText: ann.anchorText,
            comment: ann.comment,
            annotationType: ann.annotationType,
          }),
        });
        if (res.ok) {
          markSynced(ann.id);
        }
      }
    } catch (error) {
      console.error("Failed to sync annotations:", error);
    } finally {
      setSyncing(false);
    }
  }, [getUnsyncedAnnotations, markSynced]);

  // Split content into paragraphs
  const paragraphs = chapter?.content
    ? chapter.content.split("\n").filter((p) => p.trim())
    : [];

  const unsyncedCount = getUnsyncedAnnotations().length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">章が見つかりません</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors ${
        darkMode ? "bg-zinc-900 text-zinc-200" : "bg-amber-50/30 text-zinc-800"
      }`}
    >
      {/* Top Bar */}
      <div
        className={`sticky top-0 z-30 flex items-center justify-between px-4 py-2 backdrop-blur-sm ${
          darkMode
            ? "bg-zinc-900/90 border-b border-zinc-700"
            : "bg-amber-50/90 border-b border-zinc-200"
        }`}
      >
        <a
          href={`/p/${projectId}/review`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          戻る
        </a>

        <span className="text-xs font-medium">
          第{chapter.chapterNumber}章{chapter.title ? `「${chapter.title}」` : ""}
        </span>

        <div className="flex items-center gap-2">
          {/* Font size */}
          <button
            className="p-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setFontSize((s) => Math.min(s + 1, 24))}
            title="文字を大きく"
          >
            <Type className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setFontSize((s) => Math.max(s - 1, 14))}
            title="文字を小さく"
          >
            <Type className="h-3 w-3" />
          </button>

          {/* Dark mode toggle */}
          <button
            className="p-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Reader Content */}
      <div className="mx-auto max-w-[640px] px-6 py-8 md:px-8">
        {/* Chapter heading */}
        <h1
          className="mb-8 text-center font-serif font-bold"
          style={{ fontSize: fontSize + 6 }}
        >
          第{chapter.chapterNumber}章
          {chapter.title && (
            <>
              <br />
              <span className="font-normal">{chapter.title}</span>
            </>
          )}
        </h1>

        {/* Paragraphs */}
        <div className="space-y-0">
          {paragraphs.map((para, idx) => {
            const paraAnnotations = getAnnotationsForParagraph(idx);
            const isSelected = selectedParagraph === idx;

            return (
              <div key={idx} className="relative">
                {/* Annotation dots */}
                {paraAnnotations.length > 0 && (
                  <div className="absolute -left-5 top-1 flex flex-col gap-0.5">
                    {paraAnnotations.slice(0, 3).map((ann, i) => (
                      <div
                        key={i}
                        className={`h-2 w-2 rounded-full ${DOT_COLORS[ann.annotationType] || "bg-blue-500"}`}
                      />
                    ))}
                    {paraAnnotations.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{paraAnnotations.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Paragraph text */}
                <p
                  className={`cursor-pointer font-serif leading-[1.9] transition-colors ${
                    isSelected
                      ? darkMode
                        ? "bg-zinc-700/50 rounded"
                        : "bg-amber-100/70 rounded"
                      : ""
                  }`}
                  style={{
                    fontSize,
                    textIndent: "1em",
                    paddingTop: "0.25em",
                    paddingBottom: "0.25em",
                  }}
                  onClick={() => handleParagraphTap(idx)}
                >
                  {para}
                </p>

                {/* Popover for annotation input */}
                {isSelected && showPopover && (
                  <div
                    ref={popoverRef}
                    className={`mt-2 mb-4 rounded-lg border p-3 shadow-lg ${
                      darkMode
                        ? "bg-zinc-800 border-zinc-600"
                        : "bg-white border-zinc-300"
                    }`}
                  >
                    {/* Type selector */}
                    <div className="mb-2 flex gap-1.5">
                      {ANNOTATION_TYPES.map(({ type, icon: Icon, label, color }) => (
                        <button
                          key={type}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                            selectedType === type
                              ? `${color} text-white`
                              : darkMode
                              ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                          }`}
                          onClick={() => setSelectedType(type)}
                        >
                          <Icon className="h-3 w-3" />
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Comment input */}
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="この箇所について..."
                      rows={2}
                      className="mb-2 text-sm"
                      autoFocus
                    />

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setShowPopover(false);
                          selectParagraph(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <Button
                        size="sm"
                        onClick={handleSubmitAnnotation}
                        disabled={!commentText.trim()}
                        className="h-7 text-xs"
                      >
                        <Send className="mr-1 h-3 w-3" />
                        追加
                      </Button>
                    </div>

                    {/* Existing annotations for this paragraph */}
                    {paraAnnotations.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t pt-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          この段落の指摘 ({paraAnnotations.length})
                        </p>
                        {paraAnnotations.map((ann) => (
                          <div
                            key={ann.id}
                            className={`flex items-start gap-2 rounded p-1.5 text-xs ${
                              darkMode ? "bg-zinc-700/50" : "bg-zinc-50"
                            }`}
                          >
                            <div
                              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                                DOT_COLORS[ann.annotationType] || "bg-blue-500"
                              }`}
                            />
                            <span className="flex-1">{ann.comment}</span>
                            {!ann.synced && (
                              <Badge variant="outline" className="text-[10px]">
                                未送信
                              </Badge>
                            )}
                            <button
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAnnotation(ann.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Bar: Sync Button */}
      {annotations.length > 0 && (
        <div
          className={`sticky bottom-0 z-30 border-t px-4 py-3 ${
            darkMode
              ? "bg-zinc-900/95 border-zinc-700"
              : "bg-amber-50/95 border-zinc-200"
          }`}
        >
          <div className="mx-auto flex max-w-[640px] items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {annotations.length}件の指摘
              {unsyncedCount > 0 && `（${unsyncedCount}件未送信）`}
            </span>
            <Button
              size="sm"
              onClick={handleSyncAnnotations}
              disabled={unsyncedCount === 0 || syncing}
              className="h-8 text-xs"
            >
              <Send className="mr-1.5 h-3 w-3" />
              {syncing ? "送信中..." : `修正依頼を送信${unsyncedCount > 0 ? ` (${unsyncedCount})` : ""}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
