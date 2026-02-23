import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { foreshadowing } from "@/lib/db/schema";

export type Foreshadowing = InferSelectModel<typeof foreshadowing>;
export type NewForeshadowing = InferInsertModel<typeof foreshadowing>;

export type ForeshadowingType =
  | "foreshadowing"
  | "chekhovs_gun"
  | "recurring_motif"
  | "red_herring";

export type ForeshadowingStatus =
  | "planted"
  | "hinted"
  | "partially_resolved"
  | "resolved"
  | "abandoned";

export type ForeshadowingPriority = "high" | "medium" | "low";

export const FORESHADOWING_TYPE_LABELS: Record<ForeshadowingType, { ja: string; en: string }> = {
  foreshadowing: { ja: "伏線", en: "Foreshadowing" },
  chekhovs_gun: { ja: "チェーホフの銃", en: "Chekhov's Gun" },
  recurring_motif: { ja: "繰り返しモチーフ", en: "Recurring Motif" },
  red_herring: { ja: "ミスリード", en: "Red Herring" },
};

export const FORESHADOWING_STATUS_LABELS: Record<
  ForeshadowingStatus,
  { ja: string; color: string }
> = {
  planted: { ja: "設置済み", color: "blue" },
  hinted: { ja: "示唆済み", color: "cyan" },
  partially_resolved: { ja: "一部回収", color: "amber" },
  resolved: { ja: "回収済み", color: "green" },
  abandoned: { ja: "破棄", color: "gray" },
};

export const FORESHADOWING_PRIORITY_LABELS: Record<
  ForeshadowingPriority,
  { ja: string; color: string }
> = {
  high: { ja: "高", color: "red" },
  medium: { ja: "中", color: "amber" },
  low: { ja: "低", color: "gray" },
};
