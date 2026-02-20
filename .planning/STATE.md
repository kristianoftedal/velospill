# GSD State

## Current Position

- **Milestone:** v1.1 Scoring & Rules Update
- **Phase:** Not started (defining requirements)
- **Plan:** —
- **Status:** Defining requirements
- **Last activity:** 2026-02-20 — Milestone v1.1 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** The live competitive experience of managing a fantasy cycling team through a real season
**Current focus:** v1.1 — scoring rules, order mechanics, full result entry

## Blockers

None

## Notes

- v1.0 archived to .planning/milestones/ (ROADMAP, REQUIREMENTS, AUDIT)
- Tech debt backlog: Phase 10 (result categories), Phase 11 (order auto-calculation)
- Database migrations use direct SQL (drizzle-kit 0.18.x version mismatch)
- npm run build fails due to drizzle-kit type error in drizzle.config.ts (project source compiles cleanly)
- Pusher/QStash env vars required for draft features
