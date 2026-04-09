# Claude Code Kickoff: Run DA-QUEUE-001

Paste this prompt into Claude Code at the start of your desk session.

---

## THE PROMPT (copy everything below)

```
Read DA-QUEUE-001.md in the repo root.

Execute all tasks with Status: PENDING in priority order (P0 → P1 → P2 → P3).

For each task:

1. Mark Status: IN_PROGRESS
2. Read the task card carefully — Context, Files to touch, Acceptance criteria
3. Execute the task following the Commands section if provided
4. Run any verification steps listed in Acceptance criteria
5. If successful:
   - Commit with the exact commit message specified
   - Update Status: DONE
   - Add commit hash to the task card
   - Move the task to the Completed (Archive) section
6. If blocked or unclear:
   - Update Status: BLOCKED
   - Add a Reason field explaining what's needed from Doli
   - Move the task to the Blocked section
7. Respect the Golden Rules in the Notes section

After all tasks are processed:

- Update DA-OPS-001 with a new revision number documenting what was executed
- Report a summary: X done, Y blocked, Z skipped
- Show me any BLOCKED tasks so I can resolve them

Constraints:

- Vercel git author email must be k.wilsonqc@outlook.com
- Never touch fixed adapter boundaries (SSE streaming, Firestore logging) unless explicitly stated in the task
- For any task touching /api routes, verify with npm run dev before committing
- If a task conflicts with DA architecture rules (inference-last, Spotify as enrichment-only, YouTube excluded from Trend Ticker), flag it as BLOCKED and ask me
```

---

## Shortcut: Slash Command

To make this even lazier, add this to your `CLAUDE.md`:

```markdown
## /run-queue

Read DA-QUEUE-001.md. Execute all PENDING tasks in priority order.
Follow the protocol in the kickoff prompt at docs/da-queue-kickoff.md.
Report summary when done.
```

Then at your desk, you literally just type `/run-queue` and walk away.
