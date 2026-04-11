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

export type GazettePlatform =
  | "TikTok"
  | "Instagram"
  | "YouTube Shorts"
  | "Facebook"
  | "LinkedIn";

export const PLATFORM_DEFAULTS: Record<GazettePlatform, {
  hashtagCount: number;
  hashtagStyle: "trending-mix" | "niche-location" | "seo-keywords" | "minimal" | "professional";
  videoLength: string;
  captionTone: string;
  hasAudio: boolean;
  audioDeepLinkBase: string | null;
  postWindows: string;
  audioButtonLabel: string;
}> = {
  "TikTok": {
    hashtagCount: 5,
    hashtagStyle: "trending-mix",
    videoLength: "15\u201330 sec",
    captionTone: "Hook-first, drives comments and rewatches",
    hasAudio: true,
    audioDeepLinkBase: "https://www.tiktok.com/music/search?q=",
    postWindows: "2:00\u20136:00 PM",
    audioButtonLabel: "OPEN IN TIKTOK",
  },
  "Instagram": {
    hashtagCount: 5,
    hashtagStyle: "niche-location",
    videoLength: "30\u201360 sec",
    captionTone: "Trend-emotional, optimised for DM shares",
    hasAudio: true,
    audioDeepLinkBase: "https://www.instagram.com/reels/audio/",
    postWindows: "9:00\u201311:00 AM & 7:00\u20139:00 PM",
    audioButtonLabel: "FIND ON INSTAGRAM",
  },
  "YouTube Shorts": {
    hashtagCount: 5,
    hashtagStyle: "seo-keywords",
    videoLength: "60\u201390 sec",
    captionTone: "Benefit-led or question-based, keyword-rich for search",
    hasAudio: false,
    audioDeepLinkBase: null,
    postWindows: "6:00\u20139:00 AM & 5:00\u20137:00 PM",
    audioButtonLabel: "",
  },
  "Facebook": {
    hashtagCount: 2,
    hashtagStyle: "minimal",
    videoLength: "60\u201390 sec",
    captionTone: "Conversational, community-focused",
    hasAudio: false,
    audioDeepLinkBase: null,
    postWindows: "1:00\u20133:00 PM",
    audioButtonLabel: "",
  },
  "LinkedIn": {
    hashtagCount: 3,
    hashtagStyle: "professional",
    videoLength: "60\u201390 sec",
    captionTone: "Professional, insight-led, adds industry perspective",
    hasAudio: false,
    audioDeepLinkBase: null,
    postWindows: "8:00\u201310:00 AM (weekdays only)",
    audioButtonLabel: "",
  },
};
