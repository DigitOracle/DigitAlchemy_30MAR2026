"use client"
import { useState, useRef } from "react"

type Props = {
  jobId: string
  onUploadComplete: (storagePath: string) => void
}

type UploadState = "idle" | "presigning" | "uploading" | "completing" | "done" | "error"

export function UploadRequiredCard({ jobId, onUploadComplete }: Props) {
  const [state, setState] = useState<UploadState>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setError(null)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      // 1. Get presigned URL
      setState("presigning")
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type || "video/mp4",
          jobId,
        }),
      })

      if (!presignRes.ok) {
        const err = await presignRes.json()
        throw new Error(err.error ?? "Failed to get upload URL")
      }

      const { uploadUrl, storagePath } = await presignRes.json()

      // 2. Upload directly to Firebase Storage with progress
      setState("uploading")
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed: HTTP ${xhr.status}`))
        }
        xhr.onerror = () => reject(new Error("Upload failed — network error"))
        xhr.open("PUT", uploadUrl)
        xhr.setRequestHeader("Content-Type", selectedFile.type || "video/mp4")
        xhr.send(selectedFile)
      })

      // 3. Notify server upload is complete
      setState("completing")
      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, storagePath, filename: selectedFile.name }),
      })

      if (!completeRes.ok) {
        throw new Error("Failed to finalize upload")
      }

      setState("done")
      onUploadComplete(storagePath)
    } catch (err) {
      setState("error")
      setError(err instanceof Error ? err.message : "Upload failed")
    }
  }

  const fileSizeMb = selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(1) : null

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-[#190A46]" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Upload your video file</h3>
      </div>

      <p className="text-xs text-gray-500 mb-4">Supported formats: MP4, MOV, WebM. Files up to 2GB.</p>

      {state === "idle" && (
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
                <p className="text-xs text-gray-400 mt-1">or drag and drop</p>
              </div>
            )}
          </div>
          <input
            id="upload-file"
            name="file"
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={handleFileSelect}
            className="hidden"
          />
          {selectedFile && (
            <button
              onClick={handleUpload}
              className="mt-3 w-full bg-[#190A46] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#190A46]/90 transition-colors"
            >
              Upload &amp; Analyse
            </button>
          )}
        </>
      )}

      {(state === "presigning" || state === "uploading" || state === "completing") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {state === "presigning" && "Preparing upload\u2026"}
              {state === "uploading" && `Uploading ${selectedFile?.name}\u2026`}
              {state === "completing" && "Finalizing\u2026"}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#190A46] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center gap-2 text-sm text-green-700">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Upload complete — starting analysis
        </div>
      )}

      {state === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => { setState("idle"); setProgress(0); setError(null) }}
            className="text-xs text-red-500 hover:underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
