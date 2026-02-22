import type { InferSelectModel } from "drizzle-orm";
import type { annotations, annotationBatches } from "@/lib/db/schema";

export type Annotation = InferSelectModel<typeof annotations>;
export type AnnotationBatch = InferSelectModel<typeof annotationBatches>;

export type AnnotationType = "comment" | "issue" | "suggestion" | "praise";
export type AnnotationStatus = "pending" | "submitted" | "processing" | "resolved" | "dismissed";

export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, { ja: string; color: string }> = {
  comment: { ja: "コメント", color: "blue" },
  issue: { ja: "問題", color: "red" },
  suggestion: { ja: "提案", color: "amber" },
  praise: { ja: "称賛", color: "green" },
};
