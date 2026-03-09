---
phase: 17-team-profile-page
plan: 02
subsystem: ui
tags: [react, nextjs, server-components, accordion, shadcn, fantasy-cycling]

# Dependency graph
requires:
  - phase: 17-01
    provides: getTeamSeasonProfile query returning TeamSeasonProfile with per-rider per-race scoring
  - phase: 16-02
    provides: server→client page pattern established for rider profile (reused here for team profile)
provides:
  - Route /leagues/[leagueId]/teams/[teamId] with server page + client UI
  - Full team roster display with per-rider accordion showing per-race points (TEAM-01, TEAM-02)
  - Clickable team name links from standings leaderboard to team profile page
affects: [phase-18-lineup-accordion, phase-19-standings-history]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-component fetches data + passes to client component, accordion per roster entry, breadcrumb nav with notFound() guards]

key-files:
  created:
    - src/app/(main)/leagues/[leagueId]/teams/[teamId]/page.tsx
    - src/app/(main)/leagues/[leagueId]/teams/[teamId]/team-profile-client.tsx
  modified:
    - src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx

key-decisions:
  - "Server page parses leagueId and teamId from params, calls notFound() on NaN or missing profile — same guard pattern as rider profile"
  - "TeamProfileClient uses shadcn Accordion (type=single collapsible) for per-rider race breakdown — consistent with Phase 16 UI style"
  - "Rider names in accordion trigger are Links to /riders/[riderId] with stopPropagation to prevent accordion toggle"
  - "Standings team name column wraps existing text in a Link to /leagues/[leagueId]/teams/[teamId] with minimal styling change"

patterns-established:
  - "Server page → client component: server fetches all data, passes typed profile prop to 'use client' component"
  - "Accordion-per-entity pattern: each roster entry is an AccordionItem with trigger (summary) and content (detail breakdown)"
  - "notFound() guard on both NaN params and null query result for clean 404 handling"

requirements-completed: [TEAM-01, TEAM-02]

# Metrics
duration: ~2 days (with human-verify checkpoint)
completed: 2026-03-03
---

# Phase 17 Plan 02: Team Profile Page UI Summary

**Server page at /leagues/[leagueId]/teams/[teamId] with full team roster, per-rider per-race accordion scoring breakdown, and clickable team links from standings leaderboard**

## Performance

- **Duration:** ~2 days (code complete in one session, human verification in next session)
- **Started:** 2026-03-02
- **Completed:** 2026-03-03T08:14:14Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments

- Built /leagues/[leagueId]/teams/[teamId] route: async server component fetches league + team profile, renders breadcrumb, passes typed data to client
- TeamProfileClient renders team header (name, total points), 3-column stats grid, and per-rider accordion with per-race scoring detail
- Standings leaderboard team names are now clickable Links navigating to the team profile page
- 404 handling for NaN params or unknown teamId via Next.js notFound()
- Human verification passed: all navigation paths, accordion behavior, rider links, and 404 handling confirmed working

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server page component** - `8022ab4` (feat)
2. **Task 2: Create TeamProfileClient + add standings link** - `8c68a35` (feat)
3. **Task 3: Human verification checkpoint** - (no code commit — user approved)

## Files Created/Modified

- `src/app/(main)/leagues/[leagueId]/teams/[teamId]/page.tsx` - Async server component: parses params, calls getLeagueDetails + getTeamSeasonProfile, renders breadcrumb + TeamProfileClient, notFound() on NaN or null
- `src/app/(main)/leagues/[leagueId]/teams/[teamId]/team-profile-client.tsx` - Client component: team header, stats grid, shadcn Accordion per rider with per-race points table, rider links to /riders/[riderId], bonus badge
- `src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx` - Modified leaderboard tab: team name cell now wraps in Link to /leagues/[leagueId]/teams/[teamId]

## Decisions Made

- Server page uses the same server→client pattern as Phase 16 rider profile: server fetches all data, client handles rendering
- Used shadcn Accordion (type="single" collapsible) for the rider roster section to allow per-rider detail expansion without nesting
- Rider names in accordion trigger link to /riders/[riderId] with stopPropagation to avoid accordion toggling on click
- standings-client.tsx change is minimal — only wraps existing text in a Link, no layout changes

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- TEAM-01 and TEAM-02 requirements are complete and verified by human
- Phase 18 (lineup accordion on league race list) can proceed independently
- Phase 19 (standings history) can proceed independently
- v1.2 milestone now has 2 of 4 phases remaining (Phase 18 and 19)

---
*Phase: 17-team-profile-page*
*Completed: 2026-03-03*
