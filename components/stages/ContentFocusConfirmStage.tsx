"use client"
import { useState } from "react"

type Props = {
  topic: string | null
  summary: string | null
  language: string | null
  transcriptPreview: string | null
  weakIntelligence?: boolean
  onConfirm: (confirmed: { topic: string; summary: string; keywords: string[]; editedByUser: boolean }) => void
}

export function ContentFocusConfirmStage({ topic, summary, language, transcriptPreview, weakIntelligence, onConfirm }: Props) {
  const [editing, setEditing] = useState(weakIntelligence ?? false)
  // Don't prefill edit field with filename-like values — they cause bad downstream results
  const topicIsFilename = !!topic && /\.\w{2,4}$/.test(topic)
  const [editTopic, setEditTopic] = useState(topicIsFilename ? "" : (topic ?? ""))
  const [editSummary, setEditSummary] = useState(summary ?? "")
  const [editKeywords, setEditKeywords] = useState("")

  const handleAccept = () => {
    onConfirm({
      topic: topic ?? "Untitled content",
      summary: summary ?? "",
      keywords: [],
      editedByUser: false,
    })
  }

  const handleSaveEdits = () => {
    const kw = editKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
    onConfirm({
      topic: editTopic || topic || "Untitled content",
      summary: editSummary || summary || "",
      keywords: kw,
      editedByUser: true,
    })
  }

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Confirm content focus</h3>
        <span className="text-[10px] text-gray-400 ml-auto">This drives all downstream recommendations</span>
      </div>

      {weakIntelligence && !editing && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-amber-700">Automatic understanding was weak. Please review and edit the topic and summary below.</p>
        </div>
      )}

      {!editing ? (
        <>
          <div className="space-y-2 mb-4">
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">Detected topic</span>
              {topicIsFilename ? (
                <p className="text-sm text-gray-400 italic">Could not determine topic (file: {topic})</p>
              ) : (
                <p className="text-sm font-medium text-gray-900">{topic || "No topic detected"}</p>
              )}
            </div>

            {summary && (
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Summary</span>
                <p className="text-sm text-gray-700 line-clamp-3">{summary}</p>
              </div>
            )}

            {language && (
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Language</span>
                <p className="text-sm text-gray-600">{language}</p>
              </div>
            )}

            {transcriptPreview && (
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Transcript preview</span>
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 line-clamp-3">{transcriptPreview}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="text-sm font-medium text-white bg-[#190A46] hover:bg-[#190A46]/90 px-4 py-2 rounded-lg transition-colors"
            >
              Looks right
            </button>
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-gray-600 border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-lg transition-colors"
            >
              Edit before continuing
            </button>
          </div>
        </>
      ) : (
        <>
          {weakIntelligence && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-amber-700">Automatic detection was limited. Please tell us what this content is about so we can generate accurate recommendations.</p>
            </div>
          )}

          <div className="space-y-3 mb-4">
            <div>
              <label htmlFor="cf-topic" className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Topic</label>
              <input
                id="cf-topic"
                name="topic"
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#190A46]/40"
                placeholder="What is this content about?"
                autoFocus={weakIntelligence}
              />
            </div>

            <div>
              <label htmlFor="cf-summary" className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Summary</label>
              <textarea
                id="cf-summary"
                name="summary"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#190A46]/40 resize-none"
                placeholder="Brief description of the content"
              />
            </div>

            <div>
              <label htmlFor="cf-keywords" className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Keywords (optional, comma-separated)</label>
              <input
                id="cf-keywords"
                name="keywords"
                value={editKeywords}
                onChange={(e) => setEditKeywords(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#190A46]/40"
                placeholder="e.g. DigitAlchemy, AI tools, Abu Dhabi"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveEdits}
              className="text-sm font-medium text-white bg-[#190A46] hover:bg-[#190A46]/90 px-4 py-2 rounded-lg transition-colors"
            >
              {weakIntelligence ? "Continue" : "Continue with edits"}
            </button>
            {!weakIntelligence && (
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
