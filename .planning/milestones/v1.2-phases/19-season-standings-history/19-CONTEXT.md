# Phase 19: Season Standings History - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

A dedicated `/leagues/[leagueId]/standings/history` page showing the full competitive narrative of the season: a cumulative line chart of points per team across all completed races, and a race-by-race table with per-race points and running totals. Accessible via a link in the Standings card on the league overview page.

</domain>

<decisions>
## Implementation Decisions

### Chart
- Cumulative line chart — X axis: races ordered by date, Y axis: running total points per team
- One line per team; user's own team line is highlighted (bolder/brighter) — consistent with Leaderboard's blue row highlight
- Tooltip on hover: team name + cumulative points at that race point
- Add recharts via the shadcn chart component (`npx shadcn add chart`) — CSS chart color variables already defined in globals.css

### Page placement
- Separate page at `/leagues/[leagueId]/standings/history`
- Entry point: link inside the Standings card on the league overview page (e.g., "Season History →" at the bottom or header of the card)

### Table layout
- Teams as rows, races as columns
- Columns: Team Name | Race 1 | Race 2 | ... Race N | Total
- Each cell shows points earned in that race (or — if no points)
- Running total in the final column
- Horizontally scrollable for many races

### Claude's Discretion
- Exact link label/position within the Standings card
- Empty state when no races have completed yet
- Mobile table behavior (sticky first column, scroll)
- Whether to show rank position at each race in the table

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StandingsClient` (standings-client.tsx): existing shadcn Tabs component, Table components — same Table pattern for the race-by-race matrix
- `getLeagueStandingsWithOrders`: gives cumulative points per team (not per-race breakdown — new query needed)
- `getLeagueRacesWithScores`: gives total league points per race (not per team — new query needed)
- CSS chart variables: `--chart-1` through `--chart-5` defined in globals.css — maps directly to shadcn chart colors

### Established Patterns
- Server page + Client component split (see standings-client.tsx, team-profile-client.tsx)
- `leagueId` from params, `notFound()` guard on NaN
- `seasonYear` sourced from `league.config as LeagueConfig`
- Ownership-at-race-time via `lte(draftPicks.pickedAt, races.startDate)` inner join pattern

### Integration Points
- New query: `getStandingsHistory(leagueId, season)` → per-team, per-race points matrix for all completed races
- New page: `src/app/(main)/leagues/[leagueId]/standings/history/page.tsx`
- New client: `src/app/(main)/leagues/[leagueId]/standings/history/history-client.tsx` (chart + table)
- Modify: `src/app/(main)/leagues/[leagueId]/page.tsx` — add "Season History →" link to the Standings card header or footer
- Modify (or extend): `src/lib/scoring-queries.ts` — add `getStandingsHistory`

</code_context>

<specifics>
## Specific Ideas

No specific references — open to standard recharts line chart patterns via the shadcn chart component.

</specifics>

<deferred>
## Deferred Ideas

- **IR (Injured Reserve):** Player-submitted IR list with up to 2 riders, roster slot freed during transfer windows, admin approval required, admin alert when rider must return — separate feature phase

</deferred>

---

*Phase: 19-season-standings-history*
*Context gathered: 2026-03-06*
