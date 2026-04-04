/**
 * SPOTIFY INTEGRATION — ENRICHMENT ONLY
 *
 * Spotify is used for metadata enrichment, NOT trend detection.
 *
 * Allowed uses:
 *   - browse/featured-playlists (editorial curation)
 *   - browse/new-releases (new albums)
 *   - search (metadata lookup when we already know the track from another source)
 *   - artists/{id}/top-tracks (when we already know the artist)
 *   - audio-features/{id} (energy, tempo, danceability enrichment)
 *
 * NOT allowed:
 *   - Using search results as "trending" or "charts"
 *   - Using popularity field for trend scoring
 *   - Hardcoded playlist IDs as proxy for official charts
 *   - Labelling any Spotify data as "top tracks" or "regional charts"
 *
 * Trend detection comes from: ScrapeCreators, Apify, YouTube API, GDELT, xpoz
 * Spotify = artwork, genres, artist metadata, curated browse context
 */
"use server"

// NOTE: tokenCache is per-cold-start in serverless — acceptable for now since tokens
// last ~1h and cold starts are infrequent. Move to KV/Redis if token fetches become costly.
let tokenCache: { token: string; expires: number } | null = null

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.token

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
    return data.access_token
  } catch { return null }
}

// ── Types ──

export interface SpotifyTrackMeta {
  name: string
  artist: string
  albumArt: string | null
  spotifyUrl: string | null
  previewUrl: string | null
  durationMs: number
  energy: number | null
  tempo: number | null
  danceability: number | null
  genres: string[]
}

// ── Search: metadata enrichment only (when we already know the track) ──

export async function searchSpotifyTrack(query: string): Promise<SpotifyTrackMeta | null> {
  const token = await getSpotifyToken()
  if (!token) return null

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = await res.json()
    const track = data?.tracks?.items?.[0]
    if (!track) return null

    let features: Record<string, unknown> | null = null
    try {
      const featRes = await fetch(
        `https://api.spotify.com/v1/audio-features/${track.id}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000) },
      )
      if (featRes.ok) features = await featRes.json()
    } catch { /* audio features optional */ }

    return {
      name: track.name,
      artist: track.artists?.map((a: Record<string, unknown>) => a.name).join(", ") || "",
      albumArt: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || null,
      spotifyUrl: track.external_urls?.spotify || null,
      previewUrl: track.preview_url || null,
      durationMs: track.duration_ms || 0,
      energy: (features?.energy as number) ?? null,
      tempo: (features?.tempo as number) ?? null,
      danceability: (features?.danceability as number) ?? null,
      genres: [],
    }
  } catch { return null }
}

// ── Batch enrichment (for scan trending audio) ──

export async function enrichSongsWithSpotify(songs: { title: string; author: string }[]): Promise<Map<string, SpotifyTrackMeta>> {
  const results = new Map<string, SpotifyTrackMeta>()
  const batch = songs.slice(0, 5)
  const promises = batch.map(async (song) => {
    const query = `${song.title} ${song.author}`.trim()
    if (!query || query.length < 3) return
    const meta = await searchSpotifyTrack(query)
    if (meta) results.set(query.toLowerCase(), meta)
  })
  await Promise.allSettled(promises)
  return results
}
