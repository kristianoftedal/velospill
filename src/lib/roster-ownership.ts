import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * Returns an SQL EXISTS subquery that checks whether a team owned a rider at race time
 * using the roster_events table.
 *
 * Ownership is established by a 'drafted' or 'transferred_in' event that occurred
 * on or before the race date, with no subsequent 'dropped' or 'transferred_out' event
 * before the race date.
 *
 * @param leagueId - The league ID (number or SQL expression)
 * @param teamIdExpr - SQL expression for the team ID column (e.g. teams.id)
 * @param riderIdExpr - SQL expression for the rider ID column (e.g. rosterEvents.riderId or raceResults.riderId)
 * @param raceDateExpr - SQL expression for the race start date (e.g. races.startDate)
 */
export function ownershipAtRaceTime(
  leagueId: number | SQL,
  teamIdExpr: SQL,
  riderIdExpr: SQL,
  raceDateExpr: SQL,
): SQL {
  return sql`EXISTS (
    SELECT 1 FROM roster_events re_own
    WHERE re_own."leagueId" = ${leagueId}
      AND re_own."teamId" = ${teamIdExpr}
      AND re_own."riderId" = ${riderIdExpr}
      AND re_own."eventType" IN ('drafted', 'transferred_in')
      AND re_own."occurredAt" <= ${raceDateExpr}
      AND NOT EXISTS (
        SELECT 1 FROM roster_events re_end
        WHERE re_end."leagueId" = ${leagueId}
          AND re_end."teamId" = ${teamIdExpr}
          AND re_end."riderId" = ${riderIdExpr}
          AND re_end."eventType" IN ('dropped', 'transferred_out')
          AND re_end."occurredAt" <= ${raceDateExpr}
          AND re_end."occurredAt" > re_own."occurredAt"
      )
  )`;
}
