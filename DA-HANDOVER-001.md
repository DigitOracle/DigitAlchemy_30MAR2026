# DA-HANDOVER-001 — DigitAlchemy® AutoAgent × Gazette Unification

**Document type:** Live checklist + session handover document
**Owner:** Kendall Wilson (Doli), Founder, DigitAlchemy® Tech Limited
**Started:** April 7, 2026 (overnight session ~5pm UAE time)
**Current status:** Active — Rung 1 reconnaissance phase
**Read this document first if you are a new Claude instance picking up this project.**

---

## How To Read This Document

This is a living handover. It has four purposes:

1. **A live checklist** — Doli works through this top to bottom, checking off completed items.
2. **A session handover** — If the current Claude conversation runs out of tokens or needs to be restarted, a new Claude instance can read this document and resume work without losing context.
3. **A single source of truth** — Everything we've decided, built, and planned lives here or is linked from here.
4. **A bus-factor protection** — If someone else on the DigitAlchemy team needs to take over, they can read this and understand the full picture.

**To resume work after a conversation break:** Read this entire document, then read the "Current Position" section, then read the three most recent completed checklist items and the three next pending items. That's enough context to continue.

---

## The Vision (Read This First)

DigitAlchemy® Console's end state is the **Gazette as the entire product**. Not a feature of the Console — the Console *is* the Gazette. A user lands on `digitalchemy-console.vercel.app` and immediately sees a personalized, context-aware intelligence briefing delivered as **concept cards**: 5-8 actionable content plays categorized by type (`AUDIO_VIRAL`, `TREND_ALERT`, `BRAND_SIGNAL`, `CULTURAL_MOMENT`, `CREATOR_SPOTLIGHT`, `REGIONAL_PULSE`, `TECH_INNOVATION`), each with confidence scores, time windows, and specific actions the user can take.

The current Console has the opposite UX: a landing page full of filters (region, platform, time horizon, industry, audience) that users must configure before seeing any value. That filter interface was built first, the Gazette concept came later, and the filters were never removed. The goal is to **invert the product**: user context gets inferred or stored, the Gazette becomes the landing page, filters become advanced mode.

**AutoAgent's role in this vision:** The meta-agent (DA-01) autonomously optimizes the concept card generator overnight. Every morning, Doli reviews lesson documents describing what the meta-agent learned, approves the best ones via PR, and Vercel deploys the improvements. The product gets measurably better every day, autonomously, without Doli writing a single line of code.

---

## Context About Doli And This Project

- **Kendall Wilson (Doli)** is the founder and sole director of DigitAlchemy® Tech Limited, ADGM No. 35004, Abu Dhabi UAE
- Doli operates mostly from mobile. Desktop work happens in focused sessions.
- Doli has Claude Max, Claude Code v2.1.92, Opus 4.6 access
- The repo is at `C:\Users\kwils\DigitAlchemy_30MAR2026` on a Windows PC
- GitHub org: **DigitOracle** — repo: **DigitAlchemy_30MAR2026**
- Current working branch: **feature/autoagent-integration**
- Production deploy: `digitalchemy-console.vercel.app`
- Vercel git author email: `k.wilsonqc@outlook.com` (non-negotiable)
- Firebase project: `digitalchemy-de4b7` (me-central2/Dammam)

**Important collaboration notes for future Claude instances:**

- Doli prefers extremely literal step-by-step instructions when executing commands (one physical action per step, name the button, quote the exact text to paste)
- Doli works in bursts and is often tired by the end of a session — watch for typos and repeated requests as fatigue signals
- Doli pushed back successfully against being told to stop when it was actually 9am his time — do not assume tiredness, ask or check timestamps
- Doli chose the lazy workflow (mobile capture → Claude Code batch execution) and uses "run the queue" as the primary trigger phrase
- Doli corrected Claude when Claude overcaveat'd security warnings; Doli made an informed decision about the leaked API key and asked to move on
- Doli appreciates honest pushback exactly once, then expects the collaborator to respect the decision

---

## Non-Negotiable Architecture Constraints

These come from `autoagent/DA-UC-001-social-media.md` and DigitAlchemy's Console architecture. They must not be violated:

1. **Inference-last provider chain order:** `ScrapeCreators → Apify → xpoz → Perplexity → Claude`. Claude is always last.
2. **Spotify is enrichment-only.** Never used for trend detection. Only adds metadata to already-detected audio trends.
3. **Trend Ticker handles TikTok + Instagram only.** YouTube is explicitly excluded from Trend Ticker logic.
4. **SSE streaming adapter is fixed.** Do not modify `safeClose` / `safeEnqueue` guards.
5. **Firestore logging is fixed.** All experiment logs go to `da-experiments/{use-case}/{run-id}`.
6. **Vercel git author:** All commits must use `k.wilsonqc@outlook.com`.
7. **Meta-agent uses Claude.** Do not change the inference model from Claude — preserves "model empathy" advantage.

---

## What We've Built So Far (Completed Work)

All on branch `feature/autoagent-integration`, all pushed to GitHub.

### Session 1 — Night of April 6-7, 2026

- [x] **DA-TEC-2026-001** — AutoAgent × DigitAlchemy integration plan (seven-section interactive React dashboard covering strategy, architecture mapping, pipeline, benchmarks, roadmap, model empathy, file structure)
- [x] **DA-QUEUE-001.md** — Mobile-to-desktop task queue with 4 sections (active, archive, blocked, notes) and task card schema
- [x] **docs/da-queue-kickoff.md** — Execution protocol for Claude Code to process the queue
- [x] **CLAUDE.md** — Queue protocol documentation (note: `/run-queue` does not work as a literal slash command; use plain English "run the queue")
- [x] **autoagent/DA-UC-001-social-media.md** — The human directive file (AutoAgent's program.md equivalent) defining goals, constraints, benchmarks, scoring formula, keep/discard rules, cost discipline
- [x] **autoagent/** directory structure — `agents/`, `tasks/`, `.agent/`, `jobs/` with `.gitkeep` placeholders
- [x] **autoagent/.gitignore** — Protects experiment artifacts (`jobs/`, `results.tsv`, `run.log`, `*.log`, `.env`, `*.env`)
- [x] **autoagent/agents/agent_trend_ticker.py** — Harness with `TrendTickerAgent` class, editable section + fixed adapter boundary, 7 concept-card classification categories
- [x] **autoagent/agents/agent_trending_audio.py** — Harness with `TrendingAudioAgent` class, TikTok+Instagram only, Spotify enrichment-only
- [x] **autoagent/agents/agent_morning_briefing.py** — Gazette harness with `MorningBriefingAgent` class, synthesizes Wikipedia + GDELT + YouTube + Trend Ticker + Trending Audio + fact-check sub-agent hook
- [x] **autoagent/tasks/concept-card-classification/** — Full Harbor benchmark task with 20-entry synthetic ground truth, F1 verifier (tested: 1.0 perfect, 0.0 random), Dockerfile, task.toml, instruction.md
- [x] **autoagent/Dockerfile.base** — Python 3.11 + Node.js 18 + uv + Harbor CLI runtime
- [x] **autoagent/.env** — Anthropic API key wired in (gitignored, verified safe)
- [x] **First baseline run completed** — F1 score **0.9020** on concept-card-classification (18/20 correct)
- [x] **Baseline failure analysis completed** — Identified 2 failures: Post 7 "Apple AR glasses" (rule ordering — BRAND_SIGNAL shadows TECH_INNOVATION) and Post 18 "slowed + reverb" (vocabulary gap — AUDIO_VIRAL keywords too narrow)
- [x] **Session 2 — Morning April 7, 2026 (hybrid architecture foundation)** — DA-TEC-2026-002 architecture decision doc locking in Hybrid approach; Lesson format template with filled example; Lesson Extractor script; Ground truth labeling protocol; Production Translation Workflow documentation
- [x] **Firestore reconnaissance completed** — Discovered data architecture mismatch: Console stores 118 trend_snapshots with 2,508 trend entities (hashtags/songs) but NOT raw post captions. Captions are received from providers then discarded before Firestore write. This means historical retrospective analysis on post text is impossible from current Firestore data.
- [x] **Product vision clarified** — The Gazette IS the Console. The filter interface is legacy scaffolding. Concept cards become the primary output format. AutoAgent optimizes the concept card generator autonomously overnight.

**Key architectural decisions made:**

- **Hybrid path chosen** (not Path A workshop-only, not Path B direct TypeScript). Meta-agent optimizes Python harnesses in the workshop; winning changes get captured as Lesson documents; human or Claude Code translates lessons to TypeScript production code via PR; Vercel deploys after merge.
- **Approach 2 chosen for Gazette refactor** — unify the existing trend-ticker, trending-audio, morning-briefing routes into a shared "context → trends → concept cards" pipeline. Takes 2-3 days, ships cleaner than Approach 1 (side-by-side).

---

## Current Position

**We are here:** Phase 0 reconnaissance complete. Master plan revised based on findings. About to begin Phase 1 — core type definitions in types/gazette.ts. No production code touched yet.

**Current git state:**
- Branch: feature/autoagent-integration
- Phase 0 reconnaissance report committed as docs/DA-TEC-2026-003-gazette-refactor-recon.md
- Handover document now lives in repo at DA-HANDOVER-001.md
- Production branch main is unchanged — current Vercel deployment reflects the pre-session state

**The immediate next step:** Phase 2.1 — create lib/gazette/context.ts with UserContext validation helpers

**Blocked items:** DA-Q-015 (ground truth labeling from real data) and DA-Q-017 (first hybrid optimization cycle) remain blocked pending Phase 8 ground truth rebuild.

---

## The Checklist — Path To Gazette In Production

This is the concrete path from where we are now to the Gazette being the live Console at `digitalchemy-console.vercel.app`. Check items off as you complete them.

### Phase 0 — Reconnaissance (1 session, ~30 min)

**Goal:** Understand the existing Console code before touching it.

- [x] **0.1** Run the reconnaissance command in Claude Code (the long prompt that produces `docs/DA-TEC-2026-003-gazette-refactor-recon.md`)
- [ ] **0.2** Review the generated reconnaissance report
- [ ] **0.3** Identify any open questions that need human judgment before proceeding
- [ ] **0.4** Approve the refactor plan, modify it, or send it back for revision
- [ ] **0.5** Commit the approved plan and push to GitHub

**Exit criteria:** Doli has a concrete refactor plan based on real files in the repo, not guesses.

---

### Phase 1 — Core Types And Shared Context (1 session, ~1 hour)

**Goal:** Define the foundational TypeScript types that the unified pipeline will use.

- [x] **1.1** Create `types/gazette.ts` with the `UserContext` type (region, platform, horizon, industry, audience)
- [x] **1.2** Add the `ConceptCard` type (id, category, title, description, evidence, action, confidence, window, effort)
- [x] **1.3** Add the `ConceptCardCategory` enum (`AUDIO_VIRAL`, `TREND_ALERT`, `BRAND_SIGNAL`, `CULTURAL_MOMENT`, `CREATOR_SPOTLIGHT`, `REGIONAL_PULSE`, `TECH_INNOVATION`)
- [x] **1.4** Add the `GazetteResponse` type (context, cards, generated_at, source_snapshots, version)
- [x] **1.5** Write type tests or examples showing the shape of a valid response
- [x] **1.6** Commit: `feat(gazette): add core type definitions for unified pipeline`
- [ ] **1.7** Push to GitHub

**Exit criteria:** All downstream code can import from `types/gazette.ts` and get a consistent view of what a Gazette response looks like.

---

### Phase 2 — Shared Pipeline Module (1-2 sessions, ~2-3 hours)

**Goal:** Create the unified `context → trends → concept cards` pipeline as a library module that all API routes can call.

- [x] **2.0** Extract duplicated ScrapeCreators fetch logic from trend-ticker/route.ts, reverse-engineer/route.ts, and lib/trendRadar/capture.ts into `lib/providers/scrapeCreators.ts`
- [x] **2.0.5** Add Vitest test runner and backfill ScrapeCreators unit tests (18 tests, all passing)
- [ ] **2.1** Create `lib/gazette/context.ts` — helpers for validating and defaulting `UserContext` objects
- [ ] **2.2** Create `lib/gazette/trends.ts` — fetches relevant `trend_snapshots` from Firestore based on `UserContext` (platform, region filtering)
- [ ] **2.3** Create `lib/gazette/concept-cards.ts` — the concept card generator that takes context + trends and returns `ConceptCard[]`
- [ ] **2.4** Define the initial classification logic in `concept-cards.ts` — keyword rules matching the 7 categories, with the Post 7 and Post 18 fixes from the baseline failure analysis built in from day 1
- [ ] **2.5** Unit test the concept card generator against the existing synthetic ground truth (`autoagent/tasks/concept-card-classification/files/ground_truth.json`) to confirm it hits the 0.9020+ baseline
- [ ] **2.6** Create `lib/experiments/log.ts` — Firestore logging to `da-experiments/{use-case}/{run-id}` for cost tracking and experiment audit trail
- [ ] **2.7** Commit: `feat(gazette): add shared pipeline module for unified intelligence`
- [ ] **2.8** Push to GitHub

**Exit criteria:** `lib/gazette/` is a callable, tested module that any API route can import to produce concept cards from user context.

---

### Phase 3 — New Gazette API Route (1 session, ~1 hour)

**Goal:** A new `/api/gazette` endpoint that uses the shared pipeline to return concept cards.

- [ ] **3.1** Create `app/api/gazette/route.ts` — accepts `UserContext` via POST body or query params
- [ ] **3.2** Wire it to `lib/gazette/` pipeline
- [ ] **3.3** Preserve the SSE streaming pattern from existing routes (fixed adapter boundary rule)
- [ ] **3.4** Preserve the Firestore logging pattern
- [ ] **3.5** Add request validation (reject malformed UserContext)
- [ ] **3.6** Add a fallback response if no trends are available for the requested context
- [ ] **3.7** Test locally with `npm run dev` and curl calls for at least 3 different contexts (UAE/TikTok/Real Estate/24h, Singapore/Instagram/Fashion/1 week, US/YouTube/Tech/6 months)
- [ ] **3.8** Commit: `feat(gazette): add /api/gazette endpoint with shared pipeline`
- [ ] **3.9** Push to GitHub

**Exit criteria:** `curl http://localhost:3000/api/gazette` returns a valid `GazetteResponse` with 5-8 concept cards.

---

### Phase 4 — Refactor Existing Routes To Use Shared Pipeline (1-2 sessions, ~2-3 hours)

**Goal:** Migrate `trend-ticker`, `trending-audio`, and `morning-briefing` to use the shared `lib/gazette/` module so there's only one source of truth for the pipeline logic. Split MorningBriefing.tsx into per-tab components.

- [ ] **4.1** Read current `app/api/trend-ticker/route.ts` carefully and document exactly what it does
- [ ] **4.2** Refactor `trend-ticker` to call `lib/gazette/trends.ts` for data and return its existing output format (preserves API contract for any existing UI consumers)
- [ ] **4.3** Test that the trend-ticker endpoint still works identically from the UI
- [ ] **4.4** Repeat for `trending-audio`
- [ ] **4.5** Repeat for `morning-briefing`
- [ ] **4.6** Remove any duplicated Firestore query logic from the old routes — all Firestore access now flows through `lib/gazette/`
- [ ] **4.7** Split `components/console/MorningBriefing.tsx` into per-tab components: extract `RecommendsSection` to `components/gazette/ConceptCard.tsx`, extract tab content to individual files
- [ ] **4.8** Confirm the fourth ScrapeCreators duplication location and extract it
- [ ] **4.9** Run the full Console locally and verify no regressions in the existing filter-based UI
- [ ] **4.10** Commit: `refactor(gazette): migrate existing routes to shared pipeline`
- [ ] **4.11** Push to GitHub

**Exit criteria:** The existing Console UI works identically to before, but all four routes (gazette + three existing) share the same underlying pipeline module. Zero user-visible change.

---

### Phase 5 — Preview Deployment And Human Testing (1 session, ~1 hour)

**Goal:** Ship the refactored code to a Vercel preview URL and validate end-to-end.

- [ ] **5.1** Push the `feature/autoagent-integration` branch to GitHub (already done continuously)
- [ ] **5.2** Verify Vercel auto-creates a preview deployment for the branch
- [ ] **5.3** Open the preview URL in a browser
- [ ] **5.4** Test the existing filter-based Console interface — confirm no regressions
- [ ] **5.5** Test the new `/api/gazette` endpoint via browser devtools or a test page
- [ ] **5.6** Verify Firestore writes are landing in the correct collections
- [ ] **5.7** Verify cost tracking is logging Claude API spend to the experiment log
- [ ] **5.8** Document any issues found in a new task card in DA-QUEUE-001

**Exit criteria:** The preview deployment works correctly. Doli has validated the new endpoint with real data.

---

### Phase 6 — Gazette Preview UI (Optional Rung 2, 1-2 sessions)

**Goal:** A dedicated `/gazette-preview` page in the Console that renders concept cards beautifully. This is the first time users would see concept cards in a UI.

- [ ] **6.1** Create `app/gazette-preview/page.tsx` — a new page that calls `/api/gazette`
- [ ] **6.2** Design the concept card component (`components/gazette/ConceptCard.tsx`) — use the frontend-design skill guidance, distinctive aesthetic, not generic
- [ ] **6.3** Add category badges with distinct colors/icons for each of the 7 categories
- [ ] **6.4** Add confidence, window, and effort indicators
- [ ] **6.5** Add a simple "I acted on this" feedback button (even if it just logs to Firestore for now — this becomes the feedback loop for AutoAgent later)
- [ ] **6.6** Hard-code a default UserContext for initial testing (UAE / TikTok / React Now 24h / Real Estate / All Ages)
- [ ] **6.7** Test in preview deployment
- [ ] **6.8** Commit and push

**Exit criteria:** Doli can share `/gazette-preview` URL with test users and get reactions to the format.

---

### Phase 7 — Merge To Main And Ship To Production (1 session, ~30 min)

**Goal:** The Gazette refactor lives in production on `digitalchemy-console.vercel.app`.

- [ ] **7.1** Final review of the full diff on `feature/autoagent-integration` vs `main`
- [ ] **7.2** Open a pull request with a comprehensive description linking DA-TEC-2026-001, DA-TEC-2026-002, DA-TEC-2026-003, and DA-HANDOVER-001
- [ ] **7.3** Self-review the PR (or have a collaborator review if available)
- [ ] **7.4** Merge to `main`
- [ ] **7.5** Watch Vercel auto-deploy
- [ ] **7.6** Verify `digitalchemy-console.vercel.app` works identically to before (zero regression is success for this phase)
- [ ] **7.7** Verify `/api/gazette` works on production
- [ ] **7.8** Verify `/gazette-preview` works on production if Phase 6 was completed
- [ ] **7.9** Announce to self and team: **Gazette Rung 1 is live.**

**Exit criteria:** Something that was not on `digitalchemy-console.vercel.app` this morning is now live there.

---

### Phase 8 — First Real Hybrid Optimization Cycle (Deferred)

**Goal:** Solve the ground truth data problem and run the first real overnight AutoAgent optimization against the concept card generator.

- [ ] **8.1** Resolve the ground truth data mismatch — either pull raw captions from ScrapeCreators/Apify APIs directly, or manually curate 20-30 ideal concept cards for one specific context (Claude Code's Option 2 hybrid)
- [ ] **8.2** Write `autoagent/tasks/concept-card-classification/files/ground_truth_real.json`
- [ ] **8.3** Update the benchmark to optimize for concept card *output quality* rather than post *classification accuracy*
- [ ] **8.4** Unblock DA-Q-015 and DA-Q-017 in the queue
- [ ] **8.5** Run the first real overnight optimization cycle
- [ ] **8.6** Review lessons generated in `autoagent/lessons/`
- [ ] **8.7** Translate the top lesson to TypeScript via the production translation workflow (`docs/production-translation-workflow.md`)
- [ ] **8.8** Merge and deploy
- [ ] **8.9** Measure before/after impact on the concept card quality metric

**Exit criteria:** A measurable production improvement to the Gazette that was designed by AutoAgent, approved by Doli, and shipped via the hybrid workflow.

---

### Phase 9 — The Inversion (Future, Rung 3)

**Goal:** The Gazette becomes the default landing page of the Console. Filter-based interface moves to advanced mode or is deprecated.

- [ ] **9.1** Product decision: how does user context get stored/inferred without the filter interface? (stored preferences, onboarding flow, URL parameters, etc.)
- [ ] **9.2** Implement user context persistence
- [ ] **9.3** Replace the current `app/page.tsx` landing with the Gazette view
- [ ] **9.4** Move the filter interface to `/advanced` or similar
- [ ] **9.5** Ship to preview, test, merge to main
- [ ] **9.6** Update marketing/landing copy to reflect the new product positioning

**Exit criteria:** First-time visitors to `digitalchemy-console.vercel.app` land directly on a personalized Gazette, not a filter form.

---

## Active Risks And Open Questions

Track things that could derail progress or need decisions.

### Risk 1 — Ground truth data mismatch (known)

The Firestore reconnaissance revealed that `trend_snapshots` contain normalized entities, not raw post captions. This means the benchmark ground truth format needs to change from "posts to classify" to something that matches real data. **Open question:** Do we (a) pull raw captions from ScrapeCreators/Apify directly, (b) manually curate ideal concept card outputs for specific contexts, or (c) change the benchmark to operate on entities instead of posts?

### Risk 2 — Refactoring production routes

Phase 4 modifies existing production API routes. Any subtle bug here could break the live Console. Mitigation: thorough local testing before push, preview deployment validation before merge to main, the three existing routes must have identical output after refactor.

### Risk 3 — Gazette UI design quality

Phase 6 depends on the concept card component being genuinely well-designed. Generic "AI slop" UI will undermine the product. Mitigation: use the frontend-design skill, iterate on the component until it feels distinctive, get real user reactions before scaling.

### Risk 4 — Cost overrun on first optimization cycle

Phase 8 involves real Claude API calls during optimization. The DA-UC-001 directive caps overnight runs at $50 but first runs have unknown cost profiles. Mitigation: run shorter daytime cycles first (5 experiments, monitored) before letting anything run overnight unattended.

### Open question 1 — When does Doli want Phase 6 (Gazette Preview UI)?

Phase 6 is optional in the current plan. It could slot in between Phase 5 and Phase 7, or be deferred until after the first production ship.

### Open question 2 — What's the rollback plan if production regresses?

Doli has not yet defined a rollback procedure for `digitalchemy-console.vercel.app`. Should be documented before Phase 7.

---

## Key File Locations Reference

**In the repo:**

- `autoagent/DA-UC-001-social-media.md` — The AutoAgent directive file (human editable)
- `autoagent/agents/` — Python agent harnesses (meta-agent editable)
- `autoagent/tasks/concept-card-classification/` — Current benchmark task
- `autoagent/lessons/` — Where extracted lessons will live (template exists, no lessons yet)
- `autoagent/scripts/extract_lessons.py` — Lesson extractor script
- `autoagent/results.tsv` — Experiment log
- `docs/DA-TEC-2026-001-autoagent-integration.md` — Original integration plan (note: actually the React dashboard, may need a markdown version)
- `docs/DA-TEC-2026-002-architecture-decision.md` — Hybrid path decision
- `docs/DA-TEC-2026-003-gazette-refactor-recon.md` — Phase 0 reconnaissance report
- `docs/da-queue-kickoff.md` — Queue execution protocol
- `docs/production-translation-workflow.md` — How lessons become PRs
- `DA-QUEUE-001.md` (repo root) — Task queue
- `DA-HANDOVER-001.md` (repo root) — This document
- `CLAUDE.md` (repo root) — Protocol docs for Claude Code
- `app/api/trend-ticker/route.ts` — Existing production route (TypeScript)
- `app/api/trending-audio/route.ts` — Existing production route (TypeScript)
- `app/api/morning-briefing/route.ts` — Existing production route (TypeScript)
- `app/page.tsx` — Current Console landing page (filter interface)
- `lib/` — Shared utilities (lib/gazette/ to be created in Phase 2)
- `types/` — TypeScript types (types/gazette.ts to be created in Phase 1)
- `.env.local` — Has `ANTHROPIC_API_KEY` (gitignored)

**External:**

- GitHub: `https://github.com/DigitOracle/DigitAlchemy_30MAR2026`
- Production: `https://digitalchemy-console.vercel.app`
- Vercel project env vars: `https://vercel.com/digitalchemys-projects/digitalchemy-console/settings/environment-variables`
- Anthropic Console: `https://console.anthropic.com/settings/keys`
- Firebase project: `digitalchemy-de4b7` (me-central2)

---

## How To Use This Checklist

**For Doli:**

1. Work through phases in order
2. Check boxes as you complete items (edit this file directly or ask Claude Code to)
3. If you get stuck or need to stop, update the "Current Position" section so you know where to resume
4. Add new risks or open questions as they come up
5. When a phase is complete, commit the updated handover document with message: `docs(gazette): checklist phase N complete`

**For a new Claude instance picking up this project:**

1. Read this entire document
2. Check current git state: `git status && git log --oneline -20` on `feature/autoagent-integration`
3. Read `autoagent/DA-UC-001-social-media.md` to understand the AutoAgent directive
4. Read `DA-QUEUE-001.md` to see any pending tasks
5. Read `docs/DA-TEC-2026-002-architecture-decision.md` to understand why Hybrid was chosen
6. Read the most recent 3-5 commits to see what was just done
7. Check "Current Position" section above
8. Continue from the first unchecked item in the active phase
9. Ask Doli before touching any files under `app/api/` — those are production routes

**For a human collaborator (Tinamarie, backend developer, partner):**

1. Read this document top to bottom (about 15 minutes)
2. Read `autoagent/DA-UC-001-social-media.md` (10 minutes)
3. Skim `docs/DA-TEC-2026-002-architecture-decision.md` (5 minutes)
4. Ask Doli for a 15-minute walkthrough before modifying any code
5. Always work on `feature/autoagent-integration` branch or feature branches off of it
6. Never commit directly to `main`
7. Use commit message prefixes: `feat(gazette):`, `fix(gazette):`, `docs(autoagent):`, `refactor(gazette):`, `chore(autoagent):`

---

## Document History

- **v1.0 — April 7, 2026** — Initial handover document created at the end of Session 2, after the Gazette vision was clarified and Approach 2 chosen for the refactor. Phase 0 reconnaissance is the immediate next step.

---

## Session 3 — April 7, 2026 — Phase 0 Reconnaissance Complete

- Phase 0 reconnaissance report committed as docs/DA-TEC-2026-003-gazette-refactor-recon.md
- Key finding: MorningBriefing.tsx is a single 800-line component with 7 tabs via useState, not URL routing
- Key finding: The DA-UC-001 seven-category taxonomy (AUDIO_VIRAL, TREND_ALERT, BRAND_SIGNAL, CULTURAL_MOMENT, CREATOR_SPOTLIGHT, REGIONAL_PULSE, TECH_INNOVATION) does not exist anywhere in the TypeScript code — net-new work in Phase 1
- Key finding: lib/trendRadar/score.ts already computes velocity, persistence, novelty, classification, and forecast but is not called by the Gazette. TrendRadar becomes the trend source for the new pipeline.
- Key finding: ScrapeCreators fetch logic is duplicated four times — trend-ticker/route.ts, reverse-engineer/route.ts, lib/trendRadar/capture.ts, and a fourth location to confirm during Phase 4. Phase 2.0 extracts this to lib/providers/scrapeCreators.ts.
- Key finding: da-experiments/ Firestore collection is not referenced in TypeScript. Logging boundary will be built fresh in Phase 2.6 as lib/experiments/log.ts.
- Key finding: /api/post-recommendations powers the TikTok and Instagram card sections with Firestore Content DNA profiles. Content DNA personalisation is already shipped on platform tabs.
- Revised master plan decisions: Phase 2 rewritten around TrendRadar as trend source. Phase 2.0 added for ScrapeCreators dedup. Phase 4 expanded to include MorningBriefing.tsx split into per-tab components. Phases 1, 3, 5–10 unchanged.
- Next actionable step: Phase 1.1 — create types/gazette.ts
- Phase 1 complete — types/gazette.ts committed with UserContext, ConceptCard, ConceptCardCategory, GazetteResponse, and example values. tsc --noEmit passes clean.
- Phase 2.0 complete — ScrapeCreators canonical module extracted to lib/providers/scrapeCreators.ts. Four original callers remain unchanged until Phase 4. Diff analysis at docs/DA-TEC-2026-004-scrapecreators-diff.md.
- Phase 2.0.5 complete — Vitest added as test runner. ScrapeCreators tests backfilled (18 tests, all passing).
