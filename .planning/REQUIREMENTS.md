# Requirements: Velospill

**Defined:** 2026-03-06
**Core Value:** The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.

## v1.3 Requirements

### Injured Reserve (IR)

- [x] **IR-01**: Player can request to place a rider on IR (max 2 IR slots per team)
- [x] **IR-02**: Player can view their current IR slots and which riders occupy them
- [x] **IR-03**: Admin can view a queue of pending IR placement requests
- [x] **IR-04**: Admin can approve or reject an IR placement request
- [x] **IR-05**: Approved IR riders do not count against the active roster limit, freeing a slot for a waiver wire pickup
- [x] **IR-06**: Player can use the freed slot to submit a waiver wire pickup request
- [x] **IR-07**: Admin can mark an IR rider as eligible to return
- [x] **IR-08**: Player sees an in-app banner when one of their IR riders is marked eligible to return
- [x] **IR-09**: Player is blocked from making transfers while they have a rider eligible to return
- [x] **IR-10**: Player can return an eligible rider from IR to their active roster
- [x] **IR-11**: If the active roster is full when returning, player must drop a rider to make room first

### Roster Management

- [x] **ROST-01**: Player can drop any rider from their roster instantly (no admin approval, no waiver period)

## Future Requirements

_(None defined yet)_

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email notifications for IR events | In-app banners only per design decision |
| IR time limits / expiry | Admin monitors manually, no automated expiry |
| IR for bonus riders (Uno-X) | Bonus riders have separate lifecycle, deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| IR-01 | Phase 20 | Complete |
| IR-02 | Phase 20 | Complete |
| IR-03 | Phase 20 | Complete |
| IR-04 | Phase 20 | Complete |
| IR-05 | Phase 20 | Complete |
| IR-06 | Phase 22 | Complete |
| IR-07 | Phase 22 | Complete |
| IR-08 | Phase 22 | Complete |
| IR-09 | Phase 22 | Complete |
| IR-10 | Phase 22 | Complete |
| IR-11 | Phase 22 | Complete |
| ROST-01 | Phase 21 | Complete |

**Coverage:**
- v1.3 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 — traceability populated during v1.3 roadmap creation*
