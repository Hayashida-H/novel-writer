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
import { Plus, Pencil, Trash2, BookType } from "lucide-react";

interface StyleRef {
  id: string;
  projectId: string;
  title: string;
  sampleText: string | null;
  styleNotes: string | null;
  isActive: boolean;
}

interface StyleReferenceListProps {
  projectId: string;
}

export function StyleReferenceList({ projectId }: StyleReferenceListProps) {
  const [refs, setRefs] = useState<StyleRef[]>([]);
  const [editingRef, setEditingRef] = useState<Partial<StyleRef> | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/style-references?projectId=${projectId}`);
        if (res.ok) setRefs(await res.json());
      } catch (error) {
        console.error("Failed to load style references:", error);
      }
    }
    load();
  }, [projectId]);

  const handleSave = useCallback(async () => {
    if (!editingRef?.title) return;
    try {
      const method = isNew ? "POST" : "PUT";
      const body = isNew
        ? { projectId, ...editingRef }
        : editingRef;

      const res = await fetch("/api/style-references", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const saved = await res.json();
        if (isNew) {
          setRefs((prev) => [...prev, saved]);
        } else {
          setRefs((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
        }
        setEditingRef(null);
      }
    } catch (error) {
      console.error("Failed to save style reference:", error);
    }
  }, [editingRef, isNew, projectId]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/style-references?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setRefs((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete style reference:", error);
    }
  }, []);

  const handleToggleActive = useCallback(async (ref: StyleRef) => {
    try {
      const res = await fetch("/api/style-references", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ref.id, isActive: !ref.isActive }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRefs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
    } catch (error) {
      console.error("Failed to toggle style reference:", error);
    }
  }, []);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            執筆エージェントが参考にする文体サンプルを登録できます
          </p>
          <Button
            size="sm"
            onClick={() => {
              setIsNew(true);
              setEditingRef({ title: "", sampleText: "", styleNotes: "" });
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            追加
          </Button>
        </div>

        {refs.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed py-12">
            <div className="text-center text-muted-foreground">
              <BookType className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">文体参照がまだありません</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {refs.map((ref) => (
              <Card key={ref.id}>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <CardTitle className="flex-1 text-sm">{ref.title}</CardTitle>
                  <Badge
                    variant={ref.isActive ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => handleToggleActive(ref)}
                  >
                    {ref.isActive ? "有効" : "無効"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setIsNew(false);
                      setEditingRef(ref);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(ref.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                {ref.styleNotes && (
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground line-clamp-2">{ref.styleNotes}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editingRef} onOpenChange={(open) => !open && setEditingRef(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNew ? "文体参照を追加" : "文体参照を編集"}</DialogTitle>
          </DialogHeader>

          {editingRef && (
            <div className="space-y-4">
              <div>
                <Label>タイトル</Label>
                <Input
                  value={editingRef.title || ""}
                  onChange={(e) => setEditingRef({ ...editingRef, title: e.target.value })}
                  placeholder="例: 村上春樹風、宮部みゆき風"
                />
              </div>
              <div>
                <Label>スタイルノート</Label>
                <Textarea
                  value={editingRef.styleNotes || ""}
                  onChange={(e) =>
                    setEditingRef({ ...editingRef, styleNotes: e.target.value })
                  }
                  rows={3}
                  placeholder="短文多め、体言止め、一人称のモノローグ調..."
                />
              </div>
              <div>
                <Label>参考文（サンプルテキスト）</Label>
                <Textarea
                  value={editingRef.sampleText || ""}
                  onChange={(e) =>
                    setEditingRef({ ...editingRef, sampleText: e.target.value })
                  }
                  rows={6}
                  placeholder="参考にしたい文体のサンプルテキストを貼り付け..."
                  className="font-serif text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRef(null)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={!editingRef?.title}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
