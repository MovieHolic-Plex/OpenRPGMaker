# Completed settlement reference

- Reference id: `walled-settlement-43x45`, revision 1, 43×45 tiles.
- Database → 맵 → 지역 → 성벽으로 둘러싸인 정주지 (완성 맵 사례).
- Fixed remote copy: `rpg-zzu-region-reference-walled-settlement-v1`.
- `persistence.json`: LegacyDb save/load proof, exact map and tile metadata match.
- `regions-desktop.png` (1600×1050) and `regions-compact.png` (1100×820): actual
  database UI using the remote snapshot project, without spatial activation.
- Reproduce: `node scripts/capture-region-reference.mjs http://127.0.0.1:<port>`.
  The script verifies the image loads, activation is absent, and registered AI
  list/read calls succeed without changing the active project.
- Unit verification: registered tool row reads reconstruct both complete tile
  layers and passage metadata; invalid pages reject; gallery/reference view works
  without a canonical document. The existing region catalog expectation now
  includes the completed example alongside the six procedural regions.

The record is a bundled read-only reference for future AI sessions, not a new
procedural recipe, a live map pointer, or a general-purpose map registration UI.
No database schema migration or automatic map regeneration is performed.

Validation results:
- `npm run typecheck:app`: exit 0.
- Focused tests: 53 passed (regionReferences 3, spatialCatalog 15,
  spatialTools 28, databaseSidebarNav 7).
- `npm run gates -- --only css`: exit 0.
- Full `npm run gates`: interrupted with exit 143 before a Vitest JSON report
  was produced. A complete-suite regression verdict is unavailable; the focused
  results above do not substitute for that verdict.
- Surface gate: exit 1 (event-editor baseline snapshots and database tab inventory).
  It also detected the reference canvas missing the shared `spatial-canvas`
  sentinel; this was fixed and rechecked. The follow-up all-tabs/reference run
  passed all six spatial destinations and the three reference tests. Its one
  remaining failure is the pre-existing `characterAppearances` tab missing from
  `DATABASE_PRIMARY_SENTINELS`; both the tab definition and sentinel file are
  unchanged from the base commit. Event-editor snapshots are outside this change.
