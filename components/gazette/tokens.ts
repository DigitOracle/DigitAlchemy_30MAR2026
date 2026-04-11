export const T = {
  // Brand
  ink:     "#190A46",
  mid:     "#3D2A8A",
  accent:  "#7B5EA7",

  // Semantic
  bg:      "#0B0718",
  surface: "#13102A",
  border:  "rgba(123,94,167,0.25)",
  text:    "#F5F0FF",
  muted:   "rgba(245,240,255,0.5)",

  // Category colors
  categories: {
    AUDIO_VIRAL:       { bg: "#7B5EA7", icon: "\uD83C\uDFB5" },
    TREND_ALERT:       { bg: "#E85D04", icon: "\uD83D\uDD25" },
    BRAND_SIGNAL:      { bg: "#1D4ED8", icon: "\uD83D\uDCE2" },
    CULTURAL_MOMENT:   { bg: "#0D9488", icon: "\uD83C\uDF0D" },
    CREATOR_SPOTLIGHT: { bg: "#D97706", icon: "\u2B50" },
    REGIONAL_PULSE:    { bg: "#DC2626", icon: "\uD83D\uDCCD" },
    TECH_INNOVATION:   { bg: "#0891B2", icon: "\u26A1" },
  },
} as const;

export type CategoryKey = keyof typeof T.categories;
