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
