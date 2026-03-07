# Requirements: Velospill

**Defined:** 2026-03-07
**Core Value:** The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.

## v1.4 Requirements

Requirements for the Roster Consolidation milestone. Each maps to a roadmap phase.

### Schema

- [ ] **RSLOT-01**: A `roster_slots` table exists as the single source of truth for current team composition, with columns for league, team, rider, and status (active / on_ir / return_eligible)
- [ ] **RSLOT-02**: Existing live data is backfilled into `roster_slots` from current `draftPicks` and `irRequests` records

### Write Paths

- [ ] **RSLOT-03**: When a player makes a draft pick, a row is inserted into `roster_slots` with status `active`
- [ ] **RSLOT-04**: When a player drops a rider, their `roster_slots` row is removed
- [ ] **RSLOT-05**: When a transfer is approved, the rider's `roster_slots` row moves to the new team
- [ ] **RSLOT-06**: When an IR request is approved, the rider's `roster_slots` status becomes `on_ir`
- [ ] **RSLOT-07**: When an admin marks a rider return-eligible, the `roster_slots` status becomes `return_eligible`
- [ ] **RSLOT-08**: When a player returns an IR rider, the `roster_slots` status becomes `active`

### Read Paths

- [ ] **RSLOT-09**: `getActiveRosterCount` reads directly from `roster_slots` — no more two-query arithmetic across `draftPicks` and `irRequests`
- [ ] **RSLOT-10**: Team roster display reads from `roster_slots` instead of joining `draftPicks` + `irRequests`
- [ ] **RSLOT-11**: All slot-check guards in server actions (transfer bids, IR requests) use `roster_slots` counts

## Out of Scope

| Feature | Reason |
|---------|--------|
| Scoring query changes | Scoring uses `draftPicks.pickedAt` for ownership-at-race-time — must stay unchanged |
| Rider history / ownership log | `draftPicks` remains the historical record; this milestone adds current-state only |
| UI changes | Pure backend refactor — no visible user-facing changes |
| order-queries.ts roster reads | Order queries use draftPicks for historical context; deferred unless clearly broken |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RSLOT-01 | Phase 23 | Pending |
| RSLOT-02 | Phase 23 | Pending |
| RSLOT-03 | Phase 24 | Pending |
| RSLOT-04 | Phase 24 | Pending |
| RSLOT-05 | Phase 24 | Pending |
| RSLOT-06 | Phase 24 | Pending |
| RSLOT-07 | Phase 24 | Pending |
| RSLOT-08 | Phase 24 | Pending |
| RSLOT-09 | Phase 25 | Pending |
| RSLOT-10 | Phase 25 | Pending |
| RSLOT-11 | Phase 25 | Pending |

**Coverage:**
- v1.4 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
