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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Star, Save, Sparkles, Loader2, Search, ListOrdered } from "lucide-react";
import { useSSEGeneration } from "@/hooks/use-sse-generation";
import { SimilarityCheckDialog } from "@/components/similarity/similarity-check-dialog";

interface PlotStructureData {
  id: string;
  projectId: string;
  structureType: string;
  synopsis: string | null;
  themes: string[];
}

interface PlotPointData {
  id: string;
  plotStructureId: string;
  act: string;
  title: string;
  description: string;
  sortOrder: number;
  chapterHints: number[];
  isMajorTurningPoint: boolean | null;
}

const STRUCTURE_TYPES = [
  { value: "kishotenketsu", label: "起承転結" },
  { value: "three_act", label: "三幕構成" },
  { value: "hero_journey", label: "英雄の旅" },
  { value: "serial", label: "連載" },
  { value: "custom", label: "カスタム" },
];

const KISHOTENKETSU_ACTS = [
  { value: "ki", label: "起", description: "導入・設定" },
  { value: "sho", label: "承", description: "展開" },
  { value: "ten", label: "転", description: "転換・クライマックス" },
  { value: "ketsu", label: "結", description: "結末" },
];

const THREE_ACT_ACTS = [
  { value: "act1", label: "第一幕", description: "設定" },
  { value: "act2", label: "第二幕", description: "対立" },
  { value: "act3", label: "第三幕", description: "解決" },
];

const SERIAL_ACTS = [
  { value: "introduction", label: "導入", description: "世界観・キャラ紹介" },
  { value: "development", label: "展開", description: "物語の広がり" },
  { value: "escalation", label: "盛り上がり", description: "緊張・対立の高まり" },
  { value: "climax", label: "クライマックス", description: "最大の山場" },
  { value: "resolution", label: "収束", description: "結末・余韻" },
];

const HERO_JOURNEY_ACTS = [
  { value: "departure", label: "出発", description: "日常からの旅立ち" },
  { value: "initiation", label: "試練", description: "冒険と成長" },
  { value: "return", label: "帰還", description: "帰還と変容" },
];

function getActsForType(type: string) {
  switch (type) {
    case "kishotenketsu":
      return KISHOTENKETSU_ACTS;
    case "three_act":
      return THREE_ACT_ACTS;
    case "hero_journey":
      return HERO_JOURNEY_ACTS;
    case "serial":
      return SERIAL_ACTS;
    default:
      return KISHOTENKETSU_ACTS;
  }
}

const ACT_COLORS: Record<string, string> = {
  ki: "border-l-green-500",
  sho: "border-l-blue-500",
  ten: "border-l-red-500",
  ketsu: "border-l-purple-500",
  act1: "border-l-green-500",
  act2: "border-l-amber-500",
  act3: "border-l-red-500",
  departure: "border-l-green-500",
  initiation: "border-l-amber-500",
  return: "border-l-purple-500",
  introduction: "border-l-green-500",
  development: "border-l-blue-500",
  escalation: "border-l-amber-500",
  climax: "border-l-red-500",
  resolution: "border-l-purple-500",
};

interface PlotEditorProps {
  projectId: string;
}

export function PlotEditor({ projectId }: PlotEditorProps) {
  const [structure, setStructure] = useState<PlotStructureData | null>(null);
  const [points, setPoints] = useState<PlotPointData[]>([]);
  const [editingPoint, setEditingPoint] = useState<Partial<PlotPointData> | null>(null);
  const [isNewPoint, setIsNewPoint] = useState(false);
  const [synopsis, setSynopsis] = useState("");
  const [themesText, setThemesText] = useState("");
  const [structureType, setStructureType] = useState("kishotenketsu");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingStructureType, setPendingStructureType] = useState<string | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateCount, setGenerateCount] = useState<string>("auto");

  const { generate: generatePoints, isGenerating } = useSSEGeneration<PlotPointData>({
    endpoint: "/api/generate/plot-points",
    onItems: (items) => {
      setPoints((prev) => [...prev, ...items]);
      setShowGenerateDialog(false);
    },
    onError: (msg) => {
      console.error("Plot points generation error:", msg);
      setShowGenerateDialog(false);
    },
  });

  const { generate: organizePoints, isGenerating: isOrganizing } = useSSEGeneration<PlotPointData>({
    endpoint: "/api/generate/organize-plot-points",
    onItems: (items) => {
      setPoints(items);
    },
    onError: (msg) => {
      console.error("Plot points organize error:", msg);
    },
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/plot?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.structure) {
            setStructure(data.structure);
            setSynopsis(data.structure.synopsis || "");
            setThemesText((data.structure.themes || []).join(", "));
            setStructureType(data.structure.structureType || "kishotenketsu");
          }
          setPoints(data.points || []);
        }
      } catch (error) {
        console.error("Failed to load plot:", error);
      }
    }
    load();
  }, [projectId]);

  const handleStructureTypeChange = useCallback(
    (newType: string) => {
      if (points.length > 0 && structure && newType !== structureType) {
        setPendingStructureType(newType);
      } else {
        setStructureType(newType);
      }
    },
    [points.length, structure, structureType]
  );

  const handleConfirmStructureChange = useCallback(async () => {
    if (!pendingStructureType || !structure) return;
    try {
      const res = await fetch("/api/plot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "structure",
          id: structure.id,
          structureType: pendingStructureType,
          clearPoints: true,
        }),
      });
      if (res.ok) {
        setStructureType(pendingStructureType);
        setPoints([]);
        const updated = await res.json();
        setStructure((prev) => prev ? { ...prev, structureType: updated.structureType } : prev);
      }
    } catch (error) {
      console.error("Failed to change structure type:", error);
    } finally {
      setPendingStructureType(null);
    }
  }, [pendingStructureType, structure]);

  const handleGeneratePoints = useCallback(() => {
    if (!structure) return;
    const count = generateCount === "auto" ? undefined : parseInt(generateCount);
    generatePoints(projectId, count ? { count } : undefined);
  }, [structure, generateCount, generatePoints, projectId]);

  const handleSaveStructure = useCallback(async () => {
    setIsSaving(true);
    try {
      const themes = themesText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/plot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          structureType,
          synopsis,
          themes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStructure(data.structure);
      }
    } catch (error) {
      console.error("Failed to save structure:", error);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, structureType, synopsis, themesText]);

  const handleSavePoint = useCallback(async () => {
    if (!editingPoint?.title || !editingPoint?.description || !editingPoint?.act) return;
    if (!structure) return;

    try {
      if (isNewPoint) {
        const res = await fetch("/api/plot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            points: [{
              act: editingPoint.act,
              title: editingPoint.title,
              description: editingPoint.description,
              sortOrder: points.length,
              chapterHints: editingPoint.chapterHints || [],
              isMajorTurningPoint: editingPoint.isMajorTurningPoint,
            }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.points) {
            setPoints((prev) => [...prev, ...data.points]);
          }
        }
      } else {
        const res = await fetch("/api/plot", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "point",
            id: editingPoint.id,
            act: editingPoint.act,
            title: editingPoint.title,
            description: editingPoint.description,
            chapterHints: editingPoint.chapterHints || [],
            isMajorTurningPoint: editingPoint.isMajorTurningPoint,
          }),
        });

        if (res.ok) {
          const updated = await res.json();
          setPoints((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }
      }
      setEditingPoint(null);
    } catch (error) {
      console.error("Failed to save point:", error);
    }
  }, [editingPoint, isNewPoint, projectId, structure, points.length]);

  const handleDeletePoint = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/plot?id=${id}&type=point`, { method: "DELETE" });
      if (res.ok) setPoints((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Failed to delete point:", error);
    }
  }, []);

  const acts = getActsForType(structureType);

  return (
    <div className="space-y-6">
      {/* Structure Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">プロット構造</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>構造タイプ</Label>
            <Select value={structureType} onValueChange={handleStructureTypeChange}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRUCTURE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>あらすじ</Label>
            <Textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={3}
              placeholder="物語全体のあらすじ..."
            />
          </div>

          <div>
            <Label>テーマ（カンマ区切り）</Label>
            <Input
              value={themesText}
              onChange={(e) => setThemesText(e.target.value)}
              placeholder="友情, 成長, 冒険"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveStructure} disabled={isSaving} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {isSaving ? "保存中..." : "構造を保存"}
            </Button>
            <SimilarityCheckDialog
              input={{
                synopsis,
                themes: themesText.split(",").map((t) => t.trim()).filter(Boolean),
                plotPoints: points.map((p) => ({
                  act: p.act,
                  title: p.title,
                  description: p.description,
                })),
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Plot Points Timeline */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium">プロットポイント</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!structure || isGenerating}
            onClick={() => setShowGenerateDialog(true)}
          >
            {isGenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isGenerating ? "生成中..." : "AIで生成"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!structure || isOrganizing || points.length === 0}
            onClick={() => organizePoints(projectId)}
          >
            {isOrganizing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isOrganizing ? "整理中..." : "整理"}
          </Button>
          <Button
            size="sm"
            disabled={!structure}
            onClick={() => {
              setIsNewPoint(true);
              setEditingPoint({
                act: acts[0]?.value || "ki",
                title: "",
                description: "",
                isMajorTurningPoint: false,
              });
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            追加
          </Button>
        </div>
      </div>

      {!structure ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          まず構造を保存してからポイントを追加してください
        </div>
      ) : (
        <div className="space-y-4">
          {acts.map((act) => {
            const actPoints = points.filter((p) => p.act === act.value);
            return (
              <div key={act.value}>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Badge variant="outline">{act.label}</Badge>
                  <span className="text-muted-foreground">{act.description}</span>
                </h4>
                {actPoints.length === 0 ? (
                  <div className="ml-4 rounded border border-dashed p-3 text-xs text-muted-foreground">
                    ポイントなし
                  </div>
                ) : (
                  <div className="ml-4 space-y-2">
                    {actPoints.map((point) => (
                      <Card
                        key={point.id}
                        className={`border-l-4 ${ACT_COLORS[point.act] || ""}`}
                      >
                        <CardHeader className="flex flex-row items-start gap-2 py-3 px-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <CardTitle className="text-sm">{point.title}</CardTitle>
                              {point.isMajorTurningPoint && (
                                <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                              )}
                              {point.chapterHints && point.chapterHints.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  第{point.chapterHints.join(",")}章
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {point.description}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setIsNewPoint(false);
                                setEditingPoint(point);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDeletePoint(point.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Structure Type Change Confirmation */}
      <AlertDialog
        open={!!pendingStructureType}
        onOpenChange={(open) => !open && setPendingStructureType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>構造タイプを変更しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              構造タイプを変更すると、既存のプロットポイント（{points.length}件）がすべて削除されます。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStructureChange}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              変更して削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={(open) => !open && !isGenerating && setShowGenerateDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>プロットポイントをAI生成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>生成数</Label>
              <Select value={generateCount} onValueChange={setGenerateCount}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">おまかせ</SelectItem>
                  <SelectItem value="4">4個</SelectItem>
                  <SelectItem value="6">6個</SelectItem>
                  <SelectItem value="8">8個</SelectItem>
                  <SelectItem value="10">10個</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {points.length > 0 && (
              <p className="text-xs text-muted-foreground">
                既存のポイント（{points.length}件）に追加されます。重複しないポイントが生成されます。
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)} disabled={isGenerating}>
              キャンセル
            </Button>
            <Button onClick={handleGeneratePoints} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  生成する
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Point Dialog */}
      <Dialog open={!!editingPoint} onOpenChange={(open) => !open && setEditingPoint(null)}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNewPoint ? "ポイント追加" : "ポイント編集"}</DialogTitle>
          </DialogHeader>

          {editingPoint && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>幕</Label>
                  <Select
                    value={editingPoint.act || acts[0]?.value}
                    onValueChange={(v) => setEditingPoint({ ...editingPoint, act: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {acts.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label} - {a.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>章ヒント（カンマ区切り）</Label>
                  <Input
                    value={(editingPoint.chapterHints || []).join(", ")}
                    onChange={(e) =>
                      setEditingPoint({
                        ...editingPoint,
                        chapterHints: e.target.value
                          .split(/[,、\s]+/)
                          .map((s) => parseInt(s.trim()))
                          .filter((n) => !isNaN(n) && n > 0),
                      })
                    }
                    placeholder="1, 2, 3"
                  />
                </div>
              </div>

              <div>
                <Label>タイトル</Label>
                <Input
                  value={editingPoint.title || ""}
                  onChange={(e) => setEditingPoint({ ...editingPoint, title: e.target.value })}
                  placeholder="主人公、旅立ちを決意"
                />
              </div>

              <div>
                <Label>説明</Label>
                <Textarea
                  value={editingPoint.description || ""}
                  onChange={(e) => setEditingPoint({ ...editingPoint, description: e.target.value })}
                  rows={3}
                  placeholder="このポイントで何が起こるか"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="majorTurning"
                  checked={editingPoint.isMajorTurningPoint || false}
                  onChange={(e) =>
                    setEditingPoint({
                      ...editingPoint,
                      isMajorTurningPoint: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <Label htmlFor="majorTurning" className="cursor-pointer">
                  重要な転換点
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPoint(null)}>
              キャンセル
            </Button>
            <Button
              onClick={handleSavePoint}
              disabled={!editingPoint?.title || !editingPoint?.description}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
