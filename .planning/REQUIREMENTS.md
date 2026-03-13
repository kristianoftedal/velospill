# Requirements: Velospill

**Defined:** 2026-03-11
**Core Value:** The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.

## v1.5 Requirements

### Admin Result Entry (ADMRS)

- [x] **ADMRS-01**: Admin result list for a stage shows only results belonging to that stage (scoped by raceId, not all stages of the same type)
- [x] **ADMRS-02**: Admin can see at a glance which stages within a multi-stage race have results entered vs. pending

### League Stage Visibility (SVIS)

- [x] **SVIS-01**: Multi-stage race rows in league standings are expandable to reveal individual stages
- [x] **SVIS-02**: Each expanded stage shows the riders who scored and their points for that stage
- [x] **SVIS-03**: End-of-tour results (GC, points jersey, KOM, etc.) are visible within the expanded grand tour view

## Future Requirements

### Admin
- **ADMRS-F01**: Bulk stage result import from external sources

## Out of Scope

| Feature | Reason |
|---------|--------|
| Scoring calculation changes | Calculation is correct; display only |
| Stage lineup management | Lineups already work at parent race level |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ADMRS-01 | Phase 26 | Complete |
| ADMRS-02 | Phase 26 | Complete |
| SVIS-01 | Phase 27 | Complete |
| SVIS-02 | Phase 27 | Complete |
| SVIS-03 | Phase 27 | Complete |

**Coverage:**
- v1.5 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after roadmap creation*
