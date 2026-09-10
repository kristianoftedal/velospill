-- Read-only audit: which (league, team, stage-race, period) combinations have no
-- lineup row for that period. Run in the Neon SQL editor. Makes no writes.
--
-- Reading the output:
--   null_period_rows > 0                        -> fine, NULL fallback covers it
--   null_period_rows = 0, resolves_to_period set -> gap, covered by carry-forward/backward
--   null_period_rows = 0, resolves_to_period NULL -> real loss, no lineup resolves at all

WITH stage_periods AS (
  SELECT s."parentRaceId" AS race_id,
         s."stageNumber",
         1 + (SELECT count(*) FROM races rd
              WHERE rd."parentRaceId" = s."parentRaceId"
                AND rd."isRestDay" = true
                AND rd."stageNumber" < s."stageNumber") AS period
  FROM races s
  WHERE s."parentRaceId" IS NOT NULL
    AND s."stageNumber" IS NOT NULL
    AND s."isRestDay" = false
),
race_periods AS (
  SELECT race_id, period,
         min("stageNumber") AS first_stage,
         max("stageNumber") AS last_stage
  FROM stage_periods
  GROUP BY race_id, period
),
teams_with_lineups AS (
  SELECT DISTINCT "leagueId", "teamId", "raceId" FROM race_lineups
)
SELECT r.id            AS race_id,
       r.name          AS race_name,
       t."leagueId",
       t."teamId",
       rp.period       AS missing_period,
       rp.first_stage,
       rp.last_stage,
       -- what the patched code will fall back to for this gap
       COALESCE(
         (SELECT max(x."lineupPeriod") FROM race_lineups x
           WHERE x."leagueId" = t."leagueId" AND x."teamId" = t."teamId"
             AND x."raceId" = t."raceId" AND x."lineupPeriod" < rp.period),
         (SELECT min(x."lineupPeriod") FROM race_lineups x
           WHERE x."leagueId" = t."leagueId" AND x."teamId" = t."teamId"
             AND x."raceId" = t."raceId" AND x."lineupPeriod" > rp.period)
       ) AS resolves_to_period,
       -- NULL-period rows still present for this team/race. If > 0 the gap is
       -- covered by the NULL fallback and is NOT damage — it is simply a race
       -- whose lineups were never periodised.
       (SELECT count(*) FROM race_lineups n
         WHERE n."leagueId" = t."leagueId" AND n."teamId" = t."teamId"
           AND n."raceId" = t."raceId" AND n."lineupPeriod" IS NULL) AS null_period_rows
FROM race_periods rp
JOIN races r            ON r.id = rp.race_id
JOIN teams_with_lineups t ON t."raceId" = rp.race_id
LEFT JOIN race_lineups l  ON l."leagueId" = t."leagueId"
                         AND l."teamId"   = t."teamId"
                         AND l."raceId"   = t."raceId"
                         AND l."lineupPeriod" = rp.period
-- anti-join: no lineup row exists for this team/race/period
WHERE l.id IS NULL
ORDER BY r.id, t."leagueId", t."teamId", rp.period;
