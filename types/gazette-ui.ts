import type { CategoryKey } from "@/components/gazette/tokens";

export type GazetteMode = "REACT_NOW" | "PLAN_AHEAD" | "REPURPOSE";

export interface HookAngle {
  type: "Curiosity gap" | "Numbers" | "Hot take" | "Story" | "Question" | "Shock" | "Challenge";
  hookText: string;
}

export interface GazetteCard {
  id: string;
  category: CategoryKey;
  headline: string;
  hookSuggestion: string;
  confidence: number;
  timeWindow: string;
  effort: "Quick post" | "Planned piece" | "Deep dive";
  platformFit: string[];
  dnaMatch?: number;
  sourceSignal?: string;
  actedOn: boolean;
  dismissed: boolean;
  saved: boolean;
  generatedAt: string;
  angles: HookAngle[];
  suggestedFormats: string[];
  body?: string;
  hashtags: string[];
  captions: [string, string, string];
  trendingSoundName?: string;
}

export interface PostWindow {
  label: string;
  times: string;
}

export interface RepurposeOption {
  icon: string;
  label: string;
  description: string;
}

export interface TopPost {
  text: string;
  views: number;
  platform: string;
  publishedAt: string;
  postUrl?: string;
}
