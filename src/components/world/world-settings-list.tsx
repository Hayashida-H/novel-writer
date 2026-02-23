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
import { Plus, Pencil, Trash2, Globe, MapPin, Scroll, Sparkles, Building2, Wand2, Loader2 } from "lucide-react";
import { useSSEGeneration } from "@/hooks/use-sse-generation";

interface WorldSettingItem {
  id: string;
  projectId: string;
  category: string;
  title: string;
  content: string;
  sortOrder: number | null;
}

const CATEGORIES = [
  { value: "geography", label: "地理", icon: MapPin },
  { value: "history", label: "歴史", icon: Scroll },
  { value: "culture", label: "文化・社会", icon: Building2 },
  { value: "magic", label: "魔法・技術", icon: Sparkles },
  { value: "politics", label: "政治・勢力", icon: Building2 },
  { value: "other", label: "その他", icon: Globe },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

interface WorldSettingsListProps {
  projectId: string;
}

export function WorldSettingsList({ projectId }: WorldSettingsListProps) {
  const [items, setItems] = useState<WorldSettingItem[]>([]);
  const [editingItem, setEditingItem] = useState<Partial<WorldSettingItem> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { generate, isGenerating } = useSSEGeneration<WorldSettingItem>({
    endpoint: "/api/generate/world-settings",
    onItems: (newItems) => setItems((prev) => [...prev, ...newItems]),
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/world-settings?projectId=${projectId}`);
        if (res.ok) setItems(await res.json());
      } catch (error) {
        console.error("Failed to load world settings:", error);
      }
    }
    load();
  }, [projectId]);

  const handleSave = useCallback(async () => {
    if (!editingItem?.title || !editingItem?.content || !editingItem?.category) return;
    try {
      const method = isNew ? "POST" : "PUT";
      const body = isNew ? { projectId, ...editingItem } : editingItem;

      const res = await fetch("/api/world-settings", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const saved = await res.json();
        if (isNew) {
          setItems((prev) => [...prev, saved]);
        } else {
          setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
        }
        setEditingItem(null);
      }
    } catch (error) {
      console.error("Failed to save world setting:", error);
    }
  }, [editingItem, isNew, projectId]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/world-settings?id=${id}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (error) {
      console.error("Failed to delete world setting:", error);
    }
  }, []);

  const filtered = filterCategory === "all" ? items : items.filter((i) => i.category === filterCategory);

  // Group by category
  const grouped = filtered.reduce(
    (acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, WorldSettingItem[]>
  );

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterCategory("all")}
            >
              すべて ({items.length})
            </Button>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant={filterCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCategory(cat.value)}
              >
                {cat.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => generate(projectId)}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isGenerating ? "生成中..." : "AIで生成"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsNew(true);
                setEditingItem({ category: "geography", title: "", content: "" });
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              追加
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed py-12">
            <div className="text-center text-muted-foreground">
              <Globe className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">世界設定がまだありません</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, categoryItems]) => {
              const catInfo = CATEGORY_MAP[category];
              const CatIcon = catInfo?.icon || Globe;
              return (
                <div key={category}>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <CatIcon className="h-4 w-4" />
                    {catInfo?.label || category}
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {categoryItems.map((item) => (
                      <Card key={item.id}>
                        <CardHeader className="flex flex-row items-start gap-3 pb-2">
                          <CardTitle className="flex-1 text-sm">{item.title}</CardTitle>
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
                          <p className="whitespace-pre-wrap text-xs text-muted-foreground line-clamp-4">
                            {item.content}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNew ? "世界設定を追加" : "世界設定を編集"}</DialogTitle>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label>カテゴリ</Label>
                <Select
                  value={editingItem.category || "geography"}
                  onValueChange={(v) => setEditingItem({ ...editingItem, category: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>タイトル</Label>
                <Input
                  value={editingItem.title || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  placeholder="エルフの森"
                />
              </div>

              <div>
                <Label>内容</Label>
                <Textarea
                  value={editingItem.content || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                  rows={8}
                  placeholder="この設定の詳細を記述..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              disabled={!editingItem?.title || !editingItem?.content}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
