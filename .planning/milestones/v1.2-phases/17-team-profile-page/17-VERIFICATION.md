---
phase: 17-team-profile-page
verified: 2026-03-03T09:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Navigate through the full team profile flow"
    expected: "Standings leaderboard team names are clickable; team profile shows roster, accordion expands per rider with per-race points; rider links to /riders/[riderId]; non-existent team returns 404"
    why_human: "Visual rendering, accordion interaction, navigation transitions, and 404 page appearance cannot be verified programmatically. Human approved per 17-02-SUMMARY.md Task 3 checkpoint."
---

# Phase 17: Team Profile Page Verification Report

**Phase Goal:** Players can view any team's full roster and understand exactly how that team earned its points across the season.
**Verified:** 2026-03-03T09:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getTeamSeasonProfile` returns all drafted riders on the team roster (TEAM-01) | VERIFIED | Query 2 in `team-queries.ts` (lines 126-159): joins `draftPicks → riders → raceResults → races` filtered by `teamId` and `leagueId`; bonus riders merged via Query 3 (lines 162-193) |
| 2 | `getTeamSeasonProfile` returns each rider's per-race points breakdown for the season (TEAM-02) | VERIFIED | Application-side grouping (lines 218-314): nested `Map<riderId, Map<raceId, categories[]>>` builds `TeamRiderEntry[]` with `races: TeamRiderRaceEntry[]`; sorted riders by `totalPoints DESC`, races by `startDate ASC` |
| 3 | Player can navigate to `/leagues/[leagueId]/teams/[teamId]` and see the team's full roster | VERIFIED | `page.tsx` exists at `src/app/(main)/leagues/[leagueId]/teams/[teamId]/page.tsx`; calls `getTeamSeasonProfile` and passes `profile` to `TeamProfileClient` |
| 4 | Each rider on the team shows per-race points breakdown with expandable accordion | VERIFIED | `team-profile-client.tsx` renders `<Accordion type="single" collapsible>` with one `AccordionItem` per rider; `AccordionContent` maps `rider.races` into per-race rows with category breakdown badges |
| 5 | Team names in standings leaderboard are clickable links to the team profile | VERIFIED | `standings-client.tsx` line 76-81: `<Link href={"/leagues/\${leagueId}/teams/\${standing.teamId}"}>`wraps `{standing.teamName}` in leaderboard `TabsContent` |
| 6 | Unknown `teamId` or wrong league returns 404 | VERIFIED | `page.tsx` line 56-58: `if (!profile) { notFound() }`; line 17-19: `if (isNaN(leagueId) \|\| isNaN(teamId)) { notFound() }` |
| 7 | TypeScript compiles with 0 errors | VERIFIED | `npx tsc --noEmit` exits with no output and no errors |
| 8 | All required types are exported from `team-queries.ts` | VERIFIED | Lines 47-82: `TeamRiderCategoryScore`, `TeamRiderRaceEntry`, `TeamRiderEntry`, `TeamSeasonProfile` all exported; function signature `getTeamSeasonProfile(teamId, leagueId, season): Promise<TeamSeasonProfile \| null>` confirmed |

**Score:** 8/8 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/team-queries.ts` | `getTeamSeasonProfile` query function and exported types | VERIFIED | 352 lines; exports function + 4 types; three-query pattern with `lineupFilter` and bonus rider merge; commit `252b016` |
| `src/app/(main)/leagues/[leagueId]/teams/[teamId]/page.tsx` | Async server component with 404 guards and breadcrumb | VERIFIED | 79 lines; parses params, guards NaN, calls `getLeagueDetails` + `getTeamSeasonProfile`, renders breadcrumb + `TeamProfileClient`; commit `8022ab4` |
| `src/app/(main)/leagues/[leagueId]/teams/[teamId]/team-profile-client.tsx` | Client component with header, stats grid, accordion roster | VERIFIED | 164 lines; `'use client'`; three sections (header, stats grid, accordion per rider); bonus badge; rider links with `stopPropagation`; commit `8c68a35` |
| `src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx` | Modified leaderboard: team names are Links | VERIFIED | Line 76-81: `<Link href={...}>` wraps `{standing.teamName}`; minimal change — only the team name cell updated; commit `8c68a35` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `team-queries.ts` | `teams` table (via `draftPicks`) | Drizzle ORM: `draftPicks` → `riders` → `raceResults` → `races` with `eq(draftPicks.teamId, teamId)` | WIRED | Lines 126-159; `draftPicks.teamId` filter confirmed at line 154 |
| `team-queries.ts` | `scoring-queries.ts` lineupFilter pattern | `lineupFilter` SQL fragment copied verbatim (lines 18-32); references `raceLineups`, `draftPicks`, `races` | WIRED | Fragment applied in Query 2 `where()` clause at line 156; `lineupFilter` identifier present in file |
| `page.tsx` | `team-queries.ts` | `import { getTeamSeasonProfile } from '@/lib/team-queries'` | WIRED | Line 4 of `page.tsx`; called at line 54 with result consumed at line 56-58 and passed to `TeamProfileClient` at line 76 |
| `standings-client.tsx` | `/leagues/[leagueId]/teams/[teamId]` route | `<Link href={"/leagues/\${leagueId}/teams/\${standing.teamId}"}` | WIRED | Lines 76-81 of `standings-client.tsx`; pattern `leagues.*teams.*teamId` confirmed present |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TEAM-01 | 17-01, 17-02 | Player can view any team's full squad roster (all drafted riders) | SATISFIED | `getTeamSeasonProfile` returns `riders: TeamRiderEntry[]` from `draftPicks` join; `TeamProfileClient` renders one `AccordionItem` per rider; REQUIREMENTS.md marks `[x]` |
| TEAM-02 | 17-01, 17-02 | Team profile shows each rider's points contribution per race this season | SATISFIED | `TeamRiderEntry.races: TeamRiderRaceEntry[]` holds per-race breakdown; `AccordionContent` renders race rows with category, position, and points; REQUIREMENTS.md marks `[x]` |

No orphaned requirements: REQUIREMENTS.md maps only TEAM-01 and TEAM-02 to Phase 17, both claimed by both plans.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `team-queries.ts` | 113 | `return null` | Info | Intentional: null guard after Query 1 when team row not found; this is correct domain behavior, not a stub |

No blockers or warnings found.

---

## Human Verification Required

### 1. Full team profile navigation flow

**Test:** Start dev server (`npm run dev`). Navigate to an active league's Standings page. Confirm team names in the Leaderboard tab are blue underlined links. Click any team name and confirm navigation to `/leagues/{leagueId}/teams/{teamId}`. Confirm team name, total points, rider count, and "Races Scored" stats grid are visible. Click a rider accordion item — confirm it expands to show per-race results with category badges. Click a rider's name — confirm it navigates to `/riders/{riderId}` without toggling the accordion. Navigate to `/leagues/{leagueId}/teams/999999` — confirm 404 page appears.

**Expected:** All navigation steps succeed. Accordion expands with real data. Rider links work without interfering with accordion. 404 returned for unknown team.

**Why human:** Visual layout, accordion animation, click interactions, and 404 page appearance require a running browser session.

**Note:** Per `17-02-SUMMARY.md`, Task 3 (human verification checkpoint) was completed and the user approved on 2026-03-03. This item is recorded for completeness; automated checks do not re-run the approval.

---

## Gaps Summary

No gaps. All eight observable truths pass. All four artifacts are present and substantive (no placeholders, no empty returns, no TODO stubs). All four key links are wired. Both TEAM-01 and TEAM-02 requirements are satisfied. TypeScript compiles cleanly with 0 errors. Human verification was performed and approved by the user during phase execution.

---

_Verified: 2026-03-03T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
