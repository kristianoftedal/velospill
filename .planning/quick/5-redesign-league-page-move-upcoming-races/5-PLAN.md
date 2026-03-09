---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(main)/home/page.tsx
  - src/app/(main)/leagues/[leagueId]/page.tsx
  - src/lib/league-overview-queries.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Home page no longer shows Upcoming Races or Latest/Completed Races sections"
    - "League overview Actions card consolidates Draft, Transfers, Set Lineup, and Orders into a single card"
    - "League overview shows upcoming league races as accordions below Actions, each expanding to show per-team lineups"
    - "League overview shows recent completed race results below upcoming races as accordions, each showing riders with their fantasy team badge"
  artifacts:
    - path: "src/app/(main)/home/page.tsx"
      provides: "Simplified home page with league cards only (no upcoming/completed race sections)"
    - path: "src/lib/league-overview-queries.ts"
      provides: "getUpcomingRacesWithLineups and getRecentRaceResults queries"
    - path: "src/app/(main)/leagues/[leagueId]/page.tsx"
      provides: "Redesigned league overview with Actions card + upcoming races + recent results"
  key_links:
    - from: "src/app/(main)/leagues/[leagueId]/page.tsx"
      to: "src/lib/league-overview-queries.ts"
      via: "server-side import"
      pattern: "getUpcomingRacesWithLineups|getRecentRaceResults"
---

<objective>
Redesign the league overview page and simplify the home page.

Purpose: Surface the most actionable and interesting information directly on the league overview — what races are coming up (with lineups), what just happened (with team attribution). Remove duplicate race information from the home page.
Output: Simpler home page + richer league overview with consolidated Actions card, upcoming race lineup accordions, and recent result accordions with team badges.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/app/(main)/home/page.tsx
@src/app/(main)/leagues/[leagueId]/page.tsx
@src/lib/lineup-queries.ts
@src/lib/scoring-queries.ts
@src/db/schema/lineups.ts
@src/db/schema/leagues.ts
@src/db/schema/races.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Strip home page of race sections + create league-overview-queries.ts</name>
  <files>
    src/app/(main)/home/page.tsx
    src/lib/league-overview-queries.ts
  </files>
  <action>
**home/page.tsx changes:**
Remove the following from the home page entirely:
1. The "Upcoming Races" section (lines ~331-391): the entire `section` block with `parentRaces.map(...)`.
2. The "Latest/Completed Races" section if present (the `latestRacesWithResults` block).
3. Remove the now-unused queries from the server component body: `upcomingRaces`, `parentRaces`, `latestRacesWithResults`, `latestResults` fetches. Also remove unused imports: `raceResults`, `riders`, `gte`, `lt`, `isNotNull`, `asc`, `isSameDay`, `format` if no longer used. Keep `raceTypeColors`, `raceTypeLabels`, `statusColors` only if still referenced by remaining content.
The home page should retain only: the "My Leagues" cards section (league status cards linking to each league).

**src/lib/league-overview-queries.ts (new file):**
Create two query functions:

```ts
// getUpcomingRacesWithLineups
// Returns parent races assigned to this league that haven't started yet (startDate > now),
// ordered by startDate ASC, limit 5.
// For each race, returns all teams in the league and their submitted lineups.
// Shape:
// {
//   raceId: number, raceName: string, raceType: string, startDate: Date,
//   teams: Array<{ teamId: number, teamName: string, riders: Array<{ riderId: number, riderName: string, riderTeam: string }> }>
// }[]
//
// Implementation:
// 1. Query upcoming parent races from leagueRaces join races WHERE parentRaceId IS NULL AND startDate > now(), ordered ASC, limit 5.
// 2. If no races, return [].
// 3. For each race, query all teams in the league (from teams table WHERE leagueId = leagueId).
// 4. Query raceLineups JOIN riders for each raceId in the found races, grouped by teamId.
//    Use a single query: SELECT raceLineups.raceId, raceLineups.teamId, teams.name as teamName, riders.id, riders.name, riders.team
//    FROM raceLineups JOIN riders ON riders.id = raceLineups.riderId JOIN teams ON teams.id = raceLineups.teamId
//    WHERE raceLineups.leagueId = leagueId AND raceLineups.raceId IN (...raceIds)
// 5. Build the nested structure in application code: Map<raceId, Map<teamId, riders[]>>.
// 6. For each race, iterate all league teams; if a team has lineups for this race, include riders array; otherwise include empty riders array.

// getRecentRaceResults
// Returns the 3 most recently completed parent races for this league that have results,
// with each rider result tagged with their fantasy team name.
// Shape:
// {
//   raceId: number, raceName: string, raceType: string, startDate: Date,
//   results: Array<{ riderId: number, riderName: string, riderTeam: string, position: number, points: number, fantasyTeamId: number, fantasyTeamName: string }>
// }[]
//
// Implementation:
// 1. Query completed races: leagueRaces JOIN races WHERE parentRaceId IS NULL AND startDate < now()
//    ordered by startDate DESC, limit 3.
// 2. If no races, return [].
// 3. For those raceIds, query:
//    SELECT raceResults.raceId, raceResults.position, raceResults.points,
//           riders.id, riders.name, riders.team,
//           teams.id as fantasyTeamId, teams.name as fantasyTeamName
//    FROM raceResults
//    JOIN riders ON riders.id = raceResults.riderId
//    JOIN draftPicks ON draftPicks.riderId = raceResults.riderId AND draftPicks.leagueId = leagueId
//                      AND draftPicks.pickedAt <= races.startDate   -- ownership-at-race-time
//    JOIN races ON races.id = raceResults.raceId
//    JOIN teams ON teams.id = draftPicks.teamId
//    WHERE raceResults.raceId IN (...raceIds)
//    ORDER BY raceResults.raceId, raceResults.position ASC
//    (This is the same ownership-at-race-time pattern used in scoring-queries.ts — use lte from drizzle-orm)
// 4. Build nested structure in application code grouped by raceId.
// 5. Only include riders who have a draft pick in this league (inner join, not left join — unowned riders excluded).
```

Use imports: `db` from `@/lib/db`, `raceLineups` from `@/db/schema/lineups`, `leagueRaces`, `teams` from `@/db/schema/leagues`, `races` from `@/db/schema/races`, `riders` from `@/db/schema/riders`, `raceResults` from `@/db/schema/results`, `draftPicks` from `@/db/schema/draft`, `eq`, `and`, `isNull`, `gt`, `lt`, `lte`, `inArray`, `asc`, `desc` from `drizzle-orm`.

Export types: `UpcomingRaceWithLineups` and `RecentRaceResult` (use `Awaited<ReturnType<...>>[number]` pattern).
  </action>
  <verify>
    <automated>cd /Users/kristianoftedal/dev/velospill && npx tsc --noEmit 2>&1 | head -30</automated>
    <manual>Confirm home page no longer imports raceResults, gte, isNotNull. Confirm league-overview-queries.ts exists.</manual>
  </verify>
  <done>TypeScript compiles without errors in the modified files. home/page.tsx has no race section JSX. league-overview-queries.ts exports both query functions.</done>
</task>

<task type="auto">
  <name>Task 2: Redesign league overview page with consolidated Actions + upcoming lineups + recent results accordions</name>
  <files>
    src/app/(main)/leagues/[leagueId]/page.tsx
  </files>
  <action>
Rewrite `LeagueDetailPage` in `src/app/(main)/leagues/[leagueId]/page.tsx`.

**Data fetching additions (add to the existing Promise.all when league is active/complete):**
```ts
import { getUpcomingRacesWithLineups, getRecentRaceResults } from "@/lib/league-overview-queries"
```
In the `if (league.status === "active" || league.status === "complete")` block, expand the Promise.all to also fetch:
- `upcomingRaces`: `getUpcomingRacesWithLineups(league.id)`
- `recentResults`: `getRecentRaceResults(league.id)`

For `setup` / `drafting` status, set both to `[]`.

**Section order in JSX (replace the current layout):**

1. **Breadcrumb** — keep as-is
2. **League Header** — keep as-is (name + status badge + team count)
3. **Standings card** — keep as-is (StandingsClient, only shown for active/complete)
4. **Actions card** — NEW: single `<Card>` titled "Actions" replacing the four separate cards (Draft, Transfers, Set Lineup, Orders). Only show for `active` or `drafting` status. Layout: use a simple `div` with `flex flex-col gap-2` or `divide-y`. Each action is a row: `flex items-center justify-between`, label on left (font-semibold + small description text below), link button on right. Show conditionally:
   - Draft row: always show when `drafting` or `active` (text: "Draft" / "Join the draft room" or "View Draft") — link to `/leagues/${league.id}/draft`
   - Transfers row: only when `active` — link to `/leagues/${league.id}/transfers`
   - Set Lineup row: only when `active` — link to `/leagues/${league.id}/lineup`
   - Orders row: only when `active` — link to `/leagues/${league.id}/orders`
   - League Settings row (owner only): always show when `isOwner`, styled with `border-primary/20 bg-primary/5` on the card or as a separator row in a different color — link to `/leagues/${league.id}/owner`

   Use shadcn `Button` with `asChild` + `Link` for each action button.

5. **Upcoming Races section** — NEW: only show when `active` or `drafting` and `upcomingRaces.length > 0`. Use shadcn `Accordion` (type="multiple") from `@/components/ui/accordion`. Import: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`.

   Section heading: `<h2 className="text-lg font-semibold">Upcoming Races</h2>` inside a Card.

   Each race = one `AccordionItem` with `value={String(raceId)}`:
   - Trigger: race name + date formatted as `d MMM yyyy` + race type badge
   - Content: show all teams with their lineups.
     - For each team: `<div>` with team name as a small heading, then a comma-separated or pill list of rider names.
     - If `riders.length === 0` for a team: show "(no lineup set)" in muted text.
     - Layout: `grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2`

6. **Recent Race Results section** — NEW: only show when `active` or `complete` and `recentResults.length > 0`. Use shadcn `Accordion` (type="multiple").

   Section heading: `<h2 className="text-lg font-semibold">Recent Results</h2>` inside a Card.

   Each race = one `AccordionItem`:
   - Trigger: race name + date + total league points for this race (sum of points in results)
   - Content: table or list of riders ordered by position. Each row: position, rider name, pro team, points, and a `<Badge variant="outline">` showing the fantasy team name (the `fantasyTeamName`). Keep it compact.
   - Use a simple `<div>` list with `flex items-center gap-2` per row rather than a full Table component to keep it lightweight.

7. **Team Roster card** — keep as-is at the bottom

**Imports to add:**
```ts
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { getUpcomingRacesWithLineups, getRecentRaceResults } from "@/lib/league-overview-queries"
```

Remove the four individual action Cards (Draft, Transfers, Set Lineup, Orders, League Settings) and replace with the single Actions card as described above.
  </action>
  <verify>
    <automated>cd /Users/kristianoftedal/dev/velospill && npx tsc --noEmit 2>&1 | head -30</automated>
    <manual>Visit /leagues/[id] for an active league. Confirm: 1) single Actions card with all action rows, 2) Upcoming Races section with accordions that expand to show team lineups, 3) Recent Results section with accordions showing riders + team badges.</manual>
  </verify>
  <done>TypeScript compiles clean. League overview has Actions card, upcoming race accordion section, recent results accordion section. Home page no longer shows race sections.</done>
</task>

</tasks>

<verification>
`npx tsc --noEmit` passes with no new errors.
Home page renders without the upcoming races / completed races sections.
League overview for an active league shows: Standings, Actions card (consolidated), Upcoming Races accordions, Recent Results accordions, Team Roster.
</verification>

<success_criteria>
- Home page: no upcoming races section, no latest/completed races section
- League overview: one "Actions" card with all navigation actions consolidated
- League overview: upcoming race accordions show per-team lineup riders (or "no lineup set")
- League overview: recent result accordions show riders with their fantasy team badge
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/5-redesign-league-page-move-upcoming-races/5-SUMMARY.md`
</output>
