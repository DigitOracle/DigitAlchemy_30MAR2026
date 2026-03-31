"use client"
import { useState } from "react"

type Props = {
  title: string | null
  duration: string | null
  thumbnail: string | null
  transcriptSummary: string | null
  provenance: "observed" | "derived" | "inferred" | "unavailable"
  jobId: string
}

const provenanceLabels = {
  observed: { text: "Direct source \u2014 transcript extracted", className: "bg-green-50 text-green-700 border-green-200" },
  derived: { text: "Uploaded file \u2014 audio transcribed", className: "bg-amber-50 text-amber-700 border-amber-200" },
  inferred: { text: "No transcript \u2014 AI summary only", className: "bg-gray-50 text-gray-600 border-gray-200" },
  unavailable: { text: "Content inaccessible", className: "bg-red-50 text-red-700 border-red-200" },
}

export function IngestionConfirmedCard({ title, duration, thumbnail, transcriptSummary, provenance }: Props) {
  const [expanded, setExpanded] = useState(false)
  const prov = provenanceLabels[provenance]

  return (
    <div className="bg-white border border-green-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide">Video ingested successfully</h3>
        <span className={`text-xs px-2 py-0.5 rounded border ml-auto ${prov.className}`}>{prov.text}</span>
      </div>

      <div className="flex gap-4">
        {thumbnail && (
          <img src={thumbnail} alt="" className="w-24 h-16 rounded object-cover shrink-0" />
        )}
        <div className="min-w-0">
          {title && <p className="text-sm font-medium text-gray-900 truncate">{title}</p>}
          {duration && <p className="text-xs text-gray-500 mt-0.5">{duration}</p>}
        </div>
      </div>

      {transcriptSummary && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Transcript summary</p>
          <p className={`text-sm text-gray-700 ${expanded ? "" : "line-clamp-3"}`}>
            {transcriptSummary}
          </p>
          {transcriptSummary.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-[#190A46] hover:underline mt-1"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
