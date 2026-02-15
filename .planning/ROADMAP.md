# Roadmap — Velospill (Cycling Fantasy League)

## Milestone 1: Core Platform

### Phase 1: Foundation & Authentication
- [x] **Goal:** Set up project foundation with Next.js, database, authentication, and base UI components
- Project scaffolding (Next.js 16, TypeScript, Tailwind CSS, shadcn/ui)
- PostgreSQL database via Neon with Drizzle ORM
- Better Auth integration for user authentication
- Base layout, navigation, and routing structure
- Rider and race data models

### Phase 2: Admin Backoffice & Race Calendar
- [x] **Goal:** Enable race result entry, scoring preview, transfer bid management, and result correction with audit trails
- Race result entry with React Hook Form field arrays
- Scoring preview using Drizzle transactions with RETURNING
- Transfer bid management interface
- Result correction with audit trail (JSONB diffs)
- Admin dashboard and data tables with TanStack Table

### Phase 3: League Management
- [x] **Goal:** Implement private league creation with shareable invite links, team registration, and lifecycle management
- League creation with configuration (draft date, season year, team limits)
- Shareable invite links with nanoid codes, expiration, and usage limits
- Team name registration with per-league uniqueness
- League lifecycle states: setup → drafting → active → complete
- Multi-tenant data isolation via league_id scoping

### Phase 4: Live Draft System
- [x] **Goal:** Build real-time snake draft with live picks, auto-pick timers, and draft recap
- Real-time communication via Pusher Channels (presence channels)
- Snake draft algorithm (men's 18 rounds + women's 6 rounds)
- Server-authoritative countdown timers with QStash auto-pick
- Draft room UI with rider picker, draft board, and team rosters
- Reconnection state synchronization
- Post-draft recap view

### Phase 5: Scoring & Points System
- [x] **Goal:** Calculate fantasy points from race results, update team standings, and display league leaderboards
- **Plans:** 2 plans
- Team score aggregation from individual rider performances (on-demand SQL aggregation)
- League standings and leaderboard views with tabbed UI (Leaderboard / My Team / Race Results)
- Per-race score breakdown showing drafted rider contributions per team
- Season-long cumulative scoring scoped via league config seasonYear

Plans:
- [x] 05-01-PLAN.md — Scoring queries library + standings leaderboard page with My Team tab
- [x] 05-02-PLAN.md — Per-race score breakdown, Race Results tab, league page integration

### Phase 6: Transfer Market
- [x] **Goal:** Implement a waiver wire transfer system where teams bid for free agents, with priority by standings, ownership-at-race-time scoring, auto-generated transfer windows, and admin approval
- **Plans:** 4 plans — Completed 2026-02-14
- **Depends on:** Phase 5
- Waiver wire bids: drop one rider, pick up a free agent (same gender pool)
- Transfer windows auto-generated from race calendar with admin override
- Priority resolution: lowest-points team wins conflicting bids
- Ownership-at-race-time: historical points stay with original team after transfer
- Admin approval/rejection with transactional roster mutation and audit trail

Plans:
- [x] 06-01-PLAN.md — Transfer schema, migration, and scoring queries update for ownership-at-race-time
- [x] 06-02-PLAN.md — Transfer queries library and team-facing bid submission UI
- [x] 06-03-PLAN.md — Admin transfer management UI with approve/reject actions
- [x] 06-04-PLAN.md — Waiver wire priority resolution, auto-window generation, and league page integration

### Phase 7: Strategic Orders & Scoring Integration
- [ ] **Goal:** Implement strategic orders system where users deploy orders to boost riders or sabotage opponents, with counter mechanics, admin validation, and full scoring integration
- **Plans:** 5 plans (4 complete + 1 gap closure)
- **Depends on:** Phase 6
- Orders table schema for submitted order instances (referencing existing orderTypes)
- User-facing order submission with multi-step form (race > order type > target > confirm)
- Validation: race type compatibility, one-per-team-per-race, target validity, WC restriction
- Admin order validation with approve/reject, bonus points for complex orders
- Counter mechanic: Shimanobil/COVID countered by Etappeseier/Blodpose (blowback to attacker)
- Scoring integration: order-adjusted standings, per-race breakdown annotations
- All 12 order types handled (multipliers, zero-points, half-points, kaptein, gammel_venn, etc.)

Plans:
- [x] 07-01-PLAN.md — Orders schema, migration, and barrel export
- [x] 07-02-PLAN.md — Order queries library, submission UI, and league page integration
- [x] 07-03-PLAN.md — Admin order validation with approve/reject and bonus points
- [x] 07-04-PLAN.md — Scoring integration, counter mechanic resolution, and race breakdown annotations
- [ ] 07-05-PLAN.md — Gap closure: propagate riderNationality for Kaptein country_all variant
