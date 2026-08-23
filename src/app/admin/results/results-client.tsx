"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format-date";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type Race = {
  id: number;
  name: string;
  raceType: string;
  startDate: Date;
  parentRaceId: number | null;
  stageNumber: number | null;
  uciCompetitionId: string | null;
  hasResults: boolean;
  stagesTotal: number;
  stagesWithResults: number;
};

type Props = { races: Race[] };

function isRaceComplete(race: Race): boolean {
  if (race.stagesTotal > 0) return race.stagesWithResults === race.stagesTotal;
  return race.hasResults;
}

export function ResultsClient({ races }: Props) {
  const [nameFilter, setNameFilter] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);

  const visible = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    return races
      .filter((r) => !r.parentRaceId)
      .filter((r) => (q ? r.name.toLowerCase().includes(q) : true))
      .filter((r) => (hideCompleted ? !isRaceComplete(r) : true));
  }, [races, nameFilter, hideCompleted]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Race</CardTitle>
        <CardDescription>
          Open a race to enter or review its results
        </CardDescription>
        <div className="flex items-center gap-3 pt-1">
          <input
            type="text"
            placeholder="Filter by name..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="flex-1 h-8 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Hide completed
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            No races match the current filters.
          </p>
        )}
        {visible.map((race) => {
          const complete = isRaceComplete(race);
          return (
            <Link
              key={race.id}
              href={`/admin/results/${race.id}`}
              className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {race.name}
                  </span>
                  {race.uciCompetitionId && (
                    <CheckIcon
                      className="h-3.5 w-3.5 text-green-600 shrink-0"
                      aria-label="Linked to UCI"
                    />
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(race.startDate)}
                  {race.stagesTotal > 0 ? ` · ${race.stagesTotal} stages` : ""}
                </div>
              </div>
              {race.stagesTotal > 0 ? (
                <Badge
                  variant={complete ? "default" : "outline"}
                  className={`text-xs shrink-0 ${
                    complete
                      ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100"
                      : ""
                  }`}
                >
                  {race.stagesWithResults}/{race.stagesTotal}
                </Badge>
              ) : complete ? (
                <Badge className="text-xs shrink-0 bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                  Complete
                </Badge>
              ) : null}
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
