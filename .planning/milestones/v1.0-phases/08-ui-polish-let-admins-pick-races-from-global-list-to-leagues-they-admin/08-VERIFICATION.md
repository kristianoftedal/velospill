---
phase: 08-ui-polish-let-admins-pick-races-from-global-list-to-leagues-they-admin
verified: 2026-02-16T08:02:16Z
status: human_needed
score: 14/15 must-haves verified (1 requires DB inspection)
human_verification:
  - test: "Confirm league_races table exists in Neon with pre-populated rows"
    expected: "4 leagues each have 2 rows (8 total) for 2025 parent races. Query: SELECT lr.\"leagueId\", l.name, COUNT(lr.id) as race_count FROM league_races lr JOIN leagues l ON l.id = lr.\"leagueId\" GROUP BY lr.\"leagueId\", l.name;"
    why_human: "Cannot query Neon DB programmatically from verification; schema and migration script are verified but DB state requires runtime access"
  - test: "Visit league detail page as league owner and verify Race Calendar section is visible"
    expected: "A card titled 'Race Calendar' appears showing all 2025 parent races with checkboxes. Shows 'N of M races assigned to this league' subtitle."
    why_human: "Visual rendering requires browser"
  - test: "Toggle a checkbox to unassign a race that has existing orders"
    expected: "Checkbox becomes unchecked. Toast warning appears: 'Race removed. Note: existing orders for this race are still in the system.'"
    why_human: "Runtime toast behavior requires browser"
  - test: "Visit league detail page as a non-owner member and verify Race Calendar section is absent"
    expected: "No Race Calendar card visible. Invite Link and League Management sections also hidden."
    why_human: "Access control requires a second user session"
---

# Phase 08: UI Polish — Admins Pick Races from Global List Verification Report

**Phase Goal:** Enable league owners to select which races from the global calendar apply to their league, with all downstream features (orders, transfers, scoring) scoped to those selected races
**Verified:** 2026-02-16T08:02:16Z
**Status:** HUMAN_NEEDED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | `league_races` table defined in schema with leagueId + raceId FKs and unique constraint | VERIFIED | `leagues.ts` lines 49-58: `pgTable("league_races", ...)` with `uniqueIndex("league_races_league_race_unique")` |
| 2 | All existing leagues have `league_races` rows for their season's parent races | HUMAN NEEDED | Migration script logic verified; SQL pre-population uses `ON CONFLICT DO NOTHING` — DB state requires runtime inspection |
| 3 | `leagueRaces` and `leagueRacesRelations` exported from schema barrel | VERIFIED | `src/db/schema/index.ts` line 6: `export * from "./leagues"` — wildcard covers both exports |
| 4 | League owner can see race picker table on the league detail page | VERIFIED | `page.tsx` line 70 fetches `seasonRaces` only when `isOwner`; lines 220-227 render `<RacePickerSection>` conditionally |
| 5 | League owner can toggle race assignment via checkbox with immediate UI feedback | VERIFIED | `league-client.tsx` lines 316-320: `<Checkbox checked={race.assigned} disabled={togglingRaceId === race.id} onCheckedChange={() => handleToggle(race)}>`; toast on success/error |
| 6 | Non-owners do not see the race picker section | VERIFIED | `page.tsx` line 220: `{isOwner && seasonRaces && (<RacePickerSection .../>)}` — double guard; `seasonRaces` is null for non-owners |
| 7 | Warning shown when unassigning a race with existing orders | VERIFIED | `league-client.tsx` lines 258-265: checks `result.hadOrders` and calls `toast.warning("Race removed. Note: existing orders...")` |
| 8 | Toggling a race revalidates league, orders, and transfers paths | VERIFIED | `actions.ts` lines 231-233 (`assignRaceToLeague`) and 253-255 (`removeRaceFromLeague`): three `revalidatePath` calls per action |
| 9 | `getUpcomingRacesForLeague` returns only races assigned to the league (plus their stages) | VERIFIED | `order-queries.ts` line 717: `sql\`(${races.id} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}) OR ${races.parentRaceId} IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId}))\`` |
| 10 | `generateTransferWindows` generates windows only for assigned parent races | VERIFIED | `transfer-queries.ts` lines 270-283: INNER JOIN on `leagueRaces` with `eq(leagueRaces.leagueId, leagueId)` |
| 11 | `getLeagueRacesWithScores` returns scores only for assigned races | VERIFIED | `scoring-queries.ts` lines 233: same OR-based subquery in WHERE clause |
| 12 | `getLeagueStandings` aggregates points only from assigned races | VERIFIED | `scoring-queries.ts` line 69: subquery placed in LEFT JOIN condition (preserves zero-point team semantics) |
| 13 | `getTeamRiderScores` aggregates points only from assigned races | VERIFIED | `scoring-queries.ts` line 120: same LEFT JOIN pattern as `getLeagueStandings` |
| 14 | Existing behavior unchanged when all season races are assigned | VERIFIED | Subquery `IN (SELECT "raceId" FROM league_races WHERE "leagueId" = ${leagueId})` returns all pre-populated races — identical result set to season filter |
| 15 | shadcn Checkbox component installed and functional | VERIFIED | `src/components/ui/checkbox.tsx`: full implementation using `radix-ui` Checkbox primitive, CheckIcon, cn utility |

**Score:** 14/15 automated checks verified. 1 requires human (DB state).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/db/schema/leagues.ts` | `leagueRaces` table and `leagueRacesRelations` | VERIFIED | Lines 49-83: table, relations, and `leaguesRelations` updated with `many(leagueRaces)` |
| `src/app/(main)/leagues/[leagueId]/actions.ts` | `assignRaceToLeague`, `removeRaceFromLeague`, `getSeasonRacesForPicker` | VERIFIED | All three functions at lines 185-257; imports `leagueRaces`, `races`, `orders`, `isNull` |
| `src/app/(main)/leagues/[leagueId]/league-client.tsx` | `RacePickerSection` client component | VERIFIED | Lines 243-338: full implementation with table, checkbox toggling, toast feedback, loading state per row |
| `src/app/(main)/leagues/[leagueId]/page.tsx` | Race picker integration for owners only | VERIFIED | Lines 70, 220-227: guarded fetch + conditional render |
| `src/components/ui/checkbox.tsx` | shadcn Checkbox component | VERIFIED | 33-line implementation using radix-ui monorepo package |
| `src/lib/order-queries.ts` | `getUpcomingRacesForLeague` with `leagueRaces` filter | VERIFIED | Import on line 9; subquery on line 717 |
| `src/lib/transfer-queries.ts` | `generateTransferWindows` with `leagueRaces` INNER JOIN | VERIFIED | Import on line 6 (combined with `teams`); INNER JOIN lines 270-283 |
| `src/lib/scoring-queries.ts` | `getLeagueStandings`, `getTeamRiderScores`, `getLeagueRacesWithScores` with `leagueRaces` filter | VERIFIED | Import on line 3; subqueries at lines 69, 120, 233 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `leagues.ts` | `races.ts` | `raceId` FK reference | VERIFIED | Line 52: `references(() => races.id, { onDelete: "cascade" })` |
| `leagues.ts` | `leagues.ts` | `leagueId` FK reference | VERIFIED | Line 51: `references(() => leagues.id, { onDelete: "cascade" })` |
| `league-client.tsx` | `actions.ts` | Server actions passed as props | VERIFIED | `page.tsx` lines 224-225 pass `assignRaceToLeague` and `removeRaceFromLeague` as `assignRace`/`removeRace` props |
| `page.tsx` | `actions.ts` | `getSeasonRacesForPicker` call | VERIFIED | Line 70: `const seasonRaces = isOwner ? await getSeasonRacesForPicker(leagueId) : null` |
| `page.tsx` | `league-client.tsx` | `RacePickerSection` render | VERIFIED | Line 221: `<RacePickerSection leagueId={league.id} seasonRaces={seasonRaces} ...>` |
| `order-queries.ts` | `leagues.ts` | `import leagueRaces` | VERIFIED | Line 9: `import { leagueRaces } from "@/db/schema/leagues"` |
| `transfer-queries.ts` | `leagues.ts` | `import leagueRaces` | VERIFIED | Line 6: `import { teams, leagueRaces } from "@/db/schema/leagues"` |
| `scoring-queries.ts` | `leagues.ts` | `import leagueRaces` | VERIFIED | Line 3: `import { teams, leagueRaces } from "@/db/schema/leagues"` |

### Requirements Coverage

All phase 08 requirements map to the 14 verified truths above. No requirements file row-level mapping needed — requirements were captured entirely in the plan's `must_haves`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/lib/order-queries.ts` | 148 | `TODO: Shimanobil counter requires rider ownership lookup` | Warning | Pre-existing from orders phase (07); an approximation is implemented below the comment; not phase 08 scope; no impact on race picker functionality |

### Human Verification Required

#### 1. Neon DB Pre-Population State

**Test:** Connect to Neon DB and run:
```sql
SELECT lr."leagueId", l.name, COUNT(lr.id) as race_count
FROM league_races lr
JOIN leagues l ON l.id = lr."leagueId"
GROUP BY lr."leagueId", l.name;
```
**Expected:** 4 rows — each league shows 2 races assigned (8 total, as documented in 08-01-SUMMARY.md)
**Why human:** Cannot query Neon from the verification process; the schema definition and migration SQL are verified in code, but the actual DB state is not accessible programmatically here.

#### 2. Race Calendar Visible to Owner

**Test:** Log in as a league owner and navigate to `/leagues/{leagueId}`
**Expected:** A card titled "Race Calendar" appears with a subtitle like "2 of 2 races assigned to this league". A table shows each race with a checkbox, race name, type, and start date. Both checkboxes are checked (all races pre-assigned).
**Why human:** Visual rendering requires a browser session.

#### 3. hadOrders Warning Toast

**Test:** As league owner, uncheck a race that has at least one order associated with it
**Expected:** The checkbox unchecks. A warning toast appears: "Race removed. Note: existing orders for this race are still in the system."
**Why human:** Requires existing orders for that race and a live browser session.

#### 4. Non-Owner Access Control

**Test:** Log in as a league member (not the owner) and navigate to the same league detail page
**Expected:** No "Race Calendar" card visible. The page shows team roster, standings/transfers/orders links based on league status, but no race picker.
**Why human:** Requires a second user account that is a member but not the owner.

### Gaps Summary

No gaps found. All 14 automatically-verifiable must-haves pass at all three levels (exists, substantive, wired). The single human-needed item (DB pre-population state) is a runtime verification that cannot be automated from this context, not a gap in the implementation.

The phase goal is functionally achieved: the schema, UI, server actions, and all downstream query layers are correctly implemented and wired. Human verification is required only to confirm the live database state and browser rendering.

---

_Verified: 2026-02-16T08:02:16Z_
_Verifier: Claude (gsd-verifier)_
