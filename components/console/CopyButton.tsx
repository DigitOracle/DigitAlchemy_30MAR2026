"use client"
import { useState } from "react"

type Props = {
  text: string
  label?: string
}

export function CopyButton({ text, label }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-400 hover:text-[#190A46] shrink-0 transition-colors"
    >
      {copied ? "\u2713 Copied!" : label ?? "Copy"}
    </button>
  )
}
