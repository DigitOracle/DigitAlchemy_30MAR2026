"use client"

type WikiItem = { name: string; views: number }
type GdeltItem = { title: string; domain: string }
type YoutubeItem = { title: string; channel: string; thumbnail?: string }

type Props = {
  regionLabel: string
  wikipedia: WikiItem[]
  gdelt: GdeltItem[]
  youtube: YoutubeItem[]
}

export function MorningBriefing({ regionLabel, wikipedia, gdelt, youtube }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6 animate-fade-in">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">{greeting}</h2>
      <p className="text-sm text-gray-500 mb-5">Your {regionLabel} briefing for {dateStr}</p>

      {wikipedia.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">What the world is talking about</div>
          <p className="text-sm text-gray-700 leading-relaxed">
            The internet is paying attention to <strong>{wikipedia[0].name}</strong> ({Number(wikipedia[0].views).toLocaleString()} Wikipedia views)
            {wikipedia[1] && <>, <strong>{wikipedia[1].name}</strong></>}
            {wikipedia[2] && <>, and <strong>{wikipedia[2].name}</strong></>}.
            {wikipedia[3] && <> Also trending: {wikipedia[3].name}{wikipedia[4] ? ` and ${wikipedia[4].name}` : ""}.</>}
          </p>
        </div>
      )}

      {gdelt.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">News in {regionLabel}</div>
          <div className="space-y-1.5">
            {gdelt.slice(0, 4).map((a, i) => (
              <p key={i} className="text-sm text-gray-700">
                <span className="text-gray-400 mr-1">&bull;</span>
                <span className="font-medium">{a.title}</span>
                <span className="text-xs text-gray-400 ml-1">&mdash; {a.domain}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {youtube.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Trending on YouTube in {regionLabel}</div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {youtube.slice(0, 4).map((v, i) => (
              <div key={i} className="flex-shrink-0 w-48">
                {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full h-28 rounded-lg object-cover mb-1.5" />}
                <div className="text-xs text-gray-800 leading-snug line-clamp-2 font-medium">{v.title}</div>
                <div className="text-xs text-gray-400">{v.channel}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-100">
        <p className="text-sm text-gray-600 italic">Ready to create? Choose a region below to start your trend scan, or click a flag for a Quick Pulse.</p>
      </div>
    </div>
  )
}
