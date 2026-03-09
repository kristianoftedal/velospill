---
phase: quick-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: []
must_haves:
  truths:
    - "Michael Matthews has an approved IR record for team 11"
    - "Neilson Powless has an approved IR record for team 11"
    - "Both IR records are associated with the correct leagueId"
  artifacts: []
  key_links:
    - from: "ir_requests table"
      to: "riders table"
      via: "riderId foreign key"
      pattern: "riderId = (SELECT id FROM riders WHERE name ILIKE ...)"
---

<objective>
Insert Michael Matthews and Neilson Powless into the ir_requests table for team 11 with status 'approved'.

Purpose: Admin action to place two riders on injured reserve for team 11.
Output: Two rows in ir_requests with status='approved', correct teamId=11, leagueId, and riderId.
</objective>

<execution_context>
@/Users/kristianoftedal/.claude/get-shit-done/workflows/execute-plan.md
@/Users/kristianoftedal/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

IR schema: ir_requests table columns — id (serial PK), leagueId (int, NOT NULL), teamId (int, NOT NULL),
riderId (int, NOT NULL), status (enum: pending/approved/rejected, default pending), reason (text, nullable),
adminNote (text, nullable), submittedAt (timestamp, default NOW()), resolvedAt (timestamp, nullable),
resolvedBy (text, nullable).

Database connection: read DATABASE_URL from .env.local, use psql.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Look up rider IDs and team leagueId, then insert IR records</name>
  <files></files>
  <action>
    1. Read the DATABASE_URL from .env.local:
       ```
       grep DATABASE_URL .env.local
       ```

    2. Look up the leagueId for team 11 and the rider IDs for both riders:
       ```sql
       -- Get leagueId for team 11
       SELECT id, "leagueId", name FROM teams WHERE id = 11;

       -- Find Michael Matthews
       SELECT id, name FROM riders WHERE name ILIKE '%matthews%';

       -- Find Neilson Powless
       SELECT id, name FROM riders WHERE name ILIKE '%powless%';
       ```

    3. Confirm the exact rider IDs and leagueId from the query results.

    4. Insert both IR records with status 'approved' (substituting the actual IDs found):
       ```sql
       INSERT INTO ir_requests ("leagueId", "teamId", "riderId", status, "submittedAt", "resolvedAt")
       VALUES
         ({leagueId}, 11, {matthews_id}, 'approved', NOW(), NOW()),
         ({leagueId}, 11, {powless_id}, 'approved', NOW(), NOW());
       ```

    5. Verify the inserts:
       ```sql
       SELECT ir.id, r.name, ir.status, ir."teamId", ir."leagueId"
       FROM ir_requests ir
       JOIN riders r ON r.id = ir."riderId"
       WHERE ir."teamId" = 11 AND ir.status = 'approved'
       ORDER BY ir.id DESC
       LIMIT 5;
       ```

    Run all queries via: `psql "$DATABASE_URL" -c "..."`
    Or pipe a multi-statement SQL file: `psql "$DATABASE_URL" -f /tmp/ir_insert.sql`
  </action>
  <verify>
    SELECT returns 2 rows for team 11 with status='approved', names matching Michael Matthews and Neilson Powless.
  </verify>
  <done>
    Both riders appear in ir_requests with status='approved' for teamId=11 and the correct leagueId.
  </done>
</task>

</tasks>

<verification>
Run final check:
```bash
psql "$DATABASE_URL" -c "SELECT ir.id, r.name, ir.status, ir.\"teamId\", ir.\"leagueId\" FROM ir_requests ir JOIN riders r ON r.id = ir.\"riderId\" WHERE ir.\"teamId\" = 11 AND ir.status = 'approved' ORDER BY ir.id;"
```
Both Matthews and Powless rows present with status=approved.
</verification>

<success_criteria>
- ir_requests has 2 new rows for teamId=11 with status='approved'
- riderId values match Michael Matthews and Neilson Powless in the riders table
- leagueId matches the league team 11 belongs to
</success_criteria>

<output>
No SUMMARY.md required for quick tasks.
</output>
