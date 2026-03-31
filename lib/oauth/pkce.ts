// lib/oauth/pkce.ts — PKCE S256 helper for HeyGen OAuth

import crypto from "crypto"

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url")
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url")
}

// Store verifier in a short-lived map keyed by state
// In production, use a Redis/Firestore TTL document
const verifierStore = new Map<string, { verifier: string; createdAt: number }>()

export function storeVerifier(state: string, verifier: string): void {
  verifierStore.set(state, { verifier, createdAt: Date.now() })
  // Clean entries older than 10 minutes
  for (const [key, val] of verifierStore.entries()) {
    if (Date.now() - val.createdAt > 600_000) verifierStore.delete(key)
  }
}

export function consumeVerifier(state: string): string | null {
  const entry = verifierStore.get(state)
  if (!entry) return null
  verifierStore.delete(state)
  return entry.verifier
}
