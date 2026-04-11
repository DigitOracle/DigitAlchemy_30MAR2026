# DA-HANDOVER-007 — Session Handover (2026-04-09)

**Branch:** `feature/autoagent-integration` (merged to `main` via PR #1, plus cherry-picks)
**Production:** `digitalchemy-console.vercel.app` (auto-deploys from `main`)
**Preview:** `digitalchemy-console-git-feature-autoagent-integration-digitalchemys-projects.vercel.app`

---

## 1. Commits This Session

All commits pushed to both `feature/autoagent-integration` and `main` (cherry-picked).

| Hash (feature) | Hash (main) | Description |
|---|---|---|
| `fb8eae7` | via PR #1 merge `402b2ea` | fix: simplify HeyGen bio- URL resolution — strip prefix, use status endpoint directly |
| `d7b5806` | via PR #1 merge `402b2ea` | debug: add REJECT tags to analyze route 400 paths for Vercel log triage |
| `ac0f0c3` | `1360e9e` | fix(analyze): ensure HeyGen CDN filename has .mp4 extension for Whisper |
| `8f85e76` | `054ec60` | fix(accounts): recover profileKey from Firestore before title-match on duplicate profile |
| `cabccf6` | `88e4138` | fix(ayrshare): increase history limit to 500 posts over last 365 days |
| `08715e0` | `78e8169` | fix(analyze): pass HeyGen CDN URL directly to Groq instead of downloading buffer |

### PR #1 — Full Branch Merge
- `402b2ea` on main — merged entire `feature/autoagent-integration` (114 files, +12,621/-248 lines)
- Includes: security auth on ~20 routes, Gazette unification (concept cards, filters, predictions), autoagent infrastructure, upload/HeyGen fixes, Firestore rules

---

## 2. Key Changes Explained

### HeyGen Bio-URL Resolution (lib/heygen/resolveHeyGenUrl.ts)
- HeyGen dashboard URLs (`https://app.heygen.com/videos/bio-{hash}`) are resolved to CDN video URLs via HeyGen API v1
- Bio- prefix is stripped, raw hash ID passed to `v1/video_status.get` directly
- Confirmed working via curl: `cb2d34d5c79846d491e72b88dbd51e48` → `https://files2.heygen.ai/...`
- Old video.list lookup fallback removed — single-path resolution now
- Tests: 14/14 passing (`lib/heygen/__tests__/resolveHeyGenUrl.test.ts`)

### Groq Whisper URL Passthrough (app/api/content-dna/analyze/route.ts)
- HeyGen CDN URLs now passed directly to Groq via `url` FormData param
- Skips downloading video bytes through Vercel serverless function
- New `transcribeWithWhisperUrl()` function alongside existing `transcribeWithWhisper()`
- Non-HeyGen URLs and Firebase Storage uploads still use the buffer path
- Added response body logging on Whisper failures for diagnostics

### Ayrshare History Limit (lib/ayrshare.ts)
- History fetch URL changed from bare `/api/history/{platform}` to `?limit=500&lastDays=365`
- Gets up to 500 posts per platform over last year (was ~10-20 default)

### Accounts Duplicate Profile Recovery (app/api/accounts/connect/route.ts)
- Code 146 (duplicate profile) handler now re-reads Firestore before falling back to Ayrshare profile list API
- Handles concurrent request race condition where Firestore was written by another call

---

## 3. Firestore Seed Data Written This Session

### Document: `users/u0LIcMQbSSgRskUqlO7WQdZYJB33/integrations/ayrshare`
Written via Firebase MCP:
```json
{
  "profileKey": "6252972A-20A2483D-BAB5F83C-BC84D259",
  "refId": "fee00efa90f66947c3ae907c001520fcb0447ed3",
  "connectedAt": "2026-04-09T15:12:00Z"
}
```
- **uid** `u0LIcMQbSSgRskUqlO7WQdZYJB33` = `digitalabbot.io@gmail.com` (Kendall's account)
- This links Kendall's Firebase Auth to the "Kendall Wilson" Ayrshare child profile

### Firebase Auth Users (exported via `firebase-tools auth:export`)
| UID | Email |
|---|---|
| `0nSKCsGsSsYx7McHbVujO1dt5C73` | arghya65420ghosh@gmail.com |
| `FuNn413fSsSQGgiGPsY1wGrXo4X2` | mram41614@gmail.com |
| `u0LIcMQbSSgRskUqlO7WQdZYJB33` | digitalabbot.io@gmail.com |
| `whr6skh6DRQDRk3KvE9SEwG2Krx2` | mpcapistrano04@gmail.com |

### Ayrshare Profiles (via master API key)
| Title | Platforms | refId |
|---|---|---|
| Ram Mohan Patel - SMM | instagram | `074e7b9d...` |
| Kendall Wilson | gmb, instagram, linkedin, tiktok, youtube | `fee00efa...` |
| Ram Mohan Patel | _(none)_ | `c8d97db9...` |
| Arghya GHOSH | youtube | `a4e09acd...` |
| Michelle Capistrano | youtube, linkedin | `2c7ece50...` |

---

## 4. Known Issues

### CRITICAL: HeyGen Bio Video Transcription Returns Null
- **Status:** Fix deployed, needs verification
- **Symptom:** All POST `/api/content-dna/analyze` return 400 in Vercel logs (message truncated)
- **Root cause chain:**
  1. ~~HeyGen dashboard URLs returned HTML~~ — FIXED (resolve via API)
  2. ~~Bio- prefix caused 404 on video_status.get~~ — FIXED (strip prefix)
  3. ~~Filename `bio-cb2d34d5...` had no extension~~ — FIXED (append `.mp4`)
  4. ~~Video bytes downloaded through Vercel, re-uploaded to Groq~~ — FIXED (pass URL directly)
  5. **Current theory:** Groq may not support `url` param (it's OpenAI-specific). If `transcribeWithWhisperUrl` returns null, logs will show `Whisper URL failed: {status} {body}`.
- **Fallback if URL param fails:** Revert to buffer download path but with `.mp4` extension fix (which may have been the only real issue)
- **Test URL:** `https://app.heygen.com/videos/bio-cb2d34d5c79846d491e72b88dbd51e48`
- **Diagnostic:** `npx vercel logs --limit 20 2>&1 | grep "REJECT\|Whisper"`

### MEDIUM: Instagram Shows "Click to Connect" Despite Being Linked
- **Status:** Uninvestigated
- **Symptom:** `/accounts` page shows Instagram as not connected for some users, even though Ayrshare API confirms `activeSocialAccounts: ["instagram"]`
- **Likely cause:** The status route (`app/api/accounts/status/route.ts`) matches child profiles by `refId`. If the Firestore doc for a user was missing or had the wrong `refId`, the match would fail and `platforms` would be empty.
- **Kendall's account:** Fixed by writing correct `refId` to Firestore (see seed data above). Needs browser verification.
- **Other users:** Check if their `users/{uid}/integrations/ayrshare` doc has correct `refId` matching their Ayrshare profile.

### LOW: Debug REJECT Tags Still in Analyze Route
- `d7b5806` added `console.log("[analyze] REJECT:...")` tags to every 400 path
- Useful for triage but should be removed or downgraded once the transcription issue is resolved

---

## 5. Vercel Environment Variables (All Confirmed Present)

| Variable | Environments | Notes |
|---|---|---|
| `HEYGEN_API_KEY` | Prod, Preview, Dev | Added 5h ago this session |
| `GROQ_API_KEY` | Prod (separate), Dev+Preview | Whisper transcription |
| `AYRSHARE_API_KEY` | All | Master API key: `F8F65505-8DA74EE5-90A37344-D2B3E58E` |
| `AYRSHARE_PRIVATE_KEY_B64` | All | Base64-encoded private key for JWT generation |
| `AYRSHARE_PRIVATE_KEY` | All | Raw private key (fallback) |
| `AYRSHARE_DOMAIN` | All | `digitalchemy-console.vercel.app` |
| `FIREBASE_SERVICE_ACCOUNT` | All | Firebase Admin SDK credentials |
| `SCRAPECREATORS_API_KEY` | All | Trend data provider |
| `YOUTUBE_API_KEY` | All | YouTube Data API v3 enrichment |
| `GOOGLE_AI_KEY` | All | Claude/Gemini for DNA extraction |
| `SUPADATA_API_KEY` | Prod only | Transcript provider |
| `NEXT_PUBLIC_FIREBASE_*` | All | Client-side Firebase config (6 vars) |

---

## 6. Key File Locations

| File | Purpose |
|---|---|
| `app/api/content-dna/analyze/route.ts` | Main analyze route — URL ingestion, HeyGen resolution, Whisper transcription, DNA extraction |
| `lib/heygen/resolveHeyGenUrl.ts` | HeyGen dashboard URL → CDN URL resolver (video_status.get API) |
| `lib/heygen/__tests__/resolveHeyGenUrl.test.ts` | 14 tests for HeyGen resolver |
| `app/api/accounts/connect/route.ts` | Ayrshare profile creation + JWT link generation |
| `app/api/accounts/status/route.ts` | Connected platform status via Ayrshare profiles API |
| `app/accounts/page.tsx` | Accounts UI — platform grid, connect, sync |
| `app/upload/page.tsx` | Upload/Analyse Content page — URL paste + file upload |
| `lib/ayrshare.ts` | Ayrshare post history fetch + normalize (4 platforms) |
| `lib/providers/scrapeCreators.ts` | Canonical ScrapeCreators module (6 endpoints) |
| `lib/gazette/predictions.ts` | Log-space engagement predictions with James-Stein shrinkage |
| `components/console/MorningBriefing.tsx` | Main Gazette component with 7 tabs |
| `components/console/GazetteFilters.tsx` | 7-control filter bar |
| `components/console/ConceptCardGrid.tsx` | Concept card grid with source color coding |
| `firestore.rules` | Least-privilege Firestore security rules |

---

## 7. Pending Tasks (Phase 3b+)

| Task | Status | Notes |
|---|---|---|
| Phase 3b.3 — mode-driven result rendering | Deferred | Concept cards render same regardless of mode |
| Phase 3b.4 — delete bottom Spot Trends form | Deferred | Legacy form still in `app/page.tsx` |
| Phase 3b.5 — wire actor_type as real ranking signal | TODO in code | `// TODO Phase 3b.5` comment exists |
| Phase 3b.6 — DNA-driven role inference | Deferred | Auto-set filters from Content DNA |
| Phase 4 — dead code cleanup | Not started | Remove legacy routes, shared provider extraction |
| Phase 4 — Vercel Blob migration | Not started | Replace Firebase Storage with Vercel Blob |
| Deploy Firestore indexes | Pending | `firebase deploy --only firestore:indexes` |
| Deploy Firestore rules | Pending | `firebase deploy --only firestore` |
| Remove debug REJECT tags | After transcription fix verified | `app/api/content-dna/analyze/route.ts` |

---

## 8. Verification Checklist for Next Session

- [ ] Hit `/upload` with HeyGen bio URL — check if transcription succeeds now
- [ ] Check `npx vercel logs --limit 20 2>&1 | grep "REJECT\|Whisper"` for diagnostics
- [ ] If Groq rejects `url` param, revert to buffer download (the `.mp4` extension fix may have been sufficient)
- [ ] Verify `/accounts` page shows all 5 platforms connected for Kendall
- [ ] Run `firebase deploy --only firestore:indexes` to deploy composite indexes
- [ ] Run `firebase deploy --only firestore` to deploy security rules
- [ ] Test Content DNA auto-ingest ("Sync & Build Content DNA" button) with new 500-post history limit
