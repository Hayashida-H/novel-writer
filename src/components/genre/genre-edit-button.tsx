"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { GenreSelector } from "./genre-selector";
import { formatGenreLabel } from "@/lib/constants/genres";

interface GenreEditButtonProps {
  projectId: string;
  currentGenre: string | null;
}

export function GenreEditButton({ projectId, currentGenre }: GenreEditButtonProps) {
  const [genre, setGenre] = useState(currentGenre || "");
  const [displayGenre, setDisplayGenre] = useState(currentGenre || "");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre }),
      });
      if (res.ok) {
        setDisplayGenre(genre);
        setOpen(false);
      }
    } catch (error) {
      console.error("Failed to update genre:", error);
    } finally {
      setSaving(false);
    }
  }, [genre, projectId]);

  return (
    <>
      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        {formatGenreLabel(displayGenre) || "ジャンル未設定"}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => {
            setGenre(displayGenre);
            setOpen(true);
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ジャンルを変更</DialogTitle>
          </DialogHeader>
          <GenreSelector value={genre} onValueChange={setGenre} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
