import { getDb } from "@/lib/db";
import { foreshadowing } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

interface ForeshadowingUpdate {
  action: string;
  title: string;
  details: string;
  suggestedStatus?: string;
  resolvedContext?: string;
}

interface ContinuityOutput {
  foreshadowingUpdates?: ForeshadowingUpdate[];
}

const VALID_STATUSES = ["planted", "hinted", "partially_resolved", "resolved", "abandoned"] as const;
type ForeshadowingStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(s: string): s is ForeshadowingStatus {
  return VALID_STATUSES.includes(s as ForeshadowingStatus);
}

/**
 * Parse continuity checker output and update foreshadowing statuses accordingly.
 */
export async function updateForeshadowingFromCheck(
  projectId: string,
  chapterId: string,
  continuityOutput: string
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  let parsed: ContinuityOutput;
  try {
    // Try to extract JSON from the output (may be wrapped in markdown code blocks)
    const jsonMatch = continuityOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { updated: 0, errors: ["No JSON found in continuity output"] };
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { updated: 0, errors: ["Failed to parse continuity output as JSON"] };
  }

  const updates = parsed.foreshadowingUpdates;
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return { updated: 0, errors: [] };
  }

  const db = getDb();

  // Get all active foreshadowing for this project
  const allForeshadowing = await db
    .select({ id: foreshadowing.id, title: foreshadowing.title, status: foreshadowing.status })
    .from(foreshadowing)
    .where(eq(foreshadowing.projectId, projectId));

  const titleToForeshadowing = new Map(allForeshadowing.map((f) => [f.title, f]));

  for (const update of updates) {
    if (update.action !== "status_change") continue;

    const existing = titleToForeshadowing.get(update.title);
    if (!existing) {
      errors.push(`Foreshadowing not found: "${update.title}"`);
      continue;
    }

    const newStatus = update.suggestedStatus;
    if (!newStatus || !isValidStatus(newStatus)) {
      errors.push(`Invalid status "${newStatus}" for "${update.title}"`);
      continue;
    }

    // Don't downgrade status (e.g., resolved -> hinted)
    const statusOrder = { planted: 0, hinted: 1, partially_resolved: 2, resolved: 3, abandoned: 4 };
    if (statusOrder[newStatus] <= statusOrder[existing.status as ForeshadowingStatus]) {
      continue;
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === "resolved") {
      updateData.resolvedChapterId = chapterId;
      if (update.resolvedContext) {
        updateData.resolvedContext = update.resolvedContext;
      }
    }

    try {
      await db
        .update(foreshadowing)
        .set(updateData)
        .where(
          and(
            eq(foreshadowing.id, existing.id),
            eq(foreshadowing.projectId, projectId)
          )
        );
      updated++;
    } catch (err) {
      errors.push(`Failed to update "${update.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { updated, errors };
}
