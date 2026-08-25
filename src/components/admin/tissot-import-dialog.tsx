"use client";

import {
  applyTissotStage,
  previewTissotStage,
} from "@/app/admin/results/tissot-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsivePanel,
  ResponsivePanelBody,
  ResponsivePanelDescription,
  ResponsivePanelFooter,
  ResponsivePanelHeader,
  ResponsivePanelTitle,
} from "@/components/ui/responsive-panel";
import { categoryDisplayNames } from "@/components/admin/result-entry-form";
import { AlertTriangleIcon, MountainIcon, TimerIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Props = {
  raceId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
  onNeedsLink?: () => void;
};

/** Below this a match wants a human eye. */
const CONFIDENT = 0.9;

export function TissotImportDialog(props: Props) {
  return (
    <ResponsivePanel open={props.open} onOpenChange={props.onOpenChange}>
      <ImportBody {...props} />
    </ResponsivePanel>
  );
}

type Preview = Awaited<ReturnType<typeof previewTissotStage>>;

function ImportBody({ raceId, onOpenChange, onApplied, onNeedsLink }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLink, setNeedsLink] = useState(false);
  const [preview, setPreview] = useState<Extract<
    Preview,
    { success: true }
  > | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    previewTissotStage(raceId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.error);
          setNeedsLink("needsLink" in res && res.needsLink === true);
          return;
        }
        setPreview(res);
        // Everything importable starts selected.
        setSelected(
          new Set(
            res.groups
              .filter((g) => g.category && g.rows.some((r) => r.matchedRider))
              .map((g) => g.key),
          ),
        );
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
  }, [raceId]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const importable = (preview?.groups ?? []).filter(
    (g) => g.category && g.rows.some((r) => r.matchedRider),
  );
  const chosen = importable.filter((g) => selected.has(g.key));

  const apply = async () => {
    if (!preview || chosen.length === 0) return;
    setSaving(true);
    const res = await applyTissotStage({
      raceId,
      groups: chosen.map((g) => ({
        category: g.category!,
        instance: g.instance,
        instanceLabel: g.label || undefined,
        results: g.rows
          .filter((r) => r.matchedRider)
          .map((r) => ({ position: r.position, riderId: r.matchedRider!.id })),
      })),
    });
    setSaving(false);

    if (res.applied.length > 0) {
      toast.success(
        `Imported ${res.applied.length} ${res.applied.length === 1 ? "entry" : "entries"} from Tissot`,
      );
      onApplied();
    }
    if (res.failed.length > 0) {
      for (const f of res.failed) {
        toast.error(`${f.category} #${f.instance}: ${f.error}`);
      }
      return;
    }
    onOpenChange(false);
  };

  return (
    <>
      <ResponsivePanelHeader>
        <ResponsivePanelTitle>
          <MountainIcon className="h-4 w-4 shrink-0" />
          Import sprints &amp; climbs from Tissot
        </ResponsivePanelTitle>
        <ResponsivePanelDescription>
          {preview
            ? `${preview.competitionCode} · stage ${preview.stageNumber} · ${preview.stageName}`
            : "Intermediate sprints and per-climb mountain points, which UCI does not publish."}
        </ResponsivePanelDescription>
      </ResponsivePanelHeader>

      <ResponsivePanelBody>

      {loading && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Reading the stage timeline…
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
              className="w-full sm:w-auto"
              onClick={() => {
                onOpenChange(false);
                onNeedsLink?.();
              }}
            >
              Link a Tissot competition
            </Button>
          )}
        </div>
      )}

      {!loading && !error && preview && (
        <div className="space-y-4">
          {preview.groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tissot has no sprint or climb data for this stage yet.
            </p>
          )}

          {preview.tiersProvisional && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2">
              <AlertTriangleIcon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm">
                Mountain categories for a mini tour are relative to the whole
                race, and only {preview.stagesWithData} of {preview.stagesTotal}{" "}
                stages have data. If a harder climb comes later, what counts as
                the highest category will shift — re-import once the race has
                finished.
              </p>
            </div>
          )}

          {preview.groups.map((group) => {
            const canImport =
              !!group.category && group.rows.some((r) => r.matchedRider);
            const isOn = selected.has(group.key);
            const unmatched = group.rows.filter((r) => !r.matchedRider);
            const weak = group.rows.filter(
              (r) => r.matchedRider && r.matchScore < CONFIDENT,
            );

            return (
              <div
                key={group.key}
                className={`rounded-md border px-3 py-2.5 ${canImport ? "" : "opacity-60"}`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isOn}
                    disabled={!canImport || saving}
                    onChange={() => toggle(group.key)}
                    // 24px is the WCAG 2.5.8 (AA) floor for a pointer target.
                    className="mt-0.5 size-6 shrink-0 sm:mt-1 sm:size-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {group.kind === "sprint" ? (
                        <TimerIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <MountainIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">
                        {group.label || "(unnamed)"}
                      </span>
                      {group.distanceKm != null && (
                        <span className="text-xs text-muted-foreground">
                          km {group.distanceKm}
                        </span>
                      )}
                      {group.tier && (
                        <Badge variant="outline" className="text-xs">
                          {group.tier}
                          {group.tierInferred ? " (inferred)" : ""}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {group.category ? (
                        <>
                          →{" "}
                          {categoryDisplayNames[group.category] ??
                            group.category}{" "}
                          #{group.instance}
                        </>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-500">
                          {group.skipReason}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-0.5">
                      {group.rows.map((r) => (
                        <div
                          key={`${group.key}-${r.position}`}
                          className="flex items-baseline gap-2 text-xs"
                        >
                          <span className="text-muted-foreground w-4 shrink-0 tabular-nums">
                            {r.position}
                          </span>
                          <span className="w-28 shrink-0 truncate sm:w-44 lg:w-52">
                            {r.tissotName}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {r.matchedRider ? (
                              <>
                                → {r.matchedRider.name}
                                {r.matchScore < CONFIDENT && (
                                  <span className="text-amber-700 dark:text-amber-500">
                                    {" "}
                                    ({Math.round(r.matchScore * 100)}%)
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-destructive">
                                not on the roster — skipped
                              </span>
                            )}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {r.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {(unmatched.length > 0 || weak.length > 0) && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {unmatched.length > 0 &&
                          `${unmatched.length} rider${unmatched.length === 1 ? "" : "s"} skipped. `}
                        {weak.length > 0 &&
                          `${weak.length} match${weak.length === 1 ? "" : "es"} below ${Math.round(CONFIDENT * 100)}% — check before importing.`}
                      </p>
                    )}
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      )}

      </ResponsivePanelBody>

      <ResponsivePanelFooter>
        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        {!loading && !error && preview && (
          <Button onClick={apply} disabled={saving || chosen.length === 0}>
            {saving
              ? "Importing…"
              : `Import ${chosen.length} of ${importable.length}`}
          </Button>
        )}
      </ResponsivePanelFooter>
    </>
  );
}
