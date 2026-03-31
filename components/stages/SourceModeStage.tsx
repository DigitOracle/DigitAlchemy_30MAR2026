"use client"

type Props = {
  onSelect: (mode: "link" | "upload") => void
}

export function SourceModeStage({ onSelect }: Props) {
  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">New task</h1>
        <p className="text-sm text-gray-500 mt-1">How would you like to provide your content?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onSelect("link")}
          className="bg-white border-2 border-gray-200 rounded-xl p-6 text-left hover:border-[#190A46] transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#190A46]/5 flex items-center justify-center mb-3 group-hover:bg-[#190A46]/10 transition-colors">
            <svg className="w-5 h-5 text-[#190A46]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Use a link</h3>
          <p className="text-xs text-gray-500">Paste a YouTube, TikTok, Instagram, or HeyGen video URL</p>
        </button>

        <button
          onClick={() => onSelect("upload")}
          className="bg-white border-2 border-gray-200 rounded-xl p-6 text-left hover:border-[#190A46] transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#190A46]/5 flex items-center justify-center mb-3 group-hover:bg-[#190A46]/10 transition-colors">
            <svg className="w-5 h-5 text-[#190A46]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Upload a file</h3>
          <p className="text-xs text-gray-500">Upload MP4, MOV, or WebM video files up to 2GB</p>
        </button>
      </div>
    </div>
  )
}
