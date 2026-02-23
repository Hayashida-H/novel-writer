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
import { Plus, Pencil, Trash2, BookText, Sparkles, Loader2 } from "lucide-react";
import { useSSEGeneration } from "@/hooks/use-sse-generation";

interface GlossaryItem {
  id: string;
  projectId: string;
  term: string;
  reading: string | null;
  category: string | null;
  description: string;
  relatedCharacterIds: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  "地名": "地名",
  "アイテム": "アイテム",
  "技": "技",
  "組織": "組織",
  "概念": "概念",
  "その他": "その他",
};

const CATEGORY_COLORS: Record<string, string> = {
  "地名": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "アイテム": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "技": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "組織": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "概念": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "その他": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

interface GlossaryListProps {
  projectId: string;
}

export function GlossaryList({ projectId }: GlossaryListProps) {
  const [items, setItems] = useState<GlossaryItem[]>([]);
  const [editingItem, setEditingItem] = useState<Partial<GlossaryItem> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { generate, isGenerating } = useSSEGeneration<GlossaryItem>({
    endpoint: "/api/generate/glossary",
    onItems: (newItems) => setItems((prev) => [...prev, ...newItems]),
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/glossary?projectId=${projectId}`);
        if (res.ok) setItems(await res.json());
      } catch (error) {
        console.error("Failed to load glossary:", error);
      }
    }
    load();
  }, [projectId]);

  const handleSave = useCallback(async () => {
    if (!editingItem?.term || !editingItem?.description) return;
    try {
      const method = isNew ? "POST" : "PUT";
      const body = isNew ? { projectId, ...editingItem } : editingItem;

      const res = await fetch("/api/glossary", {
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
      console.error("Failed to save glossary entry:", error);
    }
  }, [editingItem, isNew, projectId]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/glossary?id=${id}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (error) {
      console.error("Failed to delete glossary entry:", error);
    }
  }, []);

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];
  const filtered = filterCategory === "all" ? items : items.filter((i) => i.category === filterCategory);

  // Group by category
  const grouped = filtered.reduce<Record<string, GlossaryItem[]>>((acc, item) => {
    const cat = item.category || "その他";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

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
              全て ({items.length})
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={filterCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCategory(cat!)}
              >
                {cat} ({items.filter((i) => i.category === cat).length})
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
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isGenerating ? "生成中..." : "AIで生成"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsNew(true);
                setEditingItem({ term: "", description: "", category: "その他" });
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
              <BookText className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">用語がまだありません</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, catItems]) => (
              <div key={category}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{category}</h3>
                <div className="space-y-2">
                  {catItems.map((item) => (
                    <Card key={item.id}>
                      <CardHeader className="flex flex-row items-start gap-3 py-2 px-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm">{item.term}</CardTitle>
                            {item.reading && (
                              <span className="text-xs text-muted-foreground">({item.reading})</span>
                            )}
                            {item.category && (
                              <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[item.category] || ""}`}>
                                {CATEGORY_LABELS[item.category] || item.category}
                              </Badge>
                            )}
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
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "用語を追加" : "用語を編集"}</DialogTitle>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>用語</Label>
                  <Input
                    value={editingItem.term || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, term: e.target.value })}
                    placeholder="エクスカリバー"
                  />
                </div>
                <div>
                  <Label>読み方</Label>
                  <Input
                    value={editingItem.reading || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, reading: e.target.value })}
                    placeholder="えくすかりばー"
                  />
                </div>
              </div>

              <div>
                <Label>カテゴリ</Label>
                <Select
                  value={editingItem.category || "その他"}
                  onValueChange={(v) => setEditingItem({ ...editingItem, category: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>説明</Label>
                <Textarea
                  value={editingItem.description || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  rows={3}
                  placeholder="用語の説明..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={!editingItem?.term || !editingItem?.description}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
