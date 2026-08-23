/**
 * Maps velospill result categories onto UCI classification titles.
 *
 * UCI publishes finishing order and cumulative classifications, but never the
 * per-climb / per-intermediate-sprint ordering that velospill's multi-instance
 * sprint and mountain categories need — those stay manual. Combativity and the
 * team classification are absent from UCI data altogether.
 */

export type UciCategorySource = {
  /** "stage" reads the stage's own accordion section, "final" the "Final Result" one. */
  scope: "stage" | "final";
  /** Candidate UCI classification titles, most specific first. */
  titles: string[];
  /** UCI publishes this as a team event (shared rank across a team's riders). */
  teamResult?: boolean;
  /** Only the rank-1 rider is relevant (jersey holders). */
  leaderOnly?: boolean;
};

export const UCI_CATEGORY_SOURCES: Record<string, UciCategorySource> = {
  // One-day races: the single accordion section is "Final Result".
  finish: { scope: "final", titles: ["General Classification"] },

  // Per-stage.
  stage_finish: { scope: "stage", titles: ["Stage Classification"] },
  ttt: { scope: "stage", titles: ["Stage Classification"], teamResult: true },

  // Jersey holders — rank 1 of the stage's own standings.
  jersey_gc: {
    scope: "stage",
    titles: ["Stage General Classification", "General Classification"],
    leaderOnly: true,
  },
  jersey_points: {
    scope: "stage",
    titles: ["Overall Points Classification", "Points Classification"],
    leaderOnly: true,
  },
  jersey_kom: {
    scope: "stage",
    titles: ["Overall Mountain Classification", "Mountain Classification"],
    leaderOnly: true,
  },

  // End of tour.
  end_gc: { scope: "final", titles: ["General Classification"] },
  end_points: { scope: "final", titles: ["Points Classification", "Overall Points Classification"] },
  end_kom: { scope: "final", titles: ["Mountain Classification", "Overall Mountain Classification"] },
  end_youth: { scope: "final", titles: ["Youth Classification", "Overall Youth Classification"] },
};

/** Categories UCI cannot supply, with the reason shown to the admin. */
export const UCI_UNSUPPORTED_REASONS: Record<string, string> = {
  sprint: "UCI only publishes the stage points total, not each intermediate sprint's order.",
  sprint_giro: "UCI only publishes the stage points total, not each intermediate sprint's order.",
  mountain_cc_hcx2_af: "UCI only publishes the stage KOM points total, not each climb's order.",
  mountain_hc: "UCI only publishes the stage KOM points total, not each climb's order.",
  mountain_1cat: "UCI only publishes the stage KOM points total, not each climb's order.",
  mountain_2cat: "UCI only publishes the stage KOM points total, not each climb's order.",
  mountain_3_4cat: "UCI only publishes the stage KOM points total, not each climb's order.",
  mountain_highest: "UCI only publishes the stage KOM points total, not each climb's order.",
  mountain_2nd_highest: "UCI only publishes the stage KOM points total, not each climb's order.",
  mountain_1_2cat: "UCI only publishes the stage KOM points total, not each climb's order.",
  jersey_combative: "UCI does not publish a combativity classification.",
  end_combative: "UCI does not publish a combativity classification.",
  end_team: "UCI does not publish a team classification for road events.",
  end_other: "No corresponding UCI classification.",
};

export function canImportFromUci(category: string): boolean {
  return category in UCI_CATEGORY_SOURCES;
}

/** How many rows the import should suggest when the category scores many places. */
export const UCI_IMPORT_LIMITS: Record<string, number> = {
  finish: 25,
  stage_finish: 25,
  end_gc: 25,
  end_points: 25,
  end_kom: 25,
  end_youth: 25,
  ttt: 25,
};

/**
 * Find the accordion section for a stage. UCI labels sections "Stage 1",
 * "Stage 2" … and the closing one "Final Result"; a prologue may be "Prologue".
 */
export function matchStageSection<T extends { label: string }>(
  sections: T[],
  stageNumber: number | null,
  stageName: string,
): T | null {
  const isFinal = (label: string) => /final/i.test(label);
  const candidates = sections.filter((s) => !isFinal(s.label));

  if (stageNumber != null) {
    const byNumber = candidates.find((s) => {
      const n = s.label.match(/(\d+)/);
      return n ? Number(n[1]) === stageNumber : false;
    });
    if (byNumber) return byNumber;
    if (stageNumber === 0) {
      const prologue = candidates.find((s) => /prologue/i.test(s.label));
      if (prologue) return prologue;
    }
  }

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return candidates.find((s) => norm(s.label) === norm(stageName)) ?? null;
}

export function matchFinalSection<T extends { label: string }>(
  sections: T[],
): T | null {
  return (
    sections.find((s) => /final/i.test(s.label)) ??
    sections[sections.length - 1] ??
    null
  );
}

export function pickResultRef<T extends { title: string }>(
  refs: T[],
  titles: string[],
): T | null {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  for (const wanted of titles) {
    const hit = refs.find((r) => norm(r.title) === norm(wanted));
    if (hit) return hit;
  }
  return null;
}
