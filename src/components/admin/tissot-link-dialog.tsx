"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  linkTissotCompetition,
  searchTissotCompetitions,
  type TissotCompetitionCandidate,
} from "@/app/admin/results/tissot-actions";
import { CheckIcon, ExternalLinkIcon, LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Props = {
  raceId: number;
  raceName: string;
  linkedCompetitionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: (competitionId: string | null) => void;
};

/**
 * Radix unmounts DialogContent when closed, so the body remounts on every open
 * and searches once from a clean state.
 */
export function TissotLinkDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85dvh] overflow-y-auto">
        <LinkBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function LinkBody({
  raceId,
  raceName,
  linkedCompetitionId,
  onOpenChange,
  onLinked,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<TissotCompetitionCandidate[]>(
    [],
  );
  const [manualId, setManualId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    searchTissotCompetitions(raceId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) setCandidates(res.candidates);
        else setError(res.error);
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

  const save = async (competitionId: string | null) => {
    setSaving(true);
    const res = await linkTissotCompetition(raceId, competitionId);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(
      competitionId ? "Linked to Tissot competition" : "UCI link removed",
    );
    onLinked(competitionId);
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          Link {raceName} to Tissot Timing
        </DialogTitle>
        <DialogDescription>
          Tissot publishes each intermediate sprint and each climb separately.
          The link is stored on the tour so every stage can import from it.
        </DialogDescription>
      </DialogHeader>

      {linkedCompetitionId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Currently linked: </span>
            <a
              href={`https://www.tissottiming.com/competition/${linkedCompetitionId}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:underline inline-flex items-center gap-1"
            >
              {linkedCompetitionId}
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => save(null)}
          >
            Unlink
          </Button>
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Searching the Tissot calendar…
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && candidates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Suggestions
          </p>
          {candidates.map((c) => {
            const isLinked = c.competitionCode === linkedCompetitionId;
            return (
              <button
                key={c.competitionCode}
                disabled={saving}
                onClick={() => save(c.competitionCode)}
                className="w-full min-h-14 text-left rounded-md border px-3 py-2 hover:bg-accent transition-colors disabled:opacity-50 sm:min-h-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {isLinked && (
                      <CheckIcon className="h-4 w-4 text-green-600" />
                    )}
                    <Badge
                      variant={c.score >= 0.9 ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {Math.round(c.score * 100)}% match
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.start} → {c.end}
                  {c.location ? ` · ${c.location}` : ""} ·{" "}
                  <span className="h-11 font-mono sm:h-9">{c.competitionCode}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && candidates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No Tissot competitions matched this race name for the season. Tissot
          only times ASO, Unipublic and Swiss Cycling races.
        </p>
      )}

      <div className="border-t pt-4 space-y-2">
        <Label htmlFor="tissot-manual-code" className="text-xs">
          Or paste a Tissot competition code
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="tissot-manual-code"
            placeholder="vue2026"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            className="font-mono"
          />
          <Button
            variant="outline"
            disabled={saving || !manualId.trim()}
            onClick={() => {
              const code = manualId.trim().toLowerCase();
              if (!/^[a-z]{2,10}\d{4}$/.test(code)) {
                toast.error('Expected something like "vue2026".');
                return;
              }
              save(code);
            }}
          >
            Link
          </Button>
        </div>
      </div>
    </>
  );
}
