# Milestones

## v1.2 Player Visibility (Shipped: 2026-03-06)

**Phases completed:** 4 phases, 6 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---

## v1.0 Core Platform (Shipped: 2026-02-20)

**Phases completed:** 9 phases, 26 plans
**Timeline:** 11 days (2026-02-09 → 2026-02-20)
**Codebase:** 126 TypeScript files, 20,924 LOC

**Key accomplishments:**
- Full-stack cycling fantasy league platform (Next.js 16, PostgreSQL/Neon, Drizzle ORM, BetterAuth, Pusher)
- Private league system with nanoid invite codes, team registration, and lifecycle state machine
- Real-time snake draft with Pusher presence channels, QStash auto-pick timers, and auto-activation on completion
- Scoring engine with on-demand SQL aggregation, order-adjusted standings, per-race breakdowns, and ownership-at-race-time transfer attribution
- Strategic orders system with 12 order types, counter mechanics, admin validation, and full scoring integration
- League-scoped race calendar where owners assign races and all downstream features (scoring, transfers, orders, lineup) scope accordingly

**Tech debt deferred:**
- Phase 2 category/subcategory result entry (7 items → Phase 10 scope)
- Phase 7 order auto-calculation (2 items → Phase 11 scope)
- Phase 4 missing formal VERIFICATION.md
- Phase 6 schema/DB index divergence (documented, no runtime impact)

---


## v1.1 Scoring & Rules Update (Shipped: 2026-02-26)

**Phases completed:** 6 phases, 12 plans, 18 tasks
**Timeline:** 6 days (2026-02-20 → 2026-02-26)
**Codebase:** ~23,760 LOC TypeScript

**Key accomplishments:**
- Updated all scoring configuration to 2026 season ruleset — TdF-specific stage finish, sprint, KOM, and end-of-tour point tables separate from Giro/Vuelta
- Extended admin result entry to support all scoring categories: sprint classification, mountain/KOM, jersey holders (GC/points/KOM/combative), TTT team results, and end-of-tour classifications
- Revamped order mechanics — Blodpose GT-specific multipliers, Etappeseier changed to multiply finish points, Hammer/Lagtempo/Sponsorens ritt updated to 2026 values
- Changed counter mechanic so countered orders return to the attacker for reuse (removed blowback effect)
- Added Kaptein/laginnsats order for women's WC (x2 one rider or x1.5 all)
- Implemented Uno-X bonus rider order — per-GT reverse-standings draft from unowned pool with dedicated schema, scoring integration, and admin + team UI

**Known gaps (accepted):**
- RESULT-01 through RESULT-06: Phase 12 VERIFICATION.md never created; code is implemented and integration-verified but formal verification skipped

**Tech debt deferred:**
- DEBT-01: drizzle-kit 0.18.x type error breaks npm run build
- DEBT-02 to DEBT-04: Hammer/Innlagt Spurt/Lagtempo order auto-calculation (currently admin-entered)
- DEBT-05: Shimanobil counter full team matching logic (simplified)
- Minor: grand_tour_tdf enum type mismatch, duplicate resolveScoringRaceType()

---

