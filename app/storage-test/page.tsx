"use client"
import { useEffect, useState, useRef } from "react"
import { app, auth } from "@/lib/firebase"
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from "firebase/auth"
import { getStorage, ref, uploadBytes } from "firebase/storage"

const TEST_YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

export default function StorageTest() {
  const [logs, setLogs] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const log = (msg: string) => {
    console.log(msg)
    setLogs(prev => [...prev, `${new Date().toISOString().slice(11, 19)} ${msg}`])
  }

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  useEffect(() => {
    log("Page loaded")
    log(`Auth instance: ${auth ? "OK" : "NULL"}`)
    log(`App instance: ${app ? "OK" : "NULL"}`)
    if (auth?.currentUser) {
      log(`Already signed in: ${auth.currentUser.email} uid=${auth.currentUser.uid}`)
    }
  }, [])

  // ── Auth helpers ──
  const signInGoogle = async () => {
    try {
      log("Signing in with Google...")
      const result = await signInWithPopup(auth!, new GoogleAuthProvider())
      log(`SUCCESS Signed in: ${result.user.email} uid=${result.user.uid}`)
      const token = await result.user.getIdToken()
      log(`SUCCESS Token: ${token.slice(0, 40)}...`)
    } catch (e: any) {
      log(`ERROR SIGN IN: ${e.code} ${e.message}`)
    }
  }

  const signInEmail = async () => {
    const email = prompt("Email:")
    const password = prompt("Password:")
    if (!email || !password) return
    try {
      log(`Signing in with email ${email}...`)
      const result = await signInWithEmailAndPassword(auth!, email, password)
      log(`SUCCESS Signed in: ${result.user.email} uid=${result.user.uid}`)
    } catch (e: any) {
      log(`ERROR SIGN IN: ${e.code} ${e.message}`)
    }
  }

  // ── Helper: POST to analyze route ──
  async function postAnalyze(body: Record<string, string>, label: string): Promise<boolean> {
    const token = await auth?.currentUser?.getIdToken(true)
    if (!token) { log(`ERROR ${label}: no auth token`); return false }

    const reqBody = JSON.stringify(body)
    log(`${label} — POST /api/content-dna/analyze`)
    log(`${label} — request body: ${reqBody.slice(0, 200)}`)

    const t0 = Date.now()
    try {
      const res = await fetch("/api/content-dna/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: reqBody,
      })

      const elapsed = Date.now() - t0
      const resText = await res.text()
      log(`${label} — status: ${res.status} (${elapsed}ms)`)

      if (!res.ok) {
        log(`ERROR ${label} — response: ${resText.slice(0, 500)}`)
        return false
      }

      let data: any
      try { data = JSON.parse(resText) } catch { data = resText }
      const transcript = data?.transcript || "(no transcript in response)"
      const dnaKeys = data?.dna ? Object.keys(data.dna).join(", ") : "(no dna)"
      log(`SUCCESS ${label} — transcript: ${transcript.slice(0, 150)}`)
      log(`SUCCESS ${label} — dna keys: ${dnaKeys}`)
      return true
    } catch (e: any) {
      log(`ERROR ${label} — exception: ${e.message}`)
      return false
    }
  }

  // ── Full pipeline test ──
  const runFullPipeline = async () => {
    setRunning(true)
    log("═══════════════════════════════════════")
    log("STARTING FULL PIPELINE TEST")
    log("═══════════════════════════════════════")

    // Step 1: Auth check
    log("── STEP 1: Auth Check ──")
    if (!auth?.currentUser) {
      log("ERROR Step 1 FAILED: No signed-in user. Sign in first.")
      setRunning(false)
      return
    }
    const uid = auth.currentUser.uid
    const email = auth.currentUser.email
    log(`SUCCESS Step 1 PASSED: uid=${uid} email=${email}`)
    const token = await auth.currentUser.getIdToken(true)
    log(`SUCCESS Token refreshed: ${token.slice(0, 40)}...`)

    // Step 2: File upload to Firebase Storage
    log("── STEP 2: Firebase Storage Upload ──")
    let storagePath: string | null = null
    if (!file) {
      log("SKIP Step 2: No file selected — skipping upload and file transcription tests")
    } else {
      try {
        const storage = getStorage(app!)
        log(`Storage bucket: ${storage.app.options.storageBucket}`)
        storagePath = `dna-uploads/${uid}/pipeline_test_${Date.now()}_${file.name}`
        log(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB) to ${storagePath}`)
        const t0 = Date.now()
        const storageRef = ref(storage, storagePath)
        const snapshot = await uploadBytes(storageRef, file)
        log(`SUCCESS Step 2 PASSED: ${snapshot.metadata.fullPath} (${Date.now() - t0}ms)`)
      } catch (e: any) {
        log(`ERROR Step 2 FAILED: code=${e.code}`)
        log(`ERROR message=${e.message}`)
        log(`ERROR serverResponse=${e.serverResponse}`)
        storagePath = null
      }
    }

    // Step 3: YouTube URL transcription
    log("── STEP 3: YouTube URL Transcription ──")
    const ytOk = await postAnalyze(
      { sourceUrl: TEST_YOUTUBE_URL, platform: "youtube" },
      "Step 3 (YouTube)"
    )
    if (ytOk) {
      log("SUCCESS Step 3 PASSED")
    } else {
      log("ERROR Step 3 FAILED — YouTube URL transcription broken")
    }

    // Step 4: File transcription via storagePath
    log("── STEP 4: File Transcription via storagePath ──")
    if (!storagePath) {
      log("SKIP Step 4: No file was uploaded — cannot test storagePath transcription")
    } else {
      const fileOk = await postAnalyze(
        { storagePath, platform: "tiktok" },
        "Step 4 (storagePath)"
      )
      if (fileOk) {
        log("SUCCESS Step 4 PASSED")
      } else {
        log("ERROR Step 4 FAILED — storagePath transcription broken")
      }
    }

    // Summary
    log("═══════════════════════════════════════")
    log("PIPELINE TEST COMPLETE")
    log("═══════════════════════════════════════")
    setRunning(false)
  }

  return (
    <div style={{ padding: 20, fontFamily: "monospace", fontSize: 13, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20 }}>Content DNA Pipeline Diagnostic</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>Tests auth → storage upload → YouTube transcription → file transcription</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={signInGoogle} style={{ padding: "8px 16px", cursor: "pointer" }}>Sign In (Google)</button>
        <button onClick={signInEmail} style={{ padding: "8px 16px", cursor: "pointer" }}>Sign In (Email)</button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input type="file" accept="video/*,.mp4,.mov,.webm" onChange={e => {
          setFile(e.target.files?.[0] ?? null)
          if (e.target.files?.[0]) log(`File selected: ${e.target.files[0].name} (${(e.target.files[0].size / 1024 / 1024).toFixed(1)} MB)`)
        }} />
        <button
          onClick={runFullPipeline}
          disabled={running}
          style={{ padding: "10px 24px", cursor: running ? "wait" : "pointer", fontWeight: "bold", background: running ? "#ccc" : "#2d7d2d", color: "#fff", border: "none", fontSize: 14 }}>
          {running ? "Running..." : "Run Full Pipeline Test"}
        </button>
      </div>

      <div style={{ marginTop: 12, background: "#1a1a1a", color: "#ccc", padding: 14, minHeight: 300, maxHeight: 600, overflow: "auto", borderRadius: 4, fontSize: 12, lineHeight: 1.6 }}>
        {logs.map((l, i) => (
          <div key={i} style={{
            color: l.includes("ERROR") ? "#ff4444"
              : l.includes("SUCCESS") ? "#44ff44"
              : l.includes("SKIP") ? "#ffaa00"
              : l.startsWith("═") || l.startsWith("──") ? "#888"
              : "#ccc"
          }}>{l}</div>
        ))}
        <div ref={logsEndRef} />
      </div>

      <button onClick={() => setLogs([])} style={{ marginTop: 8, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>Clear Logs</button>
    </div>
  )
}
