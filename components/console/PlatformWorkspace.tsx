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

type CardData = Record<string, unknown> | null
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
function GridCard({ title, badge, children, wide }: { title: string; badge?: string | null; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden ${wide ? "col-span-2" : ""}`}>
      <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h4>
        {badge && (
          <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{children}</p>
}

// ── Reverse-engineer dashboard layout ──
function ReverseEngineerDashboard({ platform, cards }: { platform: string; cards: Record<string, CardData> }) {
  const config = PLATFORMS[platform]
  const hasNiche = !!cards.topicTrends

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

      {/* ── LAYER A: Snapshot ── */}
      <SectionLabel>Snapshot</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <GridCard
          title={resolveCardLabel("platformTrends", "What\u2019s Hot Right Now", cards.platformTrends ?? null)}
          badge={resolveBadge(cards.platformTrends ?? null)}
        >
          {cards.platformTrends ? <PlatformTrendsCard data={cards.platformTrends} platform={platform} /> : <Skeleton />}
        </GridCard>

        <GridCard title={resolveCardLabel("trendingAudio", "Trending Audio", cards.trendingAudio ?? null)} badge={resolveBadge(cards.trendingAudio ?? null)}>
          {cards.trendingAudio ? <TrendingAudioCard data={cards.trendingAudio} platform={platform} /> : <Skeleton />}
        </GridCard>

        {hasNiche && (
          <GridCard title="Best Fit for Your Topic" badge={resolveBadge(cards.topicTrends ?? null)}>
            {cards.topicTrends ? <TopicTrendsCard data={cards.topicTrends} platform={platform} /> : <Skeleton />}
          </GridCard>
        )}
      </div>

      {/* ── LAYER B: Create ── */}
      <SectionLabel>Create</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <GridCard title={resolveCardLabel("videoIdeas", "Video Ideas", cards.videoIdeas ?? null)} badge={resolveBadge(cards.videoIdeas ?? null)} wide>
          {cards.videoIdeas ? <VideoIdeasCard data={cards.videoIdeas} platform={platform} /> : <Skeleton />}
        </GridCard>

        <GridCard title={resolveCardLabel("hooks", "Hook Ideas", cards.hooks ?? null)} badge={resolveBadge(cards.hooks ?? null)}>
          {cards.hooks ? <SubjectHookCard data={cards.hooks} platform={platform} /> : <Skeleton />}
        </GridCard>

        <GridCard title={resolveCardLabel("captions", "Caption Starters", cards.captions ?? null)} badge={resolveBadge(cards.captions ?? null)}>
          {cards.captions ? <CaptionsCopyCard data={cards.captions} platform={platform} /> : <Skeleton />}
        </GridCard>
      </div>

      {/* ── LAYER C: Support ── */}
      <SectionLabel>Support</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <GridCard title={resolveCardLabel("commercialAudio", "Licensed Audio", cards.commercialAudio ?? null)}>
          {cards.commercialAudio ? <CommercialAudioCard data={cards.commercialAudio} platform={platform} /> : <Skeleton />}
        </GridCard>

        <GridCard title={resolveCardLabel("vibeSuggestions", "Vibe Direction", cards.vibeSuggestions ?? null)}>
          {cards.vibeSuggestions ? <VibeSuggestionsCard data={cards.vibeSuggestions} platform={platform} /> : <Skeleton />}
        </GridCard>
      </div>

      {/* ── Trend Analysis (merged panel with tabs) ── */}
      <SectionLabel>Trend Analysis</SectionLabel>
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
