"use client"
import { useEffect, useState } from "react"
import { app, auth } from "@/lib/firebase"
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { getStorage, ref, uploadBytes } from "firebase/storage"

export default function StorageTest() {
  const [logs, setLogs] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)

  const log = (msg: string) => {
    console.log(msg)
    setLogs(prev => [...prev, `${new Date().toISOString().slice(11,19)} ${msg}`])
  }

  useEffect(() => {
    log("Page loaded")
    log(`Auth instance: ${auth ? "OK" : "NULL"}`)
    log(`App instance: ${app ? "OK" : "NULL"}`)
  }, [])

  const signIn = async () => {
    try {
      log("Signing in with Google...")
      const result = await signInWithPopup(auth!, new GoogleAuthProvider())
      log(`Signed in: ${result.user.email} uid=${result.user.uid}`)
      const token = await result.user.getIdToken()
      log(`Token: ${token.slice(0,40)}...`)
    } catch (e: any) {
      log(`SIGN IN ERROR: ${e.code} ${e.message}`)
    }
  }

  const upload = async () => {
    if (!file) { log("No file selected"); return }
    try {
      log(`Auth current user: ${auth?.currentUser?.uid ?? "NULL"}`)
      const token = await auth?.currentUser?.getIdToken(true)
      log(`Token refresh: ${token ? token.slice(0,40)+"..." : "FAILED"}`)
      const storage = getStorage(app!)
      log(`Storage bucket: ${storage.app.options.storageBucket}`)
      const path = `dna-uploads/${auth?.currentUser?.uid}/test_${Date.now()}.mp4`
      log(`Uploading to: ${path}`)
      const storageRef = ref(storage, path)
      const snapshot = await uploadBytes(storageRef, file)
      log(`SUCCESS: ${snapshot.metadata.fullPath}`)
    } catch (e: any) {
      log(`UPLOAD ERROR code=${e.code}`)
      log(`UPLOAD ERROR message=${e.message}`)
      log(`UPLOAD ERROR serverResponse=${e.serverResponse}`)
    }
  }

  return (
    <div style={{padding: 20, fontFamily: "monospace", fontSize: 14}}>
      <h1>Firebase Storage Test</h1>
      <button onClick={signIn} style={{marginRight: 10, padding: "8px 16px"}}>Sign In with Google</button>
      <input type="file" accept="video/*" onChange={e => { setFile(e.target.files?.[0] ?? null); log(`File selected: ${e.target.files?.[0]?.name}`) }} />
      <button onClick={upload} style={{marginLeft: 10, padding: "8px 16px"}}>Upload</button>
      <div style={{marginTop: 20, background: "#f0f0f0", padding: 10, minHeight: 200}}>
        {logs.map((l, i) => <div key={i} style={{color: l.includes("ERROR") ? "red" : l.includes("SUCCESS") ? "green" : "black"}}>{l}</div>)}
      </div>
    </div>
  )
}
