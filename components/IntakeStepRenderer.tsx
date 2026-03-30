"use client"
import { useRef, useState } from "react"
import type { IntakeStep, IntakeState, ParsedFileContent } from "@/types"
import { parseUploadedFile } from "@/lib/fileHandler"

interface IntakeStepRendererProps {
  step: IntakeStep
  state: IntakeState
  onChange: (stepId: string, value: string | string[] | ParsedFileContent | null) => void
}

export function IntakeStepRenderer({ step, state, onChange }: IntakeStepRendererProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const value = state[step.id]

  const handleFileChange = async (file: File | null) => {
    if (!file) { onChange(step.id, null); return }
    setParsing(true)
    try {
      const parsed = await parseUploadedFile(file)
      onChange(step.id, parsed)
    } catch {
      onChange(step.id, null)
    } finally {
      setParsing(false)
    }
  }

  const isParsedFile = value && typeof value === "object" && !Array.isArray(value) && "originalName" in value

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-600">
        {step.label}
        {step.required === false && <span className="text-gray-400 ml-1">(optional)</span>}
      </label>
      {step.helpText && <p className="text-xs text-gray-400">{step.helpText}</p>}

      {step.type === "select" && (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(step.id, e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#190A46] bg-white"
        >
          <option value="">Select…</option>
          {step.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {step.type === "multiselect" && (
        <div className="flex flex-wrap gap-2">
          {step.options?.map((opt) => {
            const selected = Array.isArray(value) && (value as string[]).includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = (Array.isArray(value) ? value : []) as string[]
                  onChange(step.id, selected ? current.filter((v) => v !== opt.value) : [...current, opt.value])
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selected
                    ? "bg-[#190A46] text-white border-[#190A46]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#190A46]"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {(step.type === "url" || step.type === "url-or-upload") && (
        <input
          type="url"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(step.id, e.target.value)}
          placeholder={step.placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46]"
        />
      )}

      {(step.type === "upload" || step.type === "url-or-upload") && (
        <div>
          <div
            onClick={() => !parsing && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors ${
              parsing
                ? "border-[#190A46] bg-blue-50 cursor-wait"
                : "border-gray-200 hover:border-[#190A46] cursor-pointer"
            }`}
          >
            {parsing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#190A46] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#190A46]">Parsing file…</p>
              </div>
            ) : isParsedFile ? (
              <div>
                <p className="text-sm font-medium text-gray-800">{(value as ParsedFileContent).originalName}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {((value as ParsedFileContent).sizeByes / 1024).toFixed(1)} KB · {(value as ParsedFileContent).contentType}
                </p>
                {(value as ParsedFileContent).metadata?.entityCount && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {(value as ParsedFileContent).metadata?.entityCount as number} IFC entities extracted
                  </p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onChange(step.id, null) }}
                  className="text-xs text-red-500 mt-2 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400">Click to browse or drag and drop</p>
                {step.accept && <p className="text-xs text-gray-300 mt-1">{step.accept}</p>}
                {step.maxFileSizeMb && <p className="text-xs text-gray-300">Max {step.maxFileSizeMb} MB</p>}
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={step.accept}
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {(step.type === "text" || step.type === "textarea") && (
        step.type === "textarea" ? (
          <textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(step.id, e.target.value)}
            placeholder={step.placeholder}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46] resize-none"
          />
        ) : (
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(step.id, e.target.value)}
            placeholder={step.placeholder}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46]"
          />
        )
      )}
    </div>
  )
}
