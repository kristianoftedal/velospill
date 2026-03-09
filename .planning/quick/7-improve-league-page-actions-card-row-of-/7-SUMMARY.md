---
phase: quick-7
plan: 01
subsystem: league-overview
tags: [ui, league, actions, refactor]
key-files:
  modified:
    - src/app/(main)/leagues/[leagueId]/page.tsx
decisions:
  - showViewDraft uses updatedAt timestamp to determine 5-day window — relies on updatedAt being set to now() on status transitions
  - Actions section rendered as bare flex-wrap div with no Card wrapper to keep it visually lightweight
  - View Draft label switches between "Go to Draft" (drafting) and "View Draft" (active) for clarity
metrics:
  duration: ~90s
  completed: 2026-03-06
  tasks: 1
  commits: 1
---

# Quick Task 7: Improve League Page Actions Card — Row of Buttons Summary

**One-liner:** Replaced card-with-rows Actions section with a compact inline button row positioned before Standings, with time-gated View Draft button hidden after 5 days.

## What Was Done

### Task 1: Refactor Actions section — button row, first position, hide View Draft after 5 days

Three targeted changes to `src/app/(main)/leagues/[leagueId]/page.tsx`:

**1. Added `showViewDraft` gate** near `showActions` (line 131):

```ts
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000
const showViewDraft =
  league.status === "drafting" ||
  (league.status === "active" &&
    Date.now() - new Date(league.updatedAt).getTime() <= FIVE_DAYS_MS)
```

**2. Moved Actions section before Standings** — the button row now appears immediately after the League Header `<div>`, before the Standings `<Card>`.

**3. Replaced the Actions Card** with a bare `<div className="flex flex-wrap gap-2">` containing `<Button asChild variant="outline" size="sm">` elements. Removed the `<Card>` wrapper, `<CardHeader>`, `<CardContent>`, and `divide-y` row structure entirely (99 lines removed, 42 added).

Buttons rendered (each conditionally):
- "Go to Draft" / "View Draft" → `/leagues/${id}/draft` — when `showViewDraft`
- "Transfers" → `/leagues/${id}/transfers` — when active
- "Set Lineup" → `/leagues/${id}/lineup` — when active
- "Orders" → `/leagues/${id}/orders` — when active
- "League Settings" → `/leagues/${id}/owner` — when `isOwner && showActions`

The separate Owner Settings card for setup/complete leagues (`!showActions && isOwner`) was left untouched.

## Decisions Made

- `showViewDraft` uses `league.updatedAt` which is set to `new Date()` on every status transition, so for active leagues it captures when drafting -> active occurred.
- No Card wrapper on the button row — flush `<div>` integrates naturally with the page grid spacing from `space-y-6`.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript: no errors in `leagues/[leagueId]/page.tsx` after change
- Actions render as a horizontal row of outline buttons with no card border/background
- Actions section appears before Standings in the DOM
- `showViewDraft` correctly gates View Draft button based on `updatedAt` age

## Commits

| Hash | Description |
|------|-------------|
| 32f1b08 | feat(quick-7): refactor Actions section — button row, first position, hide View Draft after 5 days |

## Self-Check: PASSED

- File exists: `src/app/(main)/leagues/[leagueId]/page.tsx` — FOUND
- Commit 32f1b08 — FOUND
