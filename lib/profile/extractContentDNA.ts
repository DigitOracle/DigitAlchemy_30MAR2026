import Anthropic from "@anthropic-ai/sdk"

export interface ExtractedDNA {
  topics: string[]
  tone: string
  visualStyle: string
  audioPreference: string
  captionStyle: string
  hashtags: string[]
  contentSummary: string
}

export async function extractContentDNA(
  transcript: string,
  platform: string,
  metadata?: { duration?: number; title?: string; description?: string }
): Promise<ExtractedDNA | null> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Analyze this ${platform} video transcript and extract the creator's content DNA. This will be used to personalise future content recommendations.

TRANSCRIPT:
${transcript.slice(0, 3000)}

${metadata?.title ? `TITLE: ${metadata.title}` : ""}
${metadata?.description ? `DESCRIPTION: ${metadata.description}` : ""}
${metadata?.duration ? `DURATION: ${metadata.duration} seconds` : ""}

Return ONLY a JSON object with these fields, no other text:
{
  "topics": ["topic1", "topic2", "topic3"],
  "tone": "one of: professional, casual, humorous, educational, inspirational, storytelling, aggressive, calm",
  "visualStyle": "one of: talking-head, b-roll-heavy, text-overlay, aesthetic-moody, fast-cuts, tutorial-screencast, vlog, interview",
  "audioPreference": "one of: trending-sounds, original-audio, voiceover, background-music, no-audio",
  "captionStyle": "one of: short-punchy, long-storytelling, question-hooks, list-format, cta-heavy, minimal",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "contentSummary": "one sentence describing what this creator typically makes"
}

Be specific to what's in the transcript. Don't guess — only extract what's evident from the content.`,
      }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const clean = text.replace(/```json|```/g, "").trim()
    return JSON.parse(clean) as ExtractedDNA
  } catch (err) {
    console.error("[CONTENT DNA] Extraction failed:", err)
    return null
  }
}
