# Requirements: Velospill

**Defined:** 2026-02-26
**Core Value:** The live competitive experience of managing a fantasy cycling team through a real season — drafting riders, making tactical decisions per race, and outscoring your friends.

## v1.2 Requirements

Requirements for the Player Visibility milestone. Each maps to roadmap phases.

### Rider Profiles

- [ ] **RIDER-01**: Player can view a rider's season stats page showing total points earned this season
- [ ] **RIDER-02**: Rider stats page shows per-race points breakdown (which races they scored in and how much)
- [ ] **RIDER-03**: Rider stats page shows which scoring categories contributed points per race (finish, sprint, mountain, jersey, etc.)
- [ ] **RIDER-04**: Rider stats page shows ownership history (which team(s) held this rider and when)

### Race Lineups

- [ ] **LINEUP-01**: League race list shows an expandable accordion for each race
- [ ] **LINEUP-02**: Accordion shows all teams' submitted lineups for that race once they are set
- [ ] **LINEUP-03**: Once results are posted, the lineup accordion shows each rider's points alongside their name

### Season Standings History

- [ ] **HISTORY-01**: League page shows a chart of cumulative points per team across all completed races
- [ ] **HISTORY-02**: League page shows a race-by-race breakdown table with each team's points per race and running totals

### Team Profiles

- [ ] **TEAM-01**: Player can view any team's full squad roster (all drafted riders)
- [ ] **TEAM-02**: Team profile shows each rider's points contribution per race this season

## Future Requirements

### Tech Debt (deferred from v1.1)

- **DEBT-01**: Fix drizzle-kit 0.18.x type error that breaks npm run build
- **DEBT-02**: Hammer order auto-calculation from GC standings (currently admin-entered)
- **DEBT-03**: Innlagt Spurt order auto-calculation from sprint results (currently admin-entered)
- **DEBT-04**: Lagtempo order auto-calculation from team placements (currently admin-entered)
- **DEBT-05**: Shimanobil counter full team matching logic (currently simplified)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cross-season rider history | This season's data is sufficient for v1.2; multi-season requires data model changes |
| Real-world UCI stats integration | External data dependency, adds significant complexity |
| Notifications | Not part of visibility milestone |
| Mobile app | Web-first platform |
| Order auto-calculation (Hammer, Innlagt Spurt, Lagtempo) | Deferred to future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RIDER-01 | — | Pending |
| RIDER-02 | — | Pending |
| RIDER-03 | — | Pending |
| RIDER-04 | — | Pending |
| LINEUP-01 | — | Pending |
| LINEUP-02 | — | Pending |
| LINEUP-03 | — | Pending |
| HISTORY-01 | — | Pending |
| HISTORY-02 | — | Pending |
| TEAM-01 | — | Pending |
| TEAM-02 | — | Pending |

**Coverage:**
- v1.2 requirements: 11 total
- Mapped to phases: 0 (roadmap not yet created)
- Unmapped: 11 ⚠️

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*
