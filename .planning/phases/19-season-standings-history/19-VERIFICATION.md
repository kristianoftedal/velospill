---
phase: 19-season-standings-history
verified: 2026-03-06T12:30:00Z
status: human_needed
score: 8/9 must-haves verified
human_verification:
  - test: "Confirm chart and tooltip render correctly with real data in a browser"
    expected: "Hovering a data point shows ChartTooltipContent with team name and cumulative points; lines are distinguishable by color; user's team line is visually bolder"
    why_human: "ChartTooltipContent rendering and interactive hover behavior cannot be verified statically"
  - test: "Confirm table horizontal scroll and sticky first column work on a narrow viewport"
    expected: "Table scrolls horizontally; Team column header and team name cells stay fixed while race columns scroll"
    why_human: "CSS sticky + overflow-x-auto interaction with actual rendered DOM and browser scroll requires human testing"
  - test: "Confirm empty state renders when no races have been completed"
    expected: "A centered card shows the message 'No races have been completed yet. Check back after the first results are posted.'"
    why_human: "Requires a league with zero completed race results to trigger the code path; cannot confirm live rendering statically"
---

# Phase 19: Season Standings History Verification Report

**Phase Goal:** Players can see the full competitive narrative of the season — how teams have accumulated points across every race, both as a chart and as a detailed table.
**Verified:** 2026-03-06T12:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

#### Plan 01 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getStandingsHistory` returns a matrix of per-team points for every completed parent race | VERIFIED | Function implemented at `scoring-queries.ts:669`, returns `StandingsHistory` with `races` and `teams` |
| 2 | Races are ordered by startDate ascending (chronological, left-to-right for the chart) | VERIFIED | `.orderBy(asc(races.startDate))` at line 696; cumulative assembly also iterates `raceColumns` in this order |
| 3 | Teams with zero points in a race appear with 0 (not omitted) | VERIFIED | Assembly loop (lines 826-830): `const draft = draftRaceMap.get(col.raceId) ?? 0` — every team gets every race slot defaulting to 0 |
| 4 | Running total (cumulative points) is computed per team at each race step | VERIFIED | Lines 834-839: cumulative loop iterates chronological `raceColumns`, accumulating `running` and writing `cumulativeByRace[col.raceId]` |

#### Plan 02 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | Navigating to `/leagues/[leagueId]/standings/history` shows a page with a chart and a table | VERIFIED | `page.tsx` calls `getStandingsHistory` and renders `<HistoryClient>`; `history-client.tsx` renders `LineChart` + `Table` sections |
| 6 | The chart shows one line per team with cumulative points across races | VERIFIED | `history-client.tsx:91-106`: `history.teams.map(...)` renders one `<Line>` per team; `dataKey={`team_${team.teamId}`}` reads `cumulativeByRace` values from `chartData` |
| 7 | The user's own team line is visually highlighted (bolder, brighter) | VERIFIED | `strokeWidth={isOwnTeam ? 3 : 1.5}` and `strokeOpacity={isOwnTeam ? 1 : 0.75}` at line 101-103 |
| 8 | Hovering a chart data point shows a tooltip with team name and cumulative points | ? UNCERTAIN | `<ChartTooltip content={<ChartTooltipContent />} />` is rendered (line 89); actual tooltip display requires human verification |
| 9 | The table has teams as rows and races as columns with per-race points and a Total column | VERIFIED | `history-client.tsx:120-167`: `TableHeader` maps `history.races` to columns; `TableBody` maps `history.teams` to rows; Total column present |
| 10 | Cells show 0 or — for races where a team earned no points | VERIFIED | Line 156: `{pts === 0 ? "—" : pts}` |
| 11 | The table is horizontally scrollable when there are many races | VERIFIED | `<div className="overflow-x-auto">` at line 119; sticky first column implemented via `className="sticky left-0 z-10"` and `style` override |
| 12 | The Standings card on the league overview page has a 'Season History' link to this page | VERIFIED | `leagues/[leagueId]/page.tsx:206-211`: `<Link href={`/leagues/${league.id}/standings/history`}>Season History →</Link>` in `CardHeader` |
| 13 | Empty state is shown when no races have completed yet | VERIFIED (code path) | `history-client.tsx:41-51`: `if (history.races.length === 0)` renders centered card with correct message; runtime trigger needs human testing |

**Score:** 12/13 truths verified automatically (1 uncertain — tooltip render)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/scoring-queries.ts` | `getStandingsHistory` + 3 exported types | VERIFIED | All 4 exports confirmed: `getStandingsHistory`, `RaceColumn`, `TeamRacePoints`, `StandingsHistory` at lines 638-858 |
| `src/app/(main)/leagues/[leagueId]/standings/history/page.tsx` | Server page — fetches data, guards auth, renders layout | VERIFIED | 117 lines; guards `isNaN`, status check, calls `getStandingsHistory`, renders `HistoryClient` |
| `src/app/(main)/leagues/[leagueId]/standings/history/history-client.tsx` | Client component — recharts LineChart + scrollable race table | VERIFIED | 173 lines; full implementation with chart, table, empty state, user-team highlighting |
| `src/app/(main)/leagues/[leagueId]/page.tsx` | League overview with Season History link in Standings card | VERIFIED | Lines 204-212: `CardHeader` with flex layout, link confirmed present |
| `src/components/ui/chart.tsx` | shadcn chart component | VERIFIED | File exists; recharts in node_modules confirmed |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `history/page.tsx` | `getStandingsHistory` | `import from @/lib/scoring-queries` | WIRED | Line 4: `import { getStandingsHistory } from "@/lib/scoring-queries"`; called at line 84 |
| `history-client.tsx` | recharts via shadcn chart | `import { ChartContainer, ChartTooltip } from @/components/ui/chart` | WIRED | Lines 3-12: recharts `LineChart`, `Line`, etc. imported and rendered in JSX |
| League page Standings card | `/leagues/[leagueId]/standings/history` | `Link` component | WIRED | Lines 206-211 in `leagues/[leagueId]/page.tsx`; `href={`/leagues/${league.id}/standings/history`}` confirmed |
| `getStandingsHistory` | `teams + draftPicks + raceResults + races` | ownership-at-race-time join | WIRED | Lines 744-760: `gte(races.startDate, draftPicks.pickedAt)` and league-scoping subquery match existing pattern |
| `getStandingsHistory` | league_races join table | SQL subquery league race scoping | WIRED | Lines 692, 758, 787: `IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId})` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HISTORY-01 | 19-01, 19-02 | League page shows a chart of cumulative points per team across all completed races | SATISFIED | `getStandingsHistory` computes cumulative per race; `HistoryClient` renders `LineChart` with `cumulativeByRace` values per team |
| HISTORY-02 | 19-01, 19-02 | League page shows a race-by-race breakdown table with each team's points per race and running totals | SATISFIED | `pointsByRace` and `totalPoints` populated in `getStandingsHistory`; `HistoryClient` renders table with per-race and Total columns |

Both requirements marked `[x]` in REQUIREMENTS.md. No orphaned phase-19 requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `history-client.tsx` | 10 | `Tooltip` imported from recharts but never used (`ChartTooltip` from shadcn is used instead) | Info | No functional impact; TypeScript does not error on unused imports in JSX files |
| `history-client.tsx` | 27 | `leagueId: number` declared in `HistoryClientProps` but not destructured or used in the function body | Info | Dead prop — the page passes it but the client doesn't use it; no functional impact |

No blocker or warning-level anti-patterns found.

---

### Human Verification Required

#### 1. Chart tooltip on hover

**Test:** Start dev server, navigate to an active league's Season History page (with at least one completed race). Hover over a data point on the line chart.
**Expected:** A tooltip appears showing each team's cumulative points at that race, with team names. The `ChartTooltipContent` component formats this from the `chartConfig` mapping.
**Why human:** Interactive hover and recharts tooltip rendering cannot be verified by static code analysis.

#### 2. Horizontal scroll and sticky column behavior

**Test:** On a narrow viewport (or with browser dev tools set to mobile width), navigate to a Season History page with several completed races. Scroll the table horizontally.
**Expected:** Race columns scroll horizontally. The "Team" column (first column) remains fixed/visible at the left edge while scrolling.
**Why human:** CSS `sticky left-0` with `overflow-x-auto` parent behavior depends on computed layout and browser rendering — requires visual confirmation.

#### 3. Empty state rendering

**Test:** Navigate to the Season History page for a league that has been activated but has no completed races yet.
**Expected:** No chart or table is shown. Instead, a card with the message "No races have been completed yet. Check back after the first results are posted." is displayed centered.
**Why human:** Requires access to a specific data state (active league, zero results) which cannot be confirmed statically.

---

### Gaps Summary

No structural gaps found. All artifacts exist and are substantively implemented (no stubs, no placeholders). All key links are wired. TypeScript compiles cleanly (`npx tsc --noEmit` produced no output). All five commits referenced in the summaries exist in git history.

The three items flagged for human verification are visual/interactive behaviors that cannot be confirmed through static analysis — they are the expected residual verification work for a UI feature, not indicators of missing implementation.

---

_Verified: 2026-03-06T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
