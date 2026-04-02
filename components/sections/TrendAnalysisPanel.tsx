"use client"
import { useState } from "react"
import { TrendRadarCard } from "./TrendRadarCard"
import { TrendOutlookCard } from "./TrendOutlookCard"
import { WhyStillMattersCard } from "./WhyStillMattersCard"

type CardData = Record<string, unknown> | null

type Props = {
  platform: string
  trendRadar: CardData
  trendOutlook: CardData
  safeToProduceNow: CardData
  whyStillMatters: CardData
  tooLate: CardData
}

const TABS = [
  { key: "safeToProduceNow", label: "Good to Make" },
  { key: "trendOutlook", label: "Outlook" },
  { key: "whyStillMatters", label: "Why It Matters" },
  { key: "tooLate", label: "Too Late" },
  { key: "trendRadar", label: "All Scores" },
] as const

export function TrendAnalysisPanel({ platform, trendRadar, trendOutlook, safeToProduceNow, whyStillMatters, tooLate }: Props) {
  const [activeTab, setActiveTab] = useState<string>("safeToProduceNow")

  const tabData: Record<string, CardData> = { trendRadar, trendOutlook, safeToProduceNow, whyStillMatters, tooLate }
  const components: Record<string, React.ComponentType<{ data: Record<string, unknown>; platform: string }>> = {
    trendRadar: TrendRadarCard,
    trendOutlook: TrendOutlookCard,
    safeToProduceNow: TrendRadarCard,
    whyStillMatters: WhyStillMattersCard,
    tooLate: TrendRadarCard,
  }

  const activeData = tabData[activeTab]
  const ActiveComponent = components[activeTab] ?? TrendRadarCard

  // Check if any tab has data
  const hasAnyData = Object.values(tabData).some((d) => d !== null)
  if (!hasAnyData) {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center">
        <p className="text-xs text-gray-500">Trend analysis will appear after the scan completes.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const d = tabData[tab.key]
          const count = d && typeof d === "object" && Array.isArray((d as Record<string, unknown>).trends)
            ? ((d as Record<string, unknown>).trends as unknown[]).length : null
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "bg-[#190A46] text-white"
                  : d ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-gray-50 text-gray-300 cursor-default"
              }`}
              disabled={!d}
            >
              {tab.label}{count !== null ? ` (${count})` : ""}
            </button>
          )
        })}
      </div>

      {/* Active tab content */}
      {activeData ? (
        <ActiveComponent data={activeData} platform={platform} />
      ) : (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">No data for this view yet.</p>
        </div>
      )}
    </div>
  )
}
