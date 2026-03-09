---
title: Admin Results — Modal Form, FirstCycling Import, Stage Dedup
quick_task: 3
---

# Plan: Admin Results UX Fixes

Four targeted fixes to the admin results page:
1. Open result entry in a Dialog modal instead of inline on the right panel
2. Switch scraping source from PCS to firstcycling.com
3. Fix duplicate stage display (show stages only for selected parent race)
4. Fix rider search in form (Combobox not filtering — needs ComboboxCollection wrapper)

## Context

- `src/app/admin/results/results-client.tsx` — main client component, race selector + results area
- `src/app/admin/results/actions.ts` — server actions including `scrapeAndMatchPcsResults`
- `src/components/admin/result-entry-form.tsx` — result entry form with PCS import UI
- Dialog component available at `@/components/ui/dialog`

## Tasks

---

### Task 1: Fix stage dedup + open form in modal (results-client.tsx)

**File:** `src/app/admin/results/results-client.tsx`

**Changes:**

**Stage dedup:** The sidebar currently shows stages for ALL parent races simultaneously. Fix: only expand and show stages for the currently selected parent race (or the parent of the currently selected stage). Add a helper `getSelectedParentId` that returns `selectedRace?.parentRaceId ?? selectedRaceId` — stages only render when `race.id === selectedParentId`.

**Modal:** Wrap the entire right-side results area (category picker, entry form, existing results view) in a Dialog. When a race is selected via `handleRaceSelect`, also set `modalOpen = true`. When the modal closes, reset `selectedCategory` but keep `selectedRaceId` for the "selected" highlight in the sidebar. On `handleSuccess`, close the modal after a brief delay (or keep open to allow adding more categories).

Specific implementation:
- Add `const [modalOpen, setModalOpen] = useState(false)` state
- In `handleRaceSelect`, after setting state, also call `setModalOpen(true)`
- Extract the right-side JSX into a `<Dialog open={modalOpen} onOpenChange={setModalOpen}>` with `<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">`. Include `<DialogHeader><DialogTitle>{selectedRace?.name}</DialogTitle></DialogHeader>` at the top.
- The right panel `<div>` (currently `<div>` after the race selector Card) should be removed — that content moves into the Dialog. Replace the right panel with an empty `<div />` or remove the grid split entirely (race selector takes full width or a fixed column).
- In `handleSuccess`, call `setModalOpen(false)` after reload (or before `window.location.reload()`)
- Stage fix: in the `{stagesByParent[race.id] && ...}` block, add condition: only render stages when the selected race IS that parent OR is a stage of that parent:
  ```tsx
  {stagesByParent[race.id] && (selectedRaceId === race.id || races.find(r => r.id === selectedRaceId)?.parentRaceId === race.id) && (
    <div className="ml-4 space-y-1">...stages...</div>
  )}
  ```

---

### Task 2: Switch import to firstcycling.com (actions.ts + result-entry-form.tsx)

**Files:**
- `src/app/admin/results/actions.ts`
- `src/components/admin/result-entry-form.tsx`

**Actions.ts changes:**

Rename `scrapeAndMatchPcsResults` to `scrapeAndMatchResults` (or keep name but change internals — keep name for minimal diff, just change implementation).

Change URL validation from `procyclingstats.com` to `firstcycling.com`:
```ts
if (!url.startsWith("https://firstcycling.com/")) {
  return { success: false as const, error: "URL must be from firstcycling.com (e.g. https://firstcycling.com/race.php?r=53&y=2026)" };
}
```

Change HTML parsing. FirstCycling results pages use a different table structure. The main results table on firstcycling.com race pages has:
- Table with class `tablesorter` or similar, rows in `tbody`
- Column 0: position (e.g. "1", "2", "DNS")
- Column 1: rider name (in an `<a>` tag linking to rider profile)
- Column 2 or 3: team name

Since we cannot confirm exact selectors without live access, use a robust multi-selector approach:
```ts
// Try firstcycling table structure
// The results table on firstcycling uses a standard table, typically with class "tablesorter"
// Rider name is in <a> links within td cells
const rows = $("table tbody tr")
rows.each((_, row) => {
  const cols = $(row).find("td")
  if (cols.length < 3) return

  // Position is first column — skip non-numeric (DNS, DNF, OTL, etc.)
  const posText = cols.eq(0).text().trim()
  const position = parseInt(posText, 10)
  if (isNaN(position) || position < 1) return

  // Rider name — first <a> in the row pointing to a rider profile (/rider.php)
  const riderAnchor = $(row).find("a[href*='rider.php']").first()
  const riderName = riderAnchor.text().trim()
  if (!riderName) return

  // Team name — second <a> in the row or subsequent td text
  const teamAnchor = $(row).find("a[href*='team.php']").first()
  const teamName = teamAnchor.text().trim() || cols.eq(3).text().trim()

  scraped.push({ position, riderName, teamName })
})
```

Update empty result error message to reference firstcycling.com.

Remove the Cloudflare check (firstcycling does not use Cloudflare in the same way). Keep the general fetch with same User-Agent headers.

**result-entry-form.tsx changes:**

Update the import card UI:
- `CardTitle`: Change "Import from ProCyclingStats" to "Import from FirstCycling"
- `CardDescription`: Change to "Paste a FirstCycling race URL to auto-fill rider results"
- Input `placeholder`: Change to `"https://firstcycling.com/race.php?r=53&y=2026"`
- `handleApplyMatches` toast: Change "Applied X results from PCS" to "Applied X results from FirstCycling"

The function call `scrapeAndMatchPcsResults` in the form should still work (we keep the action name), or rename both consistently to `scrapeAndMatchResults` — choose rename for clarity, updating both the export in actions.ts and the import + call in result-entry-form.tsx.

---

---

### Task 3: Fix rider search in result entry form (result-entry-form.tsx)

**File:** `src/components/admin/result-entry-form.tsx`

**Problem:** The `Combobox` from `@base-ui/react` requires items to be wrapped in `ComboboxCollection` for the built-in text filtering to work. Currently items are placed directly inside `ComboboxList`, so no filtering happens when typing.

**Fix:** Wrap the `ComboboxItem` list inside `<ComboboxCollection>` in both the rider selector AND the team selector (TTT section).

In the rider Combobox (ResultEntryForm):
```tsx
<ComboboxContent>
  <ComboboxList>
    <ComboboxEmpty>No riders found</ComboboxEmpty>
    <ComboboxCollection>
      {filteredRiders.map((rider) => (
        <ComboboxItem key={rider.id} value={rider.name}>
          ...
        </ComboboxItem>
      ))}
    </ComboboxCollection>
  </ComboboxList>
</ComboboxContent>
```

In the team Combobox (TttEntrySection):
```tsx
<ComboboxContent>
  <ComboboxList>
    <ComboboxEmpty>No teams found</ComboboxEmpty>
    <ComboboxCollection>
      {teams.map((team) => (
        <ComboboxItem key={team} value={team}>
          {team}
        </ComboboxItem>
      ))}
    </ComboboxCollection>
  </ComboboxList>
</ComboboxContent>
```

Import `ComboboxCollection` from `@/components/ui/combobox`.

---

## Verification

- Dev server starts: `npm run dev` (no TypeScript errors)
- Navigate to `/admin/results`: race list renders, clicking a race opens a modal dialog
- Stage races only expand stages when that race (or one of its stages) is selected
- Import card shows "FirstCycling" label with updated placeholder URL
- Attempting a firstcycling.com URL should attempt scrape (functional test requires live URL)
