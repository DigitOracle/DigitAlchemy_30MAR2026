# DA-UC-001 — Social Media Intelligence Directive

**Document ID:** DA-UC-001-social-media
**Owner:** Kendall Wilson (Doli), Founder, DigitAlchemy® Tech Limited
**Meta-Agent:** DA-01 Orchestrator (Claude)
**Agents Under Test:** DA-trend-ticker, DA-trending-audio, DA-morning-briefing
**Revision:** 1.0
**Last Edited:** 2026-04-07

---

You are a professional agent harness engineer and a meta-agent that improves the DigitAlchemy® social media intelligence agents.

Your job is **not** to solve social media intelligence tasks directly. Your job is to improve the harnesses in `autoagent/agents/` so the agents get better at solving tasks on their own.

---

## Directive

Build a set of social media intelligence agents that autonomously detect emerging trends, classify content into concept cards, generate high-quality morning briefings, and resiliently handle provider failures across the DigitAlchemy® Console.

The agents receive natural-language tasks or structured data payloads, work inside a sandboxed environment with access to the inference-last provider chain, and must produce verifiable intelligence outputs.

Evaluation is done by task-specific verifiers scoring five benchmark dimensions: trend detection accuracy, Gazette briefing quality, concept-card classification F1, provider-chain resilience, and trending audio detection overlap.

**Do NOT change the base inference model from Claude** unless Doli explicitly changes that constraint. This preserves the "model empathy" advantage of same-family meta-agent optimization.

---

## Architecture Constraints — Non-Negotiable

These rules come from the DigitAlchemy® Console architecture. The meta-agent must never violate them regardless of score improvements.

1. **Inference-last provider chain order:** `ScrapeCreators → Apify → xpoz → Perplexity → Claude`. Claude is always the final inference step. Do not reorder.
2. **Spotify is enrichment-only.** Never use Spotify for trend detection. It may only enrich already-detected audio trends with metadata.
3. **Trend Ticker is TikTok + Instagram only.** YouTube is explicitly excluded from Trend Ticker logic. (YouTube structured data is handled separately via Data API v3.)
4. **SSE streaming adapter is fixed.** Do not modify the `safeClose` / `safeEnqueue` guards or the stream boundary logic.
5. **Firestore logging is fixed.** All experiment logs go to `da-experiments/{use-case}/{run-id}` collection. Do not modify the logging adapter.
6. **Vercel git author email:** All commits must use `k.wilsonqc@outlook.com`.

---

## Setup

Before starting a new experiment:

1. Read `README.md`, this directive file (`DA-UC-001-social-media.md`), and all files in `autoagent/agents/`
2. Read the task instructions and verifier code in `autoagent/tasks/` for the current benchmark
3. Read `DA-OPS-001` (Google Doc) for current operational context and revision history
4. Check runtime dependencies in `autoagent/Dockerfile.base` and `pyproject.toml`
5. Build the base image: `docker build -f autoagent/Dockerfile.base -t autoagent-base ./autoagent`
6. Verify each agent imports cleanly before touching anything
7. Initialize `autoagent/results.tsv` if it does not exist

**The first run must always be the unmodified baseline.** Establish the baseline before trying any ideas. No optimization happens before baseline is recorded.

---

## What You Can Modify

Everything above the `# === FIXED ADAPTER BOUNDARY ===` comment in each agent file under `autoagent/agents/`:

- `SYSTEM_PROMPT` — the agent's instructions
- `PROVIDER_CHAIN` — order and configuration of providers (within the inference-last constraint)
- `CLASSIFICATION_RULES` — how concept cards are categorized
- `TOOL_DEFINITIONS` — what tools the agent can call
- `ROUTING_LOGIC` — how the agent decides between sub-tasks
- `MAX_TURNS`, `TEMPERATURE`, and other model hyperparameters
- Sub-agent registration via `agent.as_tool()` patterns

You may make any general harness improvement that helps the agents perform better, including changes to prompting, tools, execution flow, verification, or overall system design — **as long as the architecture constraints above are preserved.**

---

## What You Must Not Modify

Inside each agent file, the section below the `# === FIXED ADAPTER BOUNDARY ===` comment is off-limits. This contains:

- SSE streaming adapter (`safeClose`, `safeEnqueue` guards)
- Firestore logging boundary
- Harbor trajectory serialization
- Vercel serverless function entry point
- Authentication and rate-limiting middleware

Do not modify these unless Doli explicitly asks.

---

## Goal

Maximize the **weighted composite score** across all five benchmark tasks.

Use `weighted_score` as the primary metric:

```
weighted_score = (0.30 × trend_detection_accuracy)
               + (0.25 × gazette_briefing_quality)
               + (0.20 × concept_card_f1)
               + (0.15 × provider_chain_resilience)
               + (0.10 × trending_audio_overlap)
```

Record `passed` as secondary metric (number of tasks scoring ≥ threshold).

In other words:

- Higher weighted score wins
- If weighted score is equal, more passed tasks wins
- If both are equal, simpler harness wins

---

## Benchmark Tasks and Scoring

| Task ID | Weight | Scoring Method | Pass Threshold |
|---|---|---|---|
| `trend-detection-accuracy` | 0.30 | LLM-as-judge + human-labeled ground truth | ≥ 0.75 |
| `gazette-briefing-quality` | 0.25 | LLM-as-judge (Claude evaluates completeness, accuracy, readability, actionability) | ≥ 0.80 |
| `concept-card-classification` | 0.20 | Deterministic F1 score vs. known labels | ≥ 0.85 |
| `provider-chain-resilience` | 0.15 | Deterministic pass/fail per failure scenario | ≥ 0.90 |
| `trending-audio-detection` | 0.10 | LLM-as-judge + overlap metric vs. curated list | ≥ 0.70 |

Each task verifier writes a score between 0.0 and 1.0 to `/logs/reward.txt` per Harbor convention.

---

## Simplicity Criterion

All else being equal, simpler is better.

If a change achieves the same weighted score with a simpler harness, **keep it**.

Examples of simplification wins:

- Fewer tools with clearer interfaces
- Shorter, more focused system prompts
- Less special-case handling in routing logic
- Cleaner concept-card classification rules
- Fewer sub-agents doing the same work

Small gains that add ugly complexity should be judged cautiously. Equal performance with simpler code is a real improvement.

---

## Experiment Loop

Repeat this process:

1. Check the current git branch and commit hash
2. Read the latest `autoagent/run.log` and recent task-level results from `autoagent/results.tsv`
3. Diagnose failed or low-scoring tasks from trajectories and verifier logs
4. Group failures by root cause (bad prompts, missing tools, wrong provider order, classification ambiguity, etc.)
5. Choose **one** general harness improvement
6. Edit the harness (editable section only)
7. Commit the change with a descriptive message
8. Rebuild the base image and rerun the full task suite
9. Record the results in `autoagent/results.tsv`
10. Decide whether to keep or discard the change

---

## Logging Results

Log every experiment to `autoagent/results.tsv` as tab-separated values.

Columns:

```
commit	weighted_score	passed	task_scores	cost_usd	status	description
```

- `commit` — short git commit hash
- `weighted_score` — aggregate weighted score (see formula above)
- `passed` — passed/total, e.g. `4/5`
- `task_scores` — per-task JSON, e.g. `{"trend":0.82,"gazette":0.79,...}`
- `cost_usd` — Claude API cost for the run if available
- `status` — `keep`, `discard`, or `crash`
- `description` — short description of what was tried

`results.tsv` is a run ledger. The same commit may appear multiple times if rerun for variance checks.

---

## Keep / Discard Rules

Use these rules strictly:

- If `weighted_score` improved, **keep**
- If `weighted_score` stayed the same and the harness is simpler, **keep**
- If `weighted_score` stayed the same and no simplification, **discard**
- If `weighted_score` got worse, **discard**
- If the run crashed, **discard** and log the failure mode

Even discarded runs provide learning signal. Read the task-by-task changes:

- Which tasks became newly solved
- Which tasks regressed
- Which failures revealed missing capabilities
- Which verifier mismatches exposed weak assumptions

---

## Failure Analysis Patterns

When diagnosing failures, look for these patterns specific to social media intelligence:

- **Trend false positives:** Agent flags noise as a trend. Usually a classification threshold issue.
- **Trend false negatives:** Agent misses real trends. Usually a data ingestion or provider-order issue.
- **Briefing hallucination:** Agent invents facts in the Gazette. Prompt tuning + verifier sub-agent needed.
- **Concept-card bleeding:** Content classified into multiple overlapping cards. Classification rule ambiguity.
- **Provider chain collapse:** Fallback logic doesn't trigger when ScrapeCreators times out. Resilience tooling issue.
- **Audio detection gaps:** Missing trends that are TikTok-native vs. Instagram-crossover. Source-weighting issue.

---

## Sub-Agent Strategy

The SDK supports `agent.as_tool()` — wrapping an agent as a callable tool for the main agent.

A high-leverage pattern for DigitAlchemy®: **a verification sub-agent** that re-reads the produced intelligence output (trend list, Gazette briefing, concept cards) and checks it against the task requirements before the main agent finishes.

For the morning briefing specifically, consider a **fact-check sub-agent** that cross-references every factual claim against the source material before the briefing is delivered to the SSE stream.

---

## Cost Discipline

Track `cost_usd` per run. If any single experiment costs more than $5 USD, flag it in `results.tsv` with `⚠ HIGH_COST` in the description field.

Overnight runs should budget no more than $50 USD total unless Doli explicitly authorizes higher spend.

---

## When to Stop

Stop the experiment loop and report to Doli when:

- Weighted score has plateaued for 5+ consecutive experiments
- Cost budget is exhausted
- An architecture constraint conflict arises that requires human judgment
- A new benchmark task needs to be added (meta-agent should not create benchmarks — that is Doli's job)
- The harness has converged to a simpler form and further simplification risks functionality

Report back with:

- Final weighted score vs. baseline
- Top 3 harness changes that contributed most to improvement
- Any blocked experiments or flagged constraint conflicts
- Recommended next directive refinements

---

**End of directive. Read this file before every experiment run.**
