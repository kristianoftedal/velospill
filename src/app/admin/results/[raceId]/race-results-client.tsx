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
      <div className="flex items-start justify-between gap-4 flex-wrap">
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
            <h1 className="text-2xl font-bold tracking-tight">{race.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(race.startDate)} · {root.raceType.replace(/_/g, " ")}
            {isTour ? ` · ${stages.length} stages` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((stage) => {
                const active = stage.id === race.id;
                const done = stage.resultCount > 0;
                return (
                  <Link
                    key={stage.id}
                    href={`/admin/results/${stage.id}`}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
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
                className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
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
        <TabsList>
          <TabsTrigger value="enter">Enter results</TabsTrigger>
          <TabsTrigger value="entered">
            Entered
            {results.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {byCategory.size}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Change history</TabsTrigger>
        </TabsList>

        {/* --- Enter results: category accordion --- */}
        <TabsContent value="enter" className="mt-4 space-y-6">
          {isStage && (
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
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
                      <AccordionTrigger className="px-4 hover:no-underline">
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
                      <AccordionContent className="px-4 pb-4">
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
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base">
                  {categoryDisplayNames[category] ?? category}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
