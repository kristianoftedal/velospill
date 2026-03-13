---
phase: 27-league-stage-visibility
plan: 02
subsystem: ui
tags: [react, standings, accordion, lucide-react, shadcn]

requires:
  - phase: 27-01
    provides: LeagueRaceScoreGrouped type and getLeagueRacesWithScores returning grouped data

provides:
  - Expandable multi-stage race rows in Race Results tab with chevron toggle
  - Per-stage Done/Pending badges with breakdown links
  - End-of-tour Final Classifications section when endOfTourPoints > 0
  - One-day race rows unchanged

affects: [standings UI, league page]

tech-stack:
  added: []
  patterns:
    - useState<Set<number>> for accordion expand state in table rows
    - colSpan expansion row pattern using div-inside-TableCell to avoid invalid nested table HTML

key-files:
  created: []
  modified:
    - src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx

key-decisions:
  - "Expand state uses Set<number> of raceIds — allows independent expand/collapse per grand tour"
  - "Expanded content rendered as colSpan=4 TableRow with div grid inside TableCell (not nested table) to keep valid HTML"
  - "page.tsx required zero changes — TypeScript infers LeagueRaceScoreGrouped[] from getLeagueRacesWithScores return type"

patterns-established:
  - "Accordion table rows: parent TableRow onClick toggle, child TableRow with colSpan + div layout for expanded content"

requirements-completed:
  - SVIS-01
  - SVIS-02
  - SVIS-03

duration: 5min
completed: 2026-03-13
---

# Phase 27 Plan 02: League Stage Visibility — UI Summary

**Accordion-style grand tour expansion in Race Results tab — chevron toggle reveals per-stage Done/Pending rows with breakdown links and optional End-of-Tour Final Classifications section**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-13T07:51:41Z
- **Completed:** 2026-03-13T07:56:00Z
- **Tasks:** 2/2 auto tasks complete (Task 3 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Added `useState<Set<number>>` expand state with `toggleRace` helper in StandingsClient
- Multi-stage races render expandable parent row with ChevronRight/ChevronDown toggle
- Expanded view shows per-stage rows: Done badge + blue link for completed stages; Pending badge + muted text for pending stages
- End-of-tour section ("Final Classifications") appears below stages only when `endOfTourPoints > 0`
- One-day race rows completely unchanged — flat non-expandable rows with links

## Task Commits

Each task was committed atomically:

1. **Task 1: Update standings-client.tsx with expandable multi-stage rows** - `1b19525` (feat)
2. **Task 2: Update standings/page.tsx prop type** - No commit needed (page.tsx already correct, zero diff)

## Files Created/Modified

- `src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx` - Added expand state, ChevronRight/ChevronDown icons, conditional rendering for multi-stage vs one-day races, expanded sub-rows with stage list and end-of-tour section

## Decisions Made

- `page.tsx` required zero changes — `LeagueRaceScore` was never explicitly imported in the page file; TypeScript infers the correct type from `getLeagueRacesWithScores` return value automatically.
- Used `colSpan={4}` on a single `<TableRow>` with a `<div>` grid inside `<TableCell>` for expanded content — avoids invalid nested `<table>` inside `<TableBody>` HTML.
- Expand state is `Set<number>` keyed by `raceId` — allows independent expand/collapse for each grand tour simultaneously.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Race Results tab now shows accordion-style grand tour rows — ready for human verification (Task 3 checkpoint).
- After verification approval, this plan is fully complete and phase 27 wraps up.

---
*Phase: 27-league-stage-visibility*
*Completed: 2026-03-13*
