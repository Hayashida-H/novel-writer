export interface PlotCandidate {
  id: string;
  title: string;
  description: string;
  genre: string;
  themes: string[];
  structureType: string;
  plotPoints: PlotPointSuggestion[];
  appeal: string;
}

export interface PlotPointSuggestion {
  act: string;
  title: string;
  description: string;
  isMajorTurningPoint: boolean;
}

export interface SuggestionRequest {
  genre?: string;
  preferences?: string;
  homage?: string;
  count?: number;
}
