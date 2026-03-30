import { ProvenanceBadge } from "./ProvenanceBadge"
import type { ProvenanceType, ConfidenceLevel } from "@/types"

type OutputItem = { value: string; provenance: ProvenanceType; confidence: ConfidenceLevel; note?: string }

export function TranscriptCard({ data }: { data: Record<string, unknown> }) {
  const status = data.status as OutputItem | undefined
  const keyQuotes = data.keyQuotes as OutputItem[] | undefined
  const hookCandidates = data.hookCandidates as OutputItem[] | undefined

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[#b87333]" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transcript & key moments</h3>
        {status && <ProvenanceBadge provenance={status.provenance} confidence={status.confidence} />}
      </div>

      {status && (
        <p className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg px-3 py-2">{status.value}</p>
      )}

      {hookCandidates && hookCandidates.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#190A46] uppercase tracking-wide mb-2">Hook candidates</p>
          <div className="space-y-2">
            {hookCandidates.map((hook, i) => (
              <div key={i} className="border border-[#190A46]/10 bg-[#190A46]/5 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">&ldquo;{hook.value}&rdquo;</p>
                  <ProvenanceBadge provenance={hook.provenance} confidence={hook.confidence} />
                </div>
                {hook.note && <p className="text-xs text-gray-500 mt-1">{hook.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {keyQuotes && keyQuotes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key quotes</p>
          <div className="space-y-2">
            {keyQuotes.map((quote, i) => (
              <div key={i} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
                <span className="text-[#b87333] shrink-0 mt-0.5">&rsaquo;</span>
                <p className="text-sm text-gray-700 italic">&ldquo;{quote.value}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
