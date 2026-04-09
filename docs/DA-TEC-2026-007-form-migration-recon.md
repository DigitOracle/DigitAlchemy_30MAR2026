# DA-TEC-2026-007 — Phase 3a: Spot Trends Form Migration Reconnaissance

**Date:** 2026-04-09
**Status:** Complete — informs Phase 3b (merge) and Phase 3c (delete)

## 1. Executive Summary

The "Spot Trends" form is `ReverseEngineerSetupStage.tsx` rendered inside `app/page.tsx` at line 678. It appears only when the user clicks "Spot Trends Before You Create" in `ModeSelectStage` (line 621). The form calls `/api/reverse-engineer` via SSE streaming, which is a completely separate data path from the Gazette's `/api/concept-cards`. The masthead `GazetteFilters` component already has Region, Platform, Mode, Horizon, Industry, and Actor Type — it's missing only Audience and Niche. The form's SSE streaming flow feeds `PlatformWorkspace` cards, which is a different card vocabulary from `ConceptCard`. Deleting the form means either migrating its functionality into the masthead+concept-cards pipeline, or accepting the loss of the SSE-based card generation flow.

## 2. Bottom Spot Trends Form Structure (A1–A4)

### A1. Component file

The form is `components/stages/ReverseEngineerSetupStage.tsx`, rendered at `app/page.tsx:678`:

```tsx
{appMode === "reverse_engineer" && stage === "re_setup" && (
  <ReverseEngineerSetupStage onConfirm={handleReConfirm} />
)}
```

It only appears after the user selects "Spot Trends Before You Create" from `ModeSelectStage` at line 621.

### A2. Form sections (JSX)

**Region** — `ReverseEngineerSetupStage.tsx:135-175`. Grid of region flag buttons with quick-pulse dropdowns per region.

**Platform** — `ReverseEngineerSetupStage.tsx:~180-220` (approx). Grid of platform logo buttons derived from `config/platforms.ts` (filtered to exclude heygen).

**Mode/Horizon (TIME_GROUPS)** — `ReverseEngineerSetupStage.tsx:51-88`. Three groups: react_now (Same Day / 24h / 48h / 72h), plan_ahead (1 Week / 2 Weeks / 4 Weeks), analyse_history (6 Months / 12 Months). These derive from `Horizon` enum via `horizonToBranch()` per Phase 1.5 refactor.

**Industry** — `ReverseEngineerSetupStage.tsx:16-27`. Grid of 10 industry tiles with icons. Only visible when `activeBranch === "plan_ahead" || activeBranch === "analyse_history"` (line 122).

**Audience** — `ReverseEngineerSetupStage.tsx:29-35`. Five audience segments with subtitles. Visible alongside industry.

**CTA button** — Label is dynamic: "Scan Trends" (react_now), "Plan Content" (plan_ahead), "Analyse History" (analyse_history). Disabled when `!platform || (industryRequired && !industry)` (line 126).

### A3. State hooks

`ReverseEngineerSetupStage.tsx:92-100`:

```tsx
const [platform, setPlatform] = useState<string | null>(null)
const [niche, setNiche] = useState("")
const [lag, setLag] = useState<Horizon>("same_day")
const [lagChosen, setLagChosen] = useState(false)
const [region, setRegion] = useState("AE")
const [industry, setIndustry] = useState<string | null>(null)
const [audience, setAudience] = useState<string | null>(null)
const [openDropdown, setOpenDropdown] = useState<string | null>(null)
```

### A4. State flow

Props only. The component takes `onConfirm: (platform, niche, lag, region, industry, audience, quickPulse?) => void`. On submit, it calls `onConfirm(...)` with all collected values. The parent (`app/page.tsx:450`) receives these via `handleReConfirm` which stores them in page-level state and kicks off `startReverseEngineerStream`.

## 3. Submit Flow and API Routing (B1–B5)

### B1. Submit handler

CTA button calls `onConfirm(platform, niche, lag, region, industry, audience)` → parent's `handleReConfirm` at `app/page.tsx:450`:

```tsx
const handleReConfirm = (platform, niche, lag, region, industry, audience, quickPulse?) => {
  setReRegion(region)
  setReIndustry(industry)
  setReAudience(audience)
  startReverseEngineerStream(platform, niche, lag, region, industry, audience, quickPulse)
}
```

### B2. All three modes call the SAME route

`startReverseEngineerStream` at `app/page.tsx:254` calls `POST /api/reverse-engineer` with all parameters. The `lag` value distinguishes the mode (same_day/24h/48h/72h = react_now, 1w/2w/4w = plan_ahead, 6m/12m = analyse_history). The route internally uses the lag to decide which card types to generate.

### B3. Request shape

```typescript
POST /api/reverse-engineer
Body: { platform, niche, region, lag, industry, audience, quickPulse }
Headers: Authorization: Bearer {token}, Content-Type: application/json
```

All fields are strings or null. `lag` is the Horizon value (e.g., "same_day", "1w", "6m").

### B4. Response shape differences

The response is an SSE stream in all three modes. The `card` events contain different card types per mode:
- **react_now**: trendSummary, concept1-4, executionGuide
- **plan_ahead**: videoIdeas, hooks, cadencePlan, contentPillars, competitivePosition, platformTrends, topicTrends
- **analyse_history**: same as plan_ahead (the route at `app/api/reverse-engineer/route.ts` uses `timeHorizon` derived from lag to branch between react_now and plan_ahead/analyse_history card sets)

### B5. SSE streaming

**Yes** — all three modes use SSE streaming via `ReadableStream`. The response is consumed by the reader loop at `app/page.tsx:272-301` which parses SSE events and populates `platformCards` state.

## 4. Current Masthead Filter Bar State (C1–C5)

### C1. Controls rendered

`GazetteFilters.tsx:59-122` renders: Region (dropdown), Platform (dropdown), Mode (segmented: React Now / Plan Ahead / Analyse History), Horizon (dropdown, options derived from mode), Industry (dropdown), Actor Type (B2B/B2C toggle).

### C2. Audience control

**Absent.** `GazetteFilters.tsx` imports `AUDIENCE_LABELS` at line 6 and `audiences` is derived at line 57, but it is **never rendered** in the JSX. The variable exists but has no corresponding dropdown or chip component. Audience is missing from the filter bar.

### C3. Mode → Horizon wiring

**Correctly wired.** At line 55: `const horizonOptions = BRANCH_HORIZONS[filters.mode]`. When mode changes (line 74-75): `onChange({ ...filters, mode: b, horizon: newHorizons[0] })` — resets horizon to the first option for the new mode.

### C4. Filter change behavior

`onChange` updates `gazetteFilters` state in `MorningBriefing.tsx`. The concept cards useEffect depends on `gazetteFilters` (via `[gazetteFilters, user]`), so changing any filter triggers a refetch of `/api/concept-cards`.

### C5. Analyse History support

**Partially supported.** The Mode selector shows "Analyse History" and the Horizon dropdown shows "6 Months" / "12 Months" when selected. However, `/api/concept-cards` does not currently use the horizon parameter for anything meaningful — it always passes `horizon: "24h"` hardcoded at `app/api/concept-cards/route.ts:51` to `fetchTrendsForContext`. The Analyse History mode in the filter bar is cosmetic only.

## 5. Analyse History Specifics (D1–D3)

### D1. Implementation status

**Fully implemented** in the SSE flow. When the bottom form submits with `lag: "6m"` or `lag: "12m"`, the `/api/reverse-engineer` route runs the plan_ahead/analyse_history branch which generates: videoIdeas, hooks, cadencePlan, contentPillars, competitivePosition, platformTrends, topicTrends cards. These are rendered by `PlatformWorkspace`.

**Not implemented** in the concept-cards flow. The masthead's Analyse History mode changes the horizon dropdown but `/api/concept-cards` ignores the horizon value.

### D2. Route

Same route: `POST /api/reverse-engineer`. The `lag` parameter is what distinguishes modes.

### D3. Industry requirement

`ReverseEngineerSetupStage.tsx:124`:
```tsx
const industryRequired = activeBranch === "analyse_history"
```
Line 126:
```tsx
const canSubmit = !!platform && (!industryRequired || !!industry)
```
Yes — Analyse History requires an industry selection. The CTA button is disabled until one is selected.

## 6. Deletion Surface Area (E1–E5)

### E1. Unused imports after form deletion

From `app/page.tsx`:
- `ModeSelectStage` (line 10) — only used at line 621
- `ReverseEngineerSetupStage` (line 14) — only used at line 678
- `SourceInputStage` (line 11) — only used at line 627
- `IngestionConfirmedStage` (line 12) — only used at line 643
- `PlatformSelectionStage` (line 13) — only used at line 665
- `ContentFocusConfirmStage` (line 15) — only used at line 655
- `PlatformWorkspace` (line 16) — only used at line 692
- `BlockedCard` (line 18) — only used at line 668
- `useStream` (line 7) — only used for optimize flow
- `ProgressStrip` (lines 8-9) — only used at line 613

### E2. Orphaned state hooks

All state hooks at `app/page.tsx:75-89` would become orphaned except `showUserMenu` (used by header):
- `appMode`, `stage`, `sourceMode`, `sourceLabel`, `jobIdV2`, `selectedPlatforms`, `platformCards`, `error`, `reNiche`, `reLag`, `reRegion`, `reIndustry`, `reAudience`, `confirmedFocus`

### E3. Dead code

- `startPhase2Stream` (line 200)
- `startReverseEngineerStream` (line 254)
- `handleUrlSubmit` (line 403)
- `handleUploadComplete` (line 408)
- `handleContentFocusConfirm` (line 418)
- `handlePlatformConfirm` (line 429)
- `handleModeSelect` (line 444)
- `handleReConfirm` (line 450)
- `handleFullReset` (line 458)
- `handleSwitchToOptimize` (line 478)
- All `chips` logic (lines 486-540)
- `DevDebugPanel` function (lines 38-67)

### E4. Components safe to delete

These are imported only by `app/page.tsx` for the bottom form flows:
- `components/stages/ModeSelectStage.tsx`
- `components/stages/ReverseEngineerSetupStage.tsx`
- `components/stages/SourceInputStage.tsx`
- `components/stages/IngestionConfirmedStage.tsx`
- `components/stages/PlatformSelectionStage.tsx`
- `components/stages/ContentFocusConfirmStage.tsx`
- `components/console/PlatformWorkspace.tsx`
- `components/sections/BlockedCard.tsx`
- `components/ProgressStrip.tsx`

**Warning:** Verify each has no other imports before deleting. Run `grep -rn "import.*ModeSelectStage" --include="*.tsx" app/ components/` for each.

### E5. API routes called only by the bottom form

- `POST /api/reverse-engineer` — called at `app/page.tsx:265`. Also called by `app/api/post-recommendations/route.ts` indirectly (it doesn't call this route). **Check: does any other client call this route?**
- `POST /api/analyze` — called by `lib/useStream.ts:62` (optimize flow only). No other caller.
- `POST /api/platform-selection` — called at `app/page.tsx:420,433`. No other caller.
- `GET /api/jobs/[jobId]` — called at `app/page.tsx:160,205`. No other caller outside the page.
- `GET /api/jobs/[jobId]/stream` — called at `app/page.tsx:217`. No other caller.

These five routes are deletion candidates after Phase 3c **if no other page imports them**. Run the grep to confirm.

## 7. Recommended Phase 3b Plan

### Add Audience to GazetteFilters

1. Edit `components/console/GazetteFilters.tsx`: add an Audience dropdown after Industry, before the divider. Use `AUDIENCE_LABELS` and `AUDIENCE_SUBTITLES` from `types/gazette.ts`. Single-select (matching the bottom form's single-select).
2. Add `audience` to `GazetteFilterState` in `types/gazette.ts` (already present as `audience?: Audience`).

### Wire horizon into /api/concept-cards

1. Edit `app/api/concept-cards/route.ts`: read `horizon` from query params instead of hardcoding `"24h"`. Pass it to `fetchTrendsForContext`.
2. Edit `components/console/MorningBriefing.tsx`: add `horizon` to the concept-cards fetch URL from `gazetteFilters.horizon`.

### Wire audience into /api/concept-cards

1. Accept `audience` query param in the route.
2. Pass it through to the generator (currently unused, but available for future card selection logic).

### No SSE migration needed

The SSE-based reverse-engineer flow produces a different card vocabulary (`PlatformWorkspace` cards) than the concept-cards pipeline (`ConceptCard`). Phase 2.3e adapters already handle the vocabularies that overlap. The SSE flow is a separate product feature ("Deep Dive"), not a prerequisite for the Gazette.

## 8. Recommended Phase 3c Plan

### Delete from app/page.tsx

Remove everything between `{/* MODE SELECT */}` (line 620) and the end of `{/* Complete */}` section (line 725). Keep only:
- Lines 1-19: imports (trim to only what's still used)
- Lines 70-96: component function, auth guard
- Header JSX
- `{stage === "mode_select" && <MorningBriefing />}` (line 617)
- Footer JSX

The file should shrink from 746 lines to ~100 lines.

### Delete stage components

After confirming no other imports:
- `components/stages/ModeSelectStage.tsx`
- `components/stages/ReverseEngineerSetupStage.tsx`
- `components/stages/SourceInputStage.tsx`
- `components/stages/IngestionConfirmedStage.tsx`
- `components/stages/PlatformSelectionStage.tsx`
- `components/stages/ContentFocusConfirmStage.tsx`
- `components/console/PlatformWorkspace.tsx`
- `components/sections/BlockedCard.tsx`
- `components/ProgressStrip.tsx`

### Defer API route deletion

Do NOT delete `/api/reverse-engineer`, `/api/analyze`, `/api/platform-selection`, `/api/jobs/` in Phase 3c. Those routes may have mobile or external callers. File them for Phase 4 cleanup with a grep audit.
