---
status: testing
phase: 12-result-entry-expansion
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md
started: 2026-02-22T12:00:00Z
updated: 2026-02-22T12:00:00Z
---

## Current Test

number: 1
name: Category Picker Appears on Race Selection
expected: |
  In the admin results page, after selecting a race, a category picker grid appears showing available result categories as clickable buttons (e.g., "Stage Finish", "Sprint", "Mountain", etc.).
awaiting: user response

## Tests

### 1. Category Picker Appears on Race Selection
expected: In the admin results page, after selecting a race, a category picker grid appears showing available result categories as clickable buttons (e.g., "Stage Finish", "Sprint", "Mountain", etc.).
result: [pending]

### 2. Race Type Category Filtering
expected: Grand Tour stages show categories like stage_finish, sprint, mountain variants, jersey variants, and TTT. One-day races only show "Finish". Parent races show end-of-tour categories (GC, Points, KOM, Youth, Combative, Team, Other).
result: [pending]

### 3. Category Name in Result Entry Form
expected: After picking a category (e.g., Sprint), the result entry form header/description shows the human-readable category name (e.g., "Sprint Classification") instead of the generic "Enter Race Results".
result: [pending]

### 4. Category in Scoring Preview
expected: When previewing scoring impact, the scoring preview card title shows the selected category name alongside "Scoring Preview" (e.g., "Scoring Preview - Sprint Classification").
result: [pending]

### 5. Multi-Category Workflow
expected: After successfully submitting results for one category, the admin is returned to the category picker to select and enter another category for the same race.
result: [pending]

### 6. Results Grouped by Category
expected: When viewing a race that has results in multiple categories, existing results are displayed grouped under separate cards with human-readable category headers (e.g., "Stage Finish", "Sprint Classification").
result: [pending]

### 7. TTT Team Selector UI
expected: When selecting the "Team Time Trial" category, the result entry form shows team name selectors (combobox with team names) instead of the regular rider selectors. Each row has a position number and a team name dropdown.
result: [pending]

### 8. TTT Preview and Submission
expected: TTT preview shows a table with Team Name, Position, Points per Rider, and Rider Count per team. Submitting TTT results creates individual rider-level results for all riders on each placed team.
result: [pending]

### 9. End-of-Tour Categories on Parent Race
expected: Selecting a parent race (e.g., "Tour de France 2026" - not a stage) shows end-of-tour categories: GC, Points, KOM, Youth, Combative, Team, Other.
result: [pending]

### 10. End-of-Tour Stage Validation
expected: Attempting to enter an end-of-tour category result on a stage race returns a validation error: "End-of-tour classifications can only be entered on parent races, not stages."
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0

## Gaps

[none yet]
