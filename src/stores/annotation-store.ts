import { create } from "zustand";
import type { AnnotationType } from "@/types/annotation";

export interface LocalAnnotation {
  id: string;
  chapterId: string;
  paragraphIndex: number;
  startOffset: number | null;
  endOffset: number | null;
  anchorText: string | null;
  comment: string;
  annotationType: AnnotationType;
  status: "pending" | "submitted" | "processing" | "resolved" | "dismissed";
  synced: boolean;
  createdAt: Date;
}

interface AnnotationStore {
  annotations: LocalAnnotation[];
  selectedParagraph: number | null;
  showPopover: boolean;

  // Actions
  setAnnotations: (annotations: LocalAnnotation[]) => void;
  addAnnotation: (annotation: Omit<LocalAnnotation, "id" | "createdAt" | "synced" | "status">) => LocalAnnotation;
  removeAnnotation: (id: string) => void;
  updateAnnotation: (id: string, updates: Partial<LocalAnnotation>) => void;
  markSynced: (id: string) => void;
  selectParagraph: (index: number | null) => void;
  setShowPopover: (show: boolean) => void;
  getAnnotationsForParagraph: (paragraphIndex: number) => LocalAnnotation[];
  getUnsyncedAnnotations: () => LocalAnnotation[];
  clear: () => void;
}

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotations: [],
  selectedParagraph: null,
  showPopover: false,

  setAnnotations: (annotations) => set({ annotations }),

  addAnnotation: (annotation) => {
    const newAnnotation: LocalAnnotation = {
      ...annotation,
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      status: "pending",
      synced: false,
      createdAt: new Date(),
    };
    set((state) => ({
      annotations: [...state.annotations, newAnnotation],
    }));
    return newAnnotation;
  },

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    })),

  updateAnnotation: (id, updates) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

  markSynced: (id) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, synced: true } : a
      ),
    })),

  selectParagraph: (index) => set({ selectedParagraph: index }),

  setShowPopover: (show) => set({ showPopover: show }),

  getAnnotationsForParagraph: (paragraphIndex) =>
    get().annotations.filter((a) => a.paragraphIndex === paragraphIndex),

  getUnsyncedAnnotations: () =>
    get().annotations.filter((a) => !a.synced),

  clear: () => set({ annotations: [], selectedParagraph: null, showPopover: false }),
}));
