"use client";

import {
  getAuditTrail,
  getNextInstance,
  getRaceDetail,
  getResultsForRace,
} from "../actions";
import {
  MULTI_INSTANCE_CATEGORIES,
  getAvailableCategories,
  groupCategories,
  resolveScoringRaceType,
} from "../categories";
import { ResultAuditTrail } from "@/components/admin/result-audit-trail";
import { ResultCorrectionDialog } from "@/components/admin/result-correction-dialog";
import {
  ResultEntryForm,
  categoryDisplayNames,
} from "@/components/admin/result-entry-form";
import { TissotImportDialog } from "@/components/admin/tissot-import-dialog";
import { TissotLinkDialog } from "@/components/admin/tissot-link-dialog";
import { UciLinkDialog } from "@/components/admin/uci-link-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format-date";
import { canImportFromUci } from "@/lib/uci/category-map";
import {
  CheckIcon,
  ExternalLinkIcon,
  LinkIcon,
  MountainIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Detail = NonNullable<Awaited<ReturnType<typeof getRaceDetail>>>;
type RaceResult = Awaited<ReturnType<typeof getResultsForRace>>[number];
type AuditTrailEntry = Awaited<ReturnType<typeof getAuditTrail>>[number];
type Rider = {
  id: number;
  name: string;
  team: string;
  nationality: string;
  gender: string;
};

type Props = {
  detail: Detail;
  riders: Rider[];
  results: RaceResult[];
  auditTrail: AuditTrailEntry[];
};

export function RaceResultsClient({
  detail,
  riders,
  results,
  auditTrail,
}: Props) {
  const router = useRouter();
  const { race, root, stages } = detail;

  const [linkedId, setLinkedId] = useState(
    race.uciCompetitionId ?? root.uciCompetitionId ?? null,
  );
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [tissotCode, setTissotCode] = useState(
    race.tissotCompetitionCode ?? root.tissotCompetitionCode ?? null,
  );
  const [tissotLinkOpen, setTissotLinkOpen] = useState(false);
  const [tissotImportOpen, setTissotImportOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<RaceResult | null>(null);
  /** Selected instance + label per multi-instance category. */
  const [instances, setInstances] = useState<
    Record<string, { instance: number; label: string }>
  >({});

  const isStage = race.parentRaceId != null;
  const isTour = !isStage && stages.length > 0;
  const scoringRaceType = resolveScoringRaceType(root.raceType, root.name);
  const categories = getAvailableCategories(scoringRaceType, isStage, isTour);
  const groups = groupCategories(categories);

  // category → instance → results
  const byCategory = new Map<string, Map<number, RaceResult[]>>();
  for (const r of results) {
    const cat = r.category || "finish";
    const inst = r.instance ?? 1;
    if (!byCategory.has(cat)) byCategory.set(cat, new Map());
    const instMap = byCategory.get(cat)!;
    if (!instMap.has(inst)) instMap.set(inst, []);
    instMap.get(inst)!.push(r);
  }

  const refresh = () => router.refresh();

  const instanceStateFor = (category: string) =>
    instances[category] ?? { instance: 1, label: "" };

  const setInstanceState = (
    category: string,
    next: { instance: number; label: string },
  ) => setInstances((prev) => ({ ...prev, [category]: next }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isStage && (
              <Link
                href={`/admin/results/${root.id}?scope=tour`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {root.name}
              </Link>
            )}
            {isStage && <span className="text-muted-foreground">/</span>}
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{race.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(race.startDate)} · {root.raceType.replace(/_/g, " ")}
            {isTour ? ` · ${stages.length} stages` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {linkedId ? (
            <>
              <a
                href={`https://www.uci.org/competition-details/${linkedId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckIcon className="h-3.5 w-3.5 text-green-600" />
                UCI <span className="font-mono">{linkedId}</span>
                <ExternalLinkIcon className="h-3 w-3" />
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLinkDialogOpen(true)}
              >
                Change
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLinkDialogOpen(true)}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Link UCI competition
            </Button>
          )}

          {tissotCode ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckIcon className="h-3.5 w-3.5 text-green-600" />
                Tissot <span className="font-mono">{tissotCode}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTissotLinkOpen(true)}
              >
                Change
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTissotLinkOpen(true)}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Link Tissot competition
            </Button>
          )}
        </div>
      </div>

      <UciLinkDialog
        raceId={race.id}
        raceName={root.name}
        linkedCompetitionId={linkedId}
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        onLinked={(id) => {
          setLinkedId(id);
          refresh();
        }}
      />

      <TissotLinkDialog
        raceId={race.id}
        raceName={root.name}
        linkedCompetitionId={tissotCode}
        open={tissotLinkOpen}
        onOpenChange={setTissotLinkOpen}
        onLinked={(code) => {
          setTissotCode(code);
          refresh();
        }}
      />

      <TissotImportDialog
        raceId={race.id}
        open={tissotImportOpen}
        onOpenChange={setTissotImportOpen}
        onApplied={refresh}
        onNeedsLink={() => setTissotLinkOpen(true)}
      />

      {/* Stage selector */}
      {stages.length > 0 && (
        <Card className="gap-3 p-0 sm:gap-6 sm:p-6">
          <CardHeader className="px-3 pt-3 pb-0 sm:px-6 sm:pt-0 sm:pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stages
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-6 sm:pb-0">
            <div className="flex flex-wrap gap-1.5">
              {stages.map((stage) => {
                const active = stage.id === race.id;
                const done = stage.resultCount > 0;
                return (
                  <Link
                    key={stage.id}
                    href={`/admin/results/${stage.id}`}
                    className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors sm:min-h-0 sm:min-w-0 sm:py-1.5 ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    } ${stage.isRestDay ? "opacity-60" : ""}`}
                  >
                    <span className="font-medium">
                      {stage.stageNumber ?? "?"}
                    </span>
                    {stage.isRestDay ? (
                      <span>Rest</span>
                    ) : done ? (
                      <span
                        className={
                          active ? "" : "text-muted-foreground"
                        }
                      >
                        {stage.categoryCount} cat
                      </span>
                    ) : (
                      <span className={active ? "" : "text-muted-foreground"}>
                        —
                      </span>
                    )}
                  </Link>
                );
              })}
              <Link
                href={`/admin/results/${root.id}?scope=tour`}
                className={`inline-flex min-h-11 items-center rounded-md border px-3 text-xs transition-colors sm:min-h-0 sm:py-1.5 ${
                  race.id === root.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                End of tour
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="enter">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="enter" className="flex-1 sm:flex-none">Enter results</TabsTrigger>
          <TabsTrigger value="entered" className="flex-1 sm:flex-none">
            Entered
            {results.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {byCategory.size}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 sm:flex-none">History</TabsTrigger>
        </TabsList>

        {/* --- Enter results: category accordion --- */}
        <TabsContent value="enter" className="mt-4 space-y-6">
          {isStage && (
            <div className="flex flex-col gap-3 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Sprints &amp; climbs</p>
                <p className="text-xs text-muted-foreground">
                  {tissotCode
                    ? "Import every intermediate sprint and classified climb for this stage in one pass."
                    : "Link a Tissot competition to import intermediate sprints and per-climb points — UCI does not publish them."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-11 w-full shrink-0 sm:h-9 sm:w-auto"
                onClick={() =>
                  tissotCode ? setTissotImportOpen(true) : setTissotLinkOpen(true)
                }
              >
                <MountainIcon className="h-4 w-4 mr-2" />
                {tissotCode ? "Import from Tissot" : "Link Tissot"}
              </Button>
            </div>
          )}
          {isTour && (
            <p className="text-sm text-muted-foreground">
              These are the end-of-tour classifications. Pick a stage above to
              enter stage results.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h2>
              <Accordion type="single" collapsible className="border rounded-md">
                {group.categories.map((category) => {
                  const instMap = byCategory.get(category);
                  const entered = instMap
                    ? [...instMap.values()].reduce((n, rs) => n + rs.length, 0)
                    : 0;
                  const instanceCount = instMap?.size ?? 0;
                  const isMulti = MULTI_INSTANCE_CATEGORIES.has(category);
                  const state = instanceStateFor(category);

                  return (
                    <AccordionItem
                      key={category}
                      value={category}
                      className="last:border-b-0"
                    >
                      <AccordionTrigger className="min-h-12 px-3 hover:no-underline sm:px-4">
                        <div className="flex flex-1 items-center justify-between gap-3 pr-2">
                          <span className="text-sm font-medium">
                            {categoryDisplayNames[category] ?? category}
                          </span>
                          <div className="flex items-center gap-2">
                            {canImportFromUci(category) && linkedId && (
                              <Badge variant="outline" className="text-xs">
                                UCI
                              </Badge>
                            )}
                            {entered > 0 ? (
                              <Badge variant="secondary" className="text-xs">
                                {isMulti && instanceCount > 1
                                  ? `${instanceCount} instances`
                                  : `${entered} entered`}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                empty
                              </span>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-2 pb-4 sm:px-4">
                        {/* Instance picker for per-climb / per-sprint categories */}
                        {isMulti && (
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {[...(instMap?.keys() ?? [])]
                              .sort((a, b) => a - b)
                              .map((inst) => {
                                const label =
                                  instMap?.get(inst)?.[0]?.instanceLabel ?? "";
                                return (
                                  <Button
                                    key={inst}
                                    type="button"
                                    size="sm"
                                    variant={
                                      state.instance === inst
                                        ? "default"
                                        : "outline"
                                    }
                                    onClick={() =>
                                      setInstanceState(category, {
                                        instance: inst,
                                        label,
                                      })
                                    }
                                  >
                                    #{inst}
                                    {label ? ` ${label}` : ""}
                                  </Button>
                                );
                              })}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const next = await getNextInstance(
                                  race.id,
                                  category,
                                );
                                setInstanceState(category, {
                                  instance: next,
                                  label: "",
                                });
                              }}
                            >
                              <PlusIcon className="h-4 w-4 mr-1" />
                              New
                            </Button>
                            <Input
                              placeholder="Optional label (e.g. Col du Galibier)"
                              value={state.label}
                              onChange={(e) =>
                                setInstanceState(category, {
                                  ...state,
                                  label: e.target.value,
                                })
                              }
                              className="h-9 max-w-xs"
                            />
                          </div>
                        )}

                        <ResultEntryForm
                          key={`${category}-${state.instance}`}
                          raceId={race.id}
                          riders={riders}
                          raceType={root.raceType}
                          category={category}
                          instance={isMulti ? state.instance : 1}
                          instanceLabel={
                            isMulti && state.label ? state.label : undefined
                          }
                          onSuccess={refresh}
                          onRequestUciLink={() => setLinkDialogOpen(true)}
                          uciLinked={!!linkedId}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          ))}
        </TabsContent>

        {/* --- Entered results --- */}
        <TabsContent value="entered" className="mt-4 space-y-6">
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No results entered for {race.name} yet.
            </p>
          )}
          {[...byCategory.entries()].map(([category, instMap]) => (
            <Card key={category} className="gap-4 p-0 sm:gap-6 sm:p-6">
              <CardHeader className="px-3 pt-3 sm:px-6 sm:pt-0">
                <CardTitle className="text-base">
                  {categoryDisplayNames[category] ?? category}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-3 pb-3 sm:px-6 sm:pb-0">
                {[...instMap.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .map(([instance, rows]) => (
                    <div key={instance}>
                      {instMap.size > 1 && (
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            #{instance}
                          </Badge>
                          {rows[0]?.instanceLabel && (
                            <span className="text-sm font-medium">
                              {rows[0].instanceLabel}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Phones get one card per result — these are read a
                          line at a time, not scanned across columns, so a
                          sideways-scrolling table would be the wrong trade. */}
                      <ul className="space-y-1.5 sm:hidden">
                        {rows
                          .slice()
                          .sort((a, b) => a.position - b.position)
                          .map((r) => (
                            <li
                              key={r.id}
                              className="flex items-center gap-3 rounded-md border px-3 py-2"
                            >
                              <span className="w-6 shrink-0 text-sm font-medium tabular-nums">
                                {r.position}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm">{r.riderName}</div>
                                <div className="text-muted-foreground truncate text-xs">
                                  {r.riderTeam}
                                </div>
                              </div>
                              <span className="shrink-0 text-sm tabular-nums">
                                {r.points}
                                <span className="text-muted-foreground text-xs"> pts</span>
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Correct position ${r.position}`}
                                className="size-11 shrink-0"
                                onClick={() => {
                                  setSelectedResult(r);
                                  setCorrectionOpen(true);
                                }}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                      </ul>

                      <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Pos</TableHead>
                            <TableHead>Rider</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows
                            .slice()
                            .sort((a, b) => a.position - b.position)
                            .map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium tabular-nums">
                                  {r.position}
                                </TableCell>
                                <TableCell>{r.riderName}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {r.riderTeam}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {r.points}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Correct position ${r.position}`}
                                    onClick={() => {
                                      setSelectedResult(r);
                                      setCorrectionOpen(true);
                                    }}
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {auditTrail.length > 0 ? (
            <ResultAuditTrail auditEntries={auditTrail} />
          ) : (
            <p className="text-sm text-muted-foreground">No changes recorded.</p>
          )}
        </TabsContent>
      </Tabs>

      {selectedResult && (
        <ResultCorrectionDialog
          result={selectedResult}
          riders={riders}
          raceType={root.raceType}
          open={correctionOpen}
          onOpenChange={setCorrectionOpen}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
