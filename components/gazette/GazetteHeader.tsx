"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/AuthContext"
import { BROADSHEET } from "./tokens"
import { GazetteFilterBar } from "./GazetteFilterBar"

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Analyse Content", href: "/upload" },
  { label: "Linked Accounts", href: "/accounts" },
  { label: "Profile", href: "/profile" },
]

export function GazetteHeader() {
  const { user, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const initials = (() => {
    const name = profile?.name || user?.displayName
    if (name) {
      const parts = name.trim().split(" ")
      return parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : parts[0].slice(0, 2).toUpperCase()
    }
    return (user?.email ?? "??").slice(0, 2).toUpperCase()
  })()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", keyHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", keyHandler)
    }
  }, [])

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  }).toUpperCase()

  const B = BROADSHEET

  return (
    <header style={{ background: B.paper, position: "sticky", top: 0, zIndex: 100, width: "100%" }}>

      {/* Double rule top */}
      <div style={{ borderTop: `2px solid ${B.rule}`, borderBottom: `1px solid ${B.rule}`, height: 4, background: B.paper }} />

      {/* Dateline bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 24px", background: B.paper }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 11, letterSpacing: "0.15em", color: B.inkFaded, fontVariant: "small-caps" }}>
          {today} {"·"} Abu Dhabi Edition
        </span>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 11, letterSpacing: "0.1em", color: B.inkFaded, fontVariant: "small-caps" }}>
          Vol. I {"·"} Est. MMXXIV
        </span>
      </div>

      {/* Double rule */}
      <div style={{ borderTop: `2px solid ${B.rule}`, borderBottom: `1px solid ${B.rule}`, height: 4, background: B.paper }} />

      {/* Masthead */}
      <div style={{ textAlign: "center", padding: "16px 24px 12px", background: B.paper }}>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "clamp(28px, 5vw, 52px)",
          fontWeight: 900, color: B.ink,
          letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1,
        }}>
          The DigitAlchemy Gazette
        </div>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 13, fontStyle: "italic", color: B.inkFaded,
          marginTop: 6, letterSpacing: "0.05em",
        }}>
          Intelligence for the Modern Creator
        </div>
      </div>

      {/* Double rule */}
      <div style={{ borderTop: `3px double ${B.rule}`, margin: "0 24px" }} />

      {/* Nav bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 24px", background: B.paperDark }}>
        <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
          {NAV_ITEMS.slice(0, 3).map((item, i) => (
            <span key={item.href} style={{ display: "flex", alignItems: "center" }}>
              <a
                href={item.href}
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 12, letterSpacing: "0.08em", color: B.ink,
                  textDecoration: "none", padding: "2px 14px", fontVariant: "small-caps",
                }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
              >
                {item.label}
              </a>
              {i < 2 && (
                <span style={{ color: B.ruleLight, fontSize: 16, lineHeight: 1 }}>|</span>
              )}
            </span>
          ))}
        </div>

        {/* Avatar dropdown */}
        <div ref={ref} style={{ position: "relative" }}>
          <button
            onClick={() => setOpen(o => !o)}
            title={profile?.name ?? user?.email ?? "Account"}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: B.ink, border: `1px solid ${B.rule}`,
              color: B.paper, fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "0.05em",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {initials}
          </button>

          {open && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)",
              background: B.paper, border: `1px solid ${B.rule}`,
              minWidth: 180, zIndex: 200, boxShadow: `2px 2px 0 ${B.rule}`,
            }}>
              <div style={{ borderTop: `2px solid ${B.rule}`, borderBottom: `1px solid ${B.rule}`, height: 3, background: B.paper }} />
              {NAV_ITEMS.map((item, i) => (
                <div key={item.href}>
                  <button
                    onClick={() => { setOpen(false); router.push(item.href) }}
                    style={{
                      display: "block", width: "100%", padding: "9px 16px",
                      background: "transparent", border: "none", color: B.ink,
                      fontSize: 12, textAlign: "left", cursor: "pointer",
                      fontFamily: "'Playfair Display', Georgia, serif",
                      letterSpacing: "0.06em", fontVariant: "small-caps",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = B.paperDark)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {item.label}
                  </button>
                  {i < NAV_ITEMS.length - 1 && (
                    <div style={{ height: 1, background: B.rule, opacity: 0.4, margin: "0 12px" }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <GazetteFilterBar />

      {/* Heavy bottom rule */}
      <div style={{ height: 3, background: B.rule }} />
    </header>
  )
}
