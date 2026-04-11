"use client"
import { useState, useEffect, useRef } from "react"
import { T } from "./tokens"
import { PLATFORM_DEFAULTS, type GazettePlatform } from "@/types/gazette-ui"

const AUDIENCE_REGIONS = [
  { key: "AE", label: "UAE / Dubai", windows: "12:00\u20131:00 PM & 5:00\u20136:00 PM" },
  { key: "SA", label: "Saudi Arabia", windows: "1:00\u20133:00 PM & 8:00\u201310:00 PM" },
  { key: "SG", label: "Singapore", windows: "7:00\u20139:00 AM & 7:00\u20139:00 PM" },
  { key: "GB", label: "UK", windows: "11:00 AM\u20131:00 PM & 7:00\u20139:00 PM" },
  { key: "US", label: "US East", windows: "6:00\u20139:00 AM & 7:00\u20139:00 PM" },
  { key: "USW", label: "US West", windows: "6:00\u20139:00 AM & 7:00\u20139:00 PM" },
]

const REGION_TZ: Record<string, string> = {
  AE: "Asia/Dubai", SA: "Asia/Riyadh", SG: "Asia/Singapore",
  GB: "Europe/London", US: "America/New_York", USW: "America/Los_Angeles",
  KW: "Asia/Kuwait", QA: "Asia/Qatar", IN: "Asia/Kolkata",
}

const LS_KEY = "da_gazette_target_region"

function useClockTime(tz: string) {
  const [time, setTime] = useState("")
  useEffect(() => {
    const update = () => {
      try {
        setTime(new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }))
      } catch {
        setTime(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }))
      }
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [tz])
  return time
}

export function TimeBanner({ region }: { region: string }) {
  const homeTz = REGION_TZ[region] || "Asia/Dubai"
  const time = useClockTime(homeTz)

  const [targetKey, setTargetKey] = useState(region)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored && AUDIENCE_REGIONS.some(r => r.key === stored)) {
      setTargetKey(stored)
    }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [pickerOpen])

  const target = AUDIENCE_REGIONS.find(r => r.key === targetKey) || AUDIENCE_REGIONS[0]
  const [targetPlatform, setTargetPlatform] = useState<GazettePlatform>("TikTok")

  useEffect(() => {
    const stored = localStorage.getItem("da_gazette_target_platform") as GazettePlatform | null
    if (stored && stored in PLATFORM_DEFAULTS) setTargetPlatform(stored)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "da_gazette_target_platform" && e.newValue && e.newValue in PLATFORM_DEFAULTS) {
        setTargetPlatform(e.newValue as GazettePlatform)
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const platformWindows = PLATFORM_DEFAULTS[targetPlatform].postWindows

  const selectRegion = (key: string) => {
    setTargetKey(key)
    localStorage.setItem(LS_KEY, key)
    setPickerOpen(false)
  }

  return (
    <div ref={pickerRef}>
      <div className="gazette-time-banner">
        <span className="gazette-time-banner-clock">{time} \u00B7 {region}</span>
        <span className="gazette-time-banner-sep">\u2192</span>
        <span>
          Audience: <strong>{target.label}</strong>{" "}
          <button className="gazette-time-banner-edit" onClick={() => setPickerOpen(p => !p)}>\u270E</button>
        </span>
        <span className="gazette-time-banner-sep">|</span>
        <span>{targetPlatform}: <strong>{platformWindows}</strong></span>
        {target.windows !== platformWindows && (
          <><span className="gazette-time-banner-sep">\u00B7</span><span>Region: <strong>{target.windows}</strong></span></>
        )}
        <span className="gazette-time-banner-sep">|</span>
        <span>\u26A1 Stay online 60 min after posting</span>
      </div>

      {pickerOpen && (
        <div className="gazette-region-picker">
          <span className="gazette-region-picker-label">Audience region:</span>
          {AUDIENCE_REGIONS.map(r => (
            <button
              key={r.key}
              className={`gazette-region-pill ${targetKey === r.key ? "gazette-region-pill-active" : ""}`}
              onClick={() => selectRegion(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .gazette-time-banner {
          position: sticky; top: 0; z-index: 50;
          display: flex; align-items: center; gap: 10px;
          padding: 10px 20px; font-size: 12px; color: ${T.text};
          background: linear-gradient(90deg, rgba(25,10,70,0.95), rgba(61,42,138,0.95));
          backdrop-filter: blur(8px);
          overflow-x: auto; white-space: nowrap;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }
        .gazette-time-banner-clock { font-weight: 700; }
        .gazette-time-banner-sep { opacity: 0.3; }
        .gazette-time-banner-edit {
          background: none; border: none; color: ${T.muted};
          font-size: 14px; cursor: pointer; padding: 0 2px;
          vertical-align: middle;
        }
        .gazette-time-banner-edit:hover { color: ${T.text}; }
        .gazette-region-picker {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          padding: 8px 20px 10px;
          background: rgba(19,16,42,0.95);
          border-bottom: 1px solid ${T.border};
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }
        .gazette-region-picker-label {
          font-size: 11px; color: ${T.muted}; margin-right: 4px;
        }
        .gazette-region-pill {
          font-size: 11px; padding: 4px 10px; border-radius: 12px;
          border: 1px solid ${T.border}; background: transparent;
          color: ${T.muted}; cursor: pointer;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          transition: border-color 0.15s, color 0.15s;
        }
        .gazette-region-pill:hover { border-color: ${T.accent}; color: ${T.text}; }
        .gazette-region-pill-active {
          border-color: ${T.accent}; background: rgba(123,94,167,0.2);
          color: ${T.text}; font-weight: 600;
        }
        @media (max-width: 640px) {
          .gazette-time-banner { font-size: 11px; padding: 8px 12px; gap: 6px; }
          .gazette-region-picker { padding: 6px 12px 8px; }
        }
      `}</style>
    </div>
  )
}
