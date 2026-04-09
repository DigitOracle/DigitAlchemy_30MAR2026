# DA-TEC-2026-005 — Content DNA, Linked Accounts & Auth Reconnaissance

**Date:** 2026-04-07
**Authors:** Kendall Wilson (Doli) + Claude Code
**Status:** Complete — findings inform Phase 2.4+ design decisions
**Method:** Read-only pass over actual repo files. Every claim cites file path and line numbers.

---

## 1. Executive Summary

Content DNA is **already shipped and working in production**. It is not a future concept — it is a live system with real user data. Auth is Firebase Auth (email/password), user profiles live in Firestore `users/{uid}`, DNA profiles live in `users/{uid}/content_profile/main`, and social account linking is via Ayrshare's multi-profile API. Two DNA ingestion paths exist: video upload (Groq Whisper transcription → Claude analysis) and social account sync (Ayrshare post history → Claude analysis). The DNA feeds into the Gazette's "Stay in Your Lane" section via `/api/post-recommendations`. The existing `ContentProfile` and `ContentDNASample` types in `lib/firestore/contentProfile.ts` are sufficient for Phase 2.4 — a new type is unnecessary. The master plan should adapt to wrap the existing DNA, not replace it.

---

## 2. Part A — Content DNA Page

### A1. Page component

**File:** `app/profile/page.tsx`

Heading JSX at lines 41–43:
```tsx
<div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 26, color: "#1A1A1A", marginTop: 8 }}>My Content DNA</div>
<div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: "#8B7355", marginBottom: 24 }}>
  {profile?.name}&rsquo;s content profile &mdash; built from {contentProfile?.sampleCount || 0} videos
</div>
```

### A2. API routes called

Single route: `GET /api/content-dna/profile?uid={uid}` (`app/api/content-dna/profile/route.ts`).

Called at `app/profile/page.tsx:29`:
```tsx
fetch(`/api/content-dna/profile?uid=${user.uid}`)
```

### A3. TypeScript type for DNA

**File:** `lib/firestore/contentProfile.ts:18-29`

```typescript
export interface ContentProfile {
  topics: string[]
  tone: string
  visualStyle: string
  audioPreference: string
  captionStyle: string
  hashtagPatterns: string[]
  sampleCount: number
  lastAnalyzedAt: string
  profileVersion: number
  confidence: "low" | "medium" | "high"
}
```

A second type describes individual samples at `lib/firestore/contentProfile.ts:3-16`:

```typescript
export interface ContentDNASample {
  id?: string
  sourceType: "upload" | "ayrshare" | "url"
  platform: string
  transcript: string
  topics: string[]
  tone: string
  visualStyle: string
  audioPreference: string
  captionStyle: string
  hashtags: string[]
  duration: number
  analyzedAt: string
}
```

And the Claude extraction output type at `lib/profile/extractContentDNA.ts:3-11`:

```typescript
export interface ExtractedDNA {
  topics: string[]
  tone: string
  visualStyle: string
  audioPreference: string
  captionStyle: string
  hashtags: string[]
  contentSummary: string
}
```

### A4. Possible values for tone, visualStyle, audioPreference, captionStyle

These are **constrained by the Claude prompt but stored as free-form strings**. The prompt at `lib/profile/extractContentDNA.ts:37-42` instructs Claude to pick from specific values:

- **tone:** `"professional" | "casual" | "humorous" | "educational" | "inspirational" | "storytelling" | "aggressive" | "calm"`
- **visualStyle:** `"talking-head" | "b-roll-heavy" | "text-overlay" | "aesthetic-moody" | "fast-cuts" | "tutorial-screencast" | "vlog" | "interview"`
- **audioPreference:** `"trending-sounds" | "original-audio" | "voiceover" | "background-music" | "no-audio"`
- **captionStyle:** `"short-punchy" | "long-storytelling" | "question-hooks" | "list-format" | "cta-heavy" | "minimal"`

**But** the TypeScript types use `string`, not union types. Claude could return anything. No runtime validation.

### A5. Profile confidence computation

**File:** `lib/firestore/contentProfile.ts:95`

```typescript
confidence: count >= 6 ? "high" : count >= 3 ? "medium" : "low",
```

Where `count` is `existing.sampleCount + 1` (line 69). Also overridden in the auto-ingest route at `app/api/content-dna/auto-ingest/route.ts:92`:

```typescript
updated.confidence = posts.length >= 6 ? "high" : posts.length >= 3 ? "medium" : "low"
```

### A6. Video count source

The "built from 34 videos" text comes from `contentProfile.sampleCount`, stored in the Firestore document at `users/{uid}/content_profile/main`. Rendered at `app/profile/page.tsx:43`:

```tsx
built from {contentProfile?.sampleCount || 0} videos
```

The count is incremented by `mergeProfileWithSample()` at `lib/firestore/contentProfile.ts:69`: `const count = existing.sampleCount + 1`. For auto-ingest, it's overridden to the total posts fetched at `auto-ingest/route.ts:91`: `updated.sampleCount = Math.max(updated.sampleCount, posts.length)`.

### A7. "Upload another video" button

Routes to `/upload` at `app/profile/page.tsx:78`:

```tsx
<button onClick={() => router.push("/upload")}
```

The upload flow: `app/upload/page.tsx` → `POST /api/content-dna/analyze` (FormData with file) → Groq Whisper transcription (`api.groq.com/openai/v1/audio/transcriptions` using `whisper-large-v3`) → `extractContentDNA()` (Claude Sonnet analysis) → returns DNA JSON → client calls `POST /api/content-dna/save` with `{ uid, dna, platform }` → `saveDNASample()` + `mergeProfileWithSample()` + `saveContentProfile()` to Firestore.

---

## 3. Part B — Linked Accounts Page

### B1. Page component

**File:** `app/accounts/page.tsx`

### B2. API routes for account status

- `GET /api/accounts/status?uid={uid}` (`app/api/accounts/status/route.ts`) — checks Ayrshare API for connected platforms
- `POST /api/accounts/connect` (`app/api/accounts/connect/route.ts`) — creates/returns Ayrshare profile linking URL

Called at `app/accounts/page.tsx:37`:
```tsx
fetch(`/api/accounts/status?uid=${user.uid}`)
```

### B3. OAuth handling

**Ayrshare handles all OAuth.** There is no NextAuth, no Clerk, no custom OAuth. The flow:

1. `POST /api/accounts/connect` (`app/api/accounts/connect/route.ts:10-80`) verifies Firebase ID token, then calls Ayrshare's `/api/profiles` to create a profile for the user (or retrieves existing profile key)
2. Returns a URL from Ayrshare's `/api/profiles` `generateUrl` response — this is Ayrshare's hosted OAuth page
3. User opens the URL in a new tab (`window.open(data.url, "_blank")` at `app/accounts/page.tsx:64`)
4. User authenticates with TikTok/LinkedIn/YouTube/Instagram/Google Business on Ayrshare's page
5. On return, `window.focus` event triggers a refresh of `/api/accounts/status` which checks Ayrshare's `/api/profiles` for `activeSocialAccounts`

Ayrshare credentials: `AYRSHARE_API_KEY` (env var) + `AYRSHARE_PRIVATE_KEY_B64` or `AYRSHARE_PRIVATE_KEY` (env var, used for JWT signing). Per-user profile keys stored in Firestore at `users/{uid}/integrations/ayrshare`.

### B4. "Sync & Build Content DNA" execution path

Triggered at `app/accounts/page.tsx:80`:
```tsx
fetch("/api/content-dna/auto-ingest", { method: "POST", body: JSON.stringify({ uid }) })
```

Full execution path (`app/api/content-dna/auto-ingest/route.ts`):
1. Verify Firebase ID token (line 23)
2. `getAyrshareConfig(uid)` → resolves API key + optional profile key from Firestore (`lib/firestore/integrations.ts:15-40`)
3. `fetchAllPostHistory({ apiKey, profileKey })` → calls Ayrshare `/api/history/{platform}` for TikTok, LinkedIn, YouTube in parallel (`lib/ayrshare.ts:152-161`). YouTube posts enriched with Data API v3 stats.
4. Combines all posts into text block (line 50-60)
5. `extractContentDNA(combinedText, "multi-platform", metadata)` → **Claude Sonnet** (`claude-sonnet-4-20250514`) analyzes the combined posts text (`lib/profile/extractContentDNA.ts:21`)
6. `saveDNASample(uid, sample)` → writes to `users/{uid}/content_samples/{docId}` in Firestore
7. `mergeProfileWithSample(existing, sample)` → merges new analysis with existing profile
8. `saveContentProfile(uid, updated)` → writes to `users/{uid}/content_profile/main`
9. Returns `{ success, postsAnalyzed, platforms, dna, confidence }`

### B5. Other OAuth integrations

No other OAuth integrations exist. Grep for "oauth" hits only:
- `lib/media/access.ts` — comment mentioning "oauthAvailable" as a field in access attempts
- `types/jobs.ts` — `oauthAvailable: boolean` field in `AccessAttempt` type
- `config/platforms.ts` — string references to OAuth in platform descriptions
- `lib/firestore/jobs.ts` — uses the `AccessAttempt` type

None of these are actual OAuth implementations. Ayrshare is the sole social account connector.

---

## 4. Part C — Identity and Auth

### C1. How the app knows which user is logged in

**Firebase Auth** via the client-side SDK. The auth context is at `lib/AuthContext.tsx`:

```typescript
// Line 4
import { onAuthStateChanged, User } from "firebase/auth"

// Line 37
const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
  setUser(firebaseUser)
```

The `useAuth()` hook (line 109) provides `{ user: User | null, profile: UserProfile | null, loading: boolean }` to all client components.

Server-side routes verify identity via Firebase ID tokens:
```typescript
// app/api/accounts/connect/route.ts:22
const token = await getAuth().verifyIdToken(authHeader.slice(7))
uid = token.uid
```

### C2. User data model

**File:** `lib/AuthContext.tsx:9-20`

```typescript
export interface UserProfile {
  uid: string
  name: string
  email: string
  defaultRegion: string
  role: "admin" | "member"
  hasConnectedAccounts: boolean
  defaultIndustry?: string
  defaultAudience?: string
  createdAt: string
  lastLogin: string
}
```

Stored in Firestore at `users/{uid}`. Sub-collections:
- `users/{uid}/content_samples/{sampleId}` — individual DNA samples
- `users/{uid}/content_profile/main` — merged DNA profile
- `users/{uid}/integrations/ayrshare` — Ayrshare profile key + connected platforms

### C3. How a user signs up

**File:** `app/auth/page.tsx:42-56`

Firebase `createUserWithEmailAndPassword` → `updateProfile` with display name → `setDoc` to `users/{uid}` with role determination:

```typescript
const isAdmin = email === "digitalabbot.io@gmail.com"
await setDoc(doc(db, "users", cred.user.uid), {
  uid: cred.user.uid, name: name.trim(), email, defaultRegion: region,
  role: isAdmin ? "admin" : "member",
  hasConnectedAccounts: isAdmin,
  createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
})
```

Users pick a region during signup. Admin role is granted to `digitalabbot.io@gmail.com` only.

### C4. How a user signs in

**File:** `app/auth/page.tsx:57-60`

```typescript
const cred = await signInWithEmailAndPassword(auth, email, password)
await updateDoc(doc(db, "users", cred.user.uid), { lastLogin: new Date().toISOString() })
```

Standard Firebase email/password. No SSO, no magic links, no social login.

### C5. Is there a demo user hardcoded?

**No hardcoded demo user.** The auth is real Firebase Auth. The admin email `digitalabbot.io@gmail.com` is the only special-cased email (gets `role: "admin"` and `hasConnectedAccounts: true` by default). This is Doli's email. All other users are `"member"` role.

The `ADMIN_EMAIL` constant appears at `lib/AuthContext.tsx:7`:
```typescript
const ADMIN_EMAIL = "digitalabbot.io@gmail.com"
```

### C6. DNA → Gazette personalisation data flow

1. `MorningBriefing.tsx:182-187`: On mount, checks if user has DNA:
   ```tsx
   fetch(`/api/content-dna/profile?uid=${user.uid}`)
     .then(d => setHasContentDNA(!!d.profile && d.profile.sampleCount > 0))
   ```

2. `MorningBriefing.tsx:207-211`: When a platform tab is active AND `hasContentDNA` is true, fetches personalised recommendations:
   ```tsx
   const genericUrl = `/api/post-recommendations?region=${region}&platform=${activeSection}`
   const personalUrl = user?.uid ? `${genericUrl}&uid=${user.uid}` : null
   if (personalUrl && hasContentDNA) fetches.push(fetch(personalUrl))
   ```

3. `/api/post-recommendations` (`app/api/post-recommendations/route.ts:28-48`): Loads DNA via `loadContentProfile(uid)`, injects it into Claude prompt as `profileContext`:
   ```typescript
   profileContext = `\nCREATOR CONTENT PROFILE (personalise recommendations to match this style):
   - Topics they usually cover: ${profile.topics.join(", ")}
   - Their tone: ${profile.tone}
   ...`
   ```

4. Claude generates 3 posts personalised to the user's DNA, returned as "Stay in Your Lane" cards.

---

## 5. Part D — Relationship to Phase 2 Work

### D1. DNA system and scrapeCreators.ts

**No connection.** The DNA system does not call ScrapeCreators at all. DNA ingestion comes from two sources only: video upload (Groq Whisper → Claude) and Ayrshare post history (Ayrshare API → Claude). The canonical ScrapeCreators module from Phase 2.0 is irrelevant to DNA.

### D2. DNA system and trendRadar

**No connection.** The DNA system does not import or interact with `lib/trendRadar/` in any way. DNA is about the creator's style; TrendRadar is about what's trending. They are orthogonal.

### D3. DNA system and UserContext

**No connection.** The DNA system uses `user.uid` to scope data, not a `UserContext`. The `/api/post-recommendations` route takes `region` and `platform` as separate query params, not a `UserContext` object. The `UserProfile` type in `lib/AuthContext.tsx` has `defaultRegion`, `defaultIndustry`, `defaultAudience` — these overlap with `UserContext` fields but are a separate type.

### D4. Existing types expressing user → DNA → cards relationship

No single type connects all three. The pieces are:
- `UserProfile` (`lib/AuthContext.tsx:9-20`) — user identity + defaults
- `ContentProfile` (`lib/firestore/contentProfile.ts:18-29`) — DNA
- `ContentDNASample` (`lib/firestore/contentProfile.ts:3-16`) — individual DNA samples
- `ExtractedDNA` (`lib/profile/extractContentDNA.ts:3-11`) — Claude extraction output
- `RecPost` (inline in `MorningBriefing.tsx:167`) — recommendation cards

No type composes these into a unified relationship.

---

## 6. Part E — Gaps and Concerns

### E1. Fragile or half-built code

1. **`/api/content-dna/save/route.ts` has no auth check.** Any caller can POST `{ uid, dna }` to save DNA for any user. The `auto-ingest` route verifies Firebase ID tokens, but the `save` route does not. Compare line 7 of save (no auth) vs line 22 of auto-ingest (verifies token).

2. **`RecPost` type is defined inline in `MorningBriefing.tsx:167`** — not exported, not shared with any other component or route. If the concept card generator needs to produce recommendation-shaped output, it must redefine this type.

3. **DNA tone/style values are prompt-constrained, not type-constrained.** Claude could return any string. No runtime validation ensures values match the expected set. This hasn't caused issues yet because Claude generally follows the prompt, but it's a latent bug.

4. **`UserProfile.defaultIndustry` and `defaultAudience` exist in the type** (`lib/AuthContext.tsx:16-17`) but are never populated during signup (`app/auth/page.tsx:47-56` doesn't include them) and never read by any route. They are dead fields.

5. **Ayrshare `fetchAllPostHistory` only fetches TikTok, LinkedIn, YouTube** (`lib/ayrshare.ts:153`). Instagram and Google Business are shown on the accounts page as connectable platforms but their post history is never fetched.

### E2. Security concerns

1. **`/api/content-dna/save/route.ts` — no auth check** (see E1.1 above). Any HTTP client can write DNA to any user's profile by guessing their uid.

2. **`/api/accounts/status` accepts `uid` as a query param with no auth verification** (`app/api/accounts/status/route.ts:8-9`). Any caller can check which social accounts any user has connected by passing their uid.

3. **`/api/content-dna/profile` has no auth check** — accepts `uid` as a query param. Any caller can read any user's DNA profile.

4. **Admin email `digitalabbot.io@gmail.com` is hardcoded** in both `lib/AuthContext.tsx:7` and `app/auth/page.tsx:46`. If this email is ever compromised or changed, admin access logic breaks.

### E3. Phase 0 report contradictions

1. **Phase 0 said "personalisation comes from a Firestore `ContentProfile` document"** — this is correct. But it did not document the two ingestion paths (upload vs sync) or the auth system, creating an incomplete picture.

2. **Phase 0 said "no UserContext type exists"** — this is correct, but it missed that `UserProfile` in `lib/AuthContext.tsx` already contains `defaultRegion`, `defaultIndustry`, `defaultAudience` — fields that overlap with `UserContext`. Phase 2.1's `UserContext` was designed without awareness of these existing fields.

3. **Phase 0 did not mention the role-based access system** (admin vs member) which affects how Ayrshare credentials resolve (`getAyrshareConfig` in `lib/firestore/integrations.ts`). This is relevant for Phase 4 migration since different users take different code paths.

4. **Phase 0 said "RecPost" type is "the de facto concept card type"** — partially true, but it's not connected to DNA at all. DNA feeds into the Claude prompt that *generates* RecPost-shaped output. RecPost is a presentation type, not a DNA-derived type.

---

## 7. Recommended Revisions to Master Plan

### Phase 2.4 — ContentDNA type is NOT needed as a new type

The existing `ContentProfile` interface at `lib/firestore/contentProfile.ts:18-29` is already the canonical DNA type. Creating a parallel `ContentDNA` type in `types/gazette.ts` would split the source of truth. Instead:

**Recommendation:** Re-export `ContentProfile` from `types/gazette.ts` and add a `UserContextWithDNA` composite type:

```typescript
import type { ContentProfile } from "@/lib/firestore/contentProfile"
export type { ContentProfile }

export interface UserContextWithDNA extends UserContext {
  contentProfile?: ContentProfile
}
```

### Phase 2.3 (concept-cards.ts) should accept optional DNA

The concept-card generator should take `UserContextWithDNA` (or `UserContext` + optional `ContentProfile`) so it can produce personalised concept cards when DNA is available, and generic ones when it's not. This mirrors the existing "Follow the Trend" (generic) / "Stay in Your Lane" (personalised) pattern already shipped in `MorningBriefing.tsx`.

### Phase 4 should address the auth gaps

The three unauthenticated routes (`/api/content-dna/save`, `/api/content-dna/profile`, `/api/accounts/status`) need auth checks added. This should happen before merge to main in Phase 7.

### UserProfile.defaultIndustry and defaultAudience should feed UserContext

`UserProfile` already has `defaultIndustry` and `defaultAudience` fields. These should be used to auto-populate `UserContext` when a user loads the Gazette without explicit filter selections. This is how Phase 9 ("The Inversion") works — user context is inferred from stored preferences. The plumbing already exists, it just needs wiring.

### No new phase needed

A standalone Phase 2.4 "ContentDNA type" is unnecessary. The DNA type already exists and is sufficient. The composite `UserContextWithDNA` type is a 5-line addition to Phase 2.3's work. The master plan checklist should remove Phase 2.4 as a separate item and fold it into Phase 2.3.

---

**End of reconnaissance. No code was modified.**
