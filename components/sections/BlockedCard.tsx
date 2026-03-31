"use client"
import { useState } from "react"
import { UploadRequiredCard } from "./UploadRequiredCard"

type Props = {
  data: Record<string, unknown>
  jobId?: string
  onUploadComplete?: (storagePath: string) => void
}

export function BlockedCard({ data, jobId, onUploadComplete }: Props) {
  const [showUpload, setShowUpload] = useState(false)
  const message = (data.message as string) ?? "Content not accessible"
  const reason = (data.reason as string) ?? ""
  const suggestion = (data.suggestion as string) ?? ""

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Content not accessible</h3>
        </div>
        <p className="text-sm font-medium text-amber-900 mb-2">{message}</p>
        {reason && <p className="text-sm text-amber-800 mb-2">{reason}</p>}
        {suggestion && (
          <p className="text-sm text-amber-700 bg-amber-100 rounded-lg px-3 py-2 mb-3">{suggestion}</p>
        )}
        {jobId && onUploadComplete && !showUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="text-xs font-medium text-[#190A46] border border-[#190A46]/20 px-3 py-1.5 rounded-lg hover:bg-[#190A46]/5 transition-colors"
          >
            Upload video file instead
          </button>
        )}
      </div>

      {showUpload && jobId && onUploadComplete && (
        <UploadRequiredCard jobId={jobId} onUploadComplete={onUploadComplete} />
      )}
    </div>
  )
}
