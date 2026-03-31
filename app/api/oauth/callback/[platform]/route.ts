import { NextRequest, NextResponse } from "next/server"
import { getPlatform } from "@/config/platforms"
import { saveToken } from "@/lib/oauth/tokens"
import { consumeVerifier } from "@/lib/oauth/pkce"

export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const config = getPlatform(params.platform)
  if (!config || !config.oauthEnabled || !config.tokenUrl) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 })
  }

  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")

  if (!code) {
    const error = req.nextUrl.searchParams.get("error") ?? "No authorization code"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    return NextResponse.redirect(`${appUrl}?oauth=error&platform=${params.platform}&error=${encodeURIComponent(error)}`)
  }

  const clientId = process.env[`${params.platform.toUpperCase()}_CLIENT_ID`]
  const clientSecret = process.env[`${params.platform.toUpperCase()}_CLIENT_SECRET`]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const redirectUri = `${appUrl}/api/oauth/callback/${params.platform}`

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}?oauth=error&platform=${params.platform}&error=missing_client_id`)
  }

  try {
    const tokenBody: Record<string, string> = {
      code,
      client_id: clientId,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }

    // Include client_secret if available
    if (clientSecret) {
      tokenBody.client_secret = clientSecret
    }

    // PKCE: include code_verifier
    if (config.usePkce && state) {
      const verifier = consumeVerifier(state)
      if (verifier) {
        tokenBody.code_verifier = verifier
      }
    }

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[oauth callback] token exchange failed for ${params.platform}:`, errText)
      return NextResponse.redirect(`${appUrl}?oauth=error&platform=${params.platform}&error=token_exchange_failed`)
    }

    const data = await res.json()

    await saveToken(params.platform, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? "",
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
      scope: data.scope ?? "",
    })

    return NextResponse.redirect(`${appUrl}?oauth=success&platform=${params.platform}`)
  } catch (err) {
    console.error(`[oauth callback] error for ${params.platform}:`, err)
    return NextResponse.redirect(`${appUrl}?oauth=error&platform=${params.platform}&error=internal`)
  }
}
