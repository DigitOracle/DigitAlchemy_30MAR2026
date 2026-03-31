// config/platforms.ts — Platform registry for OAuth + content generation

export type PlatformConfig = {
  id: string
  label: string
  oauthEnabled: boolean
  scopes?: string[]
  authUrl?: string
  tokenUrl?: string
  refreshUrl?: string
  apiBase?: string
  icon: string
  usePkce?: boolean
}

export const PLATFORMS: Record<string, PlatformConfig> = {
  heygen: {
    id: "heygen",
    label: "HeyGen",
    oauthEnabled: true,
    scopes: [],
    authUrl: "https://app.heygen.com/oauth/authorize",
    tokenUrl: "https://api2.heygen.com/v1/oauth/token",
    refreshUrl: "https://api2.heygen.com/v1/oauth/refresh_token",
    apiBase: "https://api.heygen.com",
    icon: "HG",
    usePkce: true,
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

export function getOAuthPlatforms(): PlatformConfig[] {
  return Object.values(PLATFORMS).filter((p) => p.oauthEnabled)
}
