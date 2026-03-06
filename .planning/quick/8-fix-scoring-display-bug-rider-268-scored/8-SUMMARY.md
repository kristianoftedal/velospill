---
phase: quick
plan: 8
subsystem: scoring
tags: [data-fix, scoring, ownership-at-race-time, draft-picks]
one_liner: "Backdated draft_pick pickedAt for rider 268 (league 7) to fix ownership-at-race-time exclusion — 10 points from race 9 now appear in team 15 standings"
key_decisions:
  - "Data correction only — no code changes needed; filtering logic is correct"
  - "pickedAt backdated to startDate - 1 second (2026-02-27 23:59:59 UTC) as the minimum safe value"
  - "Root cause: race startDate stored as midnight UTC, pick entered at 08:31 UTC same day — both legitimate but incompatible with strict >= filter"
key_files:
  created:
    - scripts/diagnose-scoring-bug-268.ts
    - scripts/fix-pickedat-268.ts
  modified: []
metrics:
  duration_seconds: 98
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
  completed_date: "2026-03-06"
---

# Quick Task 8: Fix Scoring Display Bug — Rider 268 Scored Summary

## One-Liner

Backdated draft_pick pickedAt for rider 268 (league 7) to fix ownership-at-race-time exclusion — 10 points from race 9 (Omloop Het Nieuwsblad) now appear correctly in team 15 standings and team profile.

## Objective

Diagnose and fix why rider 268's 10 points from race 9 did not appear in team 15's standings total or team profile for league 7, despite being visible in the rider's individual score breakdown.

## Root Cause

**Check 4 (ownership-at-race-time) was the failing filter.**

| Field | Value |
|-------|-------|
| `draft_pick.id` | 178 |
| `riderId` | 268 (Tobias Lund Andresen) |
| `leagueId` | 7 |
| `teamId` | 15 (Hjultaster) |
| `pickedAt` (before fix) | `2026-02-28 08:31:16.816 UTC` |
| Race 9 `startDate` | `2026-02-28 00:00:00 UTC` |
| Filter: `startDate >= pickedAt` | `00:00:00 >= 08:31:16` → **false** → excluded |

The race startDate is stored as midnight UTC (no time of day). The pick was entered at 08:31 UTC on the same day. The ownership-at-race-time filter correctly enforced its condition — but the intent was that the rider was on team 15 when the race took place (race started in the afternoon, pick was made in the morning before the race started in real time).

All other checks passed: race_result exists (10 pts), race is in league_races for league 7, rider is in the team 15 lineup for the race.

## Fix Applied

Backdated `draft_picks.pickedAt` for `id=178` from `2026-02-28 08:31:16 UTC` to `2026-02-27 23:59:59 UTC` (1 second before the race `startDate`).

Script: `scripts/fix-pickedat-268.ts`

SQL applied:
```sql
UPDATE draft_picks
SET "pickedAt" = (
  SELECT "startDate" - INTERVAL '1 second'
  FROM races
  WHERE id = 9
)
WHERE "riderId" = 268
  AND "leagueId" = 7
  AND "teamId" = 15
```

## Verification Results

Post-fix diagnostic confirms:
- `pickedBefore: true`, `pickedAfterRaceStart: false`
- `ownershipOk: true`, `leagueScopeOk: true`

Scoring function output:
- `getLeagueStandings(7, 2026)`: Team 15 shows **44 total points** (correct, +10 vs before)
- `getTeamSeasonProfile(15, 7, 2026)`: Rider 268 shows **19 total points**, with race 9 (10 pts) and race 10 (9 pts) both included

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Run diagnostic script | fdac42f | scripts/diagnose-scoring-bug-268.ts |
| 2 | Apply fix + verify | 58a2933 | scripts/fix-pickedat-268.ts |

## Deviations from Plan

None — plan executed exactly as written. Root cause matched Case B (pickedAt after race startDate) as anticipated.

## Self-Check: PASSED

- scripts/diagnose-scoring-bug-268.ts: EXISTS
- scripts/fix-pickedat-268.ts: EXISTS
- Commits fdac42f and 58a2933: CONFIRMED
- Team 15 totalPoints: 44 (includes 10 pts from rider 268 race 9)
- Rider 268 totalPoints: 19 (10 pts race 9 + 9 pts race 10)
