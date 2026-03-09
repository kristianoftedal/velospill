---
phase: 16-rider-profile-page
plan: 02
subsystem: ui
tags: [nextjs, react, app-router, rider-profile, ui]

requires:
  - phase: 16-01
    provides: getRiderSeasonProfile query function and TypeScript types

provides:
  - /riders/[riderId] route — server page + client component
  - Link from riders list to individual rider profiles

affects: []

tech-stack:
  added: []
  patterns:
    - Server component fetches data, passes to 'use client' component
    - Accordion per race for category expansion (shadcn/ui)
    - Breadcrumb nav matching existing league page pattern
    - stopPropagation on rider name Link to avoid accordion toggle

key-files:
  created:
    - src/app/(main)/riders/[riderId]/page.tsx
    - src/app/(main)/riders/[riderId]/rider-profile-client.tsx
  modified:
    - src/app/(main)/riders/page-client-component.tsx

key-decisions:
  - "Server page calls notFound() for both NaN riderId and missing profile — clean 404 handling"
  - "Ownership lookup built in component via Map<raceId, teamName[]> for O(1) access per race row"
  - "Gender badge uses conditional color (blue for M, pink for F) matching project badge style"
  - "stopPropagation on rider Link prevents accordion toggle when clicking rider name"

patterns-established:
  - "Rider profile page follows server→client data-passing pattern from existing pages"

requirements-completed: [RIDER-01, RIDER-02, RIDER-03, RIDER-04]

duration: ~2min
completed: 2026-03-02
---

# Phase 16 Plan 02: Rider Profile Route + Client UI Summary

**Next.js App Router dynamic route at /riders/[riderId] — server page + 4-section client component rendering rider bio, season stats, per-race category breakdown (accordion), and ownership history**

## Performance

- **Duration:** ~2 min
- **Completed:** 2026-03-02
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 3

## Accomplishments

- Created `src/app/(main)/riders/[riderId]/page.tsx` — server component that awaits params, parses riderId, calls `getRiderSeasonProfile`, returns 404 for unknown riders, renders breadcrumb + passes profile to client
- Created `src/app/(main)/riders/[riderId]/rider-profile-client.tsx` (195 lines) — client component with 4 sections:
  1. Hero header — rider name (text-5xl), pro team/nationality/gender badges, total season points
  2. Stats grid — Total Races (blue), Total Points (green), Pts/Race (purple)
  3. Per-race accordion — each race expandable to show category rows (label, position badge, points)
  4. Ownership history — team badge(s) per race/league, or "Undrafted" in muted text
- Modified `src/app/(main)/riders/page-client-component.tsx` — rider name is now a `<Link href="/riders/{rider.id}">` with stopPropagation
- TypeScript compiles with 0 errors
- Human verification: approved

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server page component** - `85bc30d` (feat)
2. **Task 2: Create RiderProfileClient + add list link** - `6e1a69a` (feat)
3. **Task 3: Checkpoint — human verified** - approved

## Files Created/Modified

- `src/app/(main)/riders/[riderId]/page.tsx` — server page component
- `src/app/(main)/riders/[riderId]/rider-profile-client.tsx` — client UI component (195 lines)
- `src/app/(main)/riders/page-client-component.tsx` — modified: rider name Link added

## Decisions Made

- 404 returned for both NaN riderId parse and null profile from DB — consistent handling
- Ownership lookup built as `Map<raceId, teamName[]>` in component for O(1) per-race access
- Gender badge uses conditional color classes (blue/pink) matching existing badge style patterns

## Deviations from Plan

None — implemented as specified.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 16 is complete — all RIDER-01 through RIDER-04 requirements fulfilled
- Phase 17 (Team Profile Page) can proceed; will follow the same server→client pattern

---
*Phase: 16-rider-profile-page*
*Completed: 2026-03-02*
