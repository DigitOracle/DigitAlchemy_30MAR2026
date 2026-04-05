import { getDb } from "@/lib/jobStore"

export interface AyrshareConfig {
  apiKey: string
  profileKey?: string
}

/**
 * Resolve Ayrshare credentials for a user.
 *
 * - Admin users (or users without a profile key): use the default env var AYRSHARE_API_KEY
 * - Members with a connected profile: use the default API key + their Profile-Key header
 * - Members without a connection: returns null (not_connected)
 */
export async function getAyrshareConfig(uid: string | null): Promise<AyrshareConfig | null> {
  if (!uid) return null
  const defaultKey = process.env.AYRSHARE_API_KEY
  if (!defaultKey) return null

  const db = getDb()

  const userSnap = await db.doc(`users/${uid}`).get()
  if (!userSnap.exists) return null
  const userData = userSnap.data() as { role?: string; hasConnectedAccounts?: boolean }

  if (userData.role === "admin") {
    return { apiKey: defaultKey }
  }

  const integSnap = await db.doc(`users/${uid}/integrations/ayrshare`).get()

  if (integSnap.exists) {
    const data = integSnap.data() as { profileKey?: string }
    if (data.profileKey) {
      return { apiKey: defaultKey, profileKey: data.profileKey }
    }
  }

  return null
}

/**
 * Save an Ayrshare profile key for a user (member onboarding).
 */
export async function saveAyrshareProfileKey(uid: string, profileKey: string, platforms: string[]): Promise<void> {
  const db = getDb()
  await db.doc(`users/${uid}/integrations/ayrshare`).set({
    profileKey,
    platforms,
    connectedAt: new Date().toISOString(),
  })
  // Mark user as having connected accounts
  await db.doc(`users/${uid}`).update({ hasConnectedAccounts: true })
}
