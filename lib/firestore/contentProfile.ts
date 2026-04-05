import { getDb } from "@/lib/jobStore"

export interface ContentDNASample {
  id?: string
  sourceType: "upload" | "ayrshare" | "url"
  platform: string
  transcript: string
  topics: string[]
  tone: string
  visualStyle: string
  audioPreference: string
  captionStyle: string
  hashtags: string[]
  duration: number
  analyzedAt: string
}

export interface ContentProfile {
  topics: string[]
  tone: string
  visualStyle: string
  audioPreference: string
  captionStyle: string
  hashtagPatterns: string[]
  sampleCount: number
  lastAnalyzedAt: string
  profileVersion: number
  confidence: "low" | "medium" | "high"
}

export async function saveDNASample(uid: string, sample: ContentDNASample): Promise<string> {
  const db = getDb()
  const ref = db.collection(`users/${uid}/content_samples`).doc()
  await ref.set({ ...sample, analyzedAt: new Date().toISOString() })
  return ref.id
}

export async function loadContentProfile(uid: string): Promise<ContentProfile | null> {
  const db = getDb()
  const snap = await db.doc(`users/${uid}/content_profile/main`).get()
  if (snap.exists) return snap.data() as ContentProfile
  return null
}

export async function saveContentProfile(uid: string, profile: ContentProfile): Promise<void> {
  const db = getDb()
  await db.doc(`users/${uid}/content_profile/main`).set({
    ...profile,
    lastAnalyzedAt: new Date().toISOString(),
  })
}

export function mergeProfileWithSample(existing: ContentProfile | null, sample: ContentDNASample): ContentProfile {
  if (!existing) {
    return {
      topics: sample.topics,
      tone: sample.tone,
      visualStyle: sample.visualStyle,
      audioPreference: sample.audioPreference,
      captionStyle: sample.captionStyle,
      hashtagPatterns: sample.hashtags,
      sampleCount: 1,
      lastAnalyzedAt: new Date().toISOString(),
      profileVersion: 1,
      confidence: "low",
    }
  }

  const count = existing.sampleCount + 1

  const topicCounts = new Map<string, number>()
  existing.topics.forEach(t => topicCounts.set(t, (topicCounts.get(t) || 0) + 1))
  sample.topics.forEach(t => topicCounts.set(t, (topicCounts.get(t) || 0) + 2))
  const rankedTopics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 10)

  const tagCounts = new Map<string, number>()
  existing.hashtagPatterns.forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1))
  sample.hashtags.forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 2))
  const rankedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 15)

  const tone = count <= 3 ? sample.tone : existing.tone
  const visualStyle = count <= 3 ? sample.visualStyle : existing.visualStyle
  const audioPreference = count <= 3 ? sample.audioPreference : existing.audioPreference
  const captionStyle = count <= 3 ? sample.captionStyle : existing.captionStyle

  return {
    topics: rankedTopics,
    tone,
    visualStyle,
    audioPreference,
    captionStyle,
    hashtagPatterns: rankedTags,
    sampleCount: count,
    lastAnalyzedAt: new Date().toISOString(),
    profileVersion: existing.profileVersion + 1,
    confidence: count >= 6 ? "high" : count >= 3 ? "medium" : "low",
  }
}
