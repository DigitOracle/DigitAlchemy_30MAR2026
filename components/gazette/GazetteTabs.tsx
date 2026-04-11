"use client"
import { useState, useEffect, useCallback } from "react"
import { T, BROADSHEET, type CategoryKey } from "./tokens"
import { CardRow } from "./CardRow"
import { HookPicker } from "./HookPicker"
import { RepurposePanel } from "./RepurposePanel"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import type { GazetteMode, GazetteCard, HookAngle, TopPost } from "@/types/gazette-ui"

const REACT_CATEGORIES: CategoryKey[] = ["AUDIO_VIRAL", "TREND_ALERT", "CULTURAL_MOMENT", "BRAND_SIGNAL"]
const PLAN_CATEGORIES: CategoryKey[] = ["CREATOR_SPOTLIGHT", "TREND_ALERT", "REGIONAL_PULSE", "TECH_INNOVATION"]

// Map API concept card (types/conceptCard.ts) to GazetteCard UI shape
function apiCardToGazette(card: Record<string, unknown>, index: number): GazetteCard {
  const source = (card.source as string) || "trend"
  const categoryMap: Record<string, CategoryKey> = {
    trend: "TREND_ALERT",
    style: "CREATOR_SPOTLIGHT",
    blend: "BRAND_SIGNAL",
  }
  const confidence = typeof card.confidence === "number"
    ? Math.round(card.confidence * 100)
    : card.confidence === "high" ? 85 : card.confidence === "medium" ? 60 : 35

  const pf = card.platformFormat as { platform?: string; format?: string } | undefined
  const platform = pf?.platform || "tiktok"
  const format = pf?.format || "video"
  const fitMap: Record<string, string> = { tiktok: "TikTok", instagram: "Reels", youtube: "YouTube", linkedin: "LinkedIn" }

  return {
    id: (card.id as string) || `card-${index}`,
    category: categoryMap[source] || "TREND_ALERT",
    headline: (card.title as string) || "Untitled",
    hookSuggestion: (card.hook as string) || "",
    confidence,
    timeWindow: "4\u20138 hrs",
    effort: confidence >= 70 ? "Quick post" : "Planned piece",
    platformFit: [`${fitMap[platform] || platform} \u2713\u2713\u2713`],
    sourceSignal: source === "trend" ? "TrendRadar" : source === "style" ? "Content DNA" : "Blended",
    actedOn: false,
    dismissed: false,
    saved: false,
    generatedAt: new Date(((card.createdAt as number) || Date.now())).toISOString(),
    angles: [],
    suggestedFormats: [`${format} on ${platform}`],
    body: (card.body as string) || "",
    hashtags: (card.hashtags as string[]) || [],
    captions: ["", "", ""],
    trendingSoundName: undefined,
  }
}

const CATEGORY_TAGS: Record<string, string[]> = {
  AUDIO_VIRAL:       ["AudioTrend", "TikTokSound", "ViralAudio", "SoundOn", "FYP"],
  TREND_ALERT:       ["Trending", "TrendAlert", "BreakingTrend", "FYP", "CreatorTips"],
  BRAND_SIGNAL:      ["BrandWatch", "MarketingTips", "BrandStrategy", "ContentCreator", "FYP"],
  CULTURAL_MOMENT:   ["CultureWatch", "Zeitgeist", "PopCulture", "CulturalTrend", "FYP"],
  CREATOR_SPOTLIGHT: ["CreatorEconomy", "ContentCreator", "CreatorTips", "Spotlight", "FYP"],
  REGIONAL_PULSE:    ["RegionalTrend", "LocalContent", "AreaWatch", "RegionalNews", "FYP"],
  TECH_INNOVATION:   ["TechNews", "Innovation", "TechTrend", "FutureTech", "FYP"],
}

function enrichCard(card: GazetteCard): GazetteCard {
  if (!card.captions || card.captions.every(c => !c)) {
    console.warn(`[gazette-ux] WARNING: card ${card.id} missing captions — using mock`)
    const topic = card.headline.slice(0, 40)
    card.captions = [
      `The thing nobody tells you about ${topic}`,
      `3 reasons ${topic} matters right now`,
      `Everyone's wrong about this. Here's the actual truth.`,
    ]
  }
  if (!card.hashtags || card.hashtags.length === 0) {
    console.warn(`[gazette-ux] WARNING: card ${card.id} missing hashtags — using mock`)
    card.hashtags = CATEGORY_TAGS[card.category] ?? ["Trending", "FYP", "Creator", "Content", "Viral"]
  }
  return card
}

export function GazetteTabs({ userId, mode }: { userId: string; mode: GazetteMode }) {
  const [cards, setCards] = useState<GazetteCard[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerCard, setPickerCard] = useState<GazetteCard | null>(null)
  const [topPost, setTopPost] = useState<TopPost | null>(null)

  const fetchCards = useCallback(async () => {
    setLoading(true)
    try {
      const token = await auth?.currentUser?.getIdToken()
      if (!token) { setLoading(false); return }
      const res = await fetch(`/api/concept-cards?region=AE&platform=tiktok&horizon=24h`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      const raw = (data.cards || []) as Record<string, unknown>[]
      setCards(raw.map(apiCardToGazette).map(enrichCard))
    } catch (e) {
      console.error("[gazette] fetch error", e)
    }
    setLoading(false)
  }, [])

  const fetchTopPost = useCallback(async () => {
    try {
      const token = await auth?.currentUser?.getIdToken()
      if (!token) return
      const res = await fetch(`/api/dashboard?platform=all&range=30&uid=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      const posts = (data.topPosts || []) as Record<string, unknown>[]
      if (posts.length > 0) {
        const p = posts[0]
        setTopPost({
          text: (p.text as string) || "",
          views: (p.views as number) || 0,
          platform: (p.platform as string) || "",
          publishedAt: (p.date as string) || new Date().toISOString(),
          postUrl: (p.postUrl as string) || undefined,
        })
      }
    } catch {}
  }, [userId])

  useEffect(() => {
    fetchCards()
    fetchTopPost()
  }, [fetchCards, fetchTopPost])

  const categories = mode === "PLAN_AHEAD" ? PLAN_CATEGORIES : REACT_CATEGORIES
  const cardsByCategory = (cat: CategoryKey) => cards.filter(c => c.category === cat)

  const handleAct = async (card: GazetteCard, angle: HookAngle, format: string) => {
    if (!db) return
    try {
      await setDoc(doc(db, `users/${userId}/card_feedback/${card.id}`), {
        actedOn: true,
        actedAt: serverTimestamp(),
        cardCategory: card.category,
        selectedAngle: angle.type,
        selectedFormat: format,
      })
    } catch {}
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, actedOn: true } : c))
    setPickerCard(null)
  }

  const handleDismiss = async (card: GazetteCard) => {
    if (!db) return
    try {
      await setDoc(doc(db, `users/${userId}/card_feedback/${card.id}`), {
        dismissed: true,
        dismissedAt: serverTimestamp(),
        dismissedDate: new Date().toISOString().split("T")[0],
      })
    } catch {}
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, dismissed: true } : c))
  }

  const handleSave = async (card: GazetteCard) => {
    if (!db) return
    try {
      await setDoc(doc(db, `users/${userId}/card_feedback/${card.id}`), {
        saved: true,
        savedAt: serverTimestamp(),
      }, { merge: true })
    } catch {}
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, saved: true } : c))
  }

  const handleRepurposeSave = async (option: string) => {
    if (!db) return
    try {
      // Permitted write: repurpose queue
      // users/{uid}/repurpose_queue/{timestamp}
      // Logs repurpose actions from RepurposePanel to user's content queue.
      await setDoc(doc(db, `users/${userId}/repurpose_queue/${Date.now()}`), {
        option,
        savedAt: serverTimestamp(),
        sourcePost: topPost?.text?.slice(0, 100),
      })
    } catch {}
  }

  const reactCount = REACT_CATEGORIES.reduce((n, c) => n + cards.filter(x => x.category === c && !x.dismissed).length, 0)
  const planCount = PLAN_CATEGORIES.reduce((n, c) => n + cards.filter(x => x.category === c && !x.dismissed).length, 0)
  const totalVisible = cards.filter(c => !c.dismissed).length

  useEffect(() => {
    localStorage.setItem("da_gazette_card_count", String(totalVisible))
  }, [totalVisible])

  return (
    <div id="gazette-cards">
      {mode === "REPURPOSE" ? (
        <RepurposePanel topPost={topPost} onSave={handleRepurposeSave} />
      ) : (
        <>
          <div className="gazette-tabs-bar">
            <span className="gazette-tab-label">
              {mode === "REACT_NOW" ? `\u26A1 React Now (${reactCount})` : `\uD83C\uDFAF In My Lane (${planCount})`}
            </span>
          </div>

          {(() => {
            let offset = 0
            return categories.map(cat => {
              const catCards = cardsByCategory(cat)
              const row = (
                <CardRow
                  key={cat}
                  category={cat}
                  cards={catCards}
                  loading={loading}
                  indexOffset={offset}
                  onTap={(card) => setPickerCard(card)}
                  onDismiss={handleDismiss}
                  onSave={handleSave}
                />
              )
              offset += catCards.filter(c => !c.dismissed).length
              return row
            })
          })()}

          {!loading && cards.length === 0 && (
            <div className="gazette-empty">
              <p>No cards available right now. Check back in a few minutes.</p>
            </div>
          )}
        </>
      )}

      {pickerCard && (
        <HookPicker
          card={pickerCard}
          onAct={(angle, format) => handleAct(pickerCard, angle, format)}
          onClose={() => setPickerCard(null)}
        />
      )}

      <style>{`
        .gazette-tabs-bar {
          display: flex; padding: 0 20px;
          border-bottom: 2px solid ${BROADSHEET.rule};
          background: ${BROADSHEET.paperDark};
        }
        .gazette-tab-label {
          padding: 8px 16px;
          border-bottom: 3px solid ${BROADSHEET.ink};
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 12px; font-weight: 700; color: ${BROADSHEET.ink};
          font-variant: small-caps; letter-spacing: 0.1em;
        }
        .gazette-empty {
          text-align: center; padding: 60px 20px;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 14px; color: ${BROADSHEET.inkFaded}; font-style: italic;
        }
      `}</style>
    </div>
  )
}
