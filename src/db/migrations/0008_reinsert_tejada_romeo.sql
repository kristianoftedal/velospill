-- Data recovery: re-insert draftPicks rows for Tejada and Romeo
-- These rows were hard-deleted when dropRider() used DELETE instead of soft-delete.
-- They are re-inserted with droppedAt set so their historical race results
-- are restored to team 15 (Hjultaster) in league 7 (Velospill (™)).
--
-- Rider IDs confirmed via: SELECT id, name FROM riders WHERE name ILIKE '%tejada%' OR name ILIKE '%romeo%'
-- Team/league confirmed via: transfer_bids history (both were added and removed from teamId=15, leagueId=7)
-- pickedAt = resolvedAt of the approved transfer bid that added them
-- droppedAt = resolvedAt of the approved transfer bid that removed them
--   Romeo:  added by bid 19 (2026-03-08T11:21:49Z), dropped by bid 50 (2026-03-20T19:07:54Z)
--   Tejada: added by bid 35 (2026-03-08T12:01:19Z), dropped by bid 56 (2026-03-20T19:07:53Z)
--
-- pickNumber uses -99/-100 (negative, outside the partial unique index that only covers >= 0)

-- Re-insert Ivan ROMEO ABAD (riderId=381)
INSERT INTO draft_picks ("leagueId", "teamId", "riderId", "pickNumber", "round", "gender", "wasAutomatic", "pickedAt", "droppedAt")
VALUES (
  7,
  15,
  381,
  -99,
  0,
  'M',
  false,
  '2026-03-08T11:21:48.994Z',
  '2026-03-20T19:07:54.201Z'
)
ON CONFLICT DO NOTHING;

-- Re-insert Harold Alfonso TEJADA CANACUE (riderId=438)
INSERT INTO draft_picks ("leagueId", "teamId", "riderId", "pickNumber", "round", "gender", "wasAutomatic", "pickedAt", "droppedAt")
VALUES (
  7,
  15,
  438,
  -100,
  0,
  'M',
  false,
  '2026-03-08T12:01:19.293Z',
  '2026-03-20T19:07:52.782Z'
)
ON CONFLICT DO NOTHING;
