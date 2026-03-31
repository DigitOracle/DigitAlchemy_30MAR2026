// config/platforms.ts — Platform registry for content generation

export type PlatformConfig = {
  id: string
  label: string
  oauthEnabled: boolean
  apiKeyEnv?: string
  apiBase?: string
  videoEndpoint?: string
  icon: string
}

export const PLATFORMS: Record<string, PlatformConfig> = {
  heygen: {
    id: "heygen",
    label: "HeyGen",
    oauthEnabled: false,
    apiKeyEnv: "HEYGEN_API_KEY",
    apiBase: "https://api.heygen.com",
    videoEndpoint: "/v1/video_status.get?video_id={videoId}",
    icon: "HG",
  },
  instagram: { id: "instagram", label: "Instagram", oauthEnabled: false, icon: "IG" },
  tiktok:    { id: "tiktok",    label: "TikTok",    oauthEnabled: false, icon: "TT" },
  linkedin:  { id: "linkedin",  label: "LinkedIn",  oauthEnabled: false, icon: "LI" },
  youtube:   { id: "youtube",   label: "YouTube",   oauthEnabled: false, icon: "YT" },
  x:         { id: "x",         label: "X / Twitter", oauthEnabled: false, icon: "X" },
  facebook:  { id: "facebook",  label: "Facebook",  oauthEnabled: false, icon: "FB" },
}

export function getPlatform(id: string): PlatformConfig | undefined {
  return PLATFORMS[id]
}
