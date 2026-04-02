"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Hook = { text: string; type: string }
type Props = { data: Record<string, unknown>; platform: string }

export function SubjectHookCard({ data, platform }: Props) {
  const hooks = Array.isArray(data) ? (data as Hook[]) : Array.isArray((data as Record<string, unknown>).hooks) ? ((data as Record<string, unknown>).hooks as Hook[]) : []
  const copyText = hooks.map((h) => `[${h.type}] ${h.text}`).join("\n")

  return (
    <div>
      <div className="flex justify-end mb-2">
        <CopyButton text={copyText} label="Copy all" />
      </div>
      <div className="space-y-1.5">
        {hooks.map((hook, i) => (
          <div key={i} className="flex items-start justify-between gap-2 bg-[#190A46]/5 border border-[#190A46]/10 rounded-lg p-2.5">
            <div className="min-w-0">
              <p className="text-sm text-gray-900">{hook.text}</p>
              <span className="text-[10px] text-gray-400 capitalize">{hook.type}</span>
            </div>
            <CopyButton text={hook.text} />
          </div>
        ))}
      </div>
    </div>
  )
}
