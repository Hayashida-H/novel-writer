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
import { Plus, Pencil, Trash2, GitBranch, ArrowRight } from "lucide-react";
import {
  FORESHADOWING_TYPE_LABELS,
  FORESHADOWING_STATUS_LABELS,
  FORESHADOWING_PRIORITY_LABELS,
  type ForeshadowingType,
  type ForeshadowingStatus,
  type ForeshadowingPriority,
} from "@/types/foreshadowing";

interface ForeshadowingItem {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: string;
  status: string;
  plantedChapterId: string | null;
  plantedContext: string | null;
  targetChapter: number | null;
  resolvedChapterId: string | null;
  resolvedContext: string | null;
  priority: string;
  relatedCharacterIds: string[];
}

interface ForeshadowingListProps {
  projectId: string;
}

const STATUS_COLORS: Record<string, string> = {
  planted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  hinted: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  partially_resolved: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  abandoned: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function ForeshadowingList({ projectId }: ForeshadowingListProps) {
  const [items, setItems] = useState<ForeshadowingItem[]>([]);
  const [editingItem, setEditingItem] = useState<Partial<ForeshadowingItem> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        const url = filterStatus === "all"
          ? `/api/foreshadowing?projectId=${projectId}`
          : `/api/foreshadowing?projectId=${projectId}&status=${filterStatus}`;
        const res = await fetch(url);
        if (res.ok) setItems(await res.json());
      } catch (error) {
        console.error("Failed to load foreshadowing:", error);
      }
    }
    load();
  }, [projectId, filterStatus]);

  const handleSave = useCallback(async () => {
    if (!editingItem?.title || !editingItem?.description) return;
    try {
      const method = isNew ? "POST" : "PUT";
      const body = isNew ? { projectId, ...editingItem } : editingItem;

      const res = await fetch("/api/foreshadowing", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const saved = await res.json();
        if (isNew) {
          setItems((prev) => [saved, ...prev]);
        } else {
          setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
        }
        setEditingItem(null);
      }
    } catch (error) {
      console.error("Failed to save foreshadowing:", error);
    }
  }, [editingItem, isNew, projectId]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/foreshadowing?id=${id}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (error) {
      console.error("Failed to delete foreshadowing:", error);
    }
  }, []);

  const handleStatusChange = useCallback(async (item: ForeshadowingItem, newStatus: string) => {
    try {
      const res = await fetch("/api/foreshadowing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }, []);

  const statusCounts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
            >
              すべて ({items.length})
            </Button>
            {Object.entries(FORESHADOWING_STATUS_LABELS).map(([key, label]) => (
              <Button
                key={key}
                variant={filterStatus === key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(key)}
              >
                {label.ja} {statusCounts[key] ? `(${statusCounts[key]})` : ""}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => {
              setIsNew(true);
              setEditingItem({
                title: "",
                description: "",
                type: "foreshadowing",
                priority: "medium",
              });
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            伏線を追加
          </Button>
        </div>

        {/* List */}
        {items.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed py-12">
            <div className="text-center text-muted-foreground">
              <GitBranch className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">伏線がまだ登録されていません</p>
              <p className="mt-1 text-xs">「伏線を追加」から登録を始めましょう</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader className="flex flex-row items-start gap-3 pb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">{item.title}</CardTitle>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || ""}`}
                      >
                        {FORESHADOWING_STATUS_LABELS[item.status as ForeshadowingStatus]?.ja || item.status}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[item.priority] || ""}`}
                      >
                        {FORESHADOWING_PRIORITY_LABELS[item.priority as ForeshadowingPriority]?.ja || item.priority}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {FORESHADOWING_TYPE_LABELS[item.type as ForeshadowingType]?.ja || item.type}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setIsNew(false);
                        setEditingItem(item);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {item.plantedContext && (
                      <span>設置: {item.plantedContext.slice(0, 40)}…</span>
                    )}
                    {item.targetChapter && (
                      <span className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        回収予定: 第{item.targetChapter}章
                      </span>
                    )}
                  </div>
                  {/* Quick status buttons */}
                  {item.status !== "resolved" && item.status !== "abandoned" && (
                    <div className="mt-2 flex gap-1">
                      {item.status === "planted" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => handleStatusChange(item, "hinted")}
                        >
                          示唆済みに
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => handleStatusChange(item, "resolved")}
                      >
                        回収済みに
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground"
                        onClick={() => handleStatusChange(item, "abandoned")}
                      >
                        破棄
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "伏線を追加" : "伏線を編集"}</DialogTitle>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label>タイトル</Label>
                <Input
                  value={editingItem.title || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  placeholder="主人公の右手の傷跡"
                />
              </div>

              <div>
                <Label>説明</Label>
                <Textarea
                  value={editingItem.description || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, description: e.target.value })
                  }
                  rows={3}
                  placeholder="第1章で負った傷。実は魔力の源..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>種類</Label>
                  <Select
                    value={editingItem.type || "foreshadowing"}
                    onValueChange={(v) => setEditingItem({ ...editingItem, type: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FORESHADOWING_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label.ja}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>優先度</Label>
                  <Select
                    value={editingItem.priority || "medium"}
                    onValueChange={(v) => setEditingItem({ ...editingItem, priority: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FORESHADOWING_PRIORITY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label.ja}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>設置文脈</Label>
                <Textarea
                  value={editingItem.plantedContext || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, plantedContext: e.target.value })
                  }
                  rows={2}
                  placeholder="戦闘シーンで右手に深い傷を負う"
                />
              </div>

              <div>
                <Label>回収予定（章番号）</Label>
                <Input
                  type="number"
                  min={1}
                  value={editingItem.targetChapter || ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      targetChapter: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="10"
                />
              </div>

              {!isNew && (
                <div>
                  <Label>回収文脈</Label>
                  <Textarea
                    value={editingItem.resolvedContext || ""}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, resolvedContext: e.target.value })
                    }
                    rows={2}
                    placeholder="傷跡が光り、封印されていた魔力が解放"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={!editingItem?.title || !editingItem?.description}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
