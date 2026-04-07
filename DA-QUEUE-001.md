# DA-QUEUE-001 — DigitAlchemy® Action Queue

**Owner:** Kendall Wilson (Doli)
**Repo:** DigitOracle/DigitAlchemy_30MAR2026
**Purpose:** Mobile-captured tasks that Claude Code executes in batch at the desk.
**Protocol:** Voice → Claude (mobile) → append task card here → Claude Code executes

---

## How This Works

1. **Mobile capture:** Doli talks to Claude in the mobile app, describing what needs doing
2. **Claude drafts:** Claude converts the voice input into a structured task card and appends it below
3. **Desk execution:** Doli opens Claude Code, runs `/run-queue`, Claude Code executes all PENDING tasks
4. **Status update:** Claude Code updates each task's status (PENDING → DONE / BLOCKED / SKIPPED) with a commit hash

---

## Priority Tiers

- **P0** — Blocking, do first (broken builds, client deliverables due)
- **P1** — Important, do today (feature work, key improvements)
- **P2** — Should do this week (refactors, cleanups, nice-to-haves)
- **P3** — Someday/maybe (ideas worth capturing but not urgent)

## Status Values

- `PENDING` — Not yet started
- `IN_PROGRESS` — Claude Code actively working
- `DONE` — Completed, commit hash recorded
- `BLOCKED` — Needs human input or external dependency
- `SKIPPED` — Doli decided not to do this

---

## Active Queue

<!-- New tasks append here. Claude Code reads top-down. -->

### DA-Q-001 — [EXAMPLE] Fix provider order in trend-ticker route

**Priority:** P1
**Status:** PENDING
**Captured:** 2026-04-07
**Source:** Voice note via Claude mobile

**Context:**
Per inference-last architecture, ScrapeCreators must precede Apify in all trend detection routes. Current `/api/trend-ticker` has them reversed.

**Files to touch:**
- `app/api/trend-ticker/route.ts`

**Acceptance criteria:**
- [ ] Provider chain array starts with `scrapeCreators`
- [ ] `apify` is second in the chain
- [ ] Existing SSE streaming logic untouched (fixed adapter boundary)
- [ ] Test with `npm run dev` and hit endpoint manually

**Commands:**
```bash
# Claude Code will edit the file and verify
npm run dev
curl http://localhost:3000/api/trend-ticker
```

**Commit message:**
`fix(trend-ticker): correct provider order per inference-last architecture`

---

### DA-Q-002 — Bootstrap AutoAgent directory structure

**Priority:** P1
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Source:** AutoAgent integration setup

**Context:**
Create the `autoagent/` directory structure with `agents/`, `tasks/`, `.agent/`, `jobs/` subdirectories, `.gitkeep` files, and a `.gitignore` for transient artifacts.

**Acceptance criteria:**
- [x] `autoagent/agents/`, `autoagent/tasks/`, `autoagent/.agent/`, `autoagent/jobs/` exist
- [x] `.gitkeep` in each empty directory
- [x] `autoagent/.gitignore` ignores `jobs/`, `results.tsv`, `run.log`, `*.log`

---

### DA-Q-003 — Commit DA-UC-001 directive file

**Priority:** P1
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Source:** AutoAgent integration setup

**Context:**
Copy `DA-UC-001-social-media.md` into `autoagent/` as the primary directive file for the social media intelligence use case.

**Acceptance criteria:**
- [x] `autoagent/DA-UC-001-social-media.md` exists with full directive content
- [x] File matches source exactly

---

### DA-Q-004 — Extract trend-ticker route into agent harness

**Priority:** P2
**Status:** PENDING
**Captured:** 2026-04-07
**Source:** AutoAgent integration setup

**Context:**
Create `autoagent/agents/agent-trend-ticker.py` with an editable section above and a `# === FIXED ADAPTER BOUNDARY ===` comment below. The editable section should contain `SYSTEM_PROMPT`, `PROVIDER_CHAIN`, `TOOL_DEFINITIONS`, and `ROUTING_LOGIC` placeholders. The fixed section should import and delegate to the existing Vercel route.

**Files to touch:**
- `autoagent/agents/agent-trend-ticker.py`

**Acceptance criteria:**
- [ ] File has editable section above `# === FIXED ADAPTER BOUNDARY ===`
- [ ] Editable section has `SYSTEM_PROMPT`, `PROVIDER_CHAIN`, `TOOL_DEFINITIONS`, `ROUTING_LOGIC`
- [ ] Fixed section below boundary is clearly marked as off-limits

**Commit message:**
`feat(autoagent): extract trend-ticker route into agent harness`

---

### DA-Q-005 — Add Dockerfile.base for AutoAgent

**Priority:** P2
**Status:** PENDING
**Captured:** 2026-04-07
**Source:** AutoAgent integration setup

**Context:**
Create `autoagent/Dockerfile.base` with `python:3.11-slim` base, Node.js 18, `uv` (Python package manager), and Harbor CLI. This is the base image for all AutoAgent experiment runs.

**Files to touch:**
- `autoagent/Dockerfile.base`

**Acceptance criteria:**
- [ ] Base image is `python:3.11-slim`
- [ ] Node.js 18 installed
- [ ] `uv` installed
- [ ] Harbor CLI installed
- [ ] Image builds successfully: `docker build -f autoagent/Dockerfile.base -t autoagent-base ./autoagent`

**Commit message:**
`feat(autoagent): add Dockerfile.base with python 3.11, node 18, uv, harbor`

---

<!-- APPEND NEW TASKS BELOW THIS LINE -->

---

## Completed (Archive)

<!-- DONE tasks move here after execution -->

---

## Blocked

<!-- BLOCKED tasks with reason -->

---

## Notes

- **Golden rule:** Claude Code never touches the fixed adapter boundary (SSE streaming, Firestore logging) unless the task explicitly says so
- **Vercel git author:** Must be `k.wilsonqc@outlook.com` on all commits
- **Branch strategy:** Small tasks commit to current branch; large features get `feature/` branches
- **After execution:** Claude Code updates DA-OPS-001 with a new revision number
