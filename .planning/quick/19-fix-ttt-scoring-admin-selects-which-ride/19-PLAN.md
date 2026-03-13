---
phase: quick-19
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/admin/result-entry-form.tsx
  - src/app/admin/results/actions.ts
autonomous: true
requirements: [QUICK-19]

must_haves:
  truths:
    - "Admin sees checkboxes listing each rider on the selected team under the team combobox"
    - "All riders on the selected team are pre-checked by default"
    - "Only checked riders receive points when TTT results are submitted"
    - "Changing the selected team resets rider selection to all riders on the new team"
  artifacts:
    - path: src/components/admin/result-entry-form.tsx
      provides: Updated tttSchema with riderIds[], TttEntrySection showing rider checkboxes per team row
    - path: src/app/admin/results/actions.ts
      provides: submitTttResults and previewTttResults using riderIds from client, no DB team lookup
  key_links:
    - from: TttEntrySection (form submit)
      to: submitTttResults
      via: "teamPlacements[].riderIds passed directly"
    - from: TttEntrySection (team combobox onValueChange)
      to: form field riderIds
      via: "setValue resets riderIds to all riders matching new teamName and expectedGender"
---

<objective>
Fix TTT scoring so only the riders who actually started the race score points — not every rider in the DB for that team.

Purpose: Currently submitTttResults queries ALL riders WHERE team = teamName and awards every one of them TTT points. The admin must be able to select which specific riders started (defaulting to all, then unchecking absentees).

Output: Updated form with per-row rider checkboxes + updated server actions that use riderIds from the client.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@src/components/admin/result-entry-form.tsx
@src/app/admin/results/actions.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update result-entry-form.tsx — riderIds in schema and per-row checkboxes</name>
  <files>src/components/admin/result-entry-form.tsx</files>
  <action>
**1. Update `tttSchema`** — add `riderIds` to each team placement object:

```ts
const tttSchema = z.object({
  teamPlacements: z
    .array(
      z.object({
        position: z.number().min(1),
        teamName: z.string().min(1, "Select a team"),
        riderIds: z.array(z.number()).min(1, "Select at least one rider"),
      })
    )
    .min(1, "Enter at least one team placement")
    // keep existing .refine() for unique positions and unique team names
})
```

**2. Update `TttEntrySection` props** — add `riders: Rider[]`:

```ts
function TttEntrySection({
  raceId, teams, raceType, riders, onSuccess
}: {
  raceId: number
  teams: string[]
  raceType: string
  riders: Rider[]
  onSuccess: () => void
})
```

**3. Update `defaultValues`** in `useForm` to include `riderIds: []`:

```ts
defaultValues: {
  teamPlacements: [{ position: 1, teamName: "", riderIds: [] }],
},
```

**4. Update `handleAddPlacement`** to include `riderIds: []`:

```ts
append({ position: nextPosition, teamName: "", riderIds: [] })
```

**5. In the team combobox `onValueChange` handler**, after setting `teamName`, also reset `riderIds` to all riders matching the new team and gender:

```ts
onValueChange={(value) => {
  if (value) {
    form.setValue(`teamPlacements.${index}.teamName`, value, { shouldValidate: true })
    // Reset riderIds to all riders for the selected team
    const teamRiders = riders
      .filter((r) => r.team === value && r.gender === expectedGender)
      .map((r) => r.id)
    form.setValue(`teamPlacements.${index}.riderIds`, teamRiders, { shouldValidate: true })
    setTeamSearchQueries((prev) => ({ ...prev, [index]: "" }))
  }
}}
```

**6. Add rider checkboxes below the team combobox** — inside the `flex-1` team column div, after the Combobox closing tag and before its error message paragraph. Only render when `teamName` is non-empty:

```tsx
{teamName && (() => {
  const teamRiders = riders.filter((r) => r.team === teamName && r.gender === expectedGender)
  const riderIds = form.watch(`teamPlacements.${index}.riderIds`) as number[]
  return teamRiders.length > 0 ? (
    <div className="mt-2 space-y-1 border rounded-md p-2 max-h-40 overflow-y-auto">
      {teamRiders.map((rider) => {
        const checked = riderIds.includes(rider.id)
        return (
          <label key={rider.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...riderIds, rider.id]
                  : riderIds.filter((id) => id !== rider.id)
                form.setValue(`teamPlacements.${index}.riderIds`, next, { shouldValidate: true })
              }}
            />
            {rider.name}
          </label>
        )
      })}
    </div>
  ) : null
})()}
```

Add riderIds error display after the checkboxes block:
```tsx
{form.formState.errors.teamPlacements?.[index]?.riderIds && (
  <p className="text-xs text-destructive mt-1">
    {form.formState.errors.teamPlacements[index]?.riderIds?.message}
  </p>
)}
```

**7. Update `onSubmit`** — `data.teamPlacements` now contains `riderIds` automatically; no changes needed to the submit call itself since `submitTttResults` signature will be updated in Task 2.

**8. Update the TTT early-return in `ResultEntryForm`** — pass `riders` down:

```tsx
return <TttEntrySection raceId={raceId} teams={teams} raceType={raceType} riders={riders} onSuccess={onSuccess} />
```

(The `riders` prop is already available in `ResultEntryForm`'s Props — no new prop needed on `ResultEntryForm`.)
  </action>
  <verify>TypeScript: `npx tsc --noEmit 2>&1 | grep result-entry-form` produces no errors. Visually: selecting a team shows a scrollable checkbox list of riders for that team, all pre-checked.</verify>
  <done>tttSchema includes riderIds[]. TttEntrySection renders rider checkboxes per row with all pre-checked on team select. Changing team resets selection. At least-1-rider validation fires on submit.</done>
</task>

<task type="auto">
  <name>Task 2: Update actions.ts — remove DB team lookup, use client-provided riderIds</name>
  <files>src/app/admin/results/actions.ts</files>
  <action>
**1. Update `previewTttResults` signature** (line 539) — add `riderIds` to each placement and use it for `riderCount` instead of querying the DB:

Old signature:
```ts
export async function previewTttResults(
  raceId: number,
  teamPlacements: Array<{ position: number; teamName: string }>,
)
```

New signature:
```ts
export async function previewTttResults(
  raceId: number,
  teamPlacements: Array<{ position: number; teamName: string; riderIds: number[] }>,
)
```

Replace the `riderCount` calculation inside the `.map()` callback — remove the DB query and use `riderIds.length` instead:

Old (lines ~590-596):
```ts
const riderCount = await db
  .select({ count: sql<number>`count(*)` })
  .from(riders)
  .where(eq(riders.team, teamName))
  .then((res) => Number(res[0]?.count || 0));
```

New:
```ts
const riderCount = riderIds.length;
```

The `.map()` callback can now be synchronous — change `Promise.all` + `async` callback to a plain `.map()`:
```ts
const previewData = teamPlacements.map(({ position, teamName, riderIds }) => {
  const points = calculatePoints(position, scoringRules.rules as Record<string, number>);
  return { teamName, position, pointsPerRider: points, riderCount: riderIds.length };
});
```

**2. Update `submitTttResults` signature** (line 622) — add `riderIds` to the placement type:

Old:
```ts
export async function submitTttResults(formData: {
  raceId: number;
  teamPlacements: Array<{ position: number; teamName: string }>;
})
```

New:
```ts
export async function submitTttResults(formData: {
  raceId: number;
  teamPlacements: Array<{ position: number; teamName: string; riderIds: number[] }>;
})
```

**3. Remove the `allTeamRiders` DB query and `teamRiderMap` build** (lines ~704-715) — delete entirely:
```ts
// DELETE these lines:
const allTeamNames = teamPlacements.map((p) => p.teamName);
const allTeamRiders = await db
  .select({ id: riders.id, team: riders.team })
  .from(riders)
  .where(inArray(riders.team, allTeamNames));
const teamRiderMap = new Map<string, number[]>();
for (const rider of allTeamRiders) {
  if (!teamRiderMap.has(rider.team)) teamRiderMap.set(rider.team, []);
  teamRiderMap.get(rider.team)!.push(rider.id);
}
```

**4. Update the INSERT loop** inside `db.transaction` — destructure `riderIds` from the placement and use it directly instead of `teamRiderMap.get(teamName)`:

Old:
```ts
for (const { position, teamName } of teamPlacements) {
  const points = calculatePoints(position, scoringRules.rules as Record<string, number>);
  const riderIds = teamRiderMap.get(teamName) ?? [];
  for (const riderId of riderIds) { ... }
}
```

New:
```ts
for (const { position, teamName, riderIds } of teamPlacements) {
  const points = calculatePoints(position, scoringRules.rules as Record<string, number>);
  for (const riderId of riderIds) { ... }
}
```

**5. Check for unused imports** — if `inArray` is now only used in this function and nowhere else in the file, it can be removed from the drizzle import. Only remove it if it is not used elsewhere.
  </action>
  <verify>TypeScript: `npx tsc --noEmit 2>&1 | grep actions` produces no errors. Functional: submit TTT results with 2 riders unchecked → only checked riders appear in race_results for that team.</verify>
  <done>submitTttResults no longer queries riders table for team members. riderIds from the client are used directly. previewTttResults uses riderIds.length for riderCount. No TypeScript errors.</done>
</task>

</tasks>

<verification>
After both tasks:
1. `npx tsc --noEmit 2>&1` — no new errors in the two changed files
2. Open admin results for a TTT race in browser, select a team — rider checkboxes appear, all pre-checked
3. Uncheck 1-2 riders, submit — verify in DB that only the checked riders have a race_results row for category='ttt'
4. Change team selection — rider list resets to the new team's riders, all pre-checked
</verification>

<success_criteria>
- TTT form shows rider checkboxes per team row, all pre-checked on selection
- Unchecked riders do NOT receive points after submit
- submitTttResults makes no DB query for rider lookup — uses client-provided riderIds
- TypeScript compiles cleanly for both files
</success_criteria>

<output>
No SUMMARY.md needed for quick tasks. Commit with:
`git add src/components/admin/result-entry-form.tsx src/app/admin/results/actions.ts`
`git commit -m "fix(ttt): admin selects which riders score — checkbox list per team placement"`
</output>
