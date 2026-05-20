"use client"
import { formatDate } from "@/lib/format-date";

import { ResultAuditTrail } from "@/components/admin/result-audit-trail";
import { ResultCorrectionDialog } from "@/components/admin/result-correction-dialog";
import {
  ResultEntryForm,
  categoryDisplayNames,
} from "@/components/admin/result-entry-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getAuditTrail,
  getNextInstance,
  getResultsForRace,
  getTeamNames,
} from "./actions";

type RaceResult = Awaited<ReturnType<typeof getResultsForRace>>[number];
type AuditTrailEntry = Awaited<ReturnType<typeof getAuditTrail>>[number];

type Race = {
  id: number;
  name: string;
  raceType: string;
  startDate: Date;
  parentRaceId: number | null;
  stageNumber: number | null;
  hasResults: boolean;
  stagesTotal: number;
  stagesWithResults: number;
};

type Rider = {
  id: number;
  name: string;
  team: string;
  nationality: string;
  gender: string;
};

type Props = {
  races: Race[];
  riders: Rider[];
};

// Categories that support multiple instances per stage (D002: mountains + sprints)
const MULTI_INSTANCE_CATEGORIES = new Set([
  "sprint",
  "sprint_giro",
  "mountain_cc_hcx2_af",
  "mountain_hc",
  "mountain_1cat",
  "mountain_2cat",
  "mountain_3_4cat",
  "mountain_highest",
  "mountain_2nd_highest",
  "mountain_1_2cat",
]);

function resolveScoringRaceType(raceType: string, raceName: string): string {
  if (raceType === "grand_tour") {
    const lower = raceName.toLowerCase();
    if (lower.includes("tour de france") || lower.includes("tdf"))
      return "grand_tour_tdf";
  }
  return raceType;
}

function getAvailableCategories(
  raceType: string,
  isStage: boolean,
  isParentRace: boolean,
): string[] {
  // For one-day races (no parent, not multi-stage)
  if (!isStage && !isParentRace) {
    return ["finish"];
  }

  // For stages (has parentRaceId)
  if (isStage) {
    const perStage: string[] = ["stage_finish"];

    if (
      raceType === "grand_tour" ||
      raceType === "grand_tour_tdf" ||
      raceType === "womens_grand_tour"
    ) {
      perStage.push("sprint");
      if (raceType === "grand_tour") perStage.push("sprint_giro");
      // Mountain categories
      if (raceType === "grand_tour" || raceType === "grand_tour_tdf") {
        perStage.push(
          "mountain_cc_hcx2_af",
          "mountain_hc",
          "mountain_1cat",
          "mountain_2cat",
          "mountain_3_4cat",
        );
      }
      if (raceType === "womens_grand_tour") {
        perStage.push("mountain_cc_hcx2_af", "mountain_1_2cat");
      }
      // Jersey categories
      perStage.push(
        "jersey_gc",
        "jersey_points",
        "jersey_kom",
        "jersey_combative",
      );
      // TTT (only on certain stages, but we let admin decide)
      perStage.push("ttt");
    }

    if (raceType === "mini_tour") {
      perStage.push("sprint", "mountain_highest", "mountain_2nd_highest");
      perStage.push(
        "jersey_gc",
        "jersey_points",
        "jersey_kom",
        "jersey_combative",
      );
      perStage.push("ttt");
    }

    return perStage;
  }

  // For parent races (grand_tour, mini_tour, womens_grand_tour) -- end-of-tour
  if (isParentRace) {
    return [
      "end_gc",
      "end_points",
      "end_kom",
      "end_youth",
      "end_combative",
      "end_team",
      "end_other",
    ];
  }

  return ["finish"];
}

function isRaceComplete(race: Race): boolean {
  if (race.stagesTotal > 0) return race.stagesWithResults === race.stagesTotal;
  return race.hasResults;
}

export function ResultsClient({ races, riders }: Props) {
  const router = useRouter();
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [existingResults, setExistingResults] = useState<RaceResult[] | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[] | null>(null);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<RaceResult | null>(null);
  const [nameFilter, setNameFilter] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showingStageOverview, setShowingStageOverview] = useState(false);
  const [formIsDirty, setFormIsDirty] = useState(false);
  const [currentInstance, setCurrentInstance] = useState(1);
  const [currentInstanceLabel, setCurrentInstanceLabel] = useState("");

  const selectedRace = races.find((r) => r.id === selectedRaceId);

  // Stage dedup: compute the selected parent race ID
  const selectedParentId = selectedRace?.parentRaceId ?? selectedRaceId;

  // Group races by type — computed before handleRaceSelect so the handler can reference stagesByParent
  const allParentRaces = races.filter((r) => !r.parentRaceId);
  const parentRaces = allParentRaces.filter((race) => {
    if (nameFilter && !race.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (hideCompleted && isRaceComplete(race)) return false;
    return true;
  });
  const stagesByParent = races
    .filter((r) => r.parentRaceId)
    .reduce(
      (acc, stage) => {
        if (!acc[stage.parentRaceId!]) {
          acc[stage.parentRaceId!] = [];
        }
        acc[stage.parentRaceId!].push(stage);
        return acc;
      },
      {} as Record<number, Race[]>,
    );

  // Available categories for current race — used for category navigation
  const currentIsStage = !!selectedRace?.parentRaceId;
  const currentParentRace = currentIsStage
    ? races.find((r) => r.id === selectedRace?.parentRaceId)
    : null;
  const currentIsParentRace = selectedRace
    ? races.some((r) => r.parentRaceId === selectedRace.id)
    : false;
  const currentRaceTypeForCategories =
    currentIsStage && currentParentRace
      ? resolveScoringRaceType(
          currentParentRace.raceType,
          currentParentRace.name,
        )
      : selectedRace
        ? resolveScoringRaceType(selectedRace.raceType, selectedRace.name)
        : "";
  const currentAvailableCategories = selectedRace
    ? getAvailableCategories(
        currentRaceTypeForCategories,
        currentIsStage,
        currentIsParentRace,
      )
    : [];

  // Prev/next category navigation
  const currentCatIndex = selectedCategory
    ? currentAvailableCategories.indexOf(selectedCategory)
    : -1;
  const prevCategory =
    currentCatIndex > 0
      ? currentAvailableCategories[currentCatIndex - 1]
      : null;
  const nextCategory =
    currentCatIndex < currentAvailableCategories.length - 1
      ? currentAvailableCategories[currentCatIndex + 1]
      : null;

  const handleCategoryNav = (category: string) => {
    if (
      formIsDirty &&
      !window.confirm("You have unsaved changes. Navigate away without saving?")
    )
      return;
    setFormIsDirty(false);
    setCurrentInstance(1);
    setCurrentInstanceLabel("");
    setSelectedCategory(category);
  };

  const handleRaceSelect = async (raceId: number) => {
    const race = races.find((r) => r.id === raceId);

    // If this is a parent race (has stages), show the stage overview instead of the category picker
    const isParentRace =
      stagesByParent[raceId] && stagesByParent[raceId].length > 0;
    if (isParentRace) {
      setSelectedRaceId(raceId);
      setSelectedCategory(null);
      setExistingResults(null);
      setAuditTrail(null);
      setShowingStageOverview(true);
      setModalOpen(true);
      return;
    }

    // Not a parent race (one-day or individual stage) — clear stage overview
    setShowingStageOverview(false);
    setSelectedRaceId(raceId);
    setSelectedCategory(null); // Reset category when switching races
    setCurrentInstance(1);
    setCurrentInstanceLabel("");
    setLoading(true);

    // Always fetch existing results and audit trail (even for stages marked as no results — may be stale)
    const [results, audit] = await Promise.all([
      getResultsForRace(raceId),
      getAuditTrail(raceId),
    ]);
    setExistingResults(results.length > 0 ? results : null);
    setAuditTrail(audit.length > 0 ? audit : null);

    // Load team names for TTT
    const expectedGender = (
      race?.raceType.startsWith("womens_") ? "F" : "M"
    ) as "M" | "F";
    const teams = await getTeamNames(expectedGender);
    setTeamNames(teams);

    setLoading(false);
    setModalOpen(true);
  };

  const handleSuccess = async () => {
    if (!selectedRaceId) return;
    // Stay on the same stage — go to category picker so admin can enter the next category
    setSelectedCategory("__picker__");
    setFormIsDirty(false);
    // Refresh results and audit trail
    const [results, audit] = await Promise.all([
      getResultsForRace(selectedRaceId),
      getAuditTrail(selectedRaceId),
    ]);
    setExistingResults(results.length > 0 ? results : null);
    setAuditTrail(audit.length > 0 ? audit : null);
    // Refresh server data (Done badges, stagesWithResults counts) without closing modal
    router.refresh();
  };

  const handleEditResult = (result: RaceResult) => {
    setSelectedResult(result);
    setCorrectionDialogOpen(true);
  };

  // Modal content
  const modalContent =
    showingStageOverview && selectedRace ? (
      // Stage overview for parent race
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {stagesByParent[selectedRace.id]?.length || 0} stages total
        </p>
        <div className="space-y-2">
          {(stagesByParent[selectedRace.id] || [])
            .sort((a, b) => (a.stageNumber || 0) - (b.stageNumber || 0))
            .map((stage) => (
              <button
                key={stage.id}
                onClick={() => handleRaceSelect(stage.id)}
                className="w-full text-left px-4 py-3 rounded-md border hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-sm">{stage.name}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(stage.startDate)}
                    </div>
                  </div>
                  {stage.hasResults ? (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      Done
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs shrink-0">
                      Pending
                    </Badge>
                  )}
                </div>
              </button>
            ))}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setShowingStageOverview(false);
            setSelectedCategory("__picker__");
          }}
        >
          Enter End-of-Tour Results
        </Button>
      </div>
    ) : loading ? (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    ) : existingResults && !selectedCategory ? (
      <>
        <Tabs defaultValue="results" className="w-full">
          <TabsList>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="history">Change History</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-4">
            <div className="space-y-6">
              {/* Group results by category and instance */}
              {(() => {
                // Build two-level grouping: category → instance → results
                type InstanceGroup = {
                  instance: number;
                  instanceLabel: string | null;
                  results: RaceResult[];
                };
                const categoryMap: Record<string, InstanceGroup[]> = {};

                for (const result of existingResults) {
                  const cat = result.category || "finish";
                  const inst = result.instance ?? 1;
                  if (!categoryMap[cat]) categoryMap[cat] = [];
                  let group = categoryMap[cat].find((g) => g.instance === inst);
                  if (!group) {
                    group = {
                      instance: inst,
                      instanceLabel: result.instanceLabel ?? null,
                      results: [],
                    };
                    categoryMap[cat].push(group);
                  }
                  group.results.push(result);
                }

                // Sort instances within each category
                for (const groups of Object.values(categoryMap)) {
                  groups.sort((a, b) => a.instance - b.instance);
                }

                return Object.entries(categoryMap).map(
                  ([category, instanceGroups]) => {
                    const isMultiInstance =
                      MULTI_INSTANCE_CATEGORIES.has(category);
                    const hasMultipleInstances = instanceGroups.length > 1;
                    const categoryName =
                      categoryDisplayNames[category] || category;

                    return (
                      <Card key={category}>
                        <CardHeader>
                          <CardTitle>{categoryName}</CardTitle>
                          <CardDescription>
                            {hasMultipleInstances
                              ? `${instanceGroups.length} instances entered`
                              : "Click the edit button to correct any result"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {instanceGroups.map((group) => (
                            <div key={`${category}-${group.instance}`}>
                              {/* Show instance header when multi-instance */}
                              {(hasMultipleInstances ||
                                (isMultiInstance && group.instance >= 1)) &&
                                instanceGroups.length > 0 && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      #{group.instance}
                                    </Badge>
                                    {group.instanceLabel && (
                                      <span className="text-sm font-medium">
                                        {group.instanceLabel}
                                      </span>
                                    )}
                                    {!group.instanceLabel &&
                                      hasMultipleInstances && (
                                        <span className="text-sm text-muted-foreground">
                                          {categoryName} #{group.instance}
                                        </span>
                                      )}
                                  </div>
                                )}
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-20">
                                      Position
                                    </TableHead>
                                    <TableHead>Rider</TableHead>
                                    <TableHead>Team</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead className="text-right">
                                      Points
                                    </TableHead>
                                    <TableHead className="w-20"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.results
                                    .sort((a, b) => a.position - b.position)
                                    .map((result) => (
                                      <TableRow key={result.id}>
                                        <TableCell className="font-medium">
                                          {result.position}
                                        </TableCell>
                                        <TableCell>
                                          {result.riderName}
                                        </TableCell>
                                        <TableCell>
                                          {result.riderTeam}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                          {result.time || "—"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {result.points}
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              handleEditResult(result)
                                            }
                                          >
                                            <PencilIcon className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                              {/* Separator between instances */}
                              {hasMultipleInstances &&
                                group.instance <
                                  instanceGroups[instanceGroups.length - 1]
                                    .instance && (
                                  <div className="border-t my-3" />
                                )}
                            </div>
                          ))}

                          {/* "Add another" button for multi-instance categories */}
                          {isMultiInstance && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2"
                              onClick={async () => {
                                const nextInstance = await getNextInstance(
                                  selectedRaceId!,
                                  category,
                                );
                                setCurrentInstance(nextInstance);
                                setCurrentInstanceLabel("");
                                setSelectedCategory(category);
                              }}
                            >
                              <PlusIcon className="h-4 w-4 mr-2" />
                              Add another {categoryName.toLowerCase()}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  },
                );
              })()}

              {/* Add more results button */}
              {!selectedCategory && (
                <Button
                  variant="outline"
                  onClick={() => setSelectedCategory("__picker__")}
                  className="w-full"
                >
                  Add More Results
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {auditTrail && <ResultAuditTrail auditEntries={auditTrail} />}
          </TabsContent>
        </Tabs>

        {selectedResult && (
          <ResultCorrectionDialog
            result={selectedResult}
            riders={riders}
            raceType={selectedRace?.raceType || ""}
            open={correctionDialogOpen}
            onOpenChange={setCorrectionDialogOpen}
            onSuccess={handleSuccess}
          />
        )}
      </>
    ) : selectedCategory && selectedCategory !== "__picker__" ? (
      // Show result entry form for selected category
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => setSelectedCategory(null)}
          className="mb-2"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-2" />
          Back to category selection
        </Button>
        {/* Instance label input for multi-instance categories */}
        {MULTI_INSTANCE_CATEGORIES.has(selectedCategory) && (
          <div className="flex items-center gap-3 px-1">
            <Badge variant="outline" className="shrink-0">
              #{currentInstance}
            </Badge>
            <input
              type="text"
              placeholder="Optional label (e.g. Col du Galibier)"
              value={currentInstanceLabel}
              onChange={(e) => setCurrentInstanceLabel(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}
        <ResultEntryForm
          raceId={selectedRaceId!}
          riders={riders}
          raceType={selectedRace?.raceType || ""}
          category={selectedCategory}
          instance={currentInstance}
          instanceLabel={currentInstanceLabel || undefined}
          teams={teamNames}
          onSuccess={handleSuccess}
          onDirtyChange={setFormIsDirty}
        />
      </div>
    ) : (
      // Show category picker
      (() => {
        if (!selectedRace) return null;

        // Determine raceType for scoring
        const isStage = !!selectedRace.parentRaceId;
        const parentRace = isStage
          ? races.find((r) => r.id === selectedRace.parentRaceId)
          : null;
        const raceTypeForCategories =
          isStage && parentRace
            ? resolveScoringRaceType(parentRace.raceType, parentRace.name)
            : resolveScoringRaceType(selectedRace.raceType, selectedRace.name);

        // Determine if this is a parent race (has stages)
        const isParentRace = races.some(
          (r) => r.parentRaceId === selectedRace.id,
        );

        const availableCategories = getAvailableCategories(
          raceTypeForCategories,
          isStage,
          isParentRace,
        );

        return (
          <Card>
            <CardHeader>
              <CardTitle>Select Result Category</CardTitle>
              <CardDescription>
                Choose the type of result you want to enter for{" "}
                {selectedRace.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableCategories.map((category) => (
                  <Button
                    key={category}
                    variant="outline"
                    onClick={() => {
                      setFormIsDirty(false);
                      setCurrentInstance(1);
                      setCurrentInstanceLabel("");
                      setSelectedCategory(category);
                    }}
                    className="h-auto py-4 px-4 text-left justify-start"
                  >
                    <div>
                      <div className="font-medium">
                        {categoryDisplayNames[category] || category}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()
    );

  return (
    <div>
      {/* Race selector — full width */}
      <Card>
        <CardHeader>
          <CardTitle>Select Race</CardTitle>
          <CardDescription>
            Choose a race to enter or view results
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
        <CardContent className="space-y-2">
          {parentRaces.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No races match the current filters.</p>
          )}
          {parentRaces.map((race) => {
            const complete = isRaceComplete(race);
            return (
            <div key={race.id} className="space-y-1">
              <button
                onClick={() => handleRaceSelect(race.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors ${
                  selectedRaceId === race.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{race.name}</span>
                  {race.stagesTotal > 0 ? (
                    complete ? (
                      <Badge className="text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                        {race.stagesWithResults}/{race.stagesTotal} complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {race.stagesWithResults}/{race.stagesTotal} done
                      </Badge>
                    )
                  ) : complete ? (
                    <Badge className="text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                      Complete
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(race.startDate)}
                </div>
              </button>

              {/* Show stages only for the currently selected parent or the parent of the selected stage */}
              {stagesByParent[race.id] && race.id === selectedParentId && (
                <div className="ml-4 space-y-1">
                  {stagesByParent[race.id]
                    .sort((a, b) => (a.stageNumber || 0) - (b.stageNumber || 0))
                    .map((stage) => (
                      <button
                        key={stage.id}
                        onClick={() => handleRaceSelect(stage.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-xs hover:bg-accent transition-colors ${
                          selectedRaceId === stage.id ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{stage.name}</span>
                          {stage.hasResults && (
                            <Badge variant="secondary" className="text-xs">
                              Done
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )})}
        </CardContent>
      </Card>

      {/* Modal dialog for results area */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[80vw] sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRace?.name}</DialogTitle>
            {selectedCategory && selectedCategory !== "__picker__" && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!prevCategory}
                  onClick={() =>
                    prevCategory && handleCategoryNav(prevCategory)
                  }
                  className="text-xs"
                >
                  <ChevronLeftIcon className="h-3 w-3 mr-1" />
                  {prevCategory
                    ? categoryDisplayNames[prevCategory] || prevCategory
                    : "—"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!nextCategory}
                  onClick={() =>
                    nextCategory && handleCategoryNav(nextCategory)
                  }
                  className="text-xs"
                >
                  {nextCategory
                    ? categoryDisplayNames[nextCategory] || nextCategory
                    : "—"}
                  <ChevronRightIcon className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </DialogHeader>
          {modalContent}
        </DialogContent>
      </Dialog>
    </div>
  );
}
