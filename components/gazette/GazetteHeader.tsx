"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/AuthContext"
import { T } from "./tokens"

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
  })

  return (
    <header className="gazette-header">
      <div className="gazette-header-row">
        <div>
          <div className="gazette-header-masthead">The DigitAlchemy Gazette</div>
          <div className="gazette-header-date">{today}</div>
        </div>

        <div className="gazette-header-right">
          {NAV_ITEMS.slice(0, 2).map(item => (
            <a key={item.href} href={item.href} className="gazette-header-link">
              {item.label}
            </a>
          ))}

          <div ref={ref} style={{ position: "relative" }}>
            <button className="gazette-header-avatar" onClick={() => setOpen(o => !o)}>
              {initials}
            </button>

            {open && (
              <div className="gazette-header-dropdown">
                {NAV_ITEMS.map(item => (
                  <button
                    key={item.href}
                    className="gazette-header-dropdown-item"
                    onClick={() => { setOpen(false); router.push(item.href) }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="gazette-header-rule" />

      <style>{`
        .gazette-header {
          position: sticky; top: 0; z-index: 100;
          background: ${T.bg};
          border-bottom: 1px solid ${T.border};
          padding: 0 24px;
        }
        .gazette-header-row {
          display: flex; align-items: center; justify-content: space-between;
          height: 64px;
        }
        .gazette-header-masthead {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 22px; font-weight: 700; color: ${T.text};
          letter-spacing: 0.02em;
        }
        .gazette-header-date {
          font-size: 11px; color: ${T.muted};
          font-family: 'Playfair Display', Georgia, serif;
          font-style: italic; margin-top: 2px;
        }
        .gazette-header-right {
          display: flex; align-items: center; gap: 24px;
        }
        .gazette-header-link {
          font-size: 13px; color: ${T.muted}; text-decoration: none;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          transition: color 0.15s;
        }
        .gazette-header-link:hover { color: ${T.text}; }
        .gazette-header-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: ${T.accent}; border: none; color: #fff;
          font-size: 13px; font-weight: 500; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }
        .gazette-header-dropdown {
          position: absolute; right: 0; top: calc(100% + 8px);
          background: ${T.surface}; border: 1px solid ${T.border};
          border-radius: 8px; min-width: 180px; overflow: hidden;
          z-index: 200;
        }
        .gazette-header-dropdown-item {
          display: block; width: 100%; padding: 10px 20px;
          background: transparent; border: none; color: ${T.text};
          font-size: 14px; text-align: left; cursor: pointer;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          transition: background 0.15s;
        }
        .gazette-header-dropdown-item:hover { background: ${T.mid}; }
        .gazette-header-rule {
          height: 1px;
          background: linear-gradient(90deg, ${T.accent}, transparent);
        }
        @media (max-width: 640px) {
          .gazette-header { padding: 0 12px; }
          .gazette-header-masthead { font-size: 17px; }
          .gazette-header-link { display: none; }
          .gazette-header-row { height: 52px; }
        }
      `}</style>
    </header>
  )
}
