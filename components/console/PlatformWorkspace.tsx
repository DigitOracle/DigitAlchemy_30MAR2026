"use client"
import { PLATFORMS } from "@/config/platforms"
import { TrendingTopicsCard } from "@/components/sections/TrendingTopicsCard"
import { MusicAudioCard } from "@/components/sections/MusicAudioCard"
import { SubjectHookCard } from "@/components/sections/SubjectHookCard"
import { CaptionsCopyCard } from "@/components/sections/CaptionsCopyCard"
import { PostingScheduleCard } from "@/components/sections/PostingScheduleCard"

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

function Skeleton({ label }: { label: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">{label}</h4>
      <div className="animate-pulse space-y-2">
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  )
}

const CARD_ORDER = [
  { key: "trending" as const, label: "Trending Topics", Component: TrendingTopicsCard },
  { key: "audio" as const, label: "Music / Audio", Component: MusicAudioCard },
  { key: "hooks" as const, label: "Subject / Hook Angles", Component: SubjectHookCard },
  { key: "captions" as const, label: "Captions / Copy", Component: CaptionsCopyCard },
  { key: "schedule" as const, label: "Posting Schedule", Component: PostingScheduleCard },
]

export function PlatformWorkspace({ platform, cards }: Props) {
  const config = PLATFORMS[platform]

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded bg-[#190A46] text-white text-xs font-bold flex items-center justify-center">
          {config?.icon ?? "?"}
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{config?.label ?? platform}</h3>
      </div>

      <div className="space-y-4 ml-8">
        {CARD_ORDER.map(({ key, label, Component }) => {
          const data = cards[key]
          if (!data) return <Skeleton key={key} label={label} />
          return (
            <div key={key} className="animate-fade-in">
              <Component data={data} platform={platform} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
