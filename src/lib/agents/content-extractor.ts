import { getDb } from "@/lib/db";
import { characters, worldSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface ExtractedCharacter {
  name: string;
  role?: string;
  description?: string;
  appearance?: string;
  personality?: string;
  speechPattern?: string;
}

interface ExtractedWorldSetting {
  category: string;
  title: string;
  content: string;
}

interface ContinuityOutput {
  newCharacters?: ExtractedCharacter[];
  newWorldSettings?: ExtractedWorldSetting[];
}

const VALID_ROLES = ["protagonist", "antagonist", "supporting", "minor"] as const;
type CharacterRole = (typeof VALID_ROLES)[number];

function isValidRole(r: string): r is CharacterRole {
  return VALID_ROLES.includes(r as CharacterRole);
}

/**
 * Parse continuity checker output and extract new characters/world settings into DB.
 * Skips entries that already exist (matched by name for characters, title for world settings).
 */
export async function extractContentFromCheck(
  projectId: string,
  continuityOutput: string
): Promise<{ newCharacters: number; newWorldSettings: number; errors: string[] }> {
  const errors: string[] = [];
  let newCharacterCount = 0;
  let newWorldSettingCount = 0;

  let parsed: ContinuityOutput;
  try {
    const jsonMatch = continuityOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { newCharacters: 0, newWorldSettings: 0, errors: ["No JSON found in continuity output"] };
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { newCharacters: 0, newWorldSettings: 0, errors: ["Failed to parse continuity output as JSON"] };
  }

  const db = getDb();

  // --- Extract new characters ---
  if (parsed.newCharacters && Array.isArray(parsed.newCharacters) && parsed.newCharacters.length > 0) {
    // Get existing character names for deduplication
    const existingCharacters = await db
      .select({ name: characters.name })
      .from(characters)
      .where(eq(characters.projectId, projectId));

    const existingNames = new Set(existingCharacters.map((c) => c.name));

    for (const char of parsed.newCharacters) {
      if (!char.name || char.name.trim().length === 0) {
        continue;
      }

      // Skip if already exists
      if (existingNames.has(char.name)) {
        continue;
      }

      const role = char.role && isValidRole(char.role) ? char.role : "minor";

      try {
        await db.insert(characters).values({
          projectId,
          name: char.name,
          role,
          description: char.description || null,
          appearance: char.appearance || null,
          personality: char.personality || null,
          speechPattern: char.speechPattern || null,
        });
        existingNames.add(char.name); // Prevent duplicates within same batch
        newCharacterCount++;
      } catch (err) {
        errors.push(`Failed to insert character "${char.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // --- Extract new world settings ---
  if (parsed.newWorldSettings && Array.isArray(parsed.newWorldSettings) && parsed.newWorldSettings.length > 0) {
    // Get existing world settings for deduplication
    const existingSettings = await db
      .select({ title: worldSettings.title, category: worldSettings.category })
      .from(worldSettings)
      .where(eq(worldSettings.projectId, projectId));

    const existingKeys = new Set(existingSettings.map((s) => `${s.category}::${s.title}`));

    for (const setting of parsed.newWorldSettings) {
      if (!setting.title || !setting.content) {
        continue;
      }

      const category = setting.category || "その他";
      const key = `${category}::${setting.title}`;

      // Skip if already exists
      if (existingKeys.has(key)) {
        continue;
      }

      try {
        await db.insert(worldSettings).values({
          projectId,
          category,
          title: setting.title,
          content: setting.content,
        });
        existingKeys.add(key); // Prevent duplicates within same batch
        newWorldSettingCount++;
      } catch (err) {
        errors.push(`Failed to insert world setting "${setting.title}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { newCharacters: newCharacterCount, newWorldSettings: newWorldSettingCount, errors };
}
