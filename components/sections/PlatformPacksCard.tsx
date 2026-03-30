"use client"
import { useState } from "react"
import { ProvenanceBadge } from "./ProvenanceBadge"
import type { ProvenanceType, ConfidenceLevel } from "@/types"

type OutputItem = { value: string | string[]; provenance: ProvenanceType; confidence: ConfidenceLevel }
type PlatformPack = {
  platform: string
  hookOptions: OutputItem[]
  captionVariants: OutputItem[]
  hashtags: OutputItem
  musicSuggestion: OutputItem
  postingGuidance: OutputItem
}

const platformColors: Record<string, string> = {
  TikTok: "border-black",
  Instagram: "border-purple-400",
  LinkedIn: "border-blue-700",
  "X/Twitter": "border-gray-800",
  "YouTube Shorts": "border-red-500",
}

export function PlatformPacksCard({ data }: { data: Record<string, unknown> }) {
  const packs = data.packs as PlatformPack[] | undefined
  const [activePlatform, setActivePlatform] = useState(packs?.[0]?.platform ?? "")
  const [copied, setCopied] = useState<string | null>(null)

  if (!packs?.length) return null

  const active = packs.find((p) => p.platform === activePlatform) ?? packs[0]

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const hashtagsStr = Array.isArray(active.hashtags.value)
    ? active.hashtags.value.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")
    : String(active.hashtags.value)

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[#b87333]" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Platform packs</h3>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {packs.map((pack) => (
          <button
            key={pack.platform}
            onClick={() => setActivePlatform(pack.platform)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border-2 transition-colors ${
              activePlatform === pack.platform
                ? `${platformColors[pack.platform] ?? "border-[#190A46]"} bg-gray-50`
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {pack.platform}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Hooks */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hook options</p>
          <div className="space-y-2">
            {active.hookOptions.map((hook, i) => (
              <div key={i} className="flex items-start justify-between gap-2 bg-[#190A46]/5 border border-[#190A46]/10 rounded-lg p-3">
                <p className="text-sm text-gray-900">{hook.value as string}</p>
                <button
                  onClick={() => copyToClipboard(hook.value as string, `hook-${i}`)}
                  className="text-xs text-gray-400 hover:text-[#190A46] shrink-0"
                >
                  {copied === `hook-${i}` ? "✓" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Captions */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Caption variants</p>
          <div className="space-y-2">
            {active.captionVariants.map((cap, i) => (
              <div key={i} className="flex items-start justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg p-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{cap.value as string}</p>
                <button
                  onClick={() => copyToClipboard(cap.value as string, `cap-${i}`)}
                  className="text-xs text-gray-400 hover:text-[#190A46] shrink-0"
                >
                  {copied === `cap-${i}` ? "✓" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hashtags</p>
            <div className="flex items-center gap-2">
              <ProvenanceBadge provenance={active.hashtags.provenance} confidence={active.hashtags.confidence} />
              <button
                onClick={() => copyToClipboard(hashtagsStr, "hashtags")}
                className="text-xs text-gray-400 hover:text-[#190A46]"
              >
                {copied === "hashtags" ? "✓ Copied" : "Copy all"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Array.isArray(active.hashtags.value) ? active.hashtags.value : [active.hashtags.value]).map((tag: string, i: number) => (
              <span
                key={i}
                onClick={() => copyToClipboard(`#${tag.replace(/^#/, "")}`, `tag-${i}`)}
                className="text-xs bg-gray-900 text-white px-2 py-1 rounded cursor-pointer hover:bg-[#190A46] transition-colors"
              >
                #{tag.replace(/^#/, "")}
              </span>
            ))}
          </div>
        </div>

        {/* Music */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
          <div>
            <span className="text-xs text-gray-500">Music suggestion</span>
            <p className="text-sm text-gray-800">{active.musicSuggestion.value as string}</p>
          </div>
          <ProvenanceBadge provenance={active.musicSuggestion.provenance} confidence={active.musicSuggestion.confidence} />
        </div>

        {/* Posting guidance */}
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <span className="text-xs font-medium text-amber-700">Posting guidance</span>
          <p className="text-sm text-amber-900 mt-0.5">{active.postingGuidance.value as string}</p>
        </div>
      </div>
    </div>
  )
}
