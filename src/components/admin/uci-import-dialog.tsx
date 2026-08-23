"use client";

import {
  importUciResults,
  type UciImportRow,
  type UciImportTeamRow,
} from "@/app/admin/results/uci-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangleIcon,
  DownloadIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

type Rider = { id: number; name: string; team: string };

type ImportMeta = {
  competitionId: string;
  competitionName: string;
  sectionLabel: string;
  resultTitle: string;
};

type Props = {
  raceId: number;
  category: string;
  riders: Rider[];
  /** How many positions to pre-select — matches the form's prefill count. */
  defaultCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyIndividual?: (
    rows: Array<{ position: number; riderId: number; time: string }>,
  ) => void;
  onApplyTtt?: (
    placements: Array<{
      position: number;
      teamName: string;
      riderIds: number[];
    }>,
  ) => void;
  onNeedsLink?: () => void;
};

/** Below this the match is shown as needing a human decision. */
const CONFIDENT = 0.9;

/**
 * Radix unmounts DialogContent when closed, so the body remounts on every open
 * and starts from a clean loading state — no effect has to reset it.
 */
export function UciImportDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <ImportBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function ImportBody({
  raceId,
  category,
  riders,
  defaultCount,
  onOpenChange,
  onApplyIndividual,
  onApplyTtt,
  onNeedsLink,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLink, setNeedsLink] = useState(false);
  const [meta, setMeta] = useState<ImportMeta | null>(null);
  const [rows, setRows] = useState<UciImportRow[] | null>(null);
  const [teamRows, setTeamRows] = useState<UciImportTeamRow[] | null>(null);
  const [totalRanked, setTotalRanked] = useState(0);

  /** Per-position rider override, keyed by position. */
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  const [search, setSearch] = useState<Record<number, string>>({});
  const [takeCount, setTakeCount] = useState(defaultCount);

  useEffect(() => {
    let cancelled = false;
    importUciResults({ raceId, category })
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.error);
          setNeedsLink("needsLink" in res && res.needsLink === true);
          return;
        }
        setMeta(res.meta);
        if (res.kind === "ttt") {
          setTeamRows(res.teamRows);
          setTakeCount(Math.min(defaultCount, res.teamRows.length));
        } else {
          setRows(res.rows);
          setTotalRanked(res.totalRanked);
          setTakeCount(Math.min(defaultCount, res.rows.length));
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [raceId, category, defaultCount]);

  const riderFor = (row: UciImportRow): Rider | null => {
    const override = overrides[row.position];
    if (override) return riders.find((r) => r.id === override) ?? null;
    return row.matchedRider;
  };

  const visibleRows = (rows ?? []).slice(0, takeCount);
  const visibleTeamRows = (teamRows ?? []).slice(0, takeCount);
  const unresolved = visibleRows.filter((r) => !riderFor(r));
  const lowConfidence = visibleRows.filter(
    (r) => !overrides[r.position] && r.matchedRider && r.matchScore < CONFIDENT,
  );

  const applyIndividual = () => {
    const resolved = visibleRows
      .map((row) => {
        const rider = riderFor(row);
        return rider
          ? { position: row.position, riderId: rider.id, time: row.time ?? "" }
          : null;
      })
      .filter(
        (r): r is { position: number; riderId: number; time: string } =>
          r !== null,
      );
    onApplyIndividual?.(resolved);
    onOpenChange(false);
  };

  const applyTtt = () => {
    const placements = visibleTeamRows
      .filter((t) => t.matchedTeamName)
      .map((t) => ({
        position: t.position,
        teamName: t.matchedTeamName!,
        riderIds: t.riders
          .map((r) => r.matchedRider?.id)
          .filter((id): id is number => typeof id === "number"),
      }))
      .filter((p) => p.riderIds.length > 0);
    onApplyTtt?.(placements);
    onOpenChange(false);
  };

  const isTtt = teamRows !== null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <DownloadIcon className="h-4 w-4" />
          Import from UCI
        </DialogTitle>
        <DialogDescription>
          {meta ? (
            <>
              {meta.competitionName} · {meta.sectionLabel} ·{" "}
              <span className="font-medium">{meta.resultTitle}</span>{" "}
              <a
                href={`https://www.uci.org/competition-details/${meta.competitionId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <ExternalLinkIcon className="h-3 w-3" />
              </a>
            </>
          ) : (
            "Nothing is saved until you submit the form."
          )}
        </DialogDescription>
      </DialogHeader>

      {loading && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Fetching results from UCI…
        </p>
      )}

      {error && (
        <div className="space-y-3">
          <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
            <AlertTriangleIcon className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
          {needsLink && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onNeedsLink?.();
              }}
            >
              Link a UCI competition
            </Button>
          )}
        </div>
      )}

      {!loading && !error && (rows || teamRows) && (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <Label htmlFor="uci-take" className="text-xs">
                Import positions 1–
              </Label>
              <Input
                id="uci-take"
                type="number"
                min={1}
                max={(rows ?? teamRows ?? []).length}
                value={takeCount}
                onChange={(e) =>
                  setTakeCount(
                    Math.max(
                      1,
                      Math.min(
                        (rows ?? teamRows ?? []).length,
                        Number(e.target.value) || 1,
                      ),
                    ),
                  )
                }
                className="h-9 w-24"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              UCI published{" "}
              {isTtt
                ? `${teamRows!.length} team placements`
                : `${totalRanked} ranked riders`}
              {!isTtt && totalRanked > rows!.length
                ? ` (first ${rows!.length} fetched)`
                : ""}
              .
            </p>
          </div>

          {(unresolved.length > 0 || lowConfidence.length > 0) && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2">
              <AlertTriangleIcon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm">
                {unresolved.length > 0 && (
                  <>
                    {unresolved.length} rider
                    {unresolved.length === 1 ? "" : "s"} could not be matched
                    and will be skipped.{" "}
                  </>
                )}
                {lowConfidence.length > 0 && (
                  <>
                    {lowConfidence.length} match
                    {lowConfidence.length === 1 ? "" : "es"} need checking.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Individual classification */}
          {rows && (
            <div className="space-y-1.5">
              {visibleRows.map((row) => {
                const rider = riderFor(row);
                const overridden = !!overrides[row.position];
                const confident = overridden || row.matchScore >= CONFIDENT;
                return (
                  <div
                    key={row.position}
                    className="flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="w-8 text-sm font-medium tabular-nums">
                      {row.position}
                    </span>
                    <div className="w-56 shrink-0">
                      <div className="text-sm">{row.uciName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.uciTeam}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Combobox
                        value={rider?.name ?? ""}
                        onValueChange={(name) => {
                          const found = riders.find((r) => r.name === name);
                          if (found)
                            setOverrides((prev) => ({
                              ...prev,
                              [row.position]: found.id,
                            }));
                          setSearch((prev) => ({
                            ...prev,
                            [row.position]: "",
                          }));
                        }}
                        onInputValueChange={(v) =>
                          setSearch((prev) => ({ ...prev, [row.position]: v }))
                        }
                      >
                        <ComboboxInput
                          placeholder={rider?.name || "No match — pick a rider"}
                          className="h-9"
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            <ComboboxEmpty>No riders found</ComboboxEmpty>
                            {(() => {
                              const q = (
                                search[row.position] ?? ""
                              ).toLowerCase();
                              const list = q
                                ? riders.filter(
                                    (r) =>
                                      r.name.toLowerCase().includes(q) ||
                                      r.team.toLowerCase().includes(q),
                                  )
                                : [
                                    ...(row.matchedRider
                                      ? [row.matchedRider]
                                      : []),
                                    ...row.alternatives,
                                    ...riders,
                                  ].filter(
                                    (r, i, arr) =>
                                      arr.findIndex((x) => x.id === r.id) === i,
                                  );
                              return list.slice(0, 200).map((r) => (
                                <ComboboxItem key={r.id} value={r.name}>
                                  <div className="flex flex-col">
                                    <span>{r.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {r.team}
                                    </span>
                                  </div>
                                </ComboboxItem>
                              ));
                            })()}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>
                    <div className="w-24 text-right shrink-0">
                      {!rider ? (
                        <Badge variant="destructive" className="text-xs">
                          no match
                        </Badge>
                      ) : overridden ? (
                        <Badge variant="secondary" className="text-xs">
                          manual
                        </Badge>
                      ) : (
                        <Badge
                          variant={confident ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {Math.round(row.matchScore * 100)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Team time trial */}
          {teamRows && (
            <div className="space-y-1.5">
              {visibleTeamRows.map((team) => {
                const missing = team.riders.filter((r) => !r.matchedRider);
                return (
                  <div
                    key={team.position}
                    className="rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-sm font-medium tabular-nums">
                        {team.position}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{team.uciTeam}</div>
                        <div className="text-xs text-muted-foreground">
                          {team.matchedTeamName
                            ? `→ ${team.matchedTeamName}`
                            : "no roster team matched — will be skipped"}
                          {team.time ? ` · ${team.time}` : ""}
                        </div>
                      </div>
                      <Badge
                        variant={
                          team.matchedTeamName ? "secondary" : "destructive"
                        }
                        className="text-xs shrink-0"
                      >
                        {team.riders.length - missing.length}/
                        {team.riders.length} riders
                      </Badge>
                    </div>
                    {missing.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 pl-11">
                        Not on the roster:{" "}
                        {missing.map((r) => r.uciName).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        {!loading && !error && rows && (
          <Button onClick={applyIndividual} disabled={visibleRows.length === 0}>
            Prefill {visibleRows.length - unresolved.length} result
            {visibleRows.length - unresolved.length === 1 ? "" : "s"}
          </Button>
        )}
        {!loading && !error && teamRows && (
          <Button onClick={applyTtt} disabled={visibleTeamRows.length === 0}>
            Prefill {visibleTeamRows.filter((t) => t.matchedTeamName).length}{" "}
            team placements
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
