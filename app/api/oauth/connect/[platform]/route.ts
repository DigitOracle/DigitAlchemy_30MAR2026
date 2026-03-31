import { NextRequest, NextResponse } from "next/server"
import { getPlatform } from "@/config/platforms"
import { generateCodeVerifier, generateCodeChallenge, storeVerifier } from "@/lib/oauth/pkce"
import crypto from "crypto"

export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const config = getPlatform(params.platform)
  if (!config || !config.oauthEnabled || !config.authUrl) {
    return NextResponse.json(
      { error: `OAuth not available for ${params.platform}` },
      { status: 400 }
    )
  }

  const clientId = process.env[`${params.platform.toUpperCase()}_CLIENT_ID`]
  if (!clientId) {
    return NextResponse.json(
      { error: `${params.platform} client ID not configured` },
      { status: 500 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const redirectUri = `${appUrl}/api/oauth/callback/${params.platform}`
  const state = crypto.randomBytes(16).toString("hex")

  const authParams = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  })

  // PKCE for platforms that require it (HeyGen)
  if (config.usePkce) {
    const verifier = generateCodeVerifier()
    const challenge = generateCodeChallenge(verifier)
    storeVerifier(state, verifier)
    authParams.set("code_challenge", challenge)
    authParams.set("code_challenge_method", "S256")
  }

  if (config.scopes?.length) {
    authParams.set("scope", config.scopes.join(" "))
  }

  const authUrl = `${config.authUrl}?${authParams.toString()}`
  return NextResponse.redirect(authUrl)
}
