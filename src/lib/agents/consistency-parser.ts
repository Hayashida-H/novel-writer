export interface ConsistencyIssue {
  severity: "error" | "warning" | "info";
  category: string;
  description: string;
  location?: string;
  suggestion?: string;
}

export interface ConsistencyResult {
  overallConsistency: "high" | "medium" | "low";
  issues: ConsistencyIssue[];
  foreshadowingUpdates: {
    action: string;
    title: string;
    details: string;
    suggestedStatus?: string;
  }[];
  newCharacters: { name: string; role: string; description: string }[];
  newWorldSettings: { category: string; title: string; content: string }[];
}

export function parseConsistencyResult(text: string): ConsistencyResult {
  const defaultResult: ConsistencyResult = {
    overallConsistency: "medium",
    issues: [],
    foreshadowingUpdates: [],
    newCharacters: [],
    newWorldSettings: [],
  };

  try {
    // Try to find JSON in the response (the prompt asks for JSON-only output)
    const jsonMatch = text.match(/\{[\s\S]*"continuityIssues"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        overallConsistency: parsed.overallConsistency || "medium",
        issues: (parsed.continuityIssues || []).map((issue: Record<string, string>) => ({
          severity: issue.severity || "info",
          category: issue.category || "general",
          description: issue.description || "",
          location: issue.location,
          suggestion: issue.suggestion,
        })),
        foreshadowingUpdates: parsed.foreshadowingUpdates || [],
        newCharacters: parsed.newCharacters || [],
        newWorldSettings: parsed.newWorldSettings || [],
      };
    }

    // Fallback: try parsing the whole text as JSON
    const parsed = JSON.parse(text.trim());
    if (parsed.continuityIssues) {
      return {
        overallConsistency: parsed.overallConsistency || "medium",
        issues: (parsed.continuityIssues || []).map((issue: Record<string, string>) => ({
          severity: issue.severity || "info",
          category: issue.category || "general",
          description: issue.description || "",
          location: issue.location,
          suggestion: issue.suggestion,
        })),
        foreshadowingUpdates: parsed.foreshadowingUpdates || [],
        newCharacters: parsed.newCharacters || [],
        newWorldSettings: parsed.newWorldSettings || [],
      };
    }
  } catch {
    // Fall through to text parsing
  }

  // Fallback: parse as plain text
  const lines = text.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const severity: ConsistencyIssue["severity"] =
        trimmed.includes("エラー") || trimmed.includes("重大")
          ? "error"
          : trimmed.includes("警告") || trimmed.includes("注意")
            ? "warning"
            : "info";
      defaultResult.issues.push({
        severity,
        category: "general",
        description: trimmed.slice(2),
      });
    }
  }

  // If no structured issues found, show the raw text as a single info item
  if (defaultResult.issues.length === 0 && text.trim()) {
    defaultResult.issues.push({
      severity: "info",
      category: "general",
      description: text.trim().slice(0, 1000),
    });
  }

  return defaultResult;
}
