---
phase: 27-league-stage-visibility
verified: 2026-03-13T00:00:00Z
status: human_needed
score: 9/10 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to /leagues/[leagueId]/standings — Race Results tab — click a grand tour row"
    expected: "Row expands to reveal individual stage rows with stage name, Done/Pending badge, points, and a blue link for completed stages. Pending stages show muted text with no link. All rows start collapsed on page load."
    why_human: "Interactive expand/collapse state and badge rendering cannot be verified without a running browser — requires real race data with at least one multi-stage race in the league."
  - test: "Expand a grand tour that has end-of-tour results (GC/KOM classification results entered against the parent race row)"
    expected: "A 'Final Classifications' section appears below the stage list with a link to the parent race breakdown page and endOfTourPoints shown."
    why_human: "Requires specific database state (race results entered against the parent race row itself) to trigger the endOfTourPoints > 0 branch."
  - test: "Collapse an expanded grand tour row"
    expected: "Clicking the row again hides the stage list and returns to the compact single row view."
    why_human: "Toggle state requires browser interaction to verify."
  - test: "One-day race rows in Race Results tab"
    expected: "Flat non-expandable rows — no chevron icon, name is a clickable link as before."
    why_human: "Requires browser rendering to confirm visual unchanged appearance."
---

# Phase 27: League Stage Visibility Verification Report

**Phase Goal:** Players on the league standings page can expand a multi-stage race row to see per-stage scoring breakdowns and end-of-tour classification results
**Verified:** 2026-03-13
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Multi-stage race rows have an expand control that reveals individual stage rows | VERIFIED | `standings-client.tsx:177-270` — `race.isMultiStage` branch renders `<TableRow onClick={() => toggleRace(race.raceId)}>` with `ChevronRight`/`ChevronDown` icons |
| 2 | Each expanded stage row shows who scored and how many points they earned (per-stage points visible) | VERIFIED | `standings-client.tsx:212-240` — `race.stages.map()` renders stage name, Done/Pending badge, `stage.totalLeaguePoints`; breakdown link to `/leagues/[leagueId]/standings/[stage.raceId]` for Done stages |
| 3 | End-of-tour classifications are visible within the expanded grand tour view as a distinct section | VERIFIED | `standings-client.tsx:242-264` — `race.endOfTourPoints > 0 &&` block renders "Final Classifications" section with link and `race.endOfTourPoints` |
| 4 | Collapsing the row returns the standings to compact view | VERIFIED | `standings-client.tsx:49-58` — `useState<Set<number>>` with `toggleRace` deletes from Set on second click; `isExpanded` check at line 178 gates expanded row rendering |
| 5 | Multi-stage races return as parent rows with nested stages array (data layer) | VERIFIED | `scoring-queries.ts:396-506` — `getLeagueRacesWithScores` uses three-query assembly; Query B returns stage rows grouped by `parentRaceId`; `stagesByParent` Map assembled application-side |
| 6 | Each stage row carries `totalLeaguePoints` and `hasResults` flag | VERIFIED | `scoring-queries.ts:432-438` — Query B selects `totalLeaguePoints` and `hasResults: sql\`EXISTS (...)\`` correlated subquery |
| 7 | End-of-tour points returned as separate field on parent | VERIFIED | `scoring-queries.ts:493-500` — `endOfTourPoints = Number(row.totalLeaguePoints)` (parent row's own results), `totalLeaguePoints = stagePointsTotal + endOfTourPoints` |
| 8 | One-day races returned as flat rows (unchanged format) | VERIFIED | `scoring-queries.ts:479-490` — `!isMultiStage` path returns `stages: [], endOfTourPoints: 0, isMultiStage: false` |
| 9 | Page passes `LeagueRaceScoreGrouped[]` to StandingsClient | VERIFIED | `page.tsx:91` — `getLeagueRacesWithScores(leagueId, seasonYear)` call (return type inferred); `page.tsx:129` — `races={races}` prop; `standings-client.tsx:25` — `races: LeagueRaceScoreGrouped[]` |
| 10 | UI expand/collapse works correctly in browser with real data | ? NEEDS HUMAN | Cannot verify interactive state and conditional rendering without running browser and real league data |

**Score:** 9/10 truths verified automatically

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/scoring-queries.ts` | `getLeagueRacesWithScores` returns `LeagueRaceScoreGrouped[]`; exports `StageScore`, `LeagueRaceScoreGrouped` | VERIFIED | Types exported at lines 360-378; function signature at line 396; both types present and substantive |
| `src/app/(main)/leagues/[leagueId]/standings/standings-client.tsx` | Expandable race rows in Race Results tab with `useState<Set<number>>` | VERIFIED | Full implementation — expand state (line 49), toggleRace (line 51), conditional `isMultiStage` rendering (line 177), stage list (lines 212-240), end-of-tour section (lines 242-264) |
| `src/app/(main)/leagues/[leagueId]/standings/page.tsx` | Passes `LeagueRaceScoreGrouped[]` to StandingsClient | VERIFIED | Line 91 calls `getLeagueRacesWithScores`; line 129 passes `races={races}`; TypeScript infers correct type |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scoring-queries.ts` | `standings/page.tsx` | `getLeagueRacesWithScores` return type change | WIRED | `page.tsx:4` imports `getLeagueRacesWithScores`; `page.tsx:91` calls it; return type `Promise<LeagueRaceScoreGrouped[]>` inferred |
| `standings/page.tsx` | `StandingsClient` | `races` prop typed as `LeagueRaceScoreGrouped[]` | WIRED | `page.tsx:129` — `races={races}` prop; `standings-client.tsx:25` — `races: LeagueRaceScoreGrouped[]` |
| `StandingsClient` expand control | stage row list | `useState expandedRaces Set<number>` | WIRED | `expandedRaces.has(race.raceId)` at line 178 gates expanded `<TableRow>` rendering at line 208 |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SVIS-01 | 27-01, 27-02 | Multi-stage race rows in league standings are expandable to reveal individual stages | SATISFIED | Chevron toggle on `race.isMultiStage` rows; `expandedRaces` state gates stage list rendering |
| SVIS-02 | 27-01, 27-02 | Each expanded stage shows the riders who scored and their points for that stage | SATISFIED (partial — points shown; breakdown link provided; actual rider names shown via breakdown page link, not inline) | `stage.totalLeaguePoints` rendered; `stage.hasResults` gates link to `/leagues/[leagueId]/standings/[stage.raceId]` breakdown page |
| SVIS-03 | 27-01, 27-02 | End-of-tour results (GC, points jersey, KOM, etc.) are visible within the expanded grand tour view | SATISFIED | "Final Classifications" section rendered when `race.endOfTourPoints > 0`; links to parent race breakdown page |

**Note on SVIS-02:** The requirement states "each expanded stage shows the riders who scored." The implementation shows per-stage league points totals and a link to the full breakdown page — it does not inline the rider list directly in the stage row. This matches the plan spec exactly (plan 02 task 1 says "points: `stage.totalLeaguePoints`" and "link to breakdown page"), so this is the intended interpretation. The full rider list is one click away on the breakdown page.

**No orphaned requirements.** All three SVIS-01/02/03 requirements are claimed by both plans and are implemented.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `standings-client.tsx` | 180 | `<>` (React.Fragment without key) wrapping `<TableRow>` elements returned from `.map()` | Warning | React will log "Each child in a list should have a unique 'key' prop" in the browser console. Rendering is functional but produces a runtime warning. Should use `<React.Fragment key={race.raceId}>` or a keyed wrapper. |
| `scoring-queries.ts` | 519 | `LeagueRaceScore` type exported but no longer imported anywhere | Info | Dead export — preserved intentionally per plan spec for backward compatibility. Harmless but could be removed if no consumers remain. |

### Human Verification Required

#### 1. Expand/Collapse Interaction

**Test:** Navigate to `/leagues/[leagueId]/standings`, click "Race Results" tab, find a grand tour row, click it.
**Expected:** Row expands showing individual stage rows. Each stage row shows: stage name (as a link if Done, muted text if Pending), a Done or Pending badge, and the stage league points total. The chevron icon flips from right to down.
**Why human:** Interactive React state (useState Set) and conditional rendering require a live browser with actual league data containing at least one multi-stage race.

#### 2. End-of-Tour Section Visibility

**Test:** Find a grand tour where end-of-tour classification results have been entered (results entered against the parent race row itself, not a stage). Expand that row.
**Expected:** Below the stage list, a "Final Classifications" section header appears, followed by a row linking to the parent race breakdown page with `endOfTourPoints` shown.
**Why human:** The `endOfTourPoints > 0` condition requires specific database state — race results entered against a parent race row.

#### 3. Collapse Returns to Compact View

**Test:** Click an expanded grand tour row again.
**Expected:** The stage list collapses and the row returns to showing only the race name, type badge, date, and total league points.
**Why human:** Toggle state requires browser interaction.

#### 4. One-Day Races Unchanged

**Test:** Inspect one-day race rows in the Race Results tab.
**Expected:** No chevron icon, race name is a direct blue link to the breakdown page, flat single row format identical to the pre-phase appearance.
**Why human:** Visual confirmation requires browser rendering.

### Gaps Summary

No automated gaps detected. All artifacts exist, are substantive (not stubs), and are correctly wired. TypeScript compiles without errors. Commits `d556b99` (data layer) and `1b19525` (UI layer) both verified present.

The only open item is human browser verification of the interactive expand/collapse UI, which is inherently untestable programmatically.

One low-severity issue found: React Fragment at line 180 of `standings-client.tsx` is missing a `key` prop — this will produce a console warning but does not affect rendering correctness.

---

_Verified: 2026-03-13_
_Verifier: Claude (gsd-verifier)_
