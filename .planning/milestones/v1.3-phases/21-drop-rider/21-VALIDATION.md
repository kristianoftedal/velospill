---
phase: 21
slug: drop-rider
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc --noEmit`) — project uses typecheck-only; no Jest/Vitest configured |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npx tsc --noEmit 2>&1 \| grep -E "roster\|drop\|actions" \|\| echo "No TS errors in phase 21 files"` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit 2>&1 | grep -E "roster|drop|actions" || echo "No TS errors"`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full `tsc --noEmit` must be clean
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | ROST-01 | typecheck | `npx tsc --noEmit 2>&1 \| grep "roster" \|\| echo "clean"` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | ROST-01 | typecheck | `npx tsc --noEmit 2>&1 \| grep "actions" \|\| echo "clean"` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 1 | ROST-01 | manual | Manual smoke: drop rider from UI, verify gone from roster | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Ensure `src/app/(main)/leagues/[leagueId]/roster/actions.ts` compiles clean after creation
- [ ] Ensure `src/app/(main)/leagues/[leagueId]/roster/page.tsx` compiles clean after creation
- [ ] Ensure `src/app/(main)/leagues/[leagueId]/roster/roster-client.tsx` compiles clean after creation

*No new test framework installation required — project uses TypeScript typecheck as primary automated verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drop removes rider from roster immediately | ROST-01 | No runtime test suite configured | Navigate to `/leagues/[id]/roster`, click Drop on a rider, confirm in dialog, verify rider is gone and slot count decreases |
| IR records cleaned up on drop | ROST-01 | No runtime test suite configured | Put a rider on IR (approved), then drop them, verify IR slot shows as empty |
| Pending transfer bids cancelled on drop | ROST-01 | No runtime test suite configured | Create a transfer bid with the rider as outgoing, drop the rider, verify bid shows as cancelled |
| Non-member cannot drop | ROST-01 | Auth guard tested manually | Call `dropRider` as user not in league, verify "Not a member" error |
| Drop blocked when league not active | ROST-01 | Status guard tested manually | Attempt drop in setup/complete league, verify error or button hidden |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
