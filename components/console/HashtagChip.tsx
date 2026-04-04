"use client"
import { useState } from "react"

export function HashtagChip({ tag }: { tag: string }) {
  const [copied, setCopied] = useState(false)
  const display = `#${tag.replace(/^#/, "")}`

  function handleCopy() {
    navigator.clipboard.writeText(display)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`w-full text-center px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer group ${
        copied
          ? "bg-green-50 border border-green-300 text-green-700"
          : "bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-300 text-gray-700 hover:text-amber-700"
      }`}
      title="Click to copy"
    >
      {copied ? "Copied!" : display}
      {!copied && <span className="ml-1 text-gray-400 group-hover:text-amber-500">{"\u2398"}</span>}
    </button>
  )
}
