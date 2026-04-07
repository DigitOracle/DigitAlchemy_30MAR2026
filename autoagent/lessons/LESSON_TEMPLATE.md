# LESSON-{NNN} — {Short title describing the optimization}

## Metadata

| Field | Value |
|-------|-------|
| **Lesson ID** | LESSON-{NNN} |
| **Date Captured** | {YYYY-MM-DD} |
| **Source Experiment Commit** | `{short git hash}` |
| **Baseline Score** | {0.0000} |
| **Improved Score** | {0.0000} |
| **Delta** | {+0.0000} |
| **Approval Status** | DRAFT / REVIEWED / APPROVED / APPLIED / REJECTED |
| **Applied Commit** | _(populated after translation and merge)_ |

---

## Python Harness Change

**File:** `{autoagent/agents/agent_xxx.py}`

### Before

```python
# Paste the original code block from the editable harness section
```

### After

```python
# Paste the modified code block
```

### What Changed and Why

_{Human-readable explanation of what the meta-agent changed and the reasoning behind it. Include which benchmark task(s) improved and which (if any) regressed.}_

---

## TypeScript Translation

**Target File:** `{app/api/xxx/route.ts}`

### Translation Notes

_{Step-by-step explanation of how to apply the Python lesson to the TypeScript production code. Be specific about which lines/functions to modify. Note any TypeScript-specific considerations (types, async patterns, Next.js conventions).}_

### Risk Assessment

**Level:** LOW / MEDIUM / HIGH

**Reasoning:** _{Why this risk level? Consider: Does this touch the fixed adapter boundary? Does it change provider order? Could it affect SSE streaming? Does it modify Firestore logging?}_

---

## Production Test Plan

1. _{How to verify this change works in the Vercel preview deployment}_
2. _{Specific endpoints to test, expected responses}_
3. _{Edge cases to check}_
4. _{Rollback trigger: what behavior means this change should be reverted}_

---

## Lifecycle

- [ ] Meta-agent produced winning change (status=keep in results.tsv)
- [ ] Lesson extractor generated this document
- [ ] Human reviewed lesson (DRAFT -> REVIEWED)
- [ ] Claude Code translated to TypeScript on branch `experiment/lesson-{NNN}`
- [ ] PR opened with lesson in description
- [ ] Vercel preview deployed and tested
- [ ] Human approved PR (REVIEWED -> APPROVED)
- [ ] Merged to main (APPROVED -> APPLIED)
- [ ] applied_commit hash recorded above
