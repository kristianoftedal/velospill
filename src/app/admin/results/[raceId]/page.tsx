import {
  getAuditTrail,
  getRaceDetail,
  getResultsForRace,
  getRiders,
  getTeamNames,
} from "../actions";
import { RaceResultsClient } from "./race-results-client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function RaceResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ raceId: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const [{ raceId: raceIdParam }, { scope }] = await Promise.all([
    params,
    searchParams,
  ]);
  const raceId = Number(raceIdParam);
  if (!Number.isInteger(raceId) || raceId < 1) notFound();

  const detail = await getRaceDetail(raceId);
  if (!detail) notFound();

  // Opening a tour lands on its first raceable stage — that is where results are
  // entered. `?scope=tour` is how the end-of-tour classifications are reached.
  if (detail.race.parentRaceId == null && detail.stages.length > 0 && scope !== "tour") {
    const firstStage =
      detail.stages.find((s) => !s.isRestDay) ?? detail.stages[0];
    redirect(`/admin/results/${firstStage.id}`);
  }

  const expectedGender = detail.root.raceType.startsWith("womens_") ? "F" : "M";

  const [riders, results, auditTrail, teamNames] = await Promise.all([
    getRiders(),
    getResultsForRace(raceId),
    getAuditTrail(raceId),
    getTeamNames(expectedGender),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/results"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← All races
      </Link>
      <RaceResultsClient
        detail={detail}
        riders={riders}
        results={results}
        auditTrail={auditTrail}
        teamNames={teamNames}
      />
    </div>
  );
}
