"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SimilarityCheckDialog } from "@/components/similarity/similarity-check-dialog";
import type { PlotCandidate } from "@/types/plot-suggestion";

const ACT_LABELS: Record<string, string> = {
  ki: "起",
  sho: "承",
  ten: "転",
  ketsu: "結",
  act1: "第一幕",
  act2: "第二幕",
  act3: "第三幕",
  departure: "出立",
  initiation: "試練",
  return: "帰還",
};

const STRUCTURE_LABELS: Record<string, string> = {
  kishotenketsu: "起承転結",
  three_act: "三幕構成",
  hero_journey: "英雄の旅",
};

interface PlotCandidateCardProps {
  candidate: PlotCandidate;
  onSelect: (candidate: PlotCandidate) => void;
}

export function PlotCandidateCard({
  candidate,
  onSelect,
}: PlotCandidateCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-snug">
            {candidate.title}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {candidate.genre}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {STRUCTURE_LABELS[candidate.structureType] || candidate.structureType}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-sm">{candidate.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {candidate.themes.map((theme) => (
            <Badge key={theme} variant="outline" className="text-xs">
              {theme}
            </Badge>
          ))}
        </div>

        <p className="text-sm italic text-muted-foreground">
          {candidate.appeal}
        </p>

        {candidate.plotPoints.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              プロットポイント ({candidate.plotPoints.length})
            </button>

            {expanded && (
              <div className="mt-2 space-y-2">
                {candidate.plotPoints.map((point, i) => (
                  <div
                    key={i}
                    className="rounded-md border bg-muted/50 p-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          point.isMajorTurningPoint ? "default" : "outline"
                        }
                        className="text-xs"
                      >
                        {ACT_LABELS[point.act] || point.act}
                      </Badge>
                      <span className="font-medium">{point.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {point.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-auto space-y-2 pt-2">
          <SimilarityCheckDialog
            input={{
              synopsis: candidate.description,
              genre: candidate.genre,
              themes: candidate.themes,
            }}
          />
          <Button
            onClick={() => onSelect(candidate)}
            className="w-full"
            size="sm"
          >
            この候補で作成
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
