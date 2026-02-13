---
phase: 03-league-management
plan: 03
subsystem: league-ui
tags: [next.js, server-components, server-actions, drizzle, shadcn, client-components, state-machine]
dependency_graph:
  requires:
    - leagues-table
    - teams-table
    - league-membership-check
    - league-ownership-check
  provides:
    - leagues-list-page
    - league-detail-page
    - league-status-transitions
  affects:
    - src/app/(main)/leagues/page.tsx
    - src/app/(main)/leagues/[leagueId]/page.tsx
tech_stack:
  added: []
  patterns:
    - Server component calling server actions for data fetching
    - Client components co-located in same directory for interactivity
    - AlertDialog confirmation before destructive state transitions
    - router.refresh() for revalidating server-rendered data after mutations
    - Drizzle join queries for efficient multi-table data fetching
key_files:
  created:
    - src/app/(main)/leagues/[leagueId]/actions.ts
    - src/app/(main)/leagues/[leagueId]/page.tsx
    - src/app/(main)/leagues/[leagueId]/league-client.tsx
  modified:
    - src/app/(main)/leagues/page.tsx
decisions:
  - Client components (InviteSection, LeagueStatusControl) co-located in league-client.tsx alongside page.tsx rather than a separate components/ folder, keeping league feature files self-contained
  - State machine transition map defined as a plain Record in both actions.ts and league-client.tsx rather than a shared module, avoiding client/server boundary complexity
  - router.refresh() used after successful status transition to revalidate server-rendered page data without a full navigation
metrics:
  duration: "126 seconds"
  completed: "2026-02-13T07:35:48Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 3 Plan 3: Leagues List & Detail Pages Summary

**One-liner:** Next.js server-rendered leagues list and detail pages with Drizzle join queries, shadcn Card/Table/Badge/AlertDialog, and client-side state transition controls.

## What Was Built

Completed the Phase 3 user-facing experience: a My Leagues list page showing all leagues the user belongs to via their team membership, and a League Detail page with team roster, invite link sharing for owners, and lifecycle management controls. Server actions handle data fetching and state transitions with full auth and ownership guards.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create server actions for league listing, details, and state transitions | `2a3351a` | `src/app/(main)/leagues/[leagueId]/actions.ts` |
| 2 | Build leagues list page and league detail page with lifecycle controls | `2867b82` | `src/app/(main)/leagues/page.tsx`, `src/app/(main)/leagues/[leagueId]/page.tsx`, `src/app/(main)/leagues/[leagueId]/league-client.tsx` |

## Key Artifacts

### `src/app/(main)/leagues/[leagueId]/actions.ts`
- `getMyLeagues()`: joins teams+leagues, gets team counts per league, returns user's leagues sorted by newest first
- `getLeagueDetails(leagueId)`: membership-gated, returns league + ordered team roster (with user names) + isOwner flag
- `transitionLeagueStatus(leagueId, newStatus)`: ownership-checked, validates state machine transitions, enforces minimum team count for setup->drafting

### `src/app/(main)/leagues/page.tsx`
- Calls `getMyLeagues()` server-side
- Responsive grid of league cards (1/2/3 cols) with name, status badge, user's team name, team count
- Empty state with Create League CTA
- Hover effects via Tailwind group utilities

### `src/app/(main)/leagues/[leagueId]/page.tsx`
- Breadcrumb navigation, league header with status badge, season year, draft date, team count
- Invite section (owner only): `InviteSection` client component for clipboard copy
- Team roster: shadcn Table with team name, owner name, join date, league owner badge
- Management section (owner only): `LeagueStatusControl` client component

### `src/app/(main)/leagues/[leagueId]/league-client.tsx`
- `InviteSection`: computes full invite URL client-side, readonly input + Copy button with "Copied!" feedback, shows expiry date
- `LeagueStatusControl`: displays current status badge, next action button, AlertDialog confirmation (includes team count vs minimum for setup->drafting), calls server action, handles errors inline, uses `router.refresh()` on success

## Decisions Made

1. **Co-located client components:** `league-client.tsx` lives alongside `page.tsx` rather than a shared `components/` folder. The InviteSection and LeagueStatusControl are specific to the league detail page, so co-location keeps the feature self-contained.

2. **Transition map duplication:** The valid state transition map is defined separately in `actions.ts` (server, for enforcement) and `league-client.tsx` (client, for UI state). This avoids crossing the server/client boundary for a simple data structure.

3. **router.refresh() over redirect:** After a successful status transition, `router.refresh()` revalidates the server component's data without navigation. This keeps the user on the detail page and shows updated status immediately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing Zod v4 incompatibility in leagues/new/page.tsx**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `z.number({ invalid_type_error: "..." })` is not valid in Zod v4 — the `invalid_type_error` option was removed from the `number()` constructor
- **Fix:** A linter had already auto-fixed the schema to use `z.number()` without the option
- **Files modified:** `src/app/(main)/leagues/new/page.tsx` (linter auto-fix)
- **Commit:** Included in 2867b82 (linter applied before commit)

### Additions vs. Plan

**1. `league-client.tsx` added as separate file:** The plan mentioned this as an option ("define them in a companion client file"). Implemented as the cleaner approach vs. mixing client/server directives in `page.tsx`.

## Self-Check: PASSED

- FOUND: src/app/(main)/leagues/[leagueId]/actions.ts
- FOUND: src/app/(main)/leagues/[leagueId]/page.tsx
- FOUND: src/app/(main)/leagues/[leagueId]/league-client.tsx
- FOUND: getMyLeagues export in actions.ts
- FOUND: getLeagueDetails export in actions.ts
- FOUND: transitionLeagueStatus export in actions.ts
- TypeScript: PASS (npx tsc --noEmit)
- Build: PASS (npm run build — /leagues and /leagues/[leagueId] both shown as dynamic routes)
- Commits: 2a3351a (Task 1), 2867b82 (Task 2)
