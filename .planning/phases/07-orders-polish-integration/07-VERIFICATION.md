---
phase: 07-orders-polish-integration
verified: 2026-02-15T09:15:00Z
status: passed
score: 9/9 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "Kaptein country_all (x1.5) variant now correctly receives riderNationality from DB so nationality matching in applyOrderEffects works"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Submit Kaptein order with single-rider variant in a World Championship race"
    expected: "The selected rider's points are doubled in standings"
    why_human: "Requires an actual World Championship race with results in the database"
  - test: "Submit Kaptein order with country_all variant, verify x1.5 applied to all own riders of that nationality"
    expected: "Standings show adjusted points only for riders whose riderNationality matches targetCountry"
    why_human: "Now mechanically correct but requires real WC race data to confirm end-to-end"
  - test: "Submit Shimanobil on a rider, check if counter fires correctly when targeted rider's team (not another team) has Etappeseier active"
    expected: "Counter fires only when the rider's owning team has a defense order, not any other team"
    why_human: "Counter logic uses simplified matching; edge case only visible with multiple leagues playing simultaneously"
  - test: "Submit Blodpose on a rider in a Grand Tour stage, verify standings show x3 adjusted points"
    expected: "Standings page shows adjusted total including x3 for the boosted rider's race"
    why_human: "Requires active GT stage race with results and an active approved order"
---

# Phase 07: Orders Polish Integration — Verification Report (Re-verification)

**Phase Goal:** Users deploy strategic orders to boost riders or sabotage opponents with counter mechanics
**Verified:** 2026-02-15T09:15:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 07-05)

## Gap Closure Verification

The previous verification (2026-02-15T07:59:59Z) found 1 gap:

> **Kaptein country_all (x1.5):** `riderNationality` was never populated in `baseScores` because `getRaceScoreBreakdown` did not select `riders.nationality`. As a result, `s.riderNationality === order.targetCountry` always evaluated `undefined !== string`, producing 0 matches.

### Fix verification — 4 specific checks

**Check 1: `riders.nationality` selected in `getRaceScoreBreakdown` (scoring-queries.ts)**

`src/lib/scoring-queries.ts` line 149:
```typescript
nationality: riders.nationality,
```
STATUS: PRESENT. The `.select({...})` block at line 143 now includes `nationality: riders.nationality`.

**Check 2: `riderNationality` mapped in the returned rows**

`src/lib/scoring-queries.ts` line 174:
```typescript
riderNationality: row.nationality,
```
STATUS: PRESENT. The `.map((row) => ({...}))` at line 168 maps `row.nationality` to `riderNationality`.

**Check 3: `riderNationality` propagated in both `baseScores` construction sites**

Site A — `getRaceScoreBreakdownWithOrders` (scoring-queries.ts lines 352-358):
```typescript
const baseScores: BaseScore[] = baseEntries.map((entry) => ({
  teamId: entry.teamId,
  riderId: entry.riderId,
  points: entry.points,
  riderNationality: entry.riderNationality,
  position: entry.position,
}))
```
STATUS: PRESENT.

Site B — `getOrderAdjustedStandings` (order-queries.ts lines 636-642):
```typescript
const baseScores: BaseScore[] = breakdown.map((entry) => ({
  teamId: entry.teamId,
  riderId: entry.riderId,
  points: entry.points,
  riderNationality: entry.riderNationality,
  position: entry.position,
}))
```
STATUS: PRESENT.

**Check 4: `applyOrderEffects` country_all branch can now match riders by nationality**

`src/lib/order-queries.ts` lines 382-399:
```typescript
} else if (kapteinChoice === "country_all") {
  const countryRiders = baseScores.filter(
    (s) => s.teamId === order.teamId && s.riderNationality === order.targetCountry
  )
  for (const entry of countryRiders) {
    if (entry.points > 0) {
      adjustments.push({
        ...
        adjustedPoints: Math.floor(entry.points * 1.5),
        description: `${order.orderTypeName} x1.5 (${order.targetCountry})`,
      })
    }
  }
}
```
STATUS: WIRED. `s.riderNationality` now receives a real string (from `riders.nationality NOT NULL` in DB). The comparison will correctly yield riders matching the submitted country code.

**Additional verification:** `RaceScoreEntry` type (scoring-queries.ts line 225) declares `riderNationality: string` as a required field (not optional). Synthetic bonus rows pushed in `getRaceScoreBreakdownWithOrders` use `riderNationality: ""` to satisfy the type. TypeScript compilation: zero errors (`npx tsc --noEmit` — clean).

**Commits verified:**
- `7e524d7` — `feat(07-05): add riderNationality to getRaceScoreBreakdown and RaceScoreEntry`
- `ccf1951` — `feat(07-05): propagate riderNationality in getOrderAdjustedStandings and document Shimanobil limitation`

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can submit one order per stage/one-day race via order form | VERIFIED | No regression — `orders-client.tsx` 4-step wizard unchanged; `actions.ts` inserts with `status=pending`; `uniqueIndex("orders_team_race_unique").on(table.teamId, table.raceId)` enforces one-per-race |
| 2 | System validates order eligibility (race type restrictions, stage number, target validity) | VERIFIED | No regression — `actions.ts` 12-step validation chain intact: auth, membership, league status, race deadline, race type compatibility, GT restriction, target type checks, WC guard |
| 3 | One-day orders work correctly (Blodpose x2.5/x2, Shimanobil 0 points, Gammel Venn x2/x3) | VERIFIED | No regression — `effectValues`, `zero_points`, `unowned_rider` branches in `applyOrderEffects` unchanged |
| 4 | World Championship order works (Kaptein: x2 one rider OR x1.5 country/all riders) | VERIFIED | FIXED: x2 single-rider path unchanged; x1.5 country_all path now receives real `riderNationality` values so nationality filter works correctly |
| 5 | GT stage orders work (Blodpose x3, Shimanobil 0, Etappeseier double top-10, Hammer 3pts/position lost max 30, COVID half points) | VERIFIED | No regression — all effect branches unchanged in `applyOrderEffects` |
| 6 | GT-specific orders work (Innlagt spurt Giro, Bondestreik TdF, Lagtempo Vuelta) | VERIFIED | No regression — GT restriction check in `actions.ts` lines 141-147 unchanged |
| 7 | Women GT order works (Sponsorens ritt: double end-of-tour points) | VERIFIED | No regression — `double_end_tour` case in `applyOrderEffects` unchanged |
| 8 | Counter mechanic works (Shimanobil/COVID countered by Etappeseier/Blodpose returns order to attacker) | VERIFIED | No regression — `resolveCounters` logic unchanged; Shimanobil limitation now documented via TODO comment |
| 9 | Orders do not apply to World Championships (except Kaptein/laginnsats) | VERIFIED | No regression — `applyOrderEffects` line 231: `if (isWorldChampionship && order.orderTypeName !== "kaptein") continue` unchanged; `actions.ts` WC guard unchanged |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/orders.ts` | orders table schema with orderStatusEnum, relations, indexes | VERIFIED | `pgEnum(pending/active/rejected/countered)`, `pgTable` with 16 columns, `uniqueIndex(teamId, raceId)` |
| `src/lib/order-queries.ts` | getActiveOrdersForRace, resolveCounters, applyOrderEffects, getOrderAdjustedStandings | VERIFIED | All 4 functions present and substantive; `riderNationality` propagated in `baseScores` at line 640 |
| `src/lib/scoring-queries.ts` | getRaceScoreBreakdown with nationality + RaceScoreEntry type | VERIFIED | `nationality: riders.nationality` selected (line 149), `riderNationality: row.nationality` mapped (line 174), `RaceScoreEntry.riderNationality: string` typed (line 225) |
| `src/app/(main)/leagues/[leagueId]/orders/page.tsx` | Server page fetching races, orders, team riders, order types | VERIFIED | No regression |
| `src/app/(main)/leagues/[leagueId]/orders/orders-client.tsx` | Client 4-step wizard | VERIFIED | No regression |
| `src/app/(main)/leagues/[leagueId]/orders/actions.ts` | submitOrder and cancelOrder server actions | VERIFIED | No regression |
| `src/app/admin/orders/page.tsx` | Admin order validation page | VERIFIED | No regression |
| `src/app/admin/orders/actions.ts` | approveOrder, rejectOrder, setBonusPoints | VERIFIED | No regression |
| `src/app/admin/orders/order-actions.tsx` | Client approve/reject buttons | VERIFIED | No regression |
| `src/app/(main)/leagues/[leagueId]/standings/[raceId]/page.tsx` | Race breakdown with order effect annotations | VERIFIED | No regression |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `orders-client.tsx` | `actions.ts` | submitOrder call | WIRED | No regression |
| `actions.ts` | `src/db/schema/orders.ts` | db.insert(orders) | WIRED | No regression |
| `scoring-queries.ts` | `order-queries.ts` | dynamic import | WIRED | No regression |
| `getRaceScoreBreakdown` | `riders.nationality` | DB select | WIRED | NEW: `nationality: riders.nationality` now selected and mapped to `riderNationality` |
| `getOrderAdjustedStandings` | `getRaceScoreBreakdown` | `entry.riderNationality` in baseScores | WIRED | NEW: `riderNationality: entry.riderNationality` now included in baseScores construction |
| `applyOrderEffects` country_all | `baseScores[].riderNationality` | `s.riderNationality === order.targetCountry` | WIRED | NEW: comparison now evaluates real string vs string (not undefined vs string) |
| `standings/[raceId]/page.tsx` | `scoring-queries.ts` | getRaceScoreBreakdownWithOrders | WIRED | No regression |

---

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| User can submit one order per stage/one-day race | SATISFIED | — |
| System validates order eligibility | SATISFIED | — |
| One-day orders (Blodpose x2.5/x2, Shimanobil 0, Gammel Venn x2/x3) | SATISFIED | — |
| World Championship Kaptein x2 single rider | SATISFIED | — |
| World Championship Kaptein x1.5 country | SATISFIED | FIXED: riderNationality now populated |
| GT stage orders (Blodpose x3, Shimanobil, Etappeseier, Hammer, COVID) | SATISFIED | — |
| GT-specific (Innlagt spurt Giro, Bondestreik TdF, Lagtempo Vuelta) | SATISFIED | — |
| Women GT Sponsorens ritt | SATISFIED | — |
| Counter mechanic | SATISFIED | — |
| Orders do not apply to WC except Kaptein | SATISFIED | — |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/order-queries.ts` | 147-151 | Shimanobil counter check uses `d.teamId !== attack.teamId` instead of rider-ownership lookup | Warning (documented) | May fire against any non-attacker defense order; TODO comment added in 07-05; acceptable limitation per plan decision |

No blockers remain.

---

### Human Verification Required

#### 1. Kaptein Single-Rider Scoring (carried forward)

**Test:** Submit a Kaptein order (single rider) for a World Championship race, have admin approve it, add results for the race, then check standings.
**Expected:** The selected rider's race points appear doubled in the standings.
**Why human:** Requires a World Championship race with actual result data in the database.

#### 2. Kaptein Country-All Scoring (new — gap was closed)

**Test:** Submit a Kaptein order with "country_all" choice, specifying a country (e.g. "NOR"). Have admin approve. Add race results for riders with matching and non-matching nationalities. Check standings.
**Expected:** Only own riders with `riderNationality === "NOR"` have their points multiplied by 1.5; riders of other nationalities are unaffected.
**Why human:** Mechanically correct now (real nationality in baseScores), but end-to-end correctness requires real World Championship race data with nationality-tagged riders.

#### 3. Counter Mechanic End-to-End (carried forward)

**Test:** Submit Shimanobil targeting a rider owned by Team B. Have Team B submit Etappeseier. Admin approves both. Add race results. Check standings.
**Expected:** Shimanobil is countered; Team A (attacker) gets 0 pts for the targeted rider.
**Why human:** End-to-end counter behavior depends on live data; note the documented limitation that counter fires against any non-attacker defense, not specifically the rider-owning team.

#### 4. Blodpose Multiplier in Standings (carried forward)

**Test:** Submit Blodpose GT (x3) targeting a rider who scores 20pts in a stage. Admin approves. Check standings.
**Expected:** Team total includes 60pts (not 20pts) for that stage.
**Why human:** Requires real race results to verify multiplier is applied in standings arithmetic.

---

### Gaps Summary

No gaps remain. The single gap from the initial verification has been closed:

**Kaptein country_all riderNationality (CLOSED):**
The fix adds `nationality: riders.nationality` to the `getRaceScoreBreakdown` select (scoring-queries.ts line 149), maps it to `riderNationality` in the returned rows (line 174), declares `riderNationality: string` as a required field on `RaceScoreEntry` (line 225), and propagates `riderNationality: entry.riderNationality` into `baseScores` at both construction sites (scoring-queries.ts line 356 and order-queries.ts line 640). The `applyOrderEffects` country_all comparison `s.riderNationality === order.targetCountry` now receives real nationality strings from the database for all real rider rows; synthetic bonus rows use the empty string sentinel `""` which correctly never matches a real country code.

TypeScript compilation passes with zero errors after the changes.

---

### Commits Verified

| Commit | Task | Status |
|--------|------|--------|
| f09e781 | Create orders schema | EXISTS |
| 06cc741 | Barrel export + DDL migration | EXISTS |
| 188c888 | Order queries library + server actions | EXISTS |
| fcb3ead | Order page UI + league detail integration | EXISTS |
| 0b92b9f | Admin order server actions | EXISTS |
| 7097f5a | Admin orders stub replacement | EXISTS |
| 58c60b0 | Order effect calculation + counter mechanic | EXISTS |
| 5f7d03a | Scoring queries + race breakdown UI | EXISTS |
| 7e524d7 | Add riderNationality to getRaceScoreBreakdown and RaceScoreEntry | EXISTS |
| ccf1951 | Propagate riderNationality in getOrderAdjustedStandings | EXISTS |

---

_Verified: 2026-02-15T09:15:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — initial score 8/9 → final score 9/9_
