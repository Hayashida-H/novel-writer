export interface GenreCategory {
  label: string;
  subGenres: string[];
}

export const GENRE_CATEGORIES: GenreCategory[] = [
  { label: "異世界転生/転移", subGenres: [] },
  { label: "恋愛", subGenres: ["異世界", "現実世界"] },
  { label: "ファンタジー", subGenres: ["ハイファンタジー", "ローファンタジー"] },
  {
    label: "文芸",
    subGenres: [
      "純文学",
      "ヒューマンドラマ",
      "歴史",
      "推理",
      "ホラー",
      "アクション",
      "コメディー",
    ],
  },
  { label: "SF", subGenres: ["VRゲーム", "宇宙", "空想科学", "パニック"] },
  { label: "その他", subGenres: ["童話", "詩", "エッセイ", "その他"] },
];

export function parseGenreDisplay(value: string | null | undefined): {
  category: string;
  subGenre: string;
} | null {
  if (!value) return null;
  const slash = value.indexOf("/");
  if (slash !== -1) {
    return { category: value.slice(0, slash), subGenre: value.slice(slash + 1) };
  }
  return { category: value, subGenre: "" };
}

export function formatGenreLabel(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = parseGenreDisplay(value);
  if (!parsed) return "";
  return parsed.subGenre ? `${parsed.category} / ${parsed.subGenre}` : parsed.category;
}
