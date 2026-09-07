# Monster metadata UI verification

Worktree: `/home/main/z-project/rpg-zzu-monster-ui-0907`
Branch: `agent/monster-ui-0907`
Foundation: `056e655a5` (cherry-pick of `e354b1d22`).
Reviewed catalog: `6c10d44e0` (cherry-pick of `67db34b4`).

## Delivered scope

Database > 전투 몬스터 > 몬스터 소재 remains available with zero gameplay
enemies. The full 162-resource reviewed catalog is searchable by effective name,
ID, tags and description. The detail contains artwork, immutable ID, origin,
review status, per-field sources, editable name/tags/description, Apply and reset.
Enemy appearance and monster graphic pickers expose effective metadata summaries.
No schema, catalog, persistence, AI-tool, or resource-enumerator changes belong to
this UI commit. No dependency or general resource-manager redesign was added.

Draft controls stay mounted during search/external updates. Selection/reset/close
protect dirty edits with discard/cancel confirmation; repeated Escape preserves
modal ownership. Shared roving navigation uses arrows/Home/End plus Enter selection.
Apply validates before one snapshot and one labelled store update, patching only
changed fields. Clean undo/redo updates fields; project replacement disables
writes while preserving text for copying. Old callbacks cannot write afterward.

## Verification and exact commands

- Initial RED: `npm test -- test/databaseMonsterMetadata.test.ts` failed because
  the actual DB renderer had no catalog-entry control with empty enemies (`red.log`).
- Final GREEN: `npm test -- --maxWorkers=2 --minWorkers=1 test/databaseMonsterMetadata.test.ts test/databaseEnemyResourceSlot.test.ts test/databaseResourcePickerDialog.test.ts test/monsterMetadataHistory.test.ts test/monsterCatalogCoverage.test.ts`
  passed **25 tests in 5 files**, including 11 new UI cases (`green.log`).
- `npm run typecheck:app`: exit 0 on final source/catalog (`typecheck-final.log`).
- `npm run build:app`: exit 0 on final source/catalog (`build-final.log`). Existing
  circular/mixed-import/large-chunk warnings remain visible; none was suppressed.
- `npm run openwiki:verify`: no failures (`wiki.log`).
- `git diff --check`: passed before commit. TS/JS LSP diagnostics found no errors.
  CSS LSP could not run because Biome is not installed; no dependency was added.
- `MONSTER_QA_BROWSER=firefox node scripts/qa/monster-metadata.mjs`: passed the real
  app -> Database -> enemy tab -> catalog flow on owned port **11942**. The
  script verifies disabled remote persistence before fixture edits and records
  **zero database write requests**, **zero page exceptions**, and server teardown.
  Parent owns actual remote save/reload proof; none is claimed here.

### Browser evidence

`browser/results.json` records five viewports (375/768/1024/1280/1440), zero
worksheet horizontal overflow, **25 reachable controls with minimum height 32px**,
PNG signatures/dimensions, and decoded visible previews. Ten final captures:

- `browser/catalog-375.png`, `catalog-768.png`, `catalog-1024.png`,
  `catalog-1280.png`, `catalog-1440.png`
- `browser/dirty-empty-search.png`
- `browser/dirty-close-confirmation.png`
- `browser/validation-error.png`
- `browser/applied.png`
- `browser/project-replaced-draft-retained.png`

The browser pass exercises keyboard selection, empty search with a retained draft,
dirty-close cancellation, invalid-name rejection, Apply, undo/redo, reset and
project replacement. Native screenshots are NOT visible to this child model.
These are objective artifacts, not a self-certified visual PASS. Parent owns the
independent image-sensitive visual inspection; no Lighthouse/SEO audit is claimed.

A stronger browser check found undersized controls because the nested dialog was
outside the parent-only `--db2-*` token scope. `browser-control-size-red.json` and
`.png` capture that RED. The correction aliases existing size/radius tokens locally;
all final measured controls meet 32px. No shared shell geometry changed.

Chromium failed with host `ERR_NETWORK_CHANGED` before rendering
(`chromium-network-failure.json`). Firefox needed bounded visible-only preview
decoding and a complete stylesheet HTTP warmup, not fixed sleeps. Driver routing
was removed while diagnosing Vite CSS aborts. Outer command timeouts interrupted
otherwise-progressing capture runs; the final pass completed with a sufficient
whole-command budget, unchanged per-action deadlines. The local bridge at port
17831 is unavailable, and intentionally disabled fixture persistence logs autosave
errors. Those console messages remain in results; HTTP error responses and page
exceptions were empty in the final pass.

### Existing CSS gate failure

`npm run gates -- --only css` still reports `cssFileCount 267 -> 268` against the
repository baseline (`css-gate-after.log`). HEAD already tracks 268 stylesheets.
An initial new UI stylesheet raised this to 269; that regression was removed by
placing scoped rules in existing `enemies.part-3.css`. Graph checks report no new
missing imports/orphans. No baseline was changed or warning suppressed.

## Parent QA control map

- Entry: `db-monster-resources-open`
- Modal: `db-monster-resources`
- Search: `db-monster-resource-search`
- Rows: `db-monster-resource-row`, scoped by `data-resource-id` (not display name)
- Immutable ID: `db-monster-resource-id`
- Origin/review: `db-monster-resource-origin` (`data-origin`, `data-review-status`)
- Per-field source: `db-monster-resource-sources` (`data-name`, `data-tags`, `data-description`)
- Fields: `db-monster-resource-name`, `db-monster-resource-tags` (one tag per line),
  `db-monster-resource-description`
- Actions/status: `db-monster-resource-apply`, `db-monster-resource-reset`,
  `db-monster-resource-close`, `db-monster-resource-status`
- Dirty confirmation: existing `app-modal-confirm` (discard), `app-modal-cancel`
- Shared display: `monster-resource-summary` + `data-resource-id`
- Script: `scripts/qa/monster-metadata.mjs` (explicit 11942, owns teardown)

## Architectural self-review

The new editor module owns one dialog's draft lifecycle; presentation owns resource
metadata rendering. Both are under 200 pure LOC. Existing oversized DB files receive
only integration hooks; broad refactors are outside this lane. User input crosses
the model's validation boundary before writes. No new casts, suppressions, silent
error catches, generic metadata framework, or parameter-wrapper abstraction was
introduced. Expected validation errors are visibly reported; other errors propagate.
The existing mutation/history infrastructure remains authoritative. Model/catalog
commits are prerequisites, not UI-authored data or persistence work.
