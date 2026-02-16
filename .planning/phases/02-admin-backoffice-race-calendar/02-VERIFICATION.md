---
phase: 02-admin-backoffice-race-calendar
verified: 2026-02-12T14:30:00Z
status: gaps_found
score: 17/24 must-haves verified
gaps:
  - truth: "Scoring engine calculates points from results by querying scoringConfig table"
    status: partial
    reason: "Scoring engine exists but uses different name (previewScoringImpact) and simplified implementation"
    artifacts:
      - path: "src/lib/scoring-preview.ts"
        issue: "Uses previewScoringImpact instead of calculateScoresForRace, missing category/subcategory support"
    missing:
      - "Support for category and subcategory parameters (sprint, mountain, jersey, TdF bonus)"
      - "Transaction support as documented in plan (accept tx: Transaction parameter)"
  - truth: "Scoring engine handles all race types: one-day finish, GT stage, GT end results, mini tour"
    status: partial
    reason: "Only handles finish and stage_finish categories, missing GT end results, sprints, mountains, jerseys, TTT"
    artifacts:
      - path: "src/lib/scoring-preview.ts"
        issue: "Only supports 'finish' and 'stage_finish' categories"
    missing:
      - "Support for sprint, mountain, jersey, ttt, end_classification categories"
      - "Subcategory resolution logic for mountains (hc, 1cat, 2cat) and jerseys (gc, points, kom)"
  - truth: "Audit log entries can record who changed what, when, and why"
    status: partial
    reason: "Audit schema (resultAudit) exists but differs from plan (auditLog)"
    artifacts:
      - path: "src/db/schema/results.ts"
        issue: "Table named resultAudit instead of auditLog, uses changeType instead of operation enum"
    missing:
      - "Generic entityType/entityId pattern for reuse across features (plan specified auditLog for all entities)"
      - "auditOperationEnum with CREATE/UPDATE/DELETE values"
  - truth: "Race results can be stored in the database with rider, race, position, and category"
    status: partial
    reason: "raceResults table missing category and subcategory columns"
    artifacts:
      - path: "src/db/schema/results.ts"
        issue: "Missing category and subcategory columns, has time column not in plan"
    missing:
      - "category column (resultCategoryEnum: finish, stage_finish, sprint, mountain, jersey, ttt, end_classification)"
      - "subcategory column (nullable text for jersey type, mountain type, etc.)"
      - "composite unique constraint on (raceId, riderId, category, subcategory)"
  - truth: "Admin cannot enter duplicate riders or invalid positions"
    status: partial
    reason: "Validation exists for duplicates but schema constraint too restrictive"
    artifacts:
      - path: "src/db/schema/results.ts"
        issue: "Unique constraint on (raceId, riderId) prevents multiple categories per rider per race"
    missing:
      - "Update unique constraint to (raceId, riderId, category, subcategory) to allow same rider in multiple categories"
  - truth: "Admin can enter rider positions for that race"
    status: partial
    reason: "UI only supports single category (finish) per race"
    artifacts:
      - path: "src/components/admin/result-entry-form.tsx"
        issue: "No category selector, assumes all results are 'finish' category"
    missing:
      - "Category dropdown (finish, stage_finish, sprint, mountain, jersey, ttt, end_classification)"
      - "Conditional subcategory dropdown for jersey/mountain/end_classification"
  - truth: "Correcting a result triggers automatic score recalculation"
    status: partial
    reason: "Recalculates only the corrected result, not all affected results"
    artifacts:
      - path: "src/app/admin/results/actions.ts"
        issue: "correctRaceResult only recalculates single result, doesn't handle position cascade"
    missing:
      - "Recalculate all results in same category when position changes (affects relative scoring)"
---

# Phase 02: Admin Backoffice & Race Calendar Verification Report

**Phase Goal:** Admin can manage the full season race calendar and enter race results with validation

**Verified:** 2026-02-12T14:30:00Z

**Status:** gaps_found

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can enter race results with context-aware validation (eligible riders, valid positions) | ✓ VERIFIED | Result entry form validates duplicates, gender matching exists |
| 2 | Admin can preview scoring impact before committing results | ✓ VERIFIED | ScoringPreview component displays calculated points |
| 3 | Admin can review and approve/reject transfer bids during transfer windows | ✓ VERIFIED (Shell) | Shell page exists at /admin/transfers with placeholder UI |
| 4 | Admin can validate submitted orders and see their effects correctly applied | ✓ VERIFIED (Shell) | Shell page exists at /admin/orders with placeholder UI |
| 5 | Race results can be stored in the database with rider, race, position, and category | ⚠️ PARTIAL | raceResults table exists but missing category/subcategory columns |
| 6 | Audit log entries can record who changed what, when, and why | ⚠️ PARTIAL | resultAudit table exists but uses different schema than plan |
| 7 | Scoring engine calculates points from results by querying scoringConfig table | ⚠️ PARTIAL | previewScoringImpact exists but missing category/subcategory support |
| 8 | Scoring engine handles all race types: one-day finish, GT stage, GT end results, mini tour | ⚠️ PARTIAL | Only handles finish and stage_finish, missing other categories |
| 9 | Admin can see a list of races that need results entered | ✓ VERIFIED | /admin/results page lists races with hasResults flag |
| 10 | Admin can select a race and enter rider positions for that race | ⚠️ PARTIAL | Form exists but lacks category selection UI |
| 11 | Admin cannot enter duplicate riders or invalid positions | ⚠️ PARTIAL | Validation exists but schema constraint too restrictive |
| 12 | System auto-calculates points from entered results before commit | ✓ VERIFIED | previewScoringImpact calculates points from scoringConfig |
| 13 | After committing, results are saved and points are stored | ✓ VERIFIED | submitRaceResults stores calculated points |
| 14 | Admin can view existing results for a race and edit individual result entries | ✓ VERIFIED | Results displayed in table with edit buttons |
| 15 | Admin must provide a reason when correcting a result | ✓ VERIFIED | Correction form requires reason field (min 1 char) |
| 16 | Correcting a result triggers automatic score recalculation | ⚠️ PARTIAL | Recalculates single result, not all affected results |
| 17 | All corrections are recorded in the audit trail with before/after snapshots | ✓ VERIFIED | resultAudit records before/after in JSONB |
| 18 | Admin can view the full audit history for a race's results | ✓ VERIFIED | ResultAuditTrail component displays change history |
| 19 | Admin can navigate to a transfers management page | ✓ VERIFIED | /admin/transfers exists with shell UI |
| 20 | Admin can navigate to an orders validation page | ✓ VERIFIED | /admin/orders exists with shell UI |
| 21 | Transfer page shows shell UI with placeholder for future transfer bid list | ✓ VERIFIED | Shell page with "Coming in Phase 5" alerts |
| 22 | Orders page shows shell UI with placeholder for future order validation | ✓ VERIFIED | Shell page with order types reference |
| 23 | Admin dashboard shows cards for Results, Transfers, and Orders alongside existing Riders and Races | ✓ VERIFIED | Admin dashboard has 5 cards with counts and links |
| 24 | Admin nav includes Results, Transfers, and Orders links | ✓ VERIFIED | layout.tsx has all nav links |

**Score:** 17/24 truths verified (7 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/results.ts` | raceResults and resultAudit tables | ⚠️ PARTIAL | Exists but missing category/subcategory columns |
| `src/db/schema/audit.ts` | Generic auditLog table | ✗ MISSING | Not created; resultAudit is race-specific |
| `src/lib/scoring/calculate.ts` | calculateScoresForRace function | ✗ MISSING | Not created |
| `src/lib/scoring/types.ts` | TypeScript types for scoring | ✗ MISSING | Not created |
| `src/lib/scoring-preview.ts` | Scoring preview logic | ✓ VERIFIED | Exists with previewScoringImpact function |
| `src/app/admin/results/page.tsx` | Race list for results | ✓ VERIFIED | Server component fetching races and riders |
| `src/app/admin/results/actions.ts` | Server actions for results | ✓ VERIFIED | Full CRUD + preview + audit actions |
| `src/components/admin/result-entry-form.tsx` | Dynamic form with useFieldArray | ✓ VERIFIED | Form with validation and preview |
| `src/components/admin/scoring-preview.tsx` | Preview dialog | ✓ VERIFIED | Displays calculated points |
| `src/components/admin/result-correction-dialog.tsx` | Correction form with reason | ✓ VERIFIED | Inline edit with required reason |
| `src/components/admin/result-audit-trail.tsx` | Audit history display | ✓ VERIFIED | Timeline with before/after diffs |
| `src/app/admin/transfers/page.tsx` | Transfer shell page | ✓ VERIFIED | Shell with Coming in Phase 5 alerts |
| `src/app/admin/orders/page.tsx` | Order shell page | ✓ VERIFIED | Shell with order types reference |
| `src/app/admin/page.tsx` | Admin dashboard | ✓ VERIFIED | 5 cards with counts and links |
| `src/app/admin/layout.tsx` | Admin nav | ✓ VERIFIED | Nav links for all sections |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| result-entry-form.tsx | actions.ts | previewResults/submitRaceResults | ✓ WIRED | Form calls server actions |
| actions.ts | scoring-preview.ts | previewScoringImpact | ✓ WIRED | Actions use scoring engine |
| actions.ts | results.ts | raceResults table | ✓ WIRED | CRUD operations on raceResults |
| actions.ts | results.ts | resultAudit table | ✓ WIRED | Audit entries created on mutations |
| scoring-preview.ts | config.ts | scoringConfig table | ✓ WIRED | Queries scoringConfig for points |
| layout.tsx | transfers/page.tsx | /admin/transfers link | ✓ WIRED | Nav link navigates to page |
| layout.tsx | orders/page.tsx | /admin/orders link | ✓ WIRED | Nav link navigates to page |
| layout.tsx | results/page.tsx | /admin/results link | ✓ WIRED | Nav link navigates to page |
| admin/page.tsx | results schema | raceResults count | ✓ WIRED | Dashboard queries result count |
| results-client.tsx | result-correction-dialog.tsx | Edit button | ✓ WIRED | Opens correction dialog |
| results-client.tsx | result-audit-trail.tsx | Audit history tab | ✓ WIRED | Displays audit entries |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/db/schema/results.ts | 19 | Overly restrictive unique constraint | ⚠️ Warning | Prevents multiple categories per rider per race |
| src/lib/scoring-preview.ts | 60-79 | Hardcoded category logic | ⚠️ Warning | Doesn't support all planned categories |
| src/app/admin/results/actions.ts | 287-290 | Incomplete recalculation | ⚠️ Warning | Only recalculates single result on correction |
| src/components/admin/result-entry-form.tsx | N/A | Missing category selector | 🛑 Blocker | Cannot enter results for sprint/mountain/jersey categories |

### Human Verification Required

#### 1. Test result entry flow end-to-end

**Test:** 
1. Navigate to /admin/results
2. Select a race (preferably a GT stage)
3. Enter 10 rider positions
4. Click "Preview Scoring"
5. Verify points match scoringConfig
6. Click "Submit Results"
7. Verify results saved and displayed

**Expected:** 
- Preview shows correct points from database config
- Submit succeeds and shows success toast
- Results appear in results table with correct points
- Audit trail shows BATCH_INSERT entry

**Why human:** Need to verify full flow with real database state and visual UI confirmation

#### 2. Test result correction and audit trail

**Test:**
1. Navigate to an existing race with results
2. Click edit on a result
3. Change position or rider
4. Provide a reason
5. Save correction
6. Check audit history tab

**Expected:**
- Correction dialog shows original values
- Requires reason field to be filled
- Saves successfully
- Audit history shows UPDATE with before/after diff
- Points recalculated based on new position

**Why human:** Need to verify audit trail visual presentation and diff accuracy

#### 3. Test transfer and order shell pages

**Test:**
1. Navigate to /admin/transfers
2. Navigate to /admin/orders
3. Verify Coming Soon messaging

**Expected:**
- Shell pages render correctly
- Clear messaging about Phase 5 and Phase 7
- No broken UI or errors

**Why human:** Visual verification of shell page presentation

### Gaps Summary

Phase 02 has achieved **70.8% goal completion** with 7 partial implementations blocking full goal achievement:

**Critical Gaps (Blockers):**

1. **Missing category/subcategory support throughout the stack**
   - Database schema missing category and subcategory columns
   - UI has no category selector
   - Scoring engine only handles finish and stage_finish
   - **Impact:** Cannot enter results for GT sprints, mountains, jerseys, TTT, or end classifications
   - **Required for:** ADMIN-03 success criteria

2. **Incomplete scoring engine**
   - Missing support for subcategory-based scoring (mountain types, jersey types)
   - No TdF stage bonus logic
   - Different function name than planned (previewScoringImpact vs calculateScoresForRace)
   - **Impact:** Cannot accurately score GT stage races
   - **Required for:** ADMIN-04, ADMIN-05 success criteria

3. **Schema design deviations**
   - resultAudit is race-specific, not the generic auditLog planned
   - Unique constraint prevents multiple categories per rider per race
   - **Impact:** Cannot reuse audit for other entities (transfers, orders), cannot enter same rider in multiple categories
   - **Required for:** ADMIN-09 success criteria and future phase integration

**Non-Critical Gaps (Warnings):**

4. **Incomplete recalculation on corrections**
   - Only recalculates the edited result, not cascade effects
   - **Impact:** If position changes affect other riders' relative positions, points may be incorrect
   - **Required for:** ADMIN-09 success criteria

**What Works Well:**

- Core result entry and preview flow is functional for simple finish categories
- Audit trail captures all changes with before/after snapshots
- Correction workflow requires reasons and records audit entries
- Shell pages for transfers and orders establish nav structure
- Admin dashboard provides overview of all sections
- Gender validation prevents invalid rider selection
- Duplicate validation prevents data integrity issues

**Recommended Next Steps:**

1. Add category and subcategory columns to raceResults schema
2. Update result entry form to include category selector
3. Extend scoring engine to handle all category types with subcategory resolution
4. Fix unique constraint to (raceId, riderId, category, subcategory)
5. Consider renaming resultAudit to auditLog and making it generic
6. Implement full recalculation logic for position cascade on corrections

---

_Verified: 2026-02-12T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
