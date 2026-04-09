# DA-TEC-2026-007 — Phase 3a: Codex Cross-Check for Spot Trends Form Migration

**Date:** 2026-04-09
**Status:** Complete — independent cross-check of Claude Code's recon
**Method:** GitHub API code reads + search, adversarial perspective ("what could go wrong")

---

## 1. Executive Summary

The bottom Spot Trends form (`ReverseEngineerSetupStage.tsx`) is architecturally clean — local state only, single importer, single API route. Deletion is low-risk. However, the **migration** (Phase 3b) is more complex than it appears because the form and masthead drive **two completely different backend pipelines**: the form hits `/api/reverse-engineer` (SSE streaming, card vocabulary: trendSummary/concept1-4/executionGuide) while the masthead hits `/api/concept-cards` (REST, card vocabulary: ConceptCard). Moving the form's UI into the masthead is NOT the same as moving the form's functionality — the masthead currently has no SSE streaming capability. Additionally, `/api/concept-cards` hardcodes `horizon: "24h"`, making the masthead's Analyse History mode cosmetic. The biggest risk is not deletion (safe) but the assumption that masthead + concept-cards can replace the reverse-engineer flow without an SSE adapter.

---

## 2. Bottom Spot Trends Form Structure (A1–A4)

### A1. Component location

`components/stages/ReverseEngineerSetupStage.tsx` (~700 lines including base64 logos). Rendered at `app/page.tsx:678`:

```tsx
{appMode === "reverse_engineer" && stage === "re_setup" && (
  <ReverseEngineerSetupStage onConfirm={handleReConfirm} />
)}
```

Only appears after user selects "Spot Trends Before You Create" from `ModeSelectStage` at `app/page.tsx:621`.

### A2. Controls (6 total)

| Control | Values | State hook | Default |
|---------|--------|------------|---------|
| Region | 7 flags (AE, SA, KW, QA, US, SG, IN) | `useState("AE")` | `"AE"` |
| Platform | 6 (Instagram, TikTok, LinkedIn, YouTube, X, Facebook) | `useState<string \| null>(null)` | `null` |
| Mode/Horizon | 9 horizons in 3 branches (react_now: 4, plan_ahead: 3, analyse_history: 2) | `useState<Horizon>("same_day")` | `"same_day"` |
| Industry | 10 tiles (conditional: shown for plan_ahead + analyse_history only) | `useState<string \| null>(null)` | `null` |
| Audience | 5 segments (gen_z, millennials, gen_x, boomers, all_ages) | `useState<string \| null>(null)` | `null` |
| Niche | Free text (hidden for analyse_history) | `useState("")` | `""` |

### A3. Validation

Minimal: `canSubmit = !!platform && (!industryRequired || !!industry)` plus `lagChosen` must be true.

**Bug:** `platform` and `region` are typed as plain `string`, not `Platform` or `Region`. The `onConfirm` callback signature is `(platform: string, niche: string, lag: Horizon, region: string, industry: string | null, audience: string | null, quickPulse?: string) => void`. This type looseness means invalid values would not be caught at compile time.

### A4. State architecture

All state is local `useState`. Zero global state, zero Context, zero Zustand/Redux/Jotai. Confirmed via GitHub code search: no imports of `createContext`, `useContext`, `zustand`, `jotai`, `redux` in `ReverseEngineerSetupStage.tsx`.

---

## 3. Submit Flow and API Routing (B1–B5)

### B1. Handler chain

Form `onConfirm` → `handleReConfirm` (`app/page.tsx:450`) → sets `reRegion`, `reIndustry`, `reAudience` in parent state → calls `startReverseEngineerStream`.

### B2. API route

**All three modes call the same route:** `POST /api/reverse-engineer` at `app/api/reverse-engineer/route.ts` (73 KB). The `lag` parameter distinguishes modes:
- react_now: `same_day`, `24h`, `48h`, `72h`
- plan_ahead: `1w`, `2w`, `4w`
- analyse_history: `6m`, `12m`

Request shape:
```json
{ "platform": "tiktok", "niche": "hospitality", "region": "AE", "lag": "same_day", "industry": null, "audience": null, "quickPulse": null }
```

### B3. SSE streaming

Response is a `ReadableStream` with SSE events. The reader loop at `app/page.tsx:272-301` parses events and populates `platformCards` state.

### B4. Post-stream side effects

After the SSE stream completes, THREE additional requests fire:
1. `POST /api/trend-radar/capture` (platform_wide scope)
2. `POST /api/trend-radar/capture` (topic_aligned scope, if niche exists)
3. `GET /api/trend-radar/scores?platform=...&lag=...&niche=...&limit=50`

The scores are decomposed into 5 derived card types: `trendRadar`, `trendOutlook`, `safeToProduceNow`, `whyStillMatters`, `tooLate`.

### B5. Firestore writes

The form itself does NOT write to Firestore. The `/api/reverse-engineer` route writes to Firestore via `getDb()`. The `trend-radar/capture` route writes `trend_snapshots`. No job document is created for reverse-engineer mode.

---

## 4. Current Masthead Filter Bar State (C1–C5)

### C1. Controls

`components/console/GazetteFilters.tsx` (4.8 KB) renders: Region, Platform (7 + "all"), Mode (3-button toggle), Horizon (dynamic), Industry (10 + "All Industries"), Actor Type (B2B/B2C toggle).

### C2. Missing from masthead vs form

| Missing Control | Notes |
|----------------|-------|
| **Target Audience** | `AUDIENCE_LABELS` is imported but **never rendered** — variable exists, no JSX |
| **Niche (free text)** | Not present at all |
| **Quick Pulse shortcuts** | Not present at all |

### C3. Mode → Horizon wiring

**Correctly wired.** `BRANCH_HORIZONS[filters.mode]` dynamically filters horizons. Mode change resets horizon to first value of new branch.

### C4. State system

GazetteFilters is a controlled component receiving `filters: GazetteFilterState` and `onChange`. The state lives in `MorningBriefing.tsx` via local `useState<GazetteFilterState>`, initialized from `dnaToFilterDefaults(contentDNA)`.

### C5. Actor Type wiring

Actor Type is in the state type and rendered in the UI, but I could not confirm it is consumed by any downstream API call. **Appears to be UI-only placeholder.**

---

## 5. Analyse History Specifics (D1–D3)

### D1. Is it wired?

**Yes, in the bottom form.** When `activeBranch === "analyse_history"`, the form:
- Requires industry selection
- Hides the niche input (forces niche to `""`)
- Changes CTA label to "Analyse History"
- Submits to the same `/api/reverse-engineer` route with `lag: "6m"` or `lag: "12m"`

**Cosmetic only in the masthead.** GazetteFilters shows Analyse History mode and 6m/12m horizons, but `/api/concept-cards` hardcodes `horizon: "24h"` at `app/api/concept-cards/route.ts:51`. The horizon parameter is ignored.

### D2. Route verification

`/api/reverse-engineer/route.ts` EXISTS and is a 73 KB file. It receives the `lag` parameter and uses it to branch between react_now and plan_ahead/analyse_history card sets. The route IS functional for analyse_history.

There is NO separate `/api/analyse-history` or `/api/analyze-history` route. GitHub code search confirmed 0 results for "analyseHistory", "analyzeHistory", "analyse-history", "analyze-history".

### D3. Verdict

Analyse History is **live in the SSE flow, dead in the concept-cards flow**. Phase 3b must either:
(a) Wire the horizon parameter into `/api/concept-cards`, OR
(b) Accept that Analyse History in the masthead remains cosmetic until a future phase

---

## 6. Deletion Surface Area (E1–E5)

### E1. Files containing the form

- `components/stages/ReverseEngineerSetupStage.tsx` — the component
- `app/page.tsx` — the only importer (confirmed: GitHub search found exactly 2 results for "ReverseEngineerSetupStage")

### E2. Page-level state orphaned by deletion

These `useState` hooks in `ConsolePage` exist only for the reverse-engineer flow:
- `reNiche`, `reLag`, `reRegion`, `reIndustry`, `reAudience`
- `startReverseEngineerStream` callback (~80 lines)
- `handleReConfirm`, `handleSwitchToOptimize`
- The entire `appMode === "reverse_engineer"` rendering branch
- Progress strip chips for reverse-engineer mode

### E3. What breaks

Deleting the form and its rendering branches does NOT break:
- GazetteFilters (lives in MorningBriefing, completely independent)
- The optimize flow (separate `appMode`)
- Any API routes (they exist independently, become dead code)
- Any Firestore data (no data loss)

It DOES break:
- `ModeSelectStage`'s "Spot Trends" option needs rerouting
- The "Create content from these trends" button in the complete stage (`handleSwitchToOptimize`)

### E4. Components safe to delete

After confirming no other imports: `ModeSelectStage`, `ReverseEngineerSetupStage`, `SourceInputStage`, `IngestionConfirmedStage`, `PlatformSelectionStage`, `ContentFocusConfirmStage`, `PlatformWorkspace`, `BlockedCard`, `ProgressStrip`.

### E5. API routes that become dead code

- `POST /api/reverse-engineer` (73 KB) — verify no other callers
- `POST /api/analyze` — called only by `useStream.ts` for optimize flow
- `POST /api/platform-selection` — called only from `app/page.tsx`

Trend-radar routes are also called from MorningBriefing — do NOT delete those.

---

## 7. Codex-Specific Risk Analysis (F1–F4)

### F1. Analyse History route verification

The `/api/reverse-engineer` route EXISTS at `app/api/reverse-engineer/route.ts` (73 KB). It receives `lag` from the request body and branches on the `timeHorizon` derived from it. For analyse_history horizons (`6m`, `12m`), the route runs the `plan_ahead/analyse_history` card generation branch. The route is functional. **However**, the actual data pipeline may not have 6-12 month trend snapshots to score against — the ScrapeCreators calls that feed the route are real-time, not historical. The "Analyse History" functionality likely produces a forward-looking content strategy using historical context from the Claude prompt, not an actual retrospective analysis of 6 months of scraped data.

### F2. Global state verification

GitHub code search confirmed: `ReverseEngineerSetupStage.tsx` does NOT import `createContext`, `useContext`, `zustand`, `jotai`, `redux`, or any state management library. All 8 `useState` hooks are local. The component does NOT read from any global store.

The parent `ConsolePage` in `app/page.tsx` uses only `useState` hooks — no Context providers are defined or consumed for the form data flow.

**Confirmed: the form is purely local state, no hidden global coupling.**

### F3. Biggest Phase 3b migration risk

**The masthead filter bar drives `/api/concept-cards` (REST, ConceptCard vocabulary), but the form drives `/api/reverse-engineer` (SSE streaming, PlatformWorkspace card vocabulary). These are two completely different backend pipelines with different card types, different prompt chains, different data flows, and different rendering components. Moving the form's UI controls into the masthead does NOT automatically connect them to the SSE pipeline — it connects them to the concept-cards pipeline, which produces different output. If the intent is to preserve the SSE-based "Deep Dive" functionality, the masthead needs an SSE mode or the concept-cards route needs to absorb the reverse-engineer route's capabilities.**

### F4. Biggest Phase 3c deletion risk

**The `ModeSelectStage` component's "Spot Trends" option will need to redirect somewhere. If `ModeSelectStage` is also deleted (it's in the deletion candidates list), then the entire mode selection UX must be replaced — the user currently chooses between "Spot Trends" and "Optimize" on this screen. Without `ModeSelectStage`, the app either auto-routes to MorningBriefing or needs a new entry point. This affects the user's mental model of the app, not just the code.**

---

## 8. Points Where This Recon Adds Nuance to Claude Code's Recon

Claude Code's recon at `DA-TEC-2026-007-form-migration-recon.md` was read and cross-checked. Key agreements and additions:

| Finding | Claude Code | Codex Cross-Check | Agreement? |
|---------|-------------|-------------------|------------|
| Form is local state only | ✅ Confirmed | ✅ Confirmed via GitHub search | **Agree** |
| All 3 modes hit same route | ✅ Confirmed | ✅ Confirmed | **Agree** |
| Analyse History is live in SSE | ✅ Confirmed | ✅ Confirmed, but note ScrapeCreators is real-time not historical | **Agree + nuance** |
| Analyse History is cosmetic in masthead | ✅ Confirmed (horizon hardcoded to "24h") | ✅ Confirmed | **Agree** |
| Audience imported but not rendered in GazetteFilters | ✅ Confirmed | ✅ Confirmed | **Agree** |
| Actor Type is UI-only | Not explicitly stated | ✅ Flagged as placeholder | **Codex adds** |
| Two different card vocabularies | ✅ Noted (PlatformWorkspace vs ConceptCard) | ✅ Flagged as primary migration risk | **Agree, Codex emphasizes** |
| Post-stream trend-radar calls | ✅ Documented | ✅ Confirmed, noted trend-radar routes shared with MorningBriefing | **Agree** |
| Type looseness in form callback | Not mentioned | ✅ Flagged (`string` not `Platform`/`Region`) | **Codex adds** |
| ModeSelectStage deletion impact | ✅ Listed in deletion candidates | ✅ Flagged as UX risk, not just code risk | **Codex adds nuance** |

**No disagreements found.** Claude Code's recon is accurate. This cross-check adds emphasis on the pipeline mismatch risk and two minor findings (Actor Type wiring, type looseness).

---

## 9. Codex Verdict

### Phase 3b (migrate form into masthead): PROCEED WITH MODIFICATIONS

The masthead filter bar can absorb the form's controls (add Audience, add Niche text input). But wiring those controls to the existing `/api/concept-cards` pipeline does NOT replicate the SSE-based reverse-engineer flow. Two options:

1. **Accept the loss:** The concept-cards pipeline replaces the SSE flow entirely. The PlatformWorkspace card types are deprecated. Simpler, but loses the "Deep Dive" experience.
2. **Dual pipeline:** The masthead has a "Deep Dive" button that triggers the SSE flow using the current filter values. More complex, preserves functionality.

Recommendation: Option 1 for MVP. The Gazette concept cards are the strategic direction; the SSE reverse-engineer flow was a Phase 1 prototype.

### Phase 3c (delete bottom form): SAFE TO PROCEED

The form is cleanly isolated. Zero hidden coupling confirmed. Deletion is surgical:
1. Delete `ReverseEngineerSetupStage.tsx` and 8 other stage components
2. Gut `app/page.tsx` from ~746 lines to ~100 lines
3. Reroute `ModeSelectStage` or delete it entirely
4. Optionally delete `/api/reverse-engineer/route.ts` (73 KB) after confirming no other callers

**Pre-deletion checklist:**
- [ ] Run `grep -rn "reverse-engineer" --include="*.ts" --include="*.tsx"` to confirm no other callers
- [ ] Run `grep -rn "ModeSelectStage" --include="*.tsx"` to confirm single importer
- [ ] Run `grep -rn "PlatformWorkspace" --include="*.tsx"` to confirm single importer
- [ ] Verify trend-radar routes have other callers before keeping them
