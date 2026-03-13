# Phase 26: Admin Stage Result Scoping - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix admin result entry so stage results are clearly associated with the correct race, and stage completion status is visible at a glance without needing to expand each parent race individually. Scope: admin results page only — no changes to league-facing pages.

</domain>

<decisions>
## Implementation Decisions

### Parent race click behavior
- Clicking a parent race (e.g. "Tour de France") opens a **stage overview** first — a list of all stages showing their completion status
- End-of-tour categories (GC, points jersey, KOM etc.) are accessible from the stage overview view (not the first thing shown)
- This replaces the current behavior of immediately opening the end-of-tour category picker on parent click

### Stage navigation
- When a stage modal is open, include **prev/next stage buttons** for fast navigation between stages without going back to the sidebar
- Buttons should indicate stage name/number and whether the adjacent stage has results

### Stage completion display (sidebar)
- Parent race rows in the sidebar show a **completion count**: e.g. "3/5 done" visible without expanding
- This requires knowing how many stages have results per parent — `getRacesForResults()` or a separate query must return this count
- Current per-stage "Done" badge is kept for when stages are visible

### Stage identification
- Modal title format is fine as-is — parent race context is clear from sidebar
- No change needed to modal title format

### Claude's Discretion
- Exact layout of the stage overview (table vs cards vs list)
- Whether prev/next buttons are in the modal header or footer
- How to fetch the stage completion count efficiently (extend existing query vs separate query)
- Whether the stage overview is inline in the sidebar or opens in the modal

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card`, `CardHeader`, `CardContent`, `CardTitle` — used throughout results modal
- `Badge` (variant="secondary") — existing "Done" badge pattern on stages
- `Button` — used for prev/next navigation
- `Tabs`, `TabsList`, `TabsTrigger` — already used in results modal (Results | Change History tabs)
- `stagesByParent` Record<parentId, Stage[]> — already computed, sorted by stageNumber

### Established Patterns
- `handleRaceSelect(raceId)` — entry point for all race/stage clicks; loads results if `hasResults`
- Modal (`Dialog`) pattern — already used for result entry; stage overview can reuse this
- `hasResults: boolean` on each race — per-race flag; need per-parent stage completion count added

### Integration Points
- `getRacesForResults()` in `actions.ts` — extend to return `stagesTotal` and `stagesWithResults` per parent race
- `handleRaceSelect()` in `results-client.tsx` — change behavior when a parent race is clicked
- Sidebar render block (`parentRaces.map(...)`) — add completion count display
- Modal content logic — add stage overview view for parent races; add prev/next buttons for stage views

</code_context>

<specifics>
## Specific Ideas

- Stage overview when clicking parent race: list all stages with their stage number, name, date, and Done/Pending status — clicking a stage opens it for result entry
- Completion count format: "3/5 done" or "3/5" with a small Badge next to the race name in the sidebar
- Prev/next: small buttons like "← Stage 4" / "Stage 6 →" inside the stage modal

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-admin-stage-result-scoping*
*Context gathered: 2026-03-11*
