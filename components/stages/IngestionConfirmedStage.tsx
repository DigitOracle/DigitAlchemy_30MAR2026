"use client"

type Props = {
  title: string | null
  duration: string | null
  thumbnail: string | null
  transcriptSummary: string | null
  provenance: "observed" | "derived" | "inferred" | "unavailable"
}

const provenanceLabels = {
  observed: { text: "Direct source \u2014 transcript extracted", className: "bg-green-50 text-green-700 border-green-200" },
  derived: { text: "Uploaded file \u2014 audio transcribed", className: "bg-amber-50 text-amber-700 border-amber-200" },
  inferred: { text: "No transcript \u2014 AI summary only", className: "bg-gray-50 text-gray-600 border-gray-200" },
  unavailable: { text: "Content inaccessible", className: "bg-red-50 text-red-700 border-red-200" },
}

export function IngestionConfirmedStage({ title, duration, thumbnail, transcriptSummary, provenance }: Props) {
  const prov = provenanceLabels[provenance]
  const lang = provenance === "observed" ? "Detected" : "Unknown"

  return (
    <div className="bg-white border border-green-200 rounded-xl p-5 shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide">Video ingested</h3>
        <span className={`text-xs px-2 py-0.5 rounded border ml-auto ${prov.className}`}>{prov.text}</span>
      </div>

      <div className="flex gap-4 mb-3">
        {thumbnail && (
          <img src={thumbnail} alt="" className="w-20 h-14 rounded object-cover shrink-0" />
        )}
        <div className="min-w-0 space-y-1">
          {title && <p className="text-sm font-medium text-gray-900 truncate">{title}</p>}
          <div className="flex gap-3 text-xs text-gray-500">
            {duration && <span>{duration}</span>}
            <span>Language: {lang}</span>
          </div>
        </div>
      </div>

      {transcriptSummary && (
        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 line-clamp-3">{transcriptSummary}</p>
      )}
    </div>
  )
}
