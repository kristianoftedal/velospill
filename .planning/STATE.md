# GSD State

## Current Position

- **Phase:** 04-live-draft-system
- **Current Plan:** 02 (next to execute)
- **Status:** In Progress
- **Last session:** 2026-02-13T09:23:04Z
- **Stopped at:** Completed 04-01-PLAN.md

## Progress

```
Phase 04: [#.......] 1/4 plans complete
```

Plans complete: 04-01
Plans remaining: 04-02, 04-03, 04-04

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

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 03    | 01   | ~2min    | 2     | 4     |
| 03    | 02   | ~3min    | 2     | 5     |
| 04    | 01   | ~3min    | 2     | 7     |

## Blockers

None

## Notes

- nanoid is available as a transitive dependency (not in package.json directly)
- Database migrations are run manually during each plan execution via direct SQL (drizzle-kit version mismatch)
- Zod v4.3.6 and date-fns v4.1.0 are installed
- Pusher and QStash env vars required before testing draft features (see 04-01-SUMMARY.md User Setup section)
- pusher-client.ts must only be imported in "use client" components
- Pusher presence channel naming pattern: presence-draft-{leagueId}
