// lib/oauth/tokens.ts — Firestore-backed OAuth token storage

import { getDb } from "@/lib/jobStore"
import { getPlatform } from "@/config/platforms"

const COLLECTION = "oauth_tokens"

export type OAuthToken = {
  platform: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope: string
  updatedAt: string
}

export async function saveToken(platform: string, tokenData: Omit<OAuthToken, "platform" | "updatedAt">): Promise<void> {
  const db = getDb()
  const doc: OAuthToken = {
    platform,
    ...tokenData,
    updatedAt: new Date().toISOString(),
  }
  await db.collection(COLLECTION).doc(platform).set(doc)
}

export async function getToken(platform: string): Promise<OAuthToken | null> {
  const db = getDb()
  const doc = await db.collection(COLLECTION).doc(platform).get()
  return doc.exists ? (doc.data() as OAuthToken) : null
}

export async function isTokenValid(platform: string): Promise<boolean> {
  const token = await getToken(platform)
  if (!token) return false
  return token.expiresAt > Date.now()
}

export async function refreshAccessToken(platform: string): Promise<string | null> {
  const token = await getToken(platform)
  if (!token?.refreshToken) return null

  const config = getPlatform(platform)
  if (!config?.refreshUrl) return null

  const clientId = process.env[`${platform.toUpperCase()}_CLIENT_ID`]
  if (!clientId) return null

  try {
    const res = await fetch(config.refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()

    const newToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
      scope: data.scope ?? token.scope,
    }

    await saveToken(platform, newToken)
    return newToken.accessToken
  } catch {
    return null
  }
}
