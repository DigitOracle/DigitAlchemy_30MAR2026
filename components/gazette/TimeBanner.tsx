"use client"
import { useState, useEffect } from "react"
import { T } from "./tokens"
import type { PostWindow } from "@/types/gazette-ui"

const REGION_WINDOWS: Record<string, { tz: string; windows: PostWindow[] }> = {
  AE: { tz: "Asia/Dubai", windows: [
    { label: "Lunch peak", times: "11:30 AM \u2013 1:00 PM" },
    { label: "Evening peak", times: "4:30 \u2013 6:00 PM" },
  ]},
  SA: { tz: "Asia/Riyadh", windows: [
    { label: "Afternoon", times: "12:30 \u2013 3:00 PM" },
    { label: "Night", times: "7:30 \u2013 10:00 PM" },
  ]},
  SG: { tz: "Asia/Singapore", windows: [
    { label: "Morning", times: "6:30 \u2013 9:00 AM" },
    { label: "Evening", times: "6:30 \u2013 9:00 PM" },
  ]},
  GB: { tz: "Europe/London", windows: [
    { label: "Midday", times: "10:30 AM \u2013 1:00 PM" },
    { label: "Evening", times: "6:30 \u2013 9:00 PM" },
  ]},
  US: { tz: "America/New_York", windows: [
    { label: "Morning", times: "5:30 \u2013 9:00 AM ET" },
    { label: "Evening", times: "6:30 \u2013 9:00 PM ET" },
  ]},
  KW: { tz: "Asia/Kuwait", windows: [
    { label: "Afternoon", times: "12:30 \u2013 3:00 PM" },
    { label: "Night", times: "7:30 \u2013 10:00 PM" },
  ]},
  QA: { tz: "Asia/Qatar", windows: [
    { label: "Afternoon", times: "12:30 \u2013 3:00 PM" },
    { label: "Night", times: "7:30 \u2013 10:00 PM" },
  ]},
  IN: { tz: "Asia/Kolkata", windows: [
    { label: "Morning", times: "6:30 \u2013 9:00 AM" },
    { label: "Evening", times: "6:30 \u2013 9:00 PM" },
  ]},
}

function useRegionTime(region: string) {
  const [time, setTime] = useState("")
  const config = REGION_WINDOWS[region] || REGION_WINDOWS.AE

  useEffect(() => {
    const update = () => {
      try {
        setTime(new Date().toLocaleTimeString("en-US", {
          timeZone: config.tz,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }))
      } catch {
        setTime(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }))
      }
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [config.tz])

  return { time, windows: config.windows, tz: config.tz }
}

export function TimeBanner({ region }: { region: string }) {
  const { time, windows } = useRegionTime(region)
  const windowStr = windows.map(w => w.times).join(" & ")

  return (
    <div className="gazette-time-banner">
      <span className="gazette-time-banner-clock">{time} \u00B7 {region}</span>
      <span className="gazette-time-banner-sep">|</span>
      <span>Post 30 min before: <strong>{windowStr}</strong></span>
      <span className="gazette-time-banner-sep">|</span>
      <span>\u26A1 After posting: stay online 60 mins \u2014 reply to every comment</span>

      <style>{`
        .gazette-time-banner {
          position: sticky; top: 0; z-index: 50;
          display: flex; align-items: center; gap: 12px;
          padding: 10px 20px; font-size: 12px; color: ${T.text};
          background: linear-gradient(90deg, rgba(25,10,70,0.95), rgba(61,42,138,0.95));
          backdrop-filter: blur(8px);
          overflow-x: auto; white-space: nowrap;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }
        .gazette-time-banner-clock { font-weight: 700; }
        .gazette-time-banner-sep { opacity: 0.3; }
        @media (max-width: 640px) {
          .gazette-time-banner { font-size: 11px; padding: 8px 12px; gap: 8px; }
        }
      `}</style>
    </div>
  )
}
