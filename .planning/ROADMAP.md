# Roadmap — Velospill (Cycling Fantasy League)

## Milestones

- ✅ **v1.0 Core Platform** — Phases 1-9 (shipped 2026-02-20)
- ✅ **v1.1 Scoring & Rules Update** — Phases 10-15 (shipped 2026-02-26)
- ✅ **v1.2 Player Visibility** — Phases 16-19 (shipped 2026-03-06)
- ✅ **v1.3 IR List & Roster Management** — Phases 20-22 (shipped 2026-03-07)
- ✅ **v1.4 Roster Consolidation** — Phases 23-25 (shipped 2026-03-09)
- 🔄 **v1.5 Multi-Stage Race Improvements** — Phases 26-27 (in progress)

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

- [x] Phase 16: Rider Profile Page (2 plans) — completed 2026-03-02
- [x] Phase 17: Team Profile Page (2 plans) — completed 2026-03-03
- [x] Phase 18: Race Lineup Accordion — completed 2026-03-06 via quick task
- [x] Phase 19: Season Standings History (2 plans) — completed 2026-03-06

Full details: milestones/v1.2-ROADMAP.md

</details>

<details>
<summary>✅ v1.3 IR List & Roster Management (Phases 20-22) — SHIPPED 2026-03-07</summary>

- [x] Phase 20: IR Foundation & Admin Approval (3 plans) — completed 2026-03-06
- [x] Phase 21: Drop Rider (1 plan) — completed 2026-03-06
- [x] Phase 22: IR Return Flow (3 plans) — completed 2026-03-07

Full details: milestones/v1.3-ROADMAP.md

</details>

<details>
<summary>✅ v1.4 Roster Consolidation (Phases 23-25) — SHIPPED 2026-03-09</summary>

- [x] Phase 23: roster_slots Schema & Migration (2 plans) — completed 2026-03-07
- [x] Phase 24: Write Path Wiring (3 plans) — completed 2026-03-08
- [x] Phase 25: Read Path Migration & Cleanup (2 plans) — completed 2026-03-09

Full details: milestones/v1.4-ROADMAP.md

</details>

### v1.5 Multi-Stage Race Improvements

- [x] **Phase 26: Admin Stage Result Scoping** — Fix stage result list to scope by raceId and add stage completion status overview (completed 2026-03-12)
- [x] **Phase 27: League Stage Visibility** — Expandable multi-stage race rows on league standings with per-stage and end-of-tour scoring (completed 2026-03-13)

## Phase Details

### Phase 26: Admin Stage Result Scoping
**Goal**: Admin can manage results for individual stages correctly — viewing only the results that belong to a given stage and knowing at a glance which stages still need results entered
**Depends on**: Nothing (first phase of v1.5)
**Requirements**: ADMRS-01, ADMRS-02
**Success Criteria** (what must be TRUE):
  1. When admin opens a stage result list, only results for that specific stage (raceId) appear — no bleed-through from other stages of the same type
  2. Admin can see a list of all stages within a multi-stage race where each stage is clearly marked as having results entered or pending
  3. Admin can navigate directly to a pending stage to begin entering results
**Plans**: 2 plans

Plans:
- [ ] 26-01-PLAN.md — Extend getRacesForResults with stage completion counts (data layer)
- [ ] 26-02-PLAN.md — Stage overview modal, sidebar completion counts, prev/next navigation (UI layer)

### Phase 27: League Stage Visibility
**Goal**: Players on the league standings page can expand a multi-stage race row to see per-stage scoring breakdowns and end-of-tour classification results
**Depends on**: Phase 26
**Requirements**: SVIS-01, SVIS-02, SVIS-03
**Success Criteria** (what must be TRUE):
  1. Multi-stage race rows on the league standings page have an expand control that reveals individual stage rows
  2. Each expanded stage row shows the riders who scored points for that stage and how many points they earned
  3. End-of-tour classifications (GC, points jersey, KOM, etc.) are visible within the expanded grand tour view as a distinct section
  4. Collapsing the row returns the standings to the normal compact view
**Plans**: 2 plans

Plans:
- [ ] 27-01-PLAN.md — Extend getLeagueRacesWithScores with structured parent+stages data (data layer)
- [ ] 27-02-PLAN.md — Expandable multi-stage race rows in Race Results tab (UI layer)

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
| 18. Race Lineup Accordion | v1.2 | — | Complete | 2026-03-06 |
| 19. Season Standings History | v1.2 | 2/2 | Complete | 2026-03-06 |
| 20. IR Foundation & Admin Approval | v1.3 | 3/3 | Complete | 2026-03-06 |
| 21. Drop Rider | v1.3 | 1/1 | Complete | 2026-03-06 |
| 22. IR Return Flow | v1.3 | 3/3 | Complete | 2026-03-07 |
| 23. roster_slots Schema & Migration | v1.4 | 2/2 | Complete | 2026-03-07 |
| 24. Write Path Wiring | v1.4 | 3/3 | Complete | 2026-03-08 |
| 25. Read Path Migration & Cleanup | v1.4 | 2/2 | Complete | 2026-03-09 |
| 26. Admin Stage Result Scoping | 2/2 | Complete   | 2026-03-12 | - |
| 27. League Stage Visibility | 2/2 | Complete   | 2026-03-13 | - |
