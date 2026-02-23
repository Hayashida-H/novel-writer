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
import { Plus, Pencil, Trash2, Star, Save } from "lucide-react";

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
  chapterHint: number | null;
  isMajorTurningPoint: boolean | null;
}

const STRUCTURE_TYPES = [
  { value: "kishotenketsu", label: "起承転結" },
  { value: "three_act", label: "三幕構成" },
  { value: "hero_journey", label: "英雄の旅" },
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

function getActsForType(type: string) {
  switch (type) {
    case "kishotenketsu":
      return KISHOTENKETSU_ACTS;
    case "three_act":
      return THREE_ACT_ACTS;
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
              chapterHint: editingPoint.chapterHint,
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
            chapterHint: editingPoint.chapterHint,
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
            <Select value={structureType} onValueChange={setStructureType}>
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

          <Button onClick={handleSaveStructure} disabled={isSaving} size="sm">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {isSaving ? "保存中..." : "構造を保存"}
          </Button>
        </CardContent>
      </Card>

      {/* Plot Points Timeline */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">プロットポイント</h3>
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
          ポイント追加
        </Button>
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
                        <CardHeader className="flex flex-row items-start gap-2 py-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-sm">{point.title}</CardTitle>
                              {point.isMajorTurningPoint && (
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              )}
                              {point.chapterHint && (
                                <span className="text-xs text-muted-foreground">
                                  第{point.chapterHint}章頃
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {point.description}
                            </p>
                          </div>
                          <div className="flex gap-1">
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

      {/* Edit Point Dialog */}
      <Dialog open={!!editingPoint} onOpenChange={(open) => !open && setEditingPoint(null)}>
        <DialogContent className="max-w-lg">
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
                  <Label>章ヒント</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editingPoint.chapterHint || ""}
                    onChange={(e) =>
                      setEditingPoint({
                        ...editingPoint,
                        chapterHint: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    placeholder="5"
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
