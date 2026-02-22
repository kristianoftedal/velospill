# Requirements: Velospill

**Defined:** 2026-02-20
**Core Value:** The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.

## v1.1 Requirements

Requirements for the Scoring & Rules Update milestone. Each maps to roadmap phases.

### Scoring Config

- [x] **SCORE-01**: Scoring config updated with new one-day race point tables (high pri: 50/40/35/30/25/20/18/16/14/12/10/9/8/7/6/5/4/3/2/1, low pri: 30/25/20/16/14/12/10/8/7/6/5/4/3/2/1)
- [x] **SCORE-02**: Scoring engine uses TdF-specific stage finish points (15/12/10/9/8/7/6/5/4/3/2/1 for 12 positions) separate from Giro/Vuelta (12/10/8/7/6/5/4/3/2/1 for 10 positions)
- [x] **SCORE-03**: Scoring engine uses TdF-specific sprint points (3/2/2/1/1) separate from Giro (2/1/1 x2) and Vuelta (2/1/1)
- [x] **SCORE-04**: Scoring engine uses TdF-specific KOM points (HCx2: 4/3/2/2/1/1, HC: 4/3/2/1, 1cat: 3/2/1, 2cat: 2/1, 3/4cat: 1) separate from Giro/Vuelta (unchanged)
- [x] **SCORE-05**: Scoring engine uses TdF-specific end-of-tour points (GC: 30/25/20/16/14/12/10/8/7/6/5/4/3/2/1, Points/KOM: 15/10/8/6/4/2, Youth: 6/4/2, Team: 6/4/2)
- [x] **SCORE-06**: Giro/Vuelta end-of-tour GC trimmed to 12 positions (25/20/16/14/12/10/8/6/4/3/2/1), youth and team adjusted to 5/3/1
- [x] **SCORE-07**: GT per-stage combative jersey points updated from 1 to 2
- [x] **SCORE-08**: Mini tour stage finish 2nd place updated from 4 to 5 points
- [x] **SCORE-09**: Mini tour highest KOM category updated from 1/1 to 2/1
- [x] **SCORE-10**: Mini tour end-of-tour GC extended to 8 positions (8/6/4/3/2/2/1/1), end points/KOM adjusted to 4/2/1, youth/combative/team to 2

### Orders

- [x] **ORDER-01**: Blodpose GT multiplier split — x3 for TdF, x3.5 for Giro/Vuelta
- [x] **ORDER-02**: Etappeseier changed to multiply finish points — x2 TdF, x2.25 Giro/Vuelta (all own riders)
- [x] **ORDER-03**: Hammer updated to 5 points per GC position lost, max 50
- [x] **ORDER-04**: Lagtempo updated to 10 points per top-20 placement
- [x] **ORDER-05**: Sponsorens ritt updated to 3x end-of-tour points
- [x] **ORDER-06**: Counter mechanic changed — countered order returns to attacker for reuse instead of bounce-back effect
- [x] **ORDER-07**: New Uno-X order — each team picks a bonus rider per GT from unowned pool, reverse standings draft order
- [x] **ORDER-08**: New Kaptein/laginnsats for women's WC (x2 one rider or x1.5 all)

### Result Entry

- [ ] **RESULT-01**: Admin can enter sprint classification results per stage
- [ ] **RESULT-02**: Admin can enter mountain/KOM classification results per stage
- [ ] **RESULT-03**: Admin can enter jersey holder results per stage (GC, points, KOM, combative)
- [ ] **RESULT-04**: Admin can enter TTT results
- [ ] **RESULT-05**: Admin can enter end-of-tour classification results (GC, points, KOM, youth, combative, team, other)
- [ ] **RESULT-06**: Scoring preview works for all result categories (not just finish/stage_finish)

### Bug Fixes

- [x] **BUG-01**: Unassigned riders filter on /riders page returns correct results instead of empty list
- [x] **BUG-02**: Rider selection page for races has working SQL queries that don't fail

## Future Requirements

### Tech Debt (deferred)

- **DEBT-01**: Fix drizzle-kit 0.18.x type error that breaks npm run build
- **DEBT-02**: Hammer order auto-calculation from GC standings (currently admin-entered)
- **DEBT-03**: Innlagt Spurt order auto-calculation from sprint results (currently admin-entered)
- **DEBT-04**: Lagtempo order auto-calculation from team placements (currently admin-entered)
- **DEBT-05**: Shimanobil counter full team matching logic (currently simplified)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Order auto-calculation (Hammer, Innlagt Spurt, Lagtempo) | Complex, admin-entered approach works, defer to future |
| Mobile app | Web-first platform |
| Real-time notifications | Not part of scoring/rules update |
| New race types beyond existing categories | Current race types sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 10 | Complete |
| BUG-02 | Phase 10 | Complete |
| SCORE-01 | Phase 11 | Complete |
| SCORE-02 | Phase 11 | Complete |
| SCORE-03 | Phase 11 | Complete |
| SCORE-04 | Phase 11 | Complete |
| SCORE-05 | Phase 11 | Complete |
| SCORE-06 | Phase 11 | Complete |
| SCORE-07 | Phase 11 | Complete |
| SCORE-08 | Phase 11 | Complete |
| SCORE-09 | Phase 11 | Complete |
| SCORE-10 | Phase 11 | Complete |
| RESULT-01 | Phase 12 | Pending |
| RESULT-02 | Phase 12 | Pending |
| RESULT-03 | Phase 12 | Pending |
| RESULT-04 | Phase 12 | Pending |
| RESULT-05 | Phase 12 | Pending |
| RESULT-06 | Phase 12 | Pending |
| ORDER-01 | Phase 13 | Satisfied (13-01) |
| ORDER-02 | Phase 13 | Satisfied (13-01) |
| ORDER-03 | Phase 13 | Satisfied (13-01) |
| ORDER-04 | Phase 13 | Satisfied (13-01) |
| ORDER-05 | Phase 13 | Satisfied (13-01) |
| ORDER-08 | Phase 13 | Satisfied (13-01) |
| ORDER-06 | Phase 14 | Complete |
| ORDER-07 | Phase 15 | Complete |

**Coverage:**
- v1.1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after roadmap creation*
