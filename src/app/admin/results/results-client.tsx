"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format-date";
import { bucketRaces, effectiveEnd, isRaceComplete } from "./race-buckets";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type Race = {
  id: number;
  name: string;
  raceType: string;
  startDate: Date;
  endDate: Date | null;
  lastStageDate: Date | null;
  parentRaceId: number | null;
  stageNumber: number | null;
  uciCompetitionId: string | null;
  hasResults: boolean;
  stagesTotal: number;
  stagesWithResults: number;
};

type Props = {
  races: Race[];
  /** Bucketing reference time, taken on the server so render stays pure. */
  now: number;
};

function RaceRow({ race }: { race: Race }) {
  const complete = isRaceComplete(race);
  const end = effectiveEnd(race);
  const spansDays = end.getTime() - race.startDate.getTime() >= 86_400_000;

  return (
    <Link
      href={`/admin/results/${race.id}`}
      className="flex min-h-14 items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{race.name}</span>
          {race.uciCompetitionId && (
            <CheckIcon
              className="h-3.5 w-3.5 shrink-0 text-green-600"
              aria-label="Linked to UCI"
            />
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          {formatDate(race.startDate)}
          {spansDays ? ` – ${formatDate(end)}` : ""}
          {race.stagesTotal > 0 ? ` · ${race.stagesTotal} stages` : ""}
        </div>
      </div>
      {race.stagesTotal > 0 ? (
        <Badge
          variant={complete ? "default" : "outline"}
          className={`shrink-0 text-xs ${
            complete
              ? "border-green-200 bg-green-100 text-green-800 hover:bg-green-100"
              : ""
          }`}
        >
          {race.stagesWithResults}/{race.stagesTotal}
        </Badge>
      ) : complete ? (
        <Badge className="shrink-0 border-green-200 bg-green-100 text-xs text-green-800 hover:bg-green-100">
          Complete
        </Badge>
      ) : null}
      <ChevronRightIcon className="text-muted-foreground h-4 w-4 shrink-0" />
    </Link>
  );
}

export function ResultsClient({ races, now }: Props) {
  const [nameFilter, setNameFilter] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);

  const groups = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    const visible = races
      .filter((r) => !r.parentRaceId)
      .filter((r) => (q ? r.name.toLowerCase().includes(q) : true))
      .filter((r) => (hideCompleted ? !isRaceComplete(r) : true));
    return bucketRaces(visible, now);
  }, [races, nameFilter, hideCompleted, now]);

  const filtering = nameFilter.trim().length > 0;
  const outstanding = groups.previous.filter((r) => !isRaceComplete(r)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Race</CardTitle>
        <CardDescription>
          Open a race to enter or review its results
        </CardDescription>
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:gap-3">
          <input
            type="text"
            placeholder="Filter by name..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="border-input placeholder:text-muted-foreground focus-visible:ring-ring h-11 flex-1 rounded-md border bg-transparent px-3 text-sm focus-visible:ring-1 focus-visible:outline-none sm:h-8"
          />
          <label className="text-muted-foreground flex min-h-11 cursor-pointer items-center gap-2 text-sm select-none sm:min-h-0 sm:whitespace-nowrap">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
              className="size-6 rounded border-gray-300 sm:size-4"
            />
            Hide completed
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Underway and the past week — the races you can actually still enter. */}
        <div className="space-y-1">
          {groups.current.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">
              {filtering || hideCompleted
                ? "No current races match the filters."
                : "No races underway or finished in the last week."}
            </p>
          ) : (
            groups.current.map((race) => <RaceRow key={race.id} race={race} />)
          )}
        </div>

        {(groups.previous.length > 0 || groups.future.length > 0) && (
          <Accordion
            type="multiple"
            // Filtering should reach into the collapsed groups too, otherwise a
            // search for an old race looks like it found nothing.
            value={filtering ? ["previous", "future"] : undefined}
            className="border-t"
          >
            {groups.previous.length > 0 && (
              <AccordionItem value="previous" className="border-b-0">
                <AccordionTrigger className="min-h-12 hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-3 pr-2">
                    <span className="text-sm font-medium">Previous races</span>
                    <div className="flex items-center gap-2">
                      {outstanding > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {outstanding} incomplete
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {groups.previous.length}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-1 pb-2">
                  {groups.previous.map((race) => (
                    <RaceRow key={race.id} race={race} />
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}

            {groups.future.length > 0 && (
              <AccordionItem value="future" className="border-b-0">
                <AccordionTrigger className="min-h-12 hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-3 pr-2">
                    <span className="text-sm font-medium">Future races</span>
                    <span className="text-muted-foreground text-xs">
                      {groups.future.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-1 pb-2">
                  <p className="text-muted-foreground px-3 pb-1 text-xs">
                    Not ridden yet — nothing to enter.
                  </p>
                  {groups.future.map((race) => (
                    <RaceRow key={race.id} race={race} />
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
