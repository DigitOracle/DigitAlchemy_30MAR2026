"use client"
import { T, type CategoryKey } from "./tokens"
import { ConceptCard } from "./ConceptCard"
import type { GazetteCard } from "@/types/gazette-ui"

function SkeletonCard() {
  return (
    <div className="gazette-skeleton-card">
      <div className="gazette-skeleton-bar gazette-skeleton-short" />
      <div className="gazette-skeleton-bar gazette-skeleton-full" />
      <div className="gazette-skeleton-bar gazette-skeleton-mid" />
      <div className="gazette-skeleton-bar gazette-skeleton-short" />
    </div>
  )
}

export function CardRow({ category, cards, loading, onTap, onDismiss, onSave }: {
  category: CategoryKey
  cards: GazetteCard[]
  loading: boolean
  onTap: (card: GazetteCard) => void
  onDismiss: (card: GazetteCard) => void
  onSave: (card: GazetteCard) => void
}) {
  const visibleCards = cards.filter(c => !c.dismissed)
  if (!loading && visibleCards.length === 0) return null

  const cat = T.categories[category]
  const ago = cards.length > 0
    ? Math.round((Date.now() - new Date(cards[0].generatedAt).getTime()) / 60000)
    : 0

  return (
    <div className="gazette-row">
      <div className="gazette-row-header">
        <span className="gazette-row-title">
          <span style={{ color: cat.bg }}>{cat.icon}</span> {category.replace(/_/g, " ")}
          <span className="gazette-row-count">{visibleCards.length}</span>
        </span>
        {ago > 0 && <span className="gazette-row-ago">Updated {ago} min ago</span>}
      </div>

      <div className="gazette-row-scroll">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          visibleCards.map(card => (
            <ConceptCard
              key={card.id}
              card={card}
              onTap={() => onTap(card)}
              onDismiss={() => onDismiss(card)}
              onSave={() => onSave(card)}
            />
          ))
        )}
      </div>

      <style>{`
        .gazette-row { margin-bottom: 24px; }
        .gazette-row-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 20px 10px;
          position: sticky; top: 44px; z-index: 10;
          background: ${T.bg};
        }
        .gazette-row-title {
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          font-size: 14px; font-weight: 700; color: ${T.text};
          text-transform: uppercase; letter-spacing: 0.05em;
          display: flex; align-items: center; gap: 6px;
        }
        .gazette-row-count {
          font-size: 11px; background: ${T.border}; padding: 1px 6px;
          border-radius: 10px; color: ${T.muted};
        }
        .gazette-row-ago { font-size: 11px; color: ${T.muted}; }
        .gazette-row-scroll {
          display: flex; gap: 12px; overflow-x: auto;
          padding: 0 20px 8px; scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }
        .gazette-row-scroll > * { scroll-snap-align: start; }
        .gazette-row-scroll::-webkit-scrollbar { height: 4px; }
        .gazette-row-scroll::-webkit-scrollbar-track { background: transparent; }
        .gazette-row-scroll::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
        .gazette-skeleton-card {
          flex: 0 0 300px; min-width: 280px; max-width: 320px;
          background: ${T.surface}; border: 1px solid ${T.border};
          border-radius: 10px; padding: 16px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .gazette-skeleton-bar {
          height: 14px; border-radius: 4px;
          background: rgba(123,94,167,0.15);
          animation: gazette-pulse 1.5s ease-in-out infinite;
        }
        .gazette-skeleton-short { width: 40%; }
        .gazette-skeleton-full { width: 100%; height: 20px; }
        .gazette-skeleton-mid { width: 70%; }
        @keyframes gazette-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}
