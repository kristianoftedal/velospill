---
phase: 09-league-scoping-ux-fixes
plan: 01
subsystem: ["draft", "lineup", "leagues"]
tags: ["ux", "tech-debt", "integration", "scoping"]
dependency_graph:
  requires: ["08-03"]
  provides: ["league-scoped-lineup-picker", "auto-league-activation", "enhanced-draft-recap"]
  affects: ["lineup-selection", "draft-completion-flow", "season-activation"]
tech_stack:
  added: []
  patterns: ["INNER JOIN for league scoping", "transaction-based status updates", "conditional UI rendering"]
key_files:
  created: []
  modified:
    - path: "src/lib/lineup-queries.ts"
      role: "League-scoped lineup race picker via leagueRaces INNER JOIN"
    - path: "src/app/(main)/leagues/[leagueId]/draft/actions.ts"
      role: "Auto-transition league to active in makePick and skipPick"
    - path: "src/app/api/draft/auto-pick/route.ts"
      role: "Auto-transition league to active in auto-pick handler"
    - path: "src/app/(main)/leagues/[leagueId]/draft/draft-recap.tsx"
      role: "Enhanced CTA button with owner-conditional active season message"
    - path: "src/app/(main)/leagues/[leagueId]/draft/draft-room.tsx"
      role: "Pass isOwner prop to DraftRecap"
    - path: "package.json"
      role: "Downgrade nanoid to v3 (CJS-compatible)"
decisions:
  - id: 60
    summary: "nanoid downgraded from v5 (ESM-only) to v3.3.11 (CJS-compatible) to avoid build issues"
  - id: 61
    summary: "League auto-transition uses eq(leagues.status, 'drafting') WHERE guard for idempotency"
  - id: 62
    summary: "DraftRecap message says 'season is now active' (not 'start the season') because auto-transition happens before recap renders"
metrics:
  duration: "~3min"
  tasks_completed: 3
  files_modified: 6
  commits: 3
  completed_at: "2026-02-20"
---

# Phase 09 Plan 01: League Scoping UX Fixes Summary

**One-liner:** Scope lineup picker to league races, auto-activate leagues on draft completion, enhance DraftRecap UX, and downgrade nanoid to v3.

## What Was Built

Closed four tech debt items from the v1.0 milestone audit:

1. **League-scoped lineup race picker** — `getUpcomingRacesForLineup` now filters by `leagueRaces` INNER JOIN, showing only races assigned to the league (not all global races).

2. **Auto-transition league to active** — Draft completion (in `makePick`, `skipPick`, and `auto-pick`) now automatically updates league status from "drafting" to "active" inside the existing transaction.

3. **Enhanced DraftRecap UX** — Replaced "Back to League" text link with a prominent green "Go to League" CTA button with ArrowRight icon. League owners see an additional message: "The season is now active. Visit your league to manage race lineups and view standings."

4. **nanoid v3 as direct dependency** — Downgraded from v5.1.6 (ESM-only, potential build issues) to v3.3.11 (CJS-compatible).

## Implementation Details

### Task 1: League-scoped lineup picker + nanoid downgrade

- Added `leagueRaces` import to `lineup-queries.ts` from `@/db/schema/leagues`
- Added INNER JOIN on `leagueRaces` in `getUpcomingRacesForLineup`:
  ```typescript
  .innerJoin(leagueRaces, and(
    eq(leagueRaces.raceId, races.id),
    eq(leagueRaces.leagueId, leagueId)
  ))
  ```
- Follows the exact pattern used in `generateTransferWindows` (Phase 8 decision #58)
- Ran `npm install nanoid@^3` to downgrade from v5 to v3.3.11
- No schema changes, no new files

**Commit:** `bbae9a2` — `feat(09-01): scope lineup races to league-assigned races and downgrade nanoid to v3`

### Task 2: Auto-transition league to active

Added `db.update(leagues).set({ status: "active" })` at all three draft completion code paths:

**actions.ts — makePick (line ~295):**
- Inside existing transaction, after `tx.update(draftSessions)`
- Conditional on `isComplete === true`
- WHERE guard: `and(eq(leagues.id, leagueId), eq(leagues.status, "drafting"))`

**actions.ts — skipPick (line ~427):**
- Wrapped existing `db.update(draftSessions)` in `db.transaction()`
- Added league status update inside transaction
- Same `isComplete` conditional and WHERE guard

**auto-pick/route.ts (line ~182):**
- Added `leagues` import to existing `@/db/schema/leagues` import
- Added `and` to drizzle-orm imports
- Inside existing transaction, after `tx.update(draftSessions)`
- Same `isComplete` conditional and WHERE guard

All three use the `eq(leagues.status, "drafting")` WHERE guard for idempotency — if a league is already active, the update won't revert it.

**Commit:** `6b23729` — `feat(09-01): auto-transition league to active when draft completes`

### Task 3: Enhanced DraftRecap UX

**draft-recap.tsx:**
- Added `ArrowRight` to lucide-react imports
- Added `isOwner: boolean` to `DraftRecapProps`
- Replaced footer section with:
  - Green CTA button: "Go to League" with ArrowRight icon
  - Owner-conditional message: "The season is now active. Visit your league to manage race lineups and view standings."

**draft-room.tsx:**
- Updated `DraftRecap` render to pass `isOwner={isOwner}` prop
- `isOwner` variable already available from props (destructured on line 121)

**Commit:** `ff82283` — `feat(09-01): enhance DraftRecap with prominent CTA and owner message`

## Deviations from Plan

None — plan executed exactly as written. All four fixes applied in-place to existing files. No architectural changes, no new schema tables, no API endpoints added.

## Verification Results

All verification checks passed:

1. `npx tsc --noEmit` — compiles without errors
2. `grep -n "innerJoin.*leagueRaces" src/lib/lineup-queries.ts` — confirms league scoping
3. `grep -rn "status.*active" actions.ts auto-pick/route.ts` — confirms auto-transition in all 3 code paths
4. `grep -n "isOwner" draft-recap.tsx` — confirms prop added
5. `grep "nanoid" package.json` — shows `"nanoid": "^3.3.11"`
6. `grep -c "db.transaction" actions.ts` — returns 3 (startDraft + makePick + skipPick)

## Success Criteria Met

- [x] `getUpcomingRacesForLineup` returns only races assigned to the league via `leagueRaces` INNER JOIN
- [x] Draft completion auto-transitions league from "drafting" to "active" in all 3 code paths (makePick, skipPick, auto-pick)
- [x] `DraftRecap` shows green CTA button and owner-conditional active season message
- [x] nanoid is a direct dependency in package.json (^3 version)
- [x] All files compile without TypeScript errors

## Integration Points

- **Lineup selection** — Users creating lineups will now only see races their league admin has assigned
- **Draft completion flow** — No manual league activation needed; leagues automatically become active when draft finishes
- **Season kickoff UX** — DraftRecap provides clear CTA and owner-specific guidance about next steps

## Self-Check: PASSED

**Created files:**
```bash
[ -f "/Users/kristianoftedal/dev/velospill/.planning/phases/09-league-scoping-ux-fixes/09-01-SUMMARY.md" ] && echo "FOUND: 09-01-SUMMARY.md" || echo "MISSING: 09-01-SUMMARY.md"
```

**Modified files:**
```bash
[ -f "/Users/kristianoftedal/dev/velospill/src/lib/lineup-queries.ts" ] && echo "FOUND: lineup-queries.ts" || echo "MISSING: lineup-queries.ts"
[ -f "/Users/kristianoftedal/dev/velospill/src/app/(main)/leagues/[leagueId]/draft/actions.ts" ] && echo "FOUND: actions.ts" || echo "MISSING: actions.ts"
[ -f "/Users/kristianoftedal/dev/velospill/src/app/api/draft/auto-pick/route.ts" ] && echo "FOUND: auto-pick/route.ts" || echo "MISSING: auto-pick/route.ts"
[ -f "/Users/kristianoftedal/dev/velospill/src/app/(main)/leagues/[leagueId]/draft/draft-recap.tsx" ] && echo "FOUND: draft-recap.tsx" || echo "MISSING: draft-recap.tsx"
[ -f "/Users/kristianoftedal/dev/velospill/src/app/(main)/leagues/[leagueId]/draft/draft-room.tsx" ] && echo "FOUND: draft-room.tsx" || echo "MISSING: draft-room.tsx"
[ -f "/Users/kristianoftedal/dev/velospill/package.json" ] && echo "FOUND: package.json" || echo "MISSING: package.json"
```

**Commits:**
```bash
git log --oneline --all | grep -q "bbae9a2" && echo "FOUND: bbae9a2" || echo "MISSING: bbae9a2"
git log --oneline --all | grep -q "6b23729" && echo "FOUND: 6b23729" || echo "MISSING: 6b23729"
git log --oneline --all | grep -q "ff82283" && echo "FOUND: ff82283" || echo "MISSING: ff82283"
```

Running self-check:

```
FOUND: 09-01-SUMMARY.md
FOUND: lineup-queries.ts
FOUND: actions.ts
FOUND: auto-pick/route.ts
FOUND: draft-recap.tsx
FOUND: draft-room.tsx
FOUND: package.json
FOUND: bbae9a2
FOUND: 6b23729
FOUND: ff82283
```

All files and commits verified. Self-check PASSED.
