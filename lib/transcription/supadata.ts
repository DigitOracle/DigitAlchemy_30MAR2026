import { Supadata } from "@supadata/js"

const supadata = new Supadata({ apiKey: process.env.SUPADATA_API_KEY! })

export async function getSupadataTranscript(url: string): Promise<{ text: string; provenance: "observed" } | null> {
  try {
    const result = await supadata.transcript({ url, text: true })
    if (!result) return null

    // The SDK returns TranscriptOrJobId — check for content field
    const data = result as unknown as Record<string, unknown>
    const content = data.content
    if (!content) return null

    let text: string
    if (typeof content === "string") {
      text = content
    } else if (Array.isArray(content)) {
      text = (content as Array<{ text: string }>).map((s) => s.text).join(" ")
    } else {
      return null
    }

    if (!text.trim()) return null

    return { text, provenance: "observed" }
  } catch (e) {
    console.error("Supadata transcript failed:", e)
    return null
  }
}
