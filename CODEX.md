# CODEX.md — Context for Codex code reviews

Codex (via the codex-plugin-cc Claude Code plugin) is used as a second-opinion reviewer on this project. This file gives Codex the context it needs to form independent, useful opinions about the work landing on this branch.

## Project

- Owner: Kendall Wilson (Doli), Founder, DigitAlchemy® Tech Limited (ADGM No. 35004, Abu Dhabi UAE)
- Repo: github.com/DigitOracle/DigitAlchemy_30MAR2026
- Working branch: feature/autoagent-integration
- Production: digitalchemy-console.vercel.app
- Stack: Next.js 14 App Router, TypeScript strict, Tailwind, Firestore (digitalchemy-de4b7, me-central2), Vercel
- Test runner: Vitest (added in Phase 2.0.5)
- Vercel git author email (non-negotiable): k.wilsonqc@outlook.com

## The product

DigitAlchemy® Console is a social media intelligence platform marketed as the "DigitAlchemy Gazette" — a newspaper-style landing page that delivers personalised concept cards (5–8 actionable content plays) for creators in regulated industries (real estate, construction, BIM, smart cities). The end-state vision: the Gazette IS the Console. No filter form gating entry, just a personalised intelligence briefing on landing.

## Active refactor: DA-GAZETTE-UNIFICATION

A 10-phase effort unifying three separate intelligence pipelines into one shared lib/gazette/ module. Tracked in DA-HANDOVER-001.md at repo root. Reconnaissance findings in docs/DA-TEC-2026-003-gazette-refactor-recon.md.

Current state: Phase 2 in progress. Phases 0–1 complete (recon + types/gazette.ts). Phase 2.0 (canonical lib/providers/scrapeCreators.ts) complete. Phase 2.0.5 (Vitest setup + test backfill) and Phase 2.1 (lib/gazette/context.ts) in flight.

## Architecture constraints — non-negotiable, do not suggest violations

1. Inference-last provider chain order: ScrapeCreators → Apify → xpoz → Perplexity → Claude. Claude is always the final inference step.
2. Spotify is enrichment-only. Never used for trend detection.
3. Trend Ticker handles TikTok + Instagram only. YouTube is explicitly excluded from Trend Ticker logic.
4. SSE streaming adapter is fixed (safeClose / safeEnqueue guards). Do not modify.
5. Firestore experiment logs go to da-experiments/{use-case}/{run-id}.
6. Vercel git author email: k.wilsonqc@outlook.com on all commits.
7. Meta-agent (AutoAgent) inference model stays Claude — preserves "model empathy" advantage in optimisation cycles.

## Type system contract

The unified pipeline contract lives in types/gazette.ts. Key types: UserContext, Platform, Horizon, ConceptCard, ConceptCardCategory (string literal union of 7 values), ConceptCardEvidence, ConceptCardWindow, ConceptCardEffort, GazetteResponse. The seven categories are: AUDIO_VIRAL, TREND_ALERT, BRAND_SIGNAL, CULTURAL_MOMENT, CREATOR_SPOTLIGHT, REGIONAL_PULSE, TECH_INNOVATION.

## Out of scope for review feedback

Do not suggest:
- Adding retries, circuit breakers, or rate limiting in lib/providers/ (deferred hardening phase)
- Schema validation libraries like Zod or Yup (handwritten validators are the chosen approach for this project at this stage)
- Changing the inference-last provider chain order (constraint #1)
- TypeScript enums where string literal unions are used (deliberate choice for JSON serialisation)
- Splitting lib/providers/scrapeCreators.ts into multiple files unless the file exceeds ~500 lines
- Migrating callers to lib/providers/scrapeCreators.ts before Phase 4 (extraction-without-migration is deliberate)

## Review priorities — what to focus on

When reviewing this codebase, prioritise in this order:
1. Correctness: does the code do what its name and comments say it does?
2. Type safety: any `any` types, unsafe assertions, or @ts-ignore comments
3. Architecture constraint violations from the list above
4. Security: API keys in URL query strings, missing input validation on user-controlled data, secrets in commits
5. Test coverage: are happy path and error paths both covered? are mocks realistic?
6. Naming and clarity: function and variable names that mislead about behaviour
7. Style and formatting: lowest priority, only mention if it materially affects readability

## Reviewer voice

Be direct. If something is wrong, say so without hedging. If something is fine, confirm it briefly without padding. Cite file paths and line numbers for every issue. Distinguish between "this is wrong" (hard issue), "this is suboptimal but workable" (soft issue), and "this is a style preference" (skip unless asked). The user is using you as a second opinion, not a debate partner — confirmations are valuable when they're earned.
