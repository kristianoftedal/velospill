# Roadmap — Velospill (Cycling Fantasy League)

## Milestones

- ✅ **v1.0 Core Platform** — Phases 1-9 (shipped 2026-02-20)
- 🚧 **v1.1 Scoring & Rules Update** — Phases 10-15 (in progress)

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

### 🚧 v1.1 Scoring & Rules Update (In Progress)

**Milestone Goal:** Update scoring rules, order mechanics, and result entry to match the 2026 season ruleset.

#### Phase 10: Bug Fixes

**Goal:** Fix rider filtering bugs that block admin workflows

**Depends on:** Phase 9 (v1.0 complete)

**Requirements:** BUG-01, BUG-02

**Success Criteria** (what must be TRUE):
1. Admin can filter unassigned riders on /riders page and see correct results
2. Admin can select riders for races without SQL query failures
3. Rider selection page queries execute successfully for all race types

**Plans:** 1/1 plans complete

Plans:
- [x] 10-01-PLAN.md — Fix unassigned riders filter and admin results SQL queries (completed 2026-02-20, 114s, 2 commits)

---

#### Phase 11: Scoring Config Update

**Goal:** Update all scoring configuration tables to match 2026 season ruleset

**Depends on:** Phase 10

**Requirements:** SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, SCORE-06, SCORE-07, SCORE-08, SCORE-09, SCORE-10

**Success Criteria** (what must be TRUE):
1. One-day races use new high-priority (20 positions) and low-priority (15 positions) point tables
2. TdF uses distinct stage finish points (12 positions, 15 for 1st) from Giro/Vuelta (10 positions, 12 for 1st)
3. TdF uses distinct sprint points (5 positions, 3/2/2/1/1) from Giro (3 positions x2) and Vuelta (3 positions)
4. TdF uses distinct KOM points (HCx2, HC, 1cat, 2cat, 3/4cat categories) from Giro/Vuelta
5. TdF uses expanded end-of-tour GC (15 positions, 30 for 1st), Giro/Vuelta trimmed to 12 positions
6. Mini tours use updated stage finish (5 for 2nd), KOM (2/1), and end-of-tour (8 GC positions) points
7. GT per-stage combative jersey awards 2 points instead of 1

**Plans:** 2/2 plans complete

Plans:
- [x] 11-01-PLAN.md — Update seed data and create migration script for 2026 scoring config values (completed 2026-02-21, 212s, 2 commits)
- [x] 11-02-PLAN.md — Update scoring preview logic for TdF-specific config resolution (completed 2026-02-21, 110s, 2 commits)

---

#### Phase 12: Result Entry Expansion

**Goal:** Extend admin result entry to support all scoring categories

**Depends on:** Phase 11 (scoring config must be accurate for preview)

**Requirements:** RESULT-01, RESULT-02, RESULT-03, RESULT-04, RESULT-05, RESULT-06

**Success Criteria** (what must be TRUE):
1. Admin can enter sprint classification results per stage and see them in scoring preview
2. Admin can enter mountain/KOM classification results per stage and see them in scoring preview
3. Admin can enter jersey holder results per stage (GC, points, KOM, combative) and see them in scoring preview
4. Admin can enter team time trial (TTT) results and see them in scoring preview
5. Admin can enter end-of-tour classification results (GC, points, KOM, youth, combative, team, other) and see them in scoring preview
6. Scoring preview accurately calculates points for all result categories using race-specific scoring config

**Plans:** 3/3 plans complete

Plans:
- [x] 12-01-PLAN.md — Add category column to raceResults schema and update backend for category-aware scoring (completed 2026-02-21, 170s, 2 commits)
- [x] 12-02-PLAN.md — Add category selector UI and per-stage result entry for sprint, mountain, jersey (completed 2026-02-21, 223s, 2 commits)
- [x] 12-03-PLAN.md — Add TTT team-based entry and end-of-tour classification entry on parent races (completed 2026-02-21, 198s, 2 commits)

---

#### Phase 13: Order Config Updates

**Goal:** Update order multipliers and add new Kaptein order for women's WC

**Depends on:** Phase 12

**Requirements:** ORDER-01, ORDER-02, ORDER-03, ORDER-04, ORDER-05, ORDER-08

**Success Criteria** (what must be TRUE):
1. Blodpose order uses GT-specific multipliers (x3 TdF, x3.5 Giro/Vuelta)
2. Etappeseier order multiplies finish points instead of replacing them (x2 TdF, x2.25 Giro/Vuelta)
3. Hammer order awards 5 points per GC position lost, max 50
4. Lagtempo order awards 10 points per top-20 placement
5. Sponsorens ritt order multiplies end-of-tour points by 3x
6. New Kaptein/laginnsats order exists for women's WC (x2 one rider or x1.5 all)
7. Admin can select and submit all updated orders with correct multipliers

**Plans:** 2 plans (1 complete, 1 pending)

Plans:
- [x] 13-01-PLAN.md — Update order type seed data and create migration script for 2026 multipliers (COMPLETE)
- [ ] 13-02-PLAN.md — Update order effect application logic for new effect types and Kaptein on women's WC

---

#### Phase 14: Counter Mechanic & Return Logic

**Goal:** Change counter mechanic so countered orders return to attacker for reuse

**Depends on:** Phase 13

**Requirements:** ORDER-06

**Success Criteria** (what must be TRUE):
1. When an order is countered, it returns to the attacking team's available orders
2. Countered order does NOT apply bounce-back effect to defending team
3. Returned order can be reused in a future race by the attacking team
4. Admin can see in order history which orders were countered and returned
5. Scoring accurately reflects the return mechanic (no double-counting, no bounce-back points)

**Plans:** TBD

Plans:
- [ ] 14-01: TBD during phase planning

---

#### Phase 15: Uno-X Order Feature

**Goal:** Implement new Uno-X order with reverse standings draft for bonus GT riders

**Depends on:** Phase 14 (all other orders must work correctly)

**Requirements:** ORDER-07

**Success Criteria** (what must be TRUE):
1. Teams can submit Uno-X order for any Grand Tour race
2. When activated, each team picks one bonus rider from the unowned rider pool
3. Draft order is reverse standings (last place picks first, first place picks last)
4. Bonus riders score points only for the specific GT they were picked for
5. Bonus riders do NOT count against team roster limits
6. Admin can see which bonus riders were picked per team per GT

**Plans:** TBD

Plans:
- [ ] 15-01: TBD during phase planning

---

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
| 13. Order Config | v1.1 | 0/2 | Not started | — |
| 14. Counter Mechanic | v1.1 | 0/TBD | Not started | — |
| 15. Uno-X Order | v1.1 | 0/TBD | Not started | — |
