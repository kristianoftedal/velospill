# Roadmap — Velospill (Cycling Fantasy League)

## Milestones

- ✅ **v1.0 Core Platform** — Phases 1-9 (shipped 2026-02-20)

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

### Backlog (Deferred from v1.0 audit)

#### Phase 10: Result Entry & Scoring Improvements
- [ ] **Goal:** Extend result entry to support full category/subcategory scoring with cascade recalculation
- **Plans:** TBD
- **Gap Closure:** Phase 2 tech debt
- Add category/subcategory columns to raceResults schema
- Update uniqueRaceRider constraint to allow same rider in multiple categories per race
- Extend scoring preview to handle all result categories (sprints, mountains, jerseys)
- Implement cascade recalculation on corrections (position shifts cascade to other results)
- Consider genericizing resultAudit to auditLog pattern

#### Phase 11: Order System Improvements
- [ ] **Goal:** Improve order accuracy with proper rider-ownership lookups and auto-calculation for complex orders
- **Plans:** TBD
- **Gap Closure:** Phase 7 tech debt
- Store targetTeamId at order submission for proper Shimanobil counter ownership lookup
- Auto-calculate Hammer points from GC position changes (replace admin-entered bonusPoints)
- Auto-calculate Innlagt Spurt points from intermediate sprint results
- Auto-calculate Lagtempo points from team top-20 placements

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
| 10. Result Entry | backlog | TBD | Not started | — |
| 11. Order Improvements | backlog | TBD | Not started | — |
