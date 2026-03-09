---
title: Fix SQL error when submitting TTT race results
quick_task: 4
---

# Plan: Fix submitTttResults SQL Error

## Root Cause

`submitTttResults` in `src/app/admin/results/actions.ts` does a `SELECT` query inside a Neon
serverless transaction:

```ts
// Line 657 — inside db.transaction(async (tx) => { ... })
const teamRiders = await tx
  .select({ id: riders.id })
  .from(riders)
  .where(eq(riders.team, teamName));
```

Neon serverless (via `Pool` + `drizzle-orm/neon-serverless`) has known limitations with
interactive transactions where you SELECT, read results, then INSERT based on them inside the
same transaction. This is the exact same pattern that was fixed in `submitRaceResults` across
commits `a8d8597` through `4a02bd6` — the fix there was to move all SELECTs and DELETEs
**outside** the transaction and only INSERT inside.

Additionally, `submitTttResults` has no replace logic — if TTT results already exist for the
race, it will fail with a `23505` unique constraint error (currently caught and shown as a
user-visible error message). Same problem that was fixed for regular results.

## Context

- `src/app/admin/results/actions.ts` — the action to fix (lines 568-704)
- Pattern to follow: `submitRaceResults` (lines 143-285) — pre-fetch, pre-delete outside tx, INSERT-only inside tx

## Task

### Fix submitTttResults: move SELECT outside transaction + add replace logic

**File:** `src/app/admin/results/actions.ts`

**Changes to `submitTttResults`:**

**Step 1 — Pre-fetch all team rosters outside the transaction.**

Before the `db.transaction(...)` call, build a map of `teamName → rider[]` for all teams in `teamPlacements`:

```ts
// Pre-fetch all riders for all teams (outside transaction — avoids Neon interactive tx limitation)
const allTeamNames = teamPlacements.map((p) => p.teamName);
const allTeamRiders = await db
  .select({ id: riders.id, team: riders.team })
  .from(riders)
  .where(inArray(riders.team, allTeamNames));

// Build lookup map: teamName -> riderId[]
const teamRiderMap = new Map<string, number[]>();
for (const rider of allTeamRiders) {
  if (!teamRiderMap.has(rider.team)) teamRiderMap.set(rider.team, []);
  teamRiderMap.get(rider.team)!.push(rider.id);
}
```

**Step 2 — Add replace logic: delete existing TTT results before inserting.**

After the pre-fetch, add the same cleanup pattern used in `submitRaceResults`:

```ts
// Replace existing TTT results (outside transaction — same pattern as submitRaceResults)
const existingTtt = await db
  .select({ id: raceResults.id })
  .from(raceResults)
  .where(and(eq(raceResults.raceId, raceId), eq(raceResults.category, "ttt")));
if (existingTtt.length > 0) {
  const ids = existingTtt.map((r) => r.id);
  await db.delete(resultAudit).where(inArray(resultAudit.resultId, ids));
  await db.delete(raceResults).where(inArray(raceResults.id, ids));
}
```

**Step 3 — Simplify the transaction to INSERT-only.**

Remove `const teamRiders = await tx.select(...).from(riders).where(...)` from inside the
transaction. Replace with a lookup into `teamRiderMap`:

```ts
await db.transaction(async (tx) => {
  for (const { position, teamName } of teamPlacements) {
    const points = calculatePoints(position, scoringRules.rules as Record<string, number>);
    const riderIds = teamRiderMap.get(teamName) ?? [];

    for (const riderId of riderIds) {
      await tx.insert(raceResults).values({
        raceId,
        riderId,
        category: "ttt",
        position,
        time: null,
        points,
      });
    }
  }

  await tx.insert(resultAudit).values({
    raceId,
    changeType: "BATCH_INSERT",
    changedBy: session.user.id,
    newData: { category: "ttt", teamPlacements } as any,
  });
});
```

**Step 4 — Add `inArray` to imports** if not already present for `riders.team` lookup.
`inArray` is already imported at line 13, so no import change needed.

**Verify:** Submit TTT results for a race with no existing results — should succeed. Submit again
(re-submit) — should replace existing results and succeed (not show "already exist" error).

**Done:** TTT results submit without SQL error on first submission. Re-submission replaces
existing TTT results cleanly without constraint violations.
