export function parseJsonArray<T>(text: string): T[] {
  let cleaned = text.trim();

  // Strip markdown code fences
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Find outermost JSON array
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("No JSON array found in response");
  }

  const jsonStr = cleaned.slice(start, end + 1);
  return JSON.parse(jsonStr) as T[];
}
