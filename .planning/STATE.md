# GSD State

## Current Position

- **Phase:** 07-orders-polish-integration
- **Current Plan:** 01 Complete
- **Status:** In Progress
- **Last session:** 2026-02-14T13:51:39Z
- **Stopped at:** Completed 07-01-PLAN.md

## Progress

```
Phase 05: [########] 2/2 plans complete ✓
Phase 06: [########] 4/4 plans complete ✓
Phase 07: [##......] 1/4 plans complete
```

Plans complete: 05-01, 05-02, 06-01, 06-02, 06-03, 06-04, 07-01
Plans remaining: 07-02, 07-03, 07-04

## Decisions

1. **03-01:** serial("id").primaryKey() used to match existing races.ts pattern (not generatedAlwaysAsIdentity)
2. **03-01:** uniqueIndex() for composite unique constraints on teams table (leagueId+userId, leagueId+name)
3. **03-01:** JSONB config typed with $type<LeagueConfig>() for compile-time safety
4. **03-01:** league-auth.ts imports from @/db/schema/leagues (not @/db/schema) to avoid circular imports
5. **03-02:** JoinForm extracted to join-form.tsx for clean "use client" separation from server page
6. **03-02:** joinLeague re-validates invite server-side to prevent stale client state attacks
7. **03-02:** validateInvite joins user table in a single query rather than separate owner name lookup
8. **03-02:** Zod v4 does not support invalid_type_error on z.number() - removed during execution
9. **04-01:** drizzle-kit 0.18.x incompatible with drizzle-orm 0.45.x — migrations applied via direct SQL (ongoing workaround)
10. **04-01:** Women's snake draft order resets independently from round 0 (not continuing men's absolute round count)
11. **04-01:** Pusher presence channel auth validates both session AND league membership before authorizing
12. **04-01:** draftSessions.leagueId is UNIQUE — one draft session per league enforced at DB level
13. **04-02:** computeNextDraftState extracted to draft-queries.ts to share pick-advancing logic between makePick and auto-pick
14. **04-02:** QStash Client dynamically imported in auto-pick route to avoid module-load instantiation
15. **04-03:** DraftRoom maps "paused" status to "pending" since client UI has no pause state
16. **04-03:** RiderPicker filters client-side from availableRiders prop (no server refetch per keystroke)
17. **04-03:** DraftBoard derives slot positions from buildDraftOrder to stay consistent with server-side snake logic
18. **04-03:** public/sounds/README.md added as placeholder — user must place MP3 for audio notification
19. **05-01:** Season scoping applied in JOIN condition (not WHERE) to preserve LEFT JOIN zero-point team semantics
20. **05-01:** Rank derived in JS array map with tie-handling rather than SQL RANK() window function
21. **05-01:** leagueId included in draftPicks JOIN condition (not just teamId) for explicit multi-tenant isolation
22. **05-01:** Status guard blocks standings for setup/drafting leagues with informative message and back link
23. **05-02:** INNER JOIN from raceResults outward for breakdown — only drafted riders who raced appear
24. **05-02:** Per-team subtotals computed in JS Map over breakdown rows rather than a second SQL GROUP BY query
25. **05-02:** formatRaceType helper converts snake_case enum values to human-readable Title Case in client
26. **05-02:** Standings card uses green button to distinguish from yellow draft button on league detail page
27. **06-01:** pickedAt/startDate temporal condition uses gte() in LEFT JOIN (not WHERE) to preserve zero-point team semantics
28. **06-01:** getRaceScoreBreakdown adds races INNER JOIN and lte(pickedAt, startDate) on draftPicks to handle case where raceId is a parameter
29. **06-01:** Pool.connect() used for DDL migration — neon serverless sql.unsafe() does not reliably commit DDL transactions
30. **06-01:** Negative pickNumbers used as sentinels for transfer-generated draftPick rows; partial index WHERE pickNumber >= 0 enforces uniqueness only for real draft picks
31. **06-02:** alias() imported from drizzle-orm/pg-core (not drizzle-orm) — not exported from the main package in drizzle-orm 0.45.x
32. **06-02:** getTeamTransferCount queries window record internally for dates to keep caller interface clean (only requires windowId)
33. **06-02:** Two-step bid form enforces gender constraint at client level (shows only same-gender free agents) before server-side validation
34. **06-03:** approveBid re-fetches bid after transaction to get leagueId for revalidatePath — leagueId not returned from transaction directly
35. **06-03:** BidActions extracted to bid-actions.tsx (separate file) for clean "use client" boundary
36. **06-03:** Approve button has no confirmation dialog — transaction's free agent re-check is the safety net
37. **06-04:** resolveConflictingBids groups bids by inRiderId, sorts by totalPoints ASC then submittedAt ASC — lower-standing teams win
38. **06-04:** generateTransferWindows maps race type to (maxTransfers, daysBeforeOpen): GT/WT=null/7, HP=4/5, LP/MT/WO=2/3, WC=4/7
39. **06-04:** resolveWaiverWire rejects conflicting losers before approving winners to prevent race conditions
40. **06-04:** Admin transfers page uses searchParams.leagueId for server-rendered window list
41. **07-01:** orderStatusEnum values: pending/active/rejected/countered (matches order lifecycle)
42. **07-01:** uniqueIndex on (teamId, raceId) enforces one order per team per race at DB level
43. **07-01:** bonusPoints column for admin-entered complex order points (Hammer, Innlagt Spurt, Lagtempo)
44. **07-01:** orderConfig JSONB typed with $type<OrderConfig>() for kapteinChoice param
41. **06-04:** Transfers card on league detail page uses blue button to distinguish from green standings and yellow draft

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 03    | 01   | ~2min    | 2     | 4     |
| 03    | 02   | ~3min    | 2     | 5     |
| 04    | 01   | ~3min    | 2     | 7     |
| 04    | 02   | ~2min    | 2     | 3     |
| 04    | 03   | ~8min    | 2     | 5     |
| 05    | 01   | ~3min    | 2     | 3     |
| 05    | 02   | ~6min    | 2     | 5     |
| 06    | 01   | ~14min   | 2     | 5     |
| 06    | 02   | ~10min   | 2     | 4     |
| 06    | 03   | ~3min    | 2     | 3     |
| 06    | 04   | ~8min    | 2     | 5     |
| 07    | 01   | ~5min    | 2     | 2     |

## Accumulated Context

### Roadmap Evolution
- Phase 6 added: Transfer Market
- Phase 7 added: Orders & polish & integration

## Blockers

None

## Notes

- nanoid is available as a transitive dependency (not in package.json directly)
- Database migrations are run manually during each plan execution via direct SQL (drizzle-kit version mismatch)
- Zod v4.3.6 and date-fns v4.1.0 are installed
- Pusher and QStash env vars required before testing draft features (see 04-01-SUMMARY.md User Setup section)
- pusher-client.ts must only be imported in "use client" components
- Pusher presence channel naming pattern: presence-draft-{leagueId}
- npm run build fails due to pre-existing drizzle-kit 0.18.x type error in drizzle.config.ts — all project source files compile cleanly
- /public/sounds/your-turn.mp3 must be placed manually by user for audio notification in draft room
- Standings available at /leagues/[leagueId]/standings for active/complete leagues only
- Per-race breakdown available at /leagues/[leagueId]/standings/[raceId] for active/complete leagues
- Transfer tables: transfer_bids, transfer_windows, transfer_audit exist in Neon DB (applied 2026-02-14)
- Scoring queries use pickedAt/startDate temporal filter for ownership-at-race-time (all 4 functions)
- Use Pool.connect() for DDL migrations to Neon; neon() http driver sql.unsafe() does not reliably commit DDL
- Negative pickNumbers are sentinel values for transfer-generated draftPick rows
- Team transfers page available at /leagues/[leagueId]/transfers for active leagues only
- Transfer bid UI uses two-step form: select rider to drop, then pick same-gender free agent
- Gender constraint enforced both client-side (UI filtering) and server-side (action validation)
- Admin transfer management at /admin/transfers: pending bids table + history table (Phase 2 stub replaced)
- approveBid uses db.transaction() for atomic draftPick swap (delete+insert) with pickedAt=NOW() and pickNumber=-bidId
- rejectBid captures adminNote visible to team managers
- Waiver wire priority: lowest total points team gets first pick; submittedAt is tiebreaker (earlier wins)
- Transfer windows auto-generated from parent races; race type determines maxTransfers and window open period
- Admin can batch-resolve all pending bids via "Resolve Waiver Wire" button (resolveWaiverWire action)
- Admin can auto-generate, create manual, or close-early transfer windows for active leagues
- Phase 06 is fully complete: all 5 user decisions implemented across 06-01 through 06-04
- orders table in Neon: order_status enum, orders table, indexes on leagueId/teamId/raceId, unique constraint on (teamId, raceId)
- ordersRelations available for Drizzle query builder; orderStatusEnum exported from schema barrel
- orderConfig JSONB column typed as OrderConfig with optional kapteinChoice field
