# DA-TEC-2026-002 — AutoAgent Integration Architecture Decision

**Document ID:** DA-TEC-2026-002
**Owner:** Kendall Wilson (Doli), Founder, DigitAlchemy Tech Limited
**Status:** DECIDED
**Decision:** Hybrid (Path C)
**Date:** 2026-04-07
**References:** DA-TEC-2026-001, DA-UC-001-social-media

---

## Problem Statement

The DigitAlchemy Console runs three social media intelligence routes in TypeScript on Vercel:

- `/api/trend-ticker` — TikTok + Instagram hashtag detection
- `/api/trending-audio` — TikTok audio trend detection with Spotify enrichment
- `/api/morning-briefing` — Gazette briefing synthesizing all sources

We need to optimize these agents using the AutoAgent meta-agent framework (Harbor benchmarks, hill-climbing experiment loops). The question: **where does optimization happen, and how does it reach production?**

---

## Three Paths Evaluated

### Path A — Python Workshop Only

Run all optimization in Python agent harnesses. Never touch TypeScript. The Python agents become the "real" agents, deployed separately from Vercel.

### Path B — Direct TypeScript Optimization

Skip Python entirely. Have the meta-agent directly edit the TypeScript production routes, benchmark against live endpoints, and commit winning changes.

### Path C — Hybrid (Python Workshop + Lesson Translation)

Optimize in Python harnesses (fast iteration, Harbor benchmarks, safe sandbox). When a winning change is found, extract a "Lesson" document describing the improvement. A human-reviewed translation step applies the lesson to the TypeScript production code via PR.

---

## Comparison Matrix

| Dimension | Path A: Python Only | Path B: Direct TS | Path C: Hybrid |
|-----------|--------------------|--------------------|----------------|
| **Iteration speed** | Fast — Python + Harbor native | Slow — no benchmark harness for TS | Fast — Python workshop is the lab |
| **Production safety** | None — Python never reaches prod | Dangerous — AI edits production directly | Safe — human gate before every prod change |
| **Cost per experiment** | Low — local Docker runs | High — live API calls on each iteration | Low — local Docker, API only at translation |
| **Benchmark quality** | High — Harbor F1/LLM-judge scoring | Low — manual curl testing | High — Harbor benchmarks + preview deploy verification |
| **Architecture drift risk** | High — Python and TS diverge over time | None — single codebase | Medium — Lessons bridge the gap explicitly |
| **Human oversight** | None required (but also no prod impact) | Required but easy to bypass | Enforced — PR review gate is structural |
| **Time to first prod change** | Never (without translation) | Immediate (but risky) | Days — after first optimization cycle completes |
| **Rollback capability** | N/A | Git revert, but damage may be done | Clean — PR-based, Vercel preview-tested |
| **Complexity** | Low | Low | Medium — extra Lesson abstraction layer |
| **Long-term scalability** | Poor — two codebases, no prod path | Poor — no benchmark infrastructure | Good — reusable pattern for any route |

---

## Decision: Path C (Hybrid)

### Rationale

1. **Production safety is non-negotiable.** The Console serves real users (Doli's family accounts, future clients). Path B's direct TypeScript editing has no safety net. Path C's human review gate ensures every production change is intentional.

2. **Iteration speed matters for optimization.** Harbor benchmarks require a Python agent interface. Path A gives us this natively. Path B would require building a TS benchmark harness from scratch — wasted effort when Harbor exists.

3. **The Lesson abstraction pays for itself.** The extra complexity of Lesson documents is actually a feature: it forces the meta-agent to articulate *why* a change worked, not just *what* changed. This makes translation to TypeScript more reliable and creates a knowledge base of optimization insights.

4. **Architecture drift is manageable.** The Fixed Adapter Boundary pattern means the Python harness and TypeScript route share the same structure. Lessons explicitly map Python editable-section changes to TypeScript equivalents. Drift is tracked, not ignored.

5. **Cost is bounded.** Python experiments run locally in Docker. API costs only accrue during the final Claude inference step (inference-last architecture) and during translation PRs. No runaway API spend from live endpoint testing.

---

## Architecture Flow

```
+-------------------+     +------------------+     +-------------------+
|  Python Workshop  |     |  Lesson Bridge   |     |  TypeScript Prod  |
|  (autoagent/)     |     |  (autoagent/     |     |  (app/api/)       |
|                   |     |   lessons/)      |     |                   |
|  Harbor benchmarks| --> |  LESSON-NNN.md   | --> |  PR on branch     |
|  results.tsv      |     |  extract_lessons |     |  experiment/      |
|  hill-climbing    |     |  .py             |     |  lesson-NNN       |
|  experiment loop  |     |                  |     |                   |
+-------------------+     +------------------+     +-------------------+
        |                        |                        |
        v                        v                        v
  Meta-agent runs          Human reviews            Vercel preview
  locally in Docker        Lesson document          deploys branch
  (safe, fast, cheap)      (approval gate)          (test before merge)
        |                        |                        |
        v                        v                        v
  Score in results.tsv     DRAFT -> REVIEWED        Preview tested
  status: keep/discard     -> APPROVED              -> Merge to main
                                                    -> APPLIED
```

### Key Boundaries

- **Python Workshop** (`autoagent/`): Where optimization happens. Meta-agent modifies editable harness sections, runs Harbor benchmarks, records results. No production impact.
- **Lesson Bridge** (`autoagent/lessons/`): Where knowledge transfers. Winning experiments generate structured Lesson documents describing the change, its impact, and how to translate it.
- **TypeScript Production** (`app/api/`): Where changes land. Each Lesson becomes a PR on an `experiment/` branch. Vercel preview deploys for testing. Human approves merge.

### Human Gates

1. **Lesson Review** — Human reads the Lesson before any translation begins
2. **Preview Testing** — Human tests the Vercel preview deployment
3. **PR Approval** — Human merges the PR to main

No automated path from Python experiment to production exists. This is by design.

---

## Architecture Constraints Preserved

All constraints from DA-UC-001 apply throughout the hybrid flow:

1. **Inference-last provider chain** — Same order in Python harness and TypeScript route
2. **Spotify enrichment-only** — Enforced in both environments
3. **TikTok + Instagram only for Trend Ticker** — YouTube excluded in both
4. **Fixed Adapter Boundary** — SSE streaming, Firestore logging untouched in both
5. **Vercel git author** — k.wilsonqc@outlook.com on all commits

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Python/TS drift | Lesson documents explicitly map Python changes to TS equivalents |
| Lesson backlog grows without translation | Weekly review cadence; dashboard of DRAFT lessons aging > 7 days |
| Meta-agent generates low-quality lessons | Minimum score delta threshold (0.02) filters noise |
| Translation introduces bugs | Vercel preview deployment catches regressions before merge |
| Cost overrun during overnight optimization | $50 USD budget cap per overnight run (DA-UC-001 rule) |

---

## Next Steps

1. DA-Q-012: Create the Lesson format template
2. DA-Q-013: Build the Lesson Extractor script
3. DA-Q-014: Design ground truth labeling protocol
4. DA-Q-016: Draft the Production Translation Workflow
5. DA-Q-017: Run the first real hybrid optimization cycle

---

**End of decision document. This is the architectural SSOT for AutoAgent integration.**
