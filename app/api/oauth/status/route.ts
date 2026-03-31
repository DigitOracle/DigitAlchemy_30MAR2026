import { NextResponse } from "next/server"
import { PLATFORMS } from "@/config/platforms"
import { isTokenValid } from "@/lib/oauth/tokens"

export const runtime = "nodejs"

export async function GET() {
  const result: Record<string, boolean> = {}

  for (const [id, config] of Object.entries(PLATFORMS)) {
    if (config.oauthEnabled) {
      try {
        result[id] = await isTokenValid(id)
      } catch {
        result[id] = false
      }
    }
  }

  return NextResponse.json(result)
}
