# DA-TEC-2026-008 — Prediction Math Decisions (Phase 2.3c)

**Date:** 2026-04-07
**Author:** Kendall Wilson (Doli) + Claude Code
**Implements:** `lib/gazette/predictions.ts`

## Purpose

This document captures the four statistical decisions baked into the prediction module. Future engineers reading this code may be tempted to "simplify" the log transforms or replace the shrinkage estimator with simpler threshold-based blending. This document exists to prevent that.

## Decision 1: Engagement is log-normally distributed

Social media engagement metrics (views, likes, comments, shares) follow a log-normal distribution, not a normal distribution. This is well-established in the literature:

- Marrone et al. (2022), PMC9340752, analyzed 13 billion interactions across 4 million posts and confirmed log-normal engagement distributions across platforms.

**What this means for the code:** All percentile and variance computation happens in log space using `Math.log1p()` / `Math.expm1()` transforms. If you compute percentiles on raw engagement values, outliers dominate and the interquartile range underestimates the spread at the high end.

**Why log1p/expm1 instead of log/exp:** `log1p(x)` computes `log(1 + x)` with better numerical precision for small values and handles zero gracefully (`log1p(0) === 0`). `expm1(x)` is the exact inverse (`expm1(log1p(x)) === x`).

## Decision 2: Prediction interval, not confidence interval

The module computes a **prediction interval** for a single new post, not a **confidence interval** for the population mean.

- A confidence interval says: "We're 95% confident the TRUE AVERAGE of all posts like this falls in this range."
- A prediction interval says: "If you post this, there's a 50% chance your actual engagement lands between p25 and p75."

The second is what the user needs. The field is named `LikelyRange` (not `ExpectedRange`) and the UI language should be "Most posts like this land between X and Y" — not "Expected: X-Y views."

## Decision 3: James-Stein shrinkage estimator for blending

When both baseline data and user history are available, the module blends them using a James-Stein-style shrinkage estimator instead of arbitrary threshold-based weights.

**Why not threshold-based?** A common anti-pattern is: "Use 70% baseline weight for <10 user posts, 50% for 10-20, 30% for 20+." This creates discontinuities at the thresholds (a user with 19 posts gets very different predictions from a user with 21) and the specific percentages are arbitrary.

**The shrinkage formula:**

```
w_user = baselineVariance / (baselineVariance + userVariance / nUserPosts)
```

This is a continuous function that automatically increases the user weight as:
- The user accumulates more posts (nUserPosts grows → userVariance/n shrinks → w_user approaches 1.0)
- The user's variance decreases (more consistent → more trustworthy)
- The baseline's variance increases (less uniform baseline → less informative)

Clamped to [0.05, 0.95] to prevent degenerate cases.

**Direction verification:**
- n=5, equal variance: w_user = V / (V + V/5) = 1/1.2 ≈ 0.833 (83% user)
- n=50, equal variance: w_user = V / (V + V/50) = 1/1.02 ≈ 0.980 (98% user, clamped to 95%)

## Decision 4: Order-of-magnitude accuracy metric

Standard regression metrics (RMSE, MAE) are misleading for log-normal distributions because they're dominated by outliers. A prediction of 5,000 views for a post that gets 3,000 views is excellent, but RMSE treats it the same as predicting 2,000 for a post that gets 0.

We use order-of-magnitude accuracy (Tomar et al., arXiv 2508.21650): for a prediction p and actual a, the prediction passes if `floor(log10(p))` is within 1 of `floor(log10(a))`. The target is at least 80% of predictions passing.

## What this document does NOT cover

- ML-based prediction (deferred to Phase 8/9 if ever needed)
- Cross-user collaborative filtering (requires multi-user data we don't have)
- Causal inference (we're descriptive, not causal)

## When to revise these decisions

- If we ever have 10K+ users, revisit whether per-user variance estimation is robust enough for Bayesian shrinkage with informative priors
- If platforms add new metrics (e.g., "save rate"), extend the `PredictionMetric` enum — the math here applies unchanged
- If order-of-magnitude accuracy drops below 80% in production, the model needs revisiting
