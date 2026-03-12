# Phase 27: League Stage Visibility - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-stage race rows (grand tour / mini tour) on the league standings Race Results tab become expandable. Expanding reveals per-stage rows with league points and links to the existing breakdown page, plus a separate End-of-Tour section for final classifications. One-day races are unaffected. No changes to the existing /standings/[raceId] breakdown page.

</domain>

<decisions>
## Implementation Decisions

### Race list restructuring
- Multi-stage races appear as a **single expandable parent row** at the top level — stages only visible inside the expanded view
- One-day races remain as flat non-expandable rows (no change)
- Stages are removed from the top-level flat list entirely (no duplicate rows)
- Parent row shows **sum of all stages + end-of-tour points** as its total
- All grand tour rows start **collapsed** by default on page load

### Expand content (per stage)
- Each stage row shows: stage name + total league points scored that stage + link to the existing /standings/[raceId] breakdown page
- Stages with no results yet show a **Pending badge** and are still visible (not hidden)
- No rider-level or team-level inline detail — that stays on the breakdown page

### End-of-tour section
- Shown as a **separate labeled section below the stage list** ("End-of-Tour Results")
- Same row format as stage rows: classification name + league points + link to breakdown
- **Hidden entirely if no end-of-tour results have been entered yet** (no placeholder)

### Loading strategy
- All stage data **preloaded server-side** when the standings page loads — expand is instant, no spinner
- Acceptable cost: few grand tours per season

### Claude's Discretion
- Exact visual treatment of the expand control (chevron icon, accordion, etc.)
- How pending stage rows are styled (muted text, no link)
- Whether the parent row uses the same Table row pattern or a slightly different visual affordance to indicate expandability

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StandingsClient` (`standings-client.tsx`) — the "Race Results" `TabsContent` is where the race list lives; this is the primary edit target
- `getLeagueRacesWithScores(leagueId, season)` in `scoring-queries.ts` — currently returns flat rows per race (stages included as individual rows); needs to return parent races separately from their stages
- `getRaceScoreBreakdown(raceId, leagueId)` — already fetches per-rider breakdown for a single race; reusable for computing per-stage league points
- `Table`, `TableRow`, `TableBody` etc. — already used in the race-results tab
- `Badge` (variant="secondary", variant="outline") — existing Done/Pending pattern from Phase 26 admin work
- `ChevronRightIcon` / `ChevronDownIcon` from lucide-react — natural expand control

### Established Patterns
- `COALESCE(parentRaceId, id)` — existing pattern for grouping stage results under parent race (used in standings scoring queries)
- `parentRaceId IS NULL` filter — used in scoring queries to identify parent races
- `hasResults: boolean` per race — Phase 26 added `stagesTotal`/`stagesWithResults`; similar approach needed here to know which stages have results
- Three-query application-side assembly — existing pattern for avoiding SQL JSON_AGG complexity; stage data can follow same pattern

### Integration Points
- `getLeagueRacesWithScores()` — extend or replace to return: parent races with their total points, and a nested/separate list of their stages with per-stage points and hasResults flag
- `StandingsClient` race-results tab — add expand state, render parent rows with accordion behavior, render stage list + end-of-tour section inside expanded area
- `/leagues/[leagueId]/standings/page.tsx` — passes `races` prop to `StandingsClient`; may need to reshape data passed down

</code_context>

<specifics>
## Specific Ideas

- Stage rows inside the expanded view follow the same Done/Pending badge style established in Phase 26 admin UI
- The End-of-Tour section header should make it obvious these are final classifications, not another stage (e.g. "Final Classifications" or "End-of-Tour")
- Per-stage points shown are the **league total** (sum across all drafted riders for that stage), not broken down by team inline

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-league-stage-visibility*
*Context gathered: 2026-03-12*
