"use client"
import { PLATFORMS } from "@/config/platforms"

type Props = {
  platform: string
  connectUrl: string
  expired?: boolean
}

export function OAuthRequiredCard({ platform, connectUrl, expired }: Props) {
  const config = PLATFORMS[platform]
  const label = config?.label ?? platform

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
          {expired ? "Connection expired" : "Authentication required"}
        </h3>
      </div>

      <p className="text-sm text-amber-900 mb-2">
        {expired
          ? `Your ${label} connection has expired \u2014 reconnect to continue.`
          : `This video is private and requires ${label} authentication.`}
      </p>

      <p className="text-xs text-amber-700 mb-4">
        The console fetches videos server-side to extract metadata and transcripts.
        Browser login does not help \u2014 the app needs its own OAuth connection to {label}.
      </p>

      <a
        href={connectUrl}
        className="inline-block bg-[#190A46] text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-[#190A46]/90 transition-colors"
      >
        Connect {label}
      </a>

      <div className="border-t border-amber-200 mt-4 pt-4">
        <p className="text-xs text-amber-600 font-medium mb-2">Or use an alternative</p>
        <div className="space-y-2">
          <p className="text-xs text-amber-700">
            Paste a public share link directly in the task description and re-submit.
          </p>
          <button
            disabled
            className="text-xs text-gray-400 border border-gray-200 px-3 py-1.5 rounded cursor-not-allowed"
          >
            Upload video file (coming in next release)
          </button>
        </div>
      </div>
    </div>
  )
}
