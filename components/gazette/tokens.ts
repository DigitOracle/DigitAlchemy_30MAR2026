// BROADSHEET: the full page chrome — cream paper world
export const BROADSHEET = {
  paper:       "#F5F0E8",
  paperDark:   "#EDE8DC",
  ink:         "#1A1008",
  inkFaded:    "#4A3F35",
  inkLight:    "#8B7355",
  rule:        "#2A1F15",
  ruleLight:   "rgba(42,31,21,0.25)",
  accent:      "#8B0000",
  accentAmber: "#7A4F00",
  burnEdge:    "#C8BAA4",
} as const;

// T: dark palette — used for TimeBanner ONLY
export const T = {
  ink:     "#190A46",
  mid:     "#3D2A8A",
  accent:  "#7B5EA7",
  bg:      "#0B0718",
  surface: "#13102A",
  border:  "rgba(123,94,167,0.25)",
  text:    "#F5F0FF",
  muted:   "rgba(245,240,255,0.5)",
  categories: {
    AUDIO_VIRAL:       { bg: "#7A4F00", icon: "\u266A" },
    TREND_ALERT:       { bg: "#8B0000", icon: "\u2191" },
    BRAND_SIGNAL:      { bg: "#1A3A5C", icon: "\u25C6" },
    CULTURAL_MOMENT:   { bg: "#1A3A2A", icon: "\u25C9" },
    CREATOR_SPOTLIGHT: { bg: "#5C3A00", icon: "\u2605" },
    REGIONAL_PULSE:    { bg: "#5C1A00", icon: "\u25CF" },
    TECH_INNOVATION:   { bg: "#1A3A4A", icon: "\u2699" },
  },
} as const;

export type CategoryKey = keyof typeof T.categories;
