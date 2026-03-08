# Roadmap — Velospill (Cycling Fantasy League)

## Milestones

- ✅ **v1.0 Core Platform** — Phases 1-9 (shipped 2026-02-20)
- ✅ **v1.1 Scoring & Rules Update** — Phases 10-15 (shipped 2026-02-26)
- ✅ **v1.2 Player Visibility** — Phases 16-19 (shipped 2026-03-06)
- ✅ **v1.3 IR List & Roster Management** — Phases 20-22 (shipped 2026-03-07)
- 🚧 **v1.4 Roster Consolidation** — Phases 23-25 (in progress)

## Phases

<details>
<summary>✅ v1.0 Core Platform (Phases 1-9) — SHIPPED 2026-02-20</summary>

- [x] Phase 1: Foundation & Authentication — pre-GSD
- [x] Phase 2: Admin Backoffice & Race Calendar (4 plans)
- [x] Phase 3: League Management (3 plans)
- [x] Phase 4: Live Draft System (4 plans)
- [x] Phase 5: Scoring & Points System (2 plans)
- [x] Phase 6: Transfer Market (4 plans) — completed 2026-02-14
- [x] Phase 7: Strategic Orders & Scoring Integration (5 plans) — completed 2026-02-15
- [x] Phase 8: UI Polish & Race Assignment (3 plans) — completed 2026-02-16
- [x] Phase 9: League Scoping & UX Fixes (1 plan) — completed 2026-02-20

Full details: milestones/v1.0-ROADMAP.md

</details>

<details>
<summary>✅ v1.1 Scoring & Rules Update (Phases 10-15) — SHIPPED 2026-02-26</summary>

- [x] Phase 10: Bug Fixes (1 plan) — completed 2026-02-20
- [x] Phase 11: Scoring Config Update (2 plans) — completed 2026-02-21
- [x] Phase 12: Result Entry Expansion (3 plans) — completed 2026-02-21
- [x] Phase 13: Order Config Updates (2 plans) — completed 2026-02-22
- [x] Phase 14: Counter Mechanic & Return Logic (1 plan) — completed 2026-02-22
- [x] Phase 15: Uno-X Order Feature (3 plans) — completed 2026-02-22

Full details: milestones/v1.1-ROADMAP.md

</details>

<details>
<summary>✅ v1.2 Player Visibility (Phases 16-19) — SHIPPED 2026-03-06</summary>

- [x] **Phase 16: Rider Profile Page** — Season stats, per-race breakdown, categories, and ownership history for any rider (completed 2026-03-02)
- [x] **Phase 17: Team Profile Page** — Full squad roster with per-rider scoring contribution per race (completed 2026-03-03)
- [x] **Phase 18: Race Lineup Accordion** — Expandable per-race lineup panel on the league page, showing teams' picks and post-result points (completed 2026-03-06 via quick task 5)
- [x] **Phase 19: Season Standings History** — Cumulative points chart and race-by-race breakdown table on the league page (completed 2026-03-06)

</details>

<details>
<summary>✅ v1.3 IR List & Roster Management (Phases 20-22) — SHIPPED 2026-03-07</summary>

- [x] **Phase 20: IR Foundation & Admin Approval** — Schema, player IR request flow, admin queue with approve/reject, and roster slot accounting when IR is approved (completed 2026-03-06)
- [x] **Phase 21: Drop Rider** — Instant roster drop action for players, no approval required (completed 2026-03-06)
- [x] **Phase 22: IR Return Flow** — Admin marks rider eligible, player sees banner, transfer block enforced, player returns rider (with roster-full drop gate) and waiver pickup slot freed (completed 2026-03-07)

Full details: milestones/v1.3-ROADMAP.md

</details>

## Phase Details

### Phase 16: Rider Profile Page
**Goal**: Players can navigate to any rider and see that rider's full season contribution — total points, per-race scores, scoring categories, and which teams held them.
**Depends on**: Phase 5 (scoring engine), Phase 6 (transfer/ownership data)
**Requirements**: RIDER-01, RIDER-02, RIDER-03, RIDER-04
**Success Criteria** (what must be TRUE):
  1. Player can navigate to a rider's page and see total points earned this season across all races
  2. Rider page lists each race the rider scored in with their points for that race
  3. For each scored race, the breakdown shows which categories contributed (e.g., finish, sprint, mountain, jersey)
  4. Rider page shows a chronological ownership history — which team held the rider at each race
**Plans:** 2/2 plans complete

Plans:
- [ ] 16-01-PLAN.md — Data query layer: getRiderSeasonProfile (rider stats, per-race categories, ownership history)
- [ ] 16-02-PLAN.md — Route page + client UI: /riders/[riderId] profile with all four sections + list links

### Phase 17: Team Profile Page
**Goal**: Players can view any team's full roster and understand exactly how that team earned its points across the season.
**Depends on**: Phase 16 (establishes scoring query patterns for per-rider/per-race lookups)
**Requirements**: TEAM-01, TEAM-02
**Success Criteria** (what must be TRUE):
  1. Player can navigate to any team in their league and see the full squad — all drafted riders currently on the roster
  2. Team profile shows each rider's points contribution broken down by race across the current season
**Plans:** 2/2 plans complete

Plans:
- [ ] 17-01-PLAN.md — Data query layer: getTeamSeasonProfile (team metadata, full roster, per-rider per-race scoring breakdown)
- [ ] 17-02-PLAN.md — Route page + client UI: /leagues/[leagueId]/teams/[teamId] profile with roster accordion + standings link

### Phase 18: Race Lineup Accordion
**Goal**: Players can see all teams' race-day selections directly from the league race list, and after results are posted, each rider's earned points are shown alongside their name.
**Depends on**: Phase 3 (league page), Phase 5 (scoring engine)
**Requirements**: LINEUP-01, LINEUP-02, LINEUP-03
**Success Criteria** (what must be TRUE):
  1. Each race in the league race list has an expandable accordion that a player can open
  2. Once lineups are submitted, the expanded accordion shows each team's selected riders for that race
  3. After race results are posted, the accordion shows each selected rider's earned points next to their name
**Completed**: 2026-03-06 via quick task 5 (league page redesign — getUpcomingRacesWithLineups + per-team accordion + Recent Results section)

### Phase 19: Season Standings History
**Goal**: Players can see the full competitive narrative of the season — how teams have accumulated points across every race, both as a chart and as a detailed table.
**Depends on**: Phase 5 (scoring engine), Phase 3 (league page)
**Requirements**: HISTORY-01, HISTORY-02
**Success Criteria** (what must be TRUE):
  1. League page displays a line chart showing cumulative points per team across all completed races
  2. League page displays a race-by-race table with each team's points per individual race
  3. The table includes running totals so a player can see the exact standings at any point in the season
**Plans**: 2 plans

Plans:
- [ ] 19-01-PLAN.md — Data query layer: getStandingsHistory (per-team per-race points matrix with cumulative totals)
- [ ] 19-02-PLAN.md — History page + client UI: /leagues/[leagueId]/standings/history with recharts line chart + scrollable race table + league page entry link

### Phase 23: roster_slots Schema & Migration
**Goal**: Introduce the `roster_slots` table and populate it with current live data so it accurately reflects every team's roster before any code reads from it.
**Depends on**: Phase 22 (IR schema fully in place)
**Requirements**: RSLOT-01, RSLOT-02
**Success Criteria** (what must be TRUE):
  1. `roster_slots` table exists in the database with columns for league, team, rider, status, and added_at
  2. Every rider currently on a team's active roster has a corresponding `active` row in `roster_slots`
  3. Every rider with an approved or return_eligible IR request has a corresponding `on_ir` / `return_eligible` row
  4. `draftPicks` and `irRequests` tables are unchanged
**Plans:** 2/2 plans complete

Plans:
- [ ] 23-01-PLAN.md — Schema definition + SQL migration: roster_slot_status enum, roster_slots table, indexes applied to DB
- [ ] 23-02-PLAN.md — Backfill script: populate roster_slots from draftPicks + irRequests with correct status mapping

### Phase 24: Write Path Wiring
**Goal**: All mutations that change roster state also write the corresponding change to `roster_slots`, keeping it in sync with `draftPicks`.
**Depends on**: Phase 23 (roster_slots populated)
**Requirements**: RSLOT-03, RSLOT-04, RSLOT-05, RSLOT-06, RSLOT-07, RSLOT-08
**Success Criteria** (what must be TRUE):
  1. Making a draft pick inserts a new `active` row into `roster_slots`
  2. Dropping a rider removes their `roster_slots` row
  3. Approving a transfer moves the rider's row to the new team
  4. Approving an IR request sets the rider's status to `on_ir`
  5. Marking return-eligible sets status to `return_eligible`; returning sets it back to `active`
**Plans:** 3/3 plans complete

Plans:
- [ ] 24-01-PLAN.md — Wire draft picks: makePick + auto-pick route insert active row into roster_slots (RSLOT-03)
- [ ] 24-02-PLAN.md — Wire drop + transfer: dropRider deletes roster_slots row; approveBid moves row to new team (RSLOT-04, RSLOT-05)
- [ ] 24-03-PLAN.md — Wire IR transitions: approveIrRequest, markEligibleToReturn, returnRider, dropAndReturnRider (RSLOT-06, RSLOT-07, RSLOT-08)

### Phase 25: Read Path Migration & Cleanup
**Goal**: Replace all scattered `draftPicks + irRequests` join-based roster queries with direct reads from `roster_slots`, and remove the dead join code.
**Depends on**: Phase 24 (roster_slots kept in sync by all write paths)
**Requirements**: RSLOT-09, RSLOT-10, RSLOT-11
**Success Criteria** (what must be TRUE):
  1. `getActiveRosterCount` reads from `roster_slots` — no two-query arithmetic
  2. Team roster display (transfer form, roster page) reads from `roster_slots`
  3. Slot-check guards in transfer and IR server actions use `roster_slots` counts
  4. No remaining code computes active roster count by joining `draftPicks` + `irRequests`
**Plans:** 1/2 plans executed

Plans:
- [ ] 25-01-PLAN.md — Migrate getActiveRosterCount + getTeamRoster to read from roster_slots
- [ ] 25-02-PLAN.md — Migrate slot-check guards in submitTransferBid and returnRider to use roster_slots counts

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation & Auth | v1.0 | — | Complete | pre-GSD |
| 2. Admin Backoffice | v1.0 | 4 | Complete | 2026-02-12 |
| 3. League Management | v1.0 | 3/3 | Complete | 2026-02-13 |
| 4. Live Draft System | v1.0 | 4/4 | Complete | 2026-02-13 |
| 5. Scoring & Points | v1.0 | 2/2 | Complete | 2026-02-14 |
| 6. Transfer Market | v1.0 | 4/4 | Complete | 2026-02-14 |
| 7. Strategic Orders | v1.0 | 5/5 | Complete | 2026-02-15 |
| 8. UI Polish & Races | v1.0 | 3/3 | Complete | 2026-02-16 |
| 9. Scoping & UX Fixes | v1.0 | 1/1 | Complete | 2026-02-20 |
| 10. Bug Fixes | v1.1 | 1/1 | Complete | 2026-02-20 |
| 11. Scoring Config | v1.1 | 2/2 | Complete | 2026-02-21 |
| 12. Result Entry | v1.1 | 3/3 | Complete | 2026-02-21 |
| 13. Order Config | v1.1 | 2/2 | Complete | 2026-02-22 |
| 14. Counter Mechanic | v1.1 | 1/1 | Complete | 2026-02-22 |
| 15. Uno-X Order | v1.1 | 3/3 | Complete | 2026-02-22 |
| 16. Rider Profile Page | v1.2 | 2/2 | Complete | 2026-03-02 |
| 17. Team Profile Page | v1.2 | 2/2 | Complete | 2026-03-03 |
| 18. Race Lineup Accordion | v1.2 | — | Complete (quick-5) | 2026-03-06 |
| 19. Season Standings History | v1.2 | 2/2 | Complete | 2026-03-06 |
| 20. IR Foundation & Admin Approval | v1.3 | 3/3 | Complete | 2026-03-06 |
| 21. Drop Rider | v1.3 | 1/1 | Complete | 2026-03-06 |
| 22. IR Return Flow | v1.3 | 3/3 | Complete | 2026-03-07 |
| 23. roster_slots Schema & Migration | v1.4 | 2/2 | Complete | 2026-03-07 |
| 24. Write Path Wiring | 3/3 | Complete    | 2026-03-08 | — |
| 25. Read Path Migration & Cleanup | 1/2 | In Progress|  | — |
