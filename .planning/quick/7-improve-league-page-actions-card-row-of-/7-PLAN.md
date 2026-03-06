---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(main)/leagues/[leagueId]/page.tsx
autonomous: true
requirements: [QUICK-7]
must_haves:
  truths:
    - "Actions section renders as a plain row of buttons, not a card with section rows"
    - "Actions section appears before League Standings (first content after the header)"
    - "View Draft button is hidden when league is active and updatedAt is more than 5 days ago"
    - "View Draft button is visible when league is active and updatedAt is 5 days ago or less"
    - "All other action buttons (Transfers, Set Lineup, Orders, League Settings) are unchanged"
  artifacts:
    - path: "src/app/(main)/leagues/[leagueId]/page.tsx"
      provides: "League overview page with reordered and restyled actions"
  key_links:
    - from: "league.updatedAt"
      to: "showViewDraft boolean"
      via: "date comparison: Date.now() - updatedAt.getTime() <= 5 * 24 * 60 * 60 * 1000"
      pattern: "updatedAt"
---

<objective>
Improve the Actions section on the league overview page with three changes: (1) replace the card-with-rows layout with a simple inline row of buttons, (2) move actions to appear before all other cards (first position after the page header), and (3) hide the View Draft button 5 days after the draft finished.

Purpose: Streamlines the Actions section into a compact, scannable row that does not compete visually with the Standings card.
Output: Updated page.tsx with reordered sections, button-row actions, and time-gated View Draft button.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/app/(main)/leagues/[leagueId]/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor Actions section — button row, first position, hide View Draft after 5 days</name>
  <files>src/app/(main)/leagues/[leagueId]/page.tsx</files>
  <action>
Make three targeted changes to the league overview page:

**1. Compute showViewDraft gate (add near the showActions variable, around line 131):**

```ts
// Show "View Draft" button only within 5 days of the draft completing
// updatedAt is set to now() when status transitions, so for active leagues
// it records when drafting -> active happened
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000
const showViewDraft =
  league.status === "drafting" ||
  (league.status === "active" &&
    Date.now() - new Date(league.updatedAt).getTime() <= FIVE_DAYS_MS)
```

**2. Move Actions section to be first** (before Standings). In the JSX return block, place the Actions card/row block immediately after the League Header `<div>` and before the Standings `<Card>`.

**3. Replace the Actions Card with a plain button row.** Remove the `<Card>` wrapper and the `divide-y` rows entirely. Replace with a `<div className="flex flex-wrap gap-2">` containing `<Button asChild>` elements directly. The buttons to render (each conditionally):

- "View Draft" → `/leagues/${league.id}/draft` — show when `showViewDraft` is true (covers both drafting and the 5-day active window)
- "Transfers" → `/leagues/${league.id}/transfers` — show when `league.status === "active"`
- "Set Lineup" → `/leagues/${league.id}/lineup` — show when `league.status === "active"`
- "Orders" → `/leagues/${league.id}/orders` — show when `league.status === "active"`
- "League Settings" → `/leagues/${league.id}/owner` — show when `isOwner` is true and `showActions` is true
  Use `variant="outline"` for all buttons. Size is up to discretion (default or `sm`).

Keep the separate "Owner Settings" card block (`!showActions && isOwner`) that exists for setup/complete leagues — that is untouched.

Do NOT add a Card wrapper around the button row. It should be a bare `<div>` flush with the page layout grid.
  </action>
  <verify>
    <automated>npx tsc --noEmit --project /Users/kristianoftedal/dev/velospill/tsconfig.json 2>&1 | grep "leagues/\[leagueId\]/page.tsx" | head -20</automated>
    <manual>Visit a league page in the browser. Confirm: (1) action buttons appear as a horizontal row directly below the league name header, before standings; (2) for a recently-activated league the "View Draft" button is present; (3) the Actions section has no card border/background.</manual>
  </verify>
  <done>
    - TypeScript reports no errors in page.tsx
    - Actions appear as a flex row of buttons, no card wrapper
    - Actions section is positioned before Standings in the DOM
    - showViewDraft gate correctly gates the View Draft button based on updatedAt age
  </done>
</task>

</tasks>

<verification>
TypeScript compile passes for the modified file. Visual review confirms button-row layout at top, no card border, and View Draft conditional presence.
</verification>

<success_criteria>
- Actions section is a compact row of outline buttons, no card chrome
- Actions row appears first (before Standings card) in the page layout
- View Draft button hidden for active leagues where updatedAt is more than 5 days ago
- All other action buttons unchanged in label and destination
</success_criteria>

<output>
After completion, create `.planning/quick/7-improve-league-page-actions-card-row-of-/7-SUMMARY.md` with what was changed, key decisions, and the commit hash.
</output>
