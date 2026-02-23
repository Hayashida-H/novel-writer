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
import { Bot, Settings, RotateCcw, Save } from "lucide-react";
import { AGENT_LABELS, type AgentType } from "@/types/agent";

interface AgentConfigItem {
  id: string | null;
  projectId: string;
  agentType: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  customInstructions: string | null;
  styleProfile: string | null;
  isActive: boolean;
  isDefault: boolean;
}

interface AgentConfigListProps {
  projectId: string;
}

export function AgentConfigList({ projectId }: AgentConfigListProps) {
  const [configs, setConfigs] = useState<AgentConfigItem[]>([]);
  const [editingConfig, setEditingConfig] = useState<AgentConfigItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/agents/configs?projectId=${projectId}`);
        if (res.ok) setConfigs(await res.json());
      } catch (error) {
        console.error("Failed to load configs:", error);
      }
    }
    load();
  }, [projectId]);

  const handleSave = useCallback(async () => {
    if (!editingConfig) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/agents/configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          agentType: editingConfig.agentType,
          systemPrompt: editingConfig.systemPrompt,
          model: editingConfig.model,
          temperature: editingConfig.temperature,
          maxTokens: editingConfig.maxTokens,
          customInstructions: editingConfig.customInstructions,
          styleProfile: editingConfig.styleProfile,
          isActive: editingConfig.isActive,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setConfigs((prev) =>
          prev.map((c) =>
            c.agentType === updated.agentType ? { ...updated, isDefault: false } : c
          )
        );
        setEditingConfig(null);
      }
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setIsSaving(false);
    }
  }, [editingConfig, projectId]);

  const handleInitDefaults = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        const created = await res.json();
        setConfigs(created.map((c: AgentConfigItem) => ({ ...c, isDefault: false })));
      }
    } catch (error) {
      console.error("Failed to init configs:", error);
    }
  }, [projectId]);

  return (
    <>
      <div className="space-y-4">
        {configs.length > 0 && configs[0]?.isDefault && (
          <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
            <p className="text-sm text-muted-foreground">
              デフォルト設定を使用中です。プロジェクト専用にカスタマイズできます。
            </p>
            <Button variant="outline" size="sm" onClick={handleInitDefaults}>
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              カスタマイズを開始
            </Button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {configs.map((config) => {
            const labels = AGENT_LABELS[config.agentType as AgentType];
            return (
              <Card key={config.agentType}>
                <CardHeader className="flex flex-row items-center gap-3">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle className="text-base">{labels?.ja || config.agentType}</CardTitle>
                    <CardDescription>{labels?.en || config.agentType}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.isActive ? "default" : "secondary"}>
                      {config.isActive ? "有効" : "無効"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>モデル: {config.model}</span>
                    <span>温度: {config.temperature}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => setEditingConfig(config)}
                  >
                    <Settings className="mr-1.5 h-3.5 w-3.5" />
                    設定を編集
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={!!editingConfig} onOpenChange={(open) => !open && setEditingConfig(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig &&
                (AGENT_LABELS[editingConfig.agentType as AgentType]?.ja || editingConfig.agentType)}{" "}
              の設定
            </DialogTitle>
          </DialogHeader>

          {editingConfig && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>モデル</Label>
                  <Select
                    value={editingConfig.model}
                    onValueChange={(v) => setEditingConfig({ ...editingConfig, model: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                      <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>温度 ({editingConfig.temperature})</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={editingConfig.temperature}
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        temperature: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>最大トークン数</Label>
                <Input
                  type="number"
                  min={256}
                  max={16384}
                  step={256}
                  value={editingConfig.maxTokens}
                  onChange={(e) =>
                    setEditingConfig({
                      ...editingConfig,
                      maxTokens: parseInt(e.target.value) || 4096,
                    })
                  }
                />
              </div>

              <div>
                <Label>システムプロンプト</Label>
                <Textarea
                  value={editingConfig.systemPrompt}
                  onChange={(e) =>
                    setEditingConfig({ ...editingConfig, systemPrompt: e.target.value })
                  }
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <Label>カスタム指示（追加指示）</Label>
                <Textarea
                  value={editingConfig.customInstructions || ""}
                  onChange={(e) =>
                    setEditingConfig({
                      ...editingConfig,
                      customInstructions: e.target.value || null,
                    })
                  }
                  rows={3}
                  placeholder="プロジェクト固有の追加指示をここに記述..."
                />
              </div>

              <div>
                <Label>文体プロファイル</Label>
                <Textarea
                  value={editingConfig.styleProfile || ""}
                  onChange={(e) =>
                    setEditingConfig({
                      ...editingConfig,
                      styleProfile: e.target.value || null,
                    })
                  }
                  rows={3}
                  placeholder="このエージェントが参照する文体の特徴..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConfig(null)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
