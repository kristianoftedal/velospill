---
phase: quick-21
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(main)/leagues/[leagueId]/page.tsx
autonomous: true
requirements:
  - QUICK-21
must_haves:
  truths:
    - "When a transfer window is open, a banner appears near the top of the league page"
    - "The banner shows the window open and close dates"
    - "The banner includes a link to the Transfers page"
    - "No banner appears when no transfer window is currently open"
  artifacts:
    - path: "src/app/(main)/leagues/[leagueId]/page.tsx"
      provides: "Transfer window banner rendered after IR banner, using activeTransferWindow data"
  key_links:
    - from: "src/app/(main)/leagues/[leagueId]/page.tsx"
      to: "src/lib/transfer-queries.ts"
      via: "getActiveTransferWindow import"
      pattern: "getActiveTransferWindow"
---

<objective>
Add a banner to the top of the league page that informs members when a transfer window is currently open, showing the window's open and close dates with a link to the Transfers page.

Purpose: Members need to know at a glance that a transfer window is active so they don't miss the opportunity to submit bids.
Output: League page with a conditional transfer window banner rendered between the actions row and the IR return banner.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add transfer window banner to league page</name>
  <files>src/app/(main)/leagues/[leagueId]/page.tsx</files>
  <action>
    1. Import `getActiveTransferWindow` from `@/lib/transfer-queries` at the top of the file.

    2. After the `eligibleToReturnCount` fetch block (around line 129), add a fetch for the active transfer window — only when `league.status === "active"`:
    ```ts
    let activeTransferWindow = null
    if (league.status === "active") {
      activeTransferWindow = await getActiveTransferWindow(leagueId)
    }
    ```

    3. In the JSX, insert the transfer window banner **after** the IR return banner block (after line 235) and **before** the Standings card. Use the same Card-based banner pattern as the IR return banner but with a green/blue color scheme (e.g. `border-blue-300 bg-blue-50` text in `text-blue-800`/`text-blue-700`).

    Banner content:
    - Heading: "Transfer window open"
    - Body text: "Transfers are open until {format(activeTransferWindow.closesAt, 'd MMM yyyy')}. Window opened {format(activeTransferWindow.opensAt, 'd MMM yyyy')}."
    - Button: "Go to Transfers" linking to `/leagues/${leagueId}/transfers`

    Condition: `{league.status === "active" && activeTransferWindow && (...)}`

    Use `date-fns` `format` which is already imported. Use the existing Button, Card, CardContent components which are already imported.
  </action>
  <verify>
    Run `npx tsc --noEmit` — no type errors. Visually confirm by checking the page renders correctly (server component, no runtime needed beyond `next dev`).
  </verify>
  <done>
    When a transfer window is active for the league, a blue info banner appears on the league page below the actions row showing the open/close dates and a "Go to Transfers" button. No banner appears when no window is open. TypeScript compiles without errors.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no new errors
- Banner only appears for `league.status === "active"` leagues with an active window
- Dates formatted consistently with the rest of the page (date-fns `format`)
</verification>

<success_criteria>
Transfer window banner visible on the league page when a window is currently open, showing formatted open and close dates plus a direct link to the Transfers page.
</success_criteria>

<output>
After completion, create `.planning/quick/21-add-a-banner-to-the-top-of-the-league-pa/21-SUMMARY.md`
</output>
