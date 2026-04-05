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
  if (!defaultKey) { console.log("[AYRSHARE-CONFIG] No AYRSHARE_API_KEY env var"); return null }

  const db = getDb()

  const userSnap = await db.doc(`users/${uid}`).get()
  if (!userSnap.exists) { console.log("[AYRSHARE-CONFIG] No user doc for", uid); return null }
  const userData = userSnap.data() as { role?: string; hasConnectedAccounts?: boolean }
  console.log("[AYRSHARE-CONFIG] User", uid, "role:", userData.role, "hasConnected:", userData.hasConnectedAccounts)

  if (userData.role === "admin") {
    return { apiKey: defaultKey }
  }

  const integSnap = await db.doc(`users/${uid}/integrations/ayrshare`).get()
  console.log("[AYRSHARE-CONFIG] Integration exists:", integSnap.exists, "data:", integSnap.exists ? JSON.stringify(integSnap.data()).slice(0, 100) : "n/a")

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
