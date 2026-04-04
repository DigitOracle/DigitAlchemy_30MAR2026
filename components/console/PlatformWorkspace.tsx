"use client"
import { useState } from "react"
import { PLATFORMS } from "@/config/platforms"
import { PlatformTrendsCard } from "@/components/sections/PlatformTrendsCard"
import { TopicTrendsCard } from "@/components/sections/TopicTrendsCard"
import { TrendingAudioCard } from "@/components/sections/TrendingAudioCard"
import { CommercialAudioCard } from "@/components/sections/CommercialAudioCard"
import { VibeSuggestionsCard } from "@/components/sections/VibeSuggestionsCard"
import { SubjectHookCard } from "@/components/sections/SubjectHookCard"
import { CaptionsCopyCard } from "@/components/sections/CaptionsCopyCard"
import { PostingScheduleCard } from "@/components/sections/PostingScheduleCard"
import { VideoIdeasCard } from "@/components/sections/VideoIdeasCard"
import { TrendAnalysisPanel } from "@/components/sections/TrendAnalysisPanel"
import { HashtagChip } from "@/components/console/HashtagChip"

type CardData = Record<string, unknown> | null

// ── Concept card renderer for React Now bundled concepts ──
type ConceptData = { trend?: string; type?: string; whyNow?: string; hook?: string; videoIdea?: string; audio?: string; hashtags?: string[]; audience?: string; shelfLife?: string; confidence?: string; executionNotes?: string }

const SHELF_STYLES: Record<string, string> = { "24-72h": "bg-red-50 text-red-700", "1 week": "bg-amber-50 text-amber-700", "2 weeks": "bg-blue-50 text-blue-700", evergreen: "bg-green-50 text-green-700" }
const CONF_STYLES: Record<string, string> = { high: "bg-green-50 text-green-700", medium: "bg-amber-50 text-amber-700", low: "bg-gray-100 text-gray-500" }

function ConceptCardContent({ data }: { data: CardData }) {
  const c = (data as Record<string, unknown>)?.conceptData as ConceptData | undefined
  if (!c) return null
  const shelfCls = SHELF_STYLES[c.shelfLife ?? ""] ?? "bg-gray-100 text-gray-500"
  const confCls = CONF_STYLES[c.confidence ?? ""] ?? CONF_STYLES.medium
  const tags = c.hashtags ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {c.type && <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-50 text-purple-700">{c.type.replace(/_/g, " ")}</span>}
        {c.shelfLife && <span className={`px-2 py-0.5 text-[10px] rounded-full ${shelfCls}`}>{c.shelfLife}</span>}
        {c.confidence && <span className={`px-2 py-0.5 text-[10px] rounded-full ${confCls}`}>{c.confidence}</span>}
      </div>

      {c.whyNow && (
        <div>
          <p className="text-[10px] font-semibold text-purple-600 uppercase mb-0.5">Why now</p>
          <p className="text-xs text-gray-700">{c.whyNow}</p>
        </div>
      )}

      {c.videoIdea && (
        <div>
          <p className="text-[10px] font-semibold text-blue-600 uppercase mb-0.5">Video idea</p>
          <p className="text-xs text-gray-700">{c.videoIdea}</p>
        </div>
      )}

      {c.hook && (
        <div className="bg-gray-50 rounded-lg p-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold text-amber-600 uppercase mb-0.5">Hook</p>
            <p className="text-sm text-gray-900 font-medium">&ldquo;{c.hook}&rdquo;</p>
          </div>
          <button onClick={() => navigator.clipboard.writeText(c.hook ?? "")} className="text-[10px] text-gray-400 hover:text-amber-600 shrink-0">Copy</button>
        </div>
      )}

      {c.audio && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-red-600 uppercase">Audio:</span>
          <span className="text-xs text-gray-700">{c.audio}</span>
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-green-600 uppercase mb-1.5">Hashtags</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
            {tags.map((t) => <HashtagChip key={t} tag={t} />)}
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 pt-2 space-y-1.5">
        {c.audience && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase">Audience:</span>
            <span className="text-xs text-gray-700">{c.audience}</span>
          </div>
        )}
        {c.executionNotes && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Execution notes</p>
            <p className="text-xs text-gray-600">{c.executionNotes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
type AppMode = "optimize" | "reverse_engineer"

type Props = {
  platform: string
  mode?: AppMode
  cards: Record<string, CardData>
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-3 bg-gray-100 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  )
}

const LIVE_SOURCES = new Set(["scrape_creators_tiktok", "apify_live_scrape", "xpoz_social_signal", "official_platform"])


const BADGE_LABELS: Record<string, string> = {
  scrape_creators_tiktok: "live",
  scrape_creators_instagram_support: "scraped",
  apify_live_scrape: "live",
  xpoz_social_signal: "live",
  official_platform: "official",
  perplexity: "web signal",
  context_guided: "web signal",
  claude: "DigitAlchemy",
  inferred_fallback: "DigitAlchemy",
  synthesis: "DigitAlchemy",
  none: "",
}

function resolveBadge(data: CardData): string | null {
  if (!data || typeof data !== "object" || !("source" in data)) return null
  const raw = (data as Record<string, unknown>).source as string
  if (!raw || raw === "none") return null
  return BADGE_LABELS[raw] ?? raw
}

function resolveCardLabel(key: string, defaultLabel: string, data: CardData): string {
  if (!data || typeof data !== "object") return defaultLabel
  const rec = data as Record<string, unknown>
  // Use backend-provided label if present (dynamic based on production lag)
  if (typeof rec.label === "string" && rec.label) return rec.label
  const source = rec.source as string | undefined
  if (key === "platformTrends" && source && !LIVE_SOURCES.has(source)) {
    return "Context-Guided Platform Signals"
  }
  return defaultLabel
}

// ── Card wrapper for grid cells ──
const CONFIDENCE_STYLES: Record<string, { className: string; label: string }> = {
  high: { className: "bg-green-50 text-green-700 border-green-200", label: "HIGH CONFIDENCE" },
  medium: { className: "bg-amber-50 text-amber-700 border-amber-200", label: "MEDIUM CONFIDENCE" },
  low: { className: "bg-gray-50 text-gray-500 border-gray-200", label: "DIRECTIONAL ONLY" },
}

function GridCard({ title, badge, confidence, children, wide }: { title: string; badge?: string | null; confidence?: string | null; children: React.ReactNode; wide?: boolean }) {
  const confStyle = confidence ? CONFIDENCE_STYLES[confidence] : null
  return (
    <div className={`border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden ${wide ? "col-span-2" : ""}`}>
      <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h4>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
          {confStyle && (
            <span className={`text-[9px] border px-1.5 py-0.5 rounded ${confStyle.className}`}>
              {confStyle.label}
            </span>
          )}
        </div>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{children}</p>
}

// ── Card type → specialised renderer map ──
const CARD_RENDERERS: Record<string, (data: CardData, platform: string) => React.ReactNode> = {
  platformTrends: (d, p) => <PlatformTrendsCard data={d!} platform={p} />,
  topicTrends: (d, p) => <TopicTrendsCard data={d!} platform={p} />,
  trendingAudio: (d, p) => <TrendingAudioCard data={d!} platform={p} />,
  videoIdeas: (d, p) => <VideoIdeasCard data={d!} platform={p} />,
  hooks: (d, p) => <SubjectHookCard data={d!} platform={p} />,
  captions: (d, p) => <CaptionsCopyCard data={d!} platform={p} />,
  commercialAudio: (d, p) => <CommercialAudioCard data={d!} platform={p} />,
  vibeSuggestions: (d, p) => <VibeSuggestionsCard data={d!} platform={p} />,
}

// Generic renderer for unknown card types — renders JSON-like content
function GenericCardContent({ data }: { data: CardData }) {
  if (!data) return null
  const rec = data as Record<string, unknown>
  // Try to find the main content array/string
  const contentKeys = Object.keys(rec).filter((k) => !["label", "source", "provenance", "mode", "fetchedAt", "sourceElapsedMs"].includes(k))
  return (
    <div className="space-y-2 text-xs text-gray-700">
      {contentKeys.map((key) => {
        const val = rec[key]
        if (Array.isArray(val)) {
          return (
            <div key={key}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{key.replace(/([A-Z])/g, " $1").trim()}</p>
              <ul className="space-y-1">
                {(val as unknown[]).slice(0, 10).map((item, i) => (
                  <li key={i} className="text-xs text-gray-600">
                    {typeof item === "string" ? item : typeof item === "object" && item !== null
                      ? Object.values(item as Record<string, unknown>).filter((v) => typeof v === "string").join(" — ")
                      : String(item)}
                  </li>
                ))}
              </ul>
            </div>
          )
        }
        if (typeof val === "string" && val.length > 0) {
          return <p key={key} className="text-xs text-gray-600">{val}</p>
        }
        return null
      })}
    </div>
  )
}

// Trend analysis cards that use the dedicated panel
const TREND_ANALYSIS_KEYS = new Set(["trendRadar", "trendOutlook", "safeToProduceNow", "whyStillMatters", "tooLate"])

// ── Reverse-engineer dashboard — dynamic card rendering ──
function ReverseEngineerDashboard({ platform, cards }: { platform: string; cards: Record<string, CardData> }) {
  const config = PLATFORMS[platform]

  // Collect cards that have data, in insertion order (JS object key order)
  const activeCards = Object.entries(cards).filter(
    ([key, data]) => data !== null && !TREND_ANALYSIS_KEYS.has(key)
  )
  const hasTrendAnalysis = TREND_ANALYSIS_KEYS.has("trendRadar") && cards.trendRadar !== null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded bg-[#190A46] text-white text-xs font-bold flex items-center justify-center">
          {config?.icon ?? "?"}
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{config?.label ?? platform}</h3>
        <span className="text-[10px] bg-[#b87333]/10 text-[#b87333] px-1.5 py-0.5 rounded">trend scan</span>
      </div>

      {/* Dynamic card grid — cards appear as SSE events arrive */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {activeCards.map(([cardType, data]) => {
          const label = resolveCardLabel(cardType, cardType.replace(/([A-Z])/g, " $1").trim(), data)
          const badge = resolveBadge(data)
          const confidence = (data && typeof data === "object" && "confidence" in data) ? (data as Record<string, unknown>).confidence as string : null
          const renderer = CARD_RENDERERS[cardType]
          const isConceptCard = (data as Record<string, unknown>)?.type === "concept"
          const isWide = cardType === "videoIdeas" || cardType === "trendSummary" || cardType === "executionGuide"
          return (
            <div key={cardType} className="animate-fade-in">
              <GridCard title={label} badge={badge} confidence={confidence} wide={isWide}>
                {isConceptCard ? <ConceptCardContent data={data} /> : renderer ? renderer(data, platform) : <GenericCardContent data={data} />}
              </GridCard>
            </div>
          )
        })}
      </div>

      {/* Trend Analysis panel — shown when data arrives */}
      {hasTrendAnalysis && (
        <div className="animate-fade-in">
          <div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden p-4 mb-3">
            <TrendAnalysisPanel
              platform={platform}
              trendRadar={cards.trendRadar ?? null}
              trendOutlook={cards.trendOutlook ?? null}
              safeToProduceNow={cards.safeToProduceNow ?? null}
              whyStillMatters={cards.whyStillMatters ?? null}
              tooLate={cards.tooLate ?? null}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Copy-package builder ──
function buildCopyPackage(cards: Record<string, CardData>, platform: string, variant?: "instagram" | "linkedin" | "hook_caption"): string {
  const hashtags = ((cards.platformTrends as Record<string, unknown>)?.hashtags as string[]) ?? []
  const topicTags = ((cards.topicTrends as Record<string, unknown>)?.hashtags as string[]) ?? []
  const hooksRaw = cards.hooks
  const hooks = Array.isArray(hooksRaw) ? (hooksRaw as { text: string }[]) : Array.isArray((hooksRaw as Record<string, unknown>)?.hooks) ? ((hooksRaw as Record<string, unknown>).hooks as { text: string }[]) : []
  const captionsRaw = cards.captions
  const captions = Array.isArray(captionsRaw) ? (captionsRaw as { text: string; variant: string }[]) : Array.isArray((captionsRaw as Record<string, unknown>)?.captions) ? ((captionsRaw as Record<string, unknown>).captions as { text: string; variant: string }[]) : []
  const schedule = cards.schedule as Record<string, unknown> | null
  const bestTimes = (schedule?.bestTimes as string[]) ?? []
  const allTags = [...new Set([...hashtags, ...topicTags])].slice(0, 20)

  if (variant === "hook_caption") {
    const parts: string[] = []
    if (hooks.length > 0) parts.push("HOOKS\n" + hooks.map((h) => `- ${h.text}`).join("\n"))
    if (captions.length > 0) parts.push("CAPTIONS\n" + captions.map((c) => c.text).join("\n\n---\n\n"))
    return parts.join("\n\n")
  }

  const parts: string[] = []
  if (hooks.length > 0) parts.push(`HOOK: ${hooks[0].text}`)
  if (captions.length > 0) {
    const pick = variant === "linkedin" ? captions.find((c) => c.variant === "long") ?? captions[0] : captions.find((c) => c.variant === "short") ?? captions[0]
    parts.push(`CAPTION:\n${pick.text}`)
  }
  if (allTags.length > 0) {
    const limit = variant === "linkedin" ? 5 : variant === "instagram" ? 30 : 15
    parts.push("HASHTAGS: " + allTags.slice(0, limit).map((t) => `#${t.replace(/^#/, "")}`).join(" "))
  }
  if (bestTimes.length > 0) parts.push(`BEST TIMES: ${bestTimes.join(", ")}`)
  return parts.join("\n\n")
}

// ── Optimize dashboard layout (unified with Spot Trends) ──
function OptimizeDashboard({ platform, cards }: { platform: string; cards: Record<string, CardData> }) {
  const config = PLATFORMS[platform]
  const hasTopicTrends = !!cards.topicTrends

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded bg-[#190A46] text-white text-xs font-bold flex items-center justify-center">
          {config?.icon ?? "?"}
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{config?.label ?? platform}</h3>
        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">optimize</span>
      </div>

      {/* ── Copy Packages ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        <CopyPackageButton label="Copy Optimized Package" text={buildCopyPackage(cards, platform)} />
        {platform === "instagram" && <CopyPackageButton label="Copy Instagram Package" text={buildCopyPackage(cards, platform, "instagram")} />}
        {platform === "linkedin" && <CopyPackageButton label="Copy LinkedIn Package" text={buildCopyPackage(cards, platform, "linkedin")} />}
        <CopyPackageButton label="Copy Hook + Caption" text={buildCopyPackage(cards, platform, "hook_caption")} />
      </div>

      {/* ── LAYER A: Snapshot ── */}
      <SectionLabel>Snapshot</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <GridCard
          title={resolveCardLabel("platformTrends", "What\u2019s Working Now", cards.platformTrends ?? null)}
          badge={resolveBadge(cards.platformTrends ?? null)}
        >
          {cards.platformTrends ? <PlatformTrendsCard data={cards.platformTrends} platform={platform} /> : <Skeleton />}
        </GridCard>

        <GridCard title="Audio Options" badge={resolveBadge(cards.trendingAudio ?? null)}>
          {cards.trendingAudio ? <TrendingAudioCard data={cards.trendingAudio} platform={platform} /> : <Skeleton />}
        </GridCard>

        {hasTopicTrends && (
          <GridCard title="Best Fit Trends" badge={resolveBadge(cards.topicTrends ?? null)}>
            {cards.topicTrends ? <TopicTrendsCard data={cards.topicTrends} platform={platform} /> : <Skeleton />}
          </GridCard>
        )}

        <GridCard title="Post Timing" badge={resolveBadge(cards.schedule ?? null)}>
          {cards.schedule ? <PostingScheduleCard data={cards.schedule} platform={platform} /> : <Skeleton />}
        </GridCard>
      </div>

      {/* ── LAYER B: Create ── */}
      <SectionLabel>Create</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <GridCard title="Hook Ideas" badge={resolveBadge(cards.hooks ?? null)}>
          {cards.hooks ? <SubjectHookCard data={cards.hooks} platform={platform} /> : <Skeleton />}
        </GridCard>

        <GridCard title="Caption Starters" badge={resolveBadge(cards.captions ?? null)}>
          {cards.captions ? <CaptionsCopyCard data={cards.captions} platform={platform} /> : <Skeleton />}
        </GridCard>
      </div>

      {/* ── LAYER C: Support ── */}
      <SectionLabel>Support</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <GridCard title="Licensed Audio">
          {cards.commercialAudio ? <CommercialAudioCard data={cards.commercialAudio} platform={platform} /> : <Skeleton />}
        </GridCard>

        <GridCard title="Vibe Direction">
          {cards.vibeSuggestions ? <VibeSuggestionsCard data={cards.vibeSuggestions} platform={platform} /> : <Skeleton />}
        </GridCard>
      </div>
    </div>
  )
}

// ── Copy package button (small styled wrapper) ──
function CopyPackageButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      className="text-[11px] border border-gray-200 text-gray-500 hover:text-[#190A46] hover:border-[#190A46] px-2.5 py-1 rounded-lg transition-colors"
    >
      {copied ? "\u2713 Copied!" : label}
    </button>
  )
}

// ── Main export ──
export function PlatformWorkspace({ platform, mode = "optimize", cards }: Props) {
  if (mode === "reverse_engineer") {
    return <ReverseEngineerDashboard platform={platform} cards={cards} />
  }
  return <OptimizeDashboard platform={platform} cards={cards} />
}
