"use client"
import { useState, useRef } from "react"

type Props = {
  mode: "link" | "upload"
  onSubmitUrl: (url: string, task: string) => void
  onUploadComplete: (storagePath: string, filename: string) => void
  jobId: string | null
  onBack: () => void
}

const PLATFORM_PATTERNS: [RegExp, string][] = [
  [/youtube\.com|youtu\.be/, "YouTube"],
  [/tiktok\.com/, "TikTok"],
  [/instagram\.com/, "Instagram"],
  [/app\.heygen\.com/, "HeyGen"],
  [/twitter\.com|x\.com/, "X"],
  [/linkedin\.com/, "LinkedIn"],
  [/facebook\.com|fb\.watch/, "Facebook"],
]

function detectPlatformLabel(url: string): string | null {
  for (const [pattern, label] of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return label
  }
  return null
}

export function SourceInputStage({ mode, onSubmitUrl, onUploadComplete, jobId, onBack }: Props) {
  // Link mode state
  const [url, setUrl] = useState("")
  const [task, setTask] = useState("")
  const detectedPlatform = url.length > 10 ? detectPlatformLabel(url) : null

  // Upload mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<"idle" | "presigning" | "uploading" | "completing" | "done" | "error">("idle")
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUrlSubmit = () => {
    if (!url.trim()) return
    const fullTask = task.trim() || `Analyze this video: ${url}`
    onSubmitUrl(url.trim(), fullTask)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    // Need a jobId — create one first via a minimal analyze call
    const createJobId = jobId ?? await createTempJob(selectedFile.name)
    if (!createJobId) { setUploadError("Failed to create job"); setUploadState("error"); return }

    try {
      setUploadState("presigning")
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedFile.name, contentType: selectedFile.type || "video/mp4", jobId: createJobId }),
      })
      if (!presignRes.ok) throw new Error((await presignRes.json()).error ?? "Presign failed")
      const { uploadUrl, storagePath } = await presignRes.json()

      setUploadState("uploading")
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)) }
        xhr.onload = () => { xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)) }
        xhr.onerror = () => reject(new Error("Network error"))
        xhr.open("PUT", uploadUrl)
        xhr.setRequestHeader("Content-Type", selectedFile.type || "video/mp4")
        xhr.send(selectedFile)
      })

      setUploadState("completing")
      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: createJobId, storagePath, filename: selectedFile.name }),
      })
      if (!completeRes.ok) throw new Error("Finalize failed")

      setUploadState("done")
      onUploadComplete(storagePath, selectedFile.name)
    } catch (err) {
      setUploadState("error")
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    }
  }

  const fileSizeMb = selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(1) : null

  return (
    <div className="animate-fade-in space-y-4">
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-[#190A46] flex items-center gap-1">
        &larr; Change source type
      </button>

      {mode === "link" && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Video URL</label>
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or any video URL"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46] focus:border-transparent pr-24"
                onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit() }}
              />
              {detectedPlatform && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-[#190A46]/5 text-[#190A46] px-2 py-0.5 rounded font-medium">
                  {detectedPlatform}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Task description <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g. Generate Instagram and TikTok content for this video"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46] focus:border-transparent resize-none"
            />
          </div>

          <button
            onClick={handleUrlSubmit}
            disabled={!url.trim()}
            className="w-full bg-[#190A46] text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#190A46]/90 transition-colors"
          >
            Analyse &rarr;
          </button>
        </div>
      )}

      {mode === "upload" && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
          {uploadState === "idle" && (
            <>
              <div
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-[#190A46]/30 transition-colors"
              >
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{fileSizeMb} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500">Click to select a video file</p>
                    <p className="text-xs text-gray-400 mt-1">MP4, MOV, WebM &middot; Up to 2GB</p>
                  </div>
                )}
              </div>
              <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} className="hidden" />
              {selectedFile && (
                <button onClick={handleUpload} className="w-full bg-[#190A46] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#190A46]/90 transition-colors">
                  Upload &amp; Analyse &rarr;
                </button>
              )}
            </>
          )}

          {(uploadState === "presigning" || uploadState === "uploading" || uploadState === "completing") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{uploadState === "uploading" ? `Uploading ${selectedFile?.name}` : uploadState === "completing" ? "Finalizing" : "Preparing"}&hellip;</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-[#190A46] h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {uploadState === "done" && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500" />Upload complete &mdash; starting analysis
            </div>
          )}

          {uploadState === "error" && (
            <div className="space-y-2">
              <p className="text-sm text-red-600">{uploadError}</p>
              <button onClick={() => { setUploadState("idle"); setProgress(0); setUploadError(null) }} className="text-xs text-red-500 hover:underline">Try again</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

async function createTempJob(filename: string): Promise<string | null> {
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: `Analyze uploaded video: ${filename}`, workflowId: "social-video-optimization", workflowLabel: "Social Video Intelligence", intakeContext: {} }),
    })
    // The response is an SSE stream — we need to parse the job.created event
    if (!res.ok || !res.body) return null
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    // Read just enough to get the jobIdV2
    for (let i = 0; i < 10; i++) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const match = buffer.match(/"jobIdV2":"([^"]+)"/)
      if (match) {
        reader.cancel()
        return match[1]
      }
    }
    reader.cancel()
    return null
  } catch {
    return null
  }
}
