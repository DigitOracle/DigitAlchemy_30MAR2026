"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Hook = { text: string; type: string }
type Props = { data: Record<string, unknown>; platform: string }

export function SubjectHookCard({ data, platform }: Props) {
  const hooks = Array.isArray(data) ? (data as Hook[]) : []
  const copyText = hooks.map((h) => `[${h.type}] ${h.text}`).join("\n")

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject / Hook Angles</h4>
        <CopyButton text={copyText} label="Copy all" />
      </div>
      <div className="space-y-2">
        {hooks.map((hook, i) => (
          <div key={i} className="flex items-start justify-between gap-2 bg-[#190A46]/5 border border-[#190A46]/10 rounded-lg p-3">
            <div>
              <p className="text-sm text-gray-900">{hook.text}</p>
              <span className="text-xs text-gray-400 capitalize">{hook.type}</span>
            </div>
            <CopyButton text={hook.text} />
          </div>
        ))}
      </div>
    </div>
  )
}
