# Requirements: Velospill v1.0

## Validated

- [x] AUTH: User can create account with email/password and log in — v1.0
- [x] AUTH: User session persists across browser refresh, user can log out — v1.0
- [x] AUTH: Protected routes redirect unauthenticated users to login — v1.0
- [x] AUTH: Admin role with role-based access control — v1.0
- [x] RIDERS: Admin can add riders with name, team, nationality, gender — v1.0
- [x] RACES: Admin can create race calendar entries with dates and categories — v1.0
- [x] RACES: Database supports data-driven scoring configuration — v1.0
- [x] RESULTS: Admin can enter race results with context-aware validation — v1.0
- [x] RESULTS: Admin can preview scoring impact before committing results — v1.0
- [x] RESULTS: Admin can correct results with audit trail and score recalculation — v1.0
- [x] LEAGUE: User can create a new league with name and configuration — v1.0
- [x] LEAGUE: League generates shareable invite link (2-10 teams) — v1.0
- [x] LEAGUE: User can join via invite link and create team name — v1.0
- [x] LEAGUE: League transitions through lifecycle states (setup > drafting > active > complete) — v1.0
- [x] DRAFT: All participants see draft updates in real-time via Pusher — v1.0
- [x] DRAFT: Snake order (1-N-N-1) for men (18 rounds) and women (6 rounds) — v1.0
- [x] DRAFT: Active drafter can search/filter riders and pick with countdown timer — v1.0
- [x] DRAFT: Draft board displays picks in grid, auto-picks on timer expiry — v1.0
- [x] DRAFT: State persists in DB, reconnecting users see current state — v1.0
- [x] DRAFT: Active drafter receives "your turn" notification — v1.0
- [x] DRAFT: Draft recap shows each team's full roster after completion — v1.0
- [x] SCORING: Team score aggregation from individual rider performances — v1.0
- [x] SCORING: League standings and leaderboard with tabbed UI — v1.0
- [x] SCORING: Per-race score breakdown showing drafted rider contributions — v1.0
- [x] SCORING: Season-long cumulative scoring scoped via league config — v1.0
- [x] TRANSFER: Waiver wire bids (drop one rider, pick up free agent, same gender) — v1.0
- [x] TRANSFER: Auto-generated transfer windows from race calendar — v1.0
- [x] TRANSFER: Priority resolution (lowest-points team wins) — v1.0
- [x] TRANSFER: Ownership-at-race-time (historical points stay with original team) — v1.0
- [x] TRANSFER: Admin approval/rejection with transactional roster mutation — v1.0
- [x] ORDERS: User can submit one order per race via multi-step form — v1.0
- [x] ORDERS: System validates order eligibility (race type, target validity) — v1.0
- [x] ORDERS: All 12 order types handled (multipliers, zero-points, kaptein, etc.) — v1.0
- [x] ORDERS: Counter mechanic (Shimanobil/COVID countered by Etappeseier/Blodpose) — v1.0
- [x] ORDERS: Admin validation with approve/reject and bonus points — v1.0
- [x] ORDERS: Scoring integration with order-adjusted standings — v1.0
- [x] ADMIN-RACES: League owners can select which races apply to their league — v1.0
- [x] ADMIN-RACES: All downstream features scoped to league-assigned races — v1.0

## Active

(None — v1.0 complete)

## Out of Scope

- Mobile native app — web-first approach
- Lineup management per race (deferred from original Phase 5 scope)
- Transfer budget system (simplified to waiver wire priority)
- Real-time WebSocket server (using Pusher serverless instead)
- Automated scoring from external API (admin enters results manually)
