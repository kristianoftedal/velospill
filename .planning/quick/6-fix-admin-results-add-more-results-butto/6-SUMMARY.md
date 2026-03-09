# Quick Task 6 — Summary

## Task
Fix admin results: Add More Results button broken due to ternary priority

## Root Cause
`modalContent` ternary had `existingResults ?` as the second branch. When a race has results, this branch always wins regardless of `selectedCategory`. Clicking "Add More Results" set `selectedCategory = "__picker__"` but the results view stayed visible — the category picker never rendered.

## Fix
One-line change in `src/app/admin/results/results-client.tsx`:

```
- ) : existingResults ? (
+ ) : existingResults && !selectedCategory ? (
```

Now when the user clicks "Add More Results" (which sets `selectedCategory`), the results branch is skipped and the category picker renders correctly.

## Commit
- `a6b688c`: fix(admin): fix Add More Results button — ternary now checks !selectedCategory
