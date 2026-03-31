import { ProvenanceBadge } from "./ProvenanceBadge"
import type { ProvenanceType, ConfidenceLevel } from "@/types"

type OutputItem = { value: string | string[]; provenance: ProvenanceType; confidence: ConfidenceLevel; note?: string }

const fieldLabels: Record<string, string> = {
  assetType: "Asset type",
  duration: "Duration",
  tone: "Tone",
  language: "Language",
  audienceFit: "Audience fit",
  topic: "Topic",
  subject: "Subject",
  keywords: "Keywords",
}

export function ContentIntelligenceCard({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k]) => k in fieldLabels)
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[#190A46]" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Content intelligence</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {entries.map(([key, item]) => {
          const output = item as OutputItem
          const val = Array.isArray(output?.value) ? output.value.join(", ") : (output?.value ?? "")
          return (
            <div key={key} className="border border-gray-50 rounded-lg p-3 bg-gray-50/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">{fieldLabels[key]}</span>
                <ProvenanceBadge provenance={output?.provenance} confidence={output?.confidence} />
              </div>
              <p className="text-sm text-gray-900">{val}</p>
              {output?.note && <p className="text-xs text-gray-400 mt-1">{output.note}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
