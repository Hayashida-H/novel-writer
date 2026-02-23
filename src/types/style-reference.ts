import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { styleReferences } from "@/lib/db/schema";

export type StyleReference = InferSelectModel<typeof styleReferences>;
export type NewStyleReference = InferInsertModel<typeof styleReferences>;
