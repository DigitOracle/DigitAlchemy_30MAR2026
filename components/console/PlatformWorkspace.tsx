"use client"
import { PLATFORMS } from "@/config/platforms"
import { CopyButton } from "./CopyButton"

type CardData = Record<string, unknown> | null

type Props = {
  platform: string
  cards: {
    trending: CardData
    audio: CardData
    hooks: CardData
    captions: CardData
    schedule: CardData
  }
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  )
}

function TrendingSection({ data }: { data: CardData }) {
  if (!data) return <Skeleton />
  const hashtags = (data.hashtags as string[]) ?? []
  const notes = data.notes as string
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {hashtags.map((tag, i) => (
          <span key={i} className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded">
            #{tag.replace(/^#/, "")}
          </span>
        ))}
      </div>
      {notes && <p className="text-xs text-gray-500">{notes}</p>}
    </div>
  )
}

function AudioSection({ data }: { data: CardData }) {
  if (!data) return <Skeleton />
  const suggestions = (data.suggestions as string[]) ?? []
  const mood = data.mood as string
  return (
    <div>
      {suggestions.map((s, i) => (
        <div key={i} className="flex items-center justify-between text-sm text-gray-700 py-1">
          <span>{s}</span>
          <CopyButton text={s} />
        </div>
      ))}
      {mood && <p className="text-xs text-gray-500 mt-1">Mood: {mood}</p>}
    </div>
  )
}

function HooksSection({ data }: { data: CardData }) {
  if (!data) return <Skeleton />
  const hooks = data as unknown as Array<{ text: string; type: string }>
  if (!Array.isArray(hooks)) return <Skeleton />
  return (
    <div className="space-y-2">
      {hooks.map((hook, i) => (
        <div key={i} className="flex items-start justify-between gap-2 bg-[#190A46]/5 border border-[#190A46]/10 rounded-lg p-3">
          <div>
            <p className="text-sm text-gray-900">{hook.text}</p>
            <span className="text-xs text-gray-400">{hook.type}</span>
          </div>
          <CopyButton text={hook.text} />
        </div>
      ))}
    </div>
  )
}

function CaptionsSection({ data }: { data: CardData }) {
  if (!data) return <Skeleton />
  const captions = data as unknown as Array<{ text: string; variant: string }>
  if (!Array.isArray(captions)) return <Skeleton />
  return (
    <div className="space-y-2">
      {captions.map((cap, i) => (
        <div key={i} className="flex items-start justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg p-3">
          <div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{cap.text}</p>
            <span className="text-xs text-gray-400">{cap.variant}</span>
          </div>
          <CopyButton text={cap.text} />
        </div>
      ))}
    </div>
  )
}

function ScheduleSection({ data }: { data: CardData }) {
  if (!data) return <Skeleton />
  const bestTimes = (data.bestTimes as string[]) ?? []
  const frequency = data.frequency as string
  const notes = data.notes as string
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {bestTimes.map((t, i) => (
          <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">{t}</span>
        ))}
      </div>
      {frequency && <p className="text-sm text-gray-700">Frequency: {frequency}</p>}
      {notes && <p className="text-xs text-gray-500 mt-1">{notes}</p>}
    </div>
  )
}

const CARD_SECTIONS = [
  { key: "trending" as const, label: "Trending" },
  { key: "audio" as const, label: "Audio" },
  { key: "hooks" as const, label: "Hooks" },
  { key: "captions" as const, label: "Captions" },
  { key: "schedule" as const, label: "Schedule" },
]

const RENDERERS = {
  trending: TrendingSection,
  audio: AudioSection,
  hooks: HooksSection,
  captions: CaptionsSection,
  schedule: ScheduleSection,
}

export function PlatformWorkspace({ platform, cards }: Props) {
  const config = PLATFORMS[platform]
  const label = config?.label ?? platform

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded bg-[#190A46] text-white text-xs font-bold flex items-center justify-center">
          {config?.icon ?? "?"}
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
      </div>

      <div className="space-y-5">
        {CARD_SECTIONS.map(({ key, label: sectionLabel }) => {
          const Renderer = RENDERERS[key]
          return (
            <div key={key}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{sectionLabel}</p>
              <Renderer data={cards[key]} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
