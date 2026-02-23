"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { GENRE_CATEGORIES } from "@/lib/constants/genres";

interface GenreSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function GenreSelector({
  value,
  onValueChange,
  placeholder = "ジャンルを選択",
}: GenreSelectorProps) {
  const allValues = useMemo(() => {
    const values: { value: string; label: string; group: string }[] = [];
    for (const cat of GENRE_CATEGORIES) {
      if (cat.subGenres.length === 0) {
        values.push({ value: cat.label, label: cat.label, group: "" });
      } else {
        for (const sub of cat.subGenres) {
          values.push({
            value: `${cat.label}/${sub}`,
            label: `${cat.label} / ${sub}`,
            group: cat.label,
          });
        }
      }
    }
    return values;
  }, []);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {GENRE_CATEGORIES.map((cat) => {
          if (cat.subGenres.length === 0) {
            return (
              <SelectItem key={cat.label} value={cat.label}>
                {cat.label}
              </SelectItem>
            );
          }
          return (
            <SelectGroup key={cat.label}>
              <SelectLabel>{cat.label}</SelectLabel>
              {cat.subGenres.map((sub) => (
                <SelectItem key={`${cat.label}/${sub}`} value={`${cat.label}/${sub}`}>
                  {sub}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
