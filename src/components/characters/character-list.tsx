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
import { Plus, Pencil, Trash2, User, Crown, Sword, Users2, UserMinus, Sparkles, Loader2 } from "lucide-react";
import { useSSEGeneration } from "@/hooks/use-sse-generation";

interface CharacterItem {
  id: string;
  projectId: string;
  name: string;
  role: string;
  description: string | null;
  appearance: string | null;
  personality: string | null;
  speechPattern: string | null;
  backstory: string | null;
  goals: string | null;
  arcDescription: string | null;
  affiliationMajor: string | null;
  affiliationMiddle: string | null;
  affiliationMinor: string | null;
}

const ROLE_LABELS: Record<string, { ja: string; icon: typeof User }> = {
  protagonist: { ja: "主人公", icon: Crown },
  antagonist: { ja: "敵対者", icon: Sword },
  supporting: { ja: "主要人物", icon: Users2 },
  minor: { ja: "脇役", icon: UserMinus },
};

const ROLE_COLORS: Record<string, string> = {
  protagonist: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  antagonist: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  supporting: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  minor: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

interface CharacterListProps {
  projectId: string;
}

export function CharacterList({ projectId }: CharacterListProps) {
  const [chars, setChars] = useState<CharacterItem[]>([]);
  const [editingChar, setEditingChar] = useState<Partial<CharacterItem> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filterRole, setFilterRole] = useState<string>("all");

  const { generate, isGenerating } = useSSEGeneration<CharacterItem>({
    endpoint: "/api/generate/characters",
    onItems: (items) => setChars((prev) => [...prev, ...items]),
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/characters?projectId=${projectId}`);
        if (res.ok) setChars(await res.json());
      } catch (error) {
        console.error("Failed to load characters:", error);
      }
    }
    load();
  }, [projectId]);

  const handleSave = useCallback(async () => {
    if (!editingChar?.name || !editingChar?.role) return;
    try {
      const method = isNew ? "POST" : "PUT";
      const body = isNew ? { projectId, ...editingChar } : editingChar;

      const res = await fetch("/api/characters", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const saved = await res.json();
        if (isNew) {
          setChars((prev) => [...prev, saved]);
        } else {
          setChars((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        }
        setEditingChar(null);
      }
    } catch (error) {
      console.error("Failed to save character:", error);
    }
  }, [editingChar, isNew, projectId]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/characters?id=${id}`, { method: "DELETE" });
      if (res.ok) setChars((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Failed to delete character:", error);
    }
  }, []);

  const filtered = filterRole === "all" ? chars : chars.filter((c) => c.role === filterRole);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={filterRole === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterRole("all")}
            >
              全員 ({chars.length})
            </Button>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <Button
                key={key}
                variant={filterRole === key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterRole(key)}
              >
                {label.ja}
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
                setEditingChar({ name: "", role: "supporting" });
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
              <User className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">登場人物がまだいません</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((char) => {
              const roleInfo = ROLE_LABELS[char.role];
              const RoleIcon = roleInfo?.icon || User;
              return (
                <Card key={char.id}>
                  <CardHeader className="flex flex-row items-start gap-3 pb-2">
                    <RoleIcon className="mt-0.5 h-6 w-6 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{char.name}</CardTitle>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[char.role] || ""}`}
                        >
                          {roleInfo?.ja || char.role}
                        </span>
                      </div>
                      {char.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {char.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setIsNew(false);
                          setEditingChar(char);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(char.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      {char.personality && (
                        <div>
                          <span className="font-medium">性格:</span> {char.personality.slice(0, 30)}…
                        </div>
                      )}
                      {char.goals && (
                        <div>
                          <span className="font-medium">目標:</span> {char.goals.slice(0, 30)}…
                        </div>
                      )}
                    </div>
                    {(char.affiliationMajor || char.affiliationMiddle || char.affiliationMinor) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium">所属:</span>{" "}
                        {[char.affiliationMajor, char.affiliationMiddle, char.affiliationMinor]
                          .filter(Boolean)
                          .join(" > ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!editingChar} onOpenChange={(open) => !open && setEditingChar(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "登場人物を追加" : "登場人物を編集"}</DialogTitle>
          </DialogHeader>

          {editingChar && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>名前</Label>
                  <Input
                    value={editingChar.name || ""}
                    onChange={(e) => setEditingChar({ ...editingChar, name: e.target.value })}
                    placeholder="山田太郎"
                  />
                </div>
                <div>
                  <Label>役割</Label>
                  <Select
                    value={editingChar.role || "supporting"}
                    onValueChange={(v) => setEditingChar({ ...editingChar, role: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label.ja}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>概要</Label>
                <Textarea
                  value={editingChar.description || ""}
                  onChange={(e) => setEditingChar({ ...editingChar, description: e.target.value })}
                  rows={2}
                  placeholder="キャラクターの概要説明"
                />
              </div>

              <div>
                <Label>外見</Label>
                <Textarea
                  value={editingChar.appearance || ""}
                  onChange={(e) => setEditingChar({ ...editingChar, appearance: e.target.value })}
                  rows={2}
                  placeholder="身長、体格、髪色、服装など"
                />
              </div>

              <div>
                <Label>性格</Label>
                <Textarea
                  value={editingChar.personality || ""}
                  onChange={(e) => setEditingChar({ ...editingChar, personality: e.target.value })}
                  rows={2}
                  placeholder="性格の特徴、長所、短所"
                />
              </div>

              <div>
                <Label>口調・話し方</Label>
                <Textarea
                  value={editingChar.speechPattern || ""}
                  onChange={(e) => setEditingChar({ ...editingChar, speechPattern: e.target.value })}
                  rows={2}
                  placeholder="「〜だよ」「〜でございます」など"
                />
              </div>

              <div>
                <Label>バックストーリー</Label>
                <Textarea
                  value={editingChar.backstory || ""}
                  onChange={(e) => setEditingChar({ ...editingChar, backstory: e.target.value })}
                  rows={3}
                  placeholder="過去の出来事、生い立ち"
                />
              </div>

              <div>
                <Label>目標・動機</Label>
                <Textarea
                  value={editingChar.goals || ""}
                  onChange={(e) => setEditingChar({ ...editingChar, goals: e.target.value })}
                  rows={2}
                  placeholder="物語における目的"
                />
              </div>

              <div>
                <Label>成長アーク</Label>
                <Textarea
                  value={editingChar.arcDescription || ""}
                  onChange={(e) => setEditingChar({ ...editingChar, arcDescription: e.target.value })}
                  rows={2}
                  placeholder="物語を通しての変化・成長"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>所属・大区分</Label>
                  <Input
                    value={editingChar.affiliationMajor || ""}
                    onChange={(e) => setEditingChar({ ...editingChar, affiliationMajor: e.target.value })}
                    placeholder="王国軍"
                  />
                </div>
                <div>
                  <Label>所属・中区分</Label>
                  <Input
                    value={editingChar.affiliationMiddle || ""}
                    onChange={(e) => setEditingChar({ ...editingChar, affiliationMiddle: e.target.value })}
                    placeholder="第三騎士団"
                  />
                </div>
                <div>
                  <Label>所属・小区分</Label>
                  <Input
                    value={editingChar.affiliationMinor || ""}
                    onChange={(e) => setEditingChar({ ...editingChar, affiliationMinor: e.target.value })}
                    placeholder="偵察部隊"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingChar(null)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={!editingChar?.name || !editingChar?.role}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
