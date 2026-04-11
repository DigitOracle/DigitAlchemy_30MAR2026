"use client"
import { useState, useEffect } from "react"
import { BROADSHEET } from "./tokens"
import { useAuth } from "@/lib/AuthContext"

export function GazetteGreeting() {
  const { user } = useAuth()
  const [cardCount, setCardCount] = useState(0)

  useEffect(() => {
    const stored = localStorage.getItem("da_gazette_card_count")
    if (stored) setCardCount(parseInt(stored, 10) || 0)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "da_gazette_card_count") setCardCount(parseInt(e.newValue ?? "0", 10) || 0)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const hour = new Date().getHours()
  const greeting =
    hour >= 5  && hour < 12 ? "Good Morning"  :
    hour >= 12 && hour < 17 ? "Good Afternoon" :
    hour >= 17 && hour < 21 ? "Good Evening"   :
    "Good Night"

  const firstName = (() => {
    if (user?.displayName) return user.displayName.trim().split(" ")[0]
    if (user?.email) return user.email.split("@")[0]
    return ""
  })()

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })

  return (
    <div style={{
      padding: "20px 24px 16px",
      borderBottom: `1px solid ${BROADSHEET.ruleLight}`,
      background: BROADSHEET.paper,
    }}>
      {/* Ornamental divider */}
      <div style={{
        textAlign: "center",
        fontSize: 12,
        color: BROADSHEET.inkFaded,
        letterSpacing: "0.3em",
        marginBottom: 12,
        fontFamily: "'Playfair Display', Georgia, serif",
      }}>
        {"\u25C6 \u25C6 \u25C6"}
      </div>

      {/* Greeting headline */}
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: "clamp(22px, 3vw, 32px)",
        fontWeight: 700,
        color: BROADSHEET.ink,
        lineHeight: 1.2,
        marginBottom: 6,
      }}>
        {greeting}{firstName ? `, ${firstName}` : ""}.
      </div>

      {/* Subhead */}
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 14,
        fontStyle: "italic",
        color: BROADSHEET.inkFaded,
        marginBottom: 8,
      }}>
        {cardCount > 0
          ? `Here are today\u2019s dispatches \u2014 ${cardCount} ${cardCount === 1 ? "story" : "stories"} worth your attention.`
          : "Gathering today\u2019s intelligence from across the wire\u2026"}
      </div>

      {/* Date byline */}
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 11,
        fontVariant: "small-caps",
        letterSpacing: "0.1em",
        color: BROADSHEET.inkLight,
      }}>
        {today}
      </div>

      {/* Bottom rule */}
      <div style={{
        height: 1,
        background: BROADSHEET.rule,
        marginTop: 14,
        opacity: 0.3,
      }} />
    </div>
  )
}
