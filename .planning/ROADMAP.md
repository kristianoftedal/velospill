# Roadmap — Velospill (Cycling Fantasy League)

## Milestones

- ✅ **v1.0 Core Platform** — Phases 1-9 (shipped 2026-02-20)
- ✅ **v1.1 Scoring & Rules Update** — Phases 10-15 (shipped 2026-02-26)
- 🔄 **v1.2 Player Visibility** — Phases 16-19 (in progress)

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

### v1.2 Player Visibility (Phases 16-19)

- [x] **Phase 16: Rider Profile Page** — Season stats, per-race breakdown, categories, and ownership history for any rider (completed 2026-03-02)
- [ ] **Phase 17: Team Profile Page** — Full squad roster with per-rider scoring contribution per race
- [ ] **Phase 18: Race Lineup Accordion** — Expandable per-race lineup panel on the league page, showing teams' picks and post-result points
- [ ] **Phase 19: Season Standings History** — Cumulative points chart and race-by-race breakdown table on the league page

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
**Plans**: TBD

### Phase 18: Race Lineup Accordion
**Goal**: Players can see all teams' race-day selections directly from the league race list, and after results are posted, each rider's earned points are shown alongside their name.
**Depends on**: Phase 3 (league page), Phase 5 (scoring engine)
**Requirements**: LINEUP-01, LINEUP-02, LINEUP-03
**Success Criteria** (what must be TRUE):
  1. Each race in the league race list has an expandable accordion that a player can open
  2. Once lineups are submitted, the expanded accordion shows each team's selected riders for that race
  3. After race results are posted, the accordion shows each selected rider's earned points next to their name
**Plans**: TBD

### Phase 19: Season Standings History
**Goal**: Players can see the full competitive narrative of the season — how teams have accumulated points across every race, both as a chart and as a detailed table.
**Depends on**: Phase 5 (scoring engine), Phase 3 (league page)
**Requirements**: HISTORY-01, HISTORY-02
**Success Criteria** (what must be TRUE):
  1. League page displays a line chart showing cumulative points per team across all completed races
  2. League page displays a race-by-race table with each team's points per individual race
  3. The table includes running totals so a player can see the exact standings at any point in the season
**Plans**: TBD

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
| 16. Rider Profile Page | 2/2 | Complete    | 2026-03-02 | — |
| 17. Team Profile Page | v1.2 | 0/? | Not started | — |
| 18. Race Lineup Accordion | v1.2 | 0/? | Not started | — |
| 19. Season Standings History | v1.2 | 0/? | Not started | — |
