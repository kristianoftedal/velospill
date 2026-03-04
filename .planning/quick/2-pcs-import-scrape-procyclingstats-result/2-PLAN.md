---
title: PCS Import with Fuzzy Rider Matching
quick_task: 2
---

# Plan: PCS Import

## Tasks

### Task 1: Server action — scrape + fuzzy match
- `scrapeAndMatchPcsResults(url, raceId)` in actions.ts
- cheerio parse `table.results tbody tr`
- fuzzy match: exact, reversed, token, last-name, partial

### Task 2: UI — import card in result-entry-form
- PCS URL input + Import button
- Match preview table with confidence badges
- Per-row rider override select
- Apply button populates form field array
- Fix hooks violation (hooks before TTT conditional return)
