# Round 2 repair/integration candidate (2026-09-07)

Implemented by `st_01a079d7` in `agent/release-versioning` only. This resolves the
pending merge of `83bd6098d94dd6d7082d2ded6d557be928592623` into
`db6f6ab9c131a13dcac43f96a90dfd66433e19f1`. This is repair evidence, not ultrabrain
approval. The lead owns final builds, artifact synchronization, real exported-game
browser QA, and the fresh exact-SHA review.

## Repair

- The frozen collector recognizes only the exact optional map background/BGM
  objects. Empty background image selection and blank custom BGM selection retain
  their authored values. Whitespace-only BGM retains the runtime's inheritance
  semantics. Nonempty unresolved/external references still resolve strictly.
- Image/sprite definition IDs remain mandatory even beneath a tileset's `kind`.
  The new negative regression exposed the previous command-context bypass for
  empty tileset images; it is now rejected before persistence.
- Main's Project monster metadata type, playable-export stripping and asset-usage
  exclusions are preserved. The frozen strict walk also excludes root editorial
  monster metadata, including opaque raw IDs named `resourceId` or `imageId`.
- Publishing dialog shows separate verified installed/selected collector values.
  Tests assert 2 for the installed manifest, 1 for a selected older manifest, and
  correct prepare/upgrade/fork transitions. Manifest digest/target disagreement
  never supplies a displayed version. Late older-manifest completion does not
  reset an upgraded target or edited version text. No localized prose is pinned.
- `releaseCollectorBuild.d.mts` declares the existing JS build API so the changed
  TypeScript tests typecheck strictly without `allowJs` or error suppression.
- `openwiki/INDEX.md` was regenerated from both merged doc sets using
  `npm run openwiki:index`, not a conflict-side selection.

## Direct execution

Final focused run, default Node heap, exit 0: **15 files, 178 passed, no failed or
skipped tests** (86.65 seconds):

```sh
TMPDIR=/dev/shm npm test -- test/publicationExport.test.ts test/communityDependencyClosure.test.ts test/publishingDialog.test.ts test/publicationSaves.test.ts test/publicationSaveImportPanel.test.ts test/communitySaveBoot.test.ts test/communityReleaseArchive.test.ts test/runtimeArchive.test.ts test/gameRelease.test.ts test/standaloneHtml.test.ts test/standaloneExport.test.ts test/lifeSaveVersion.test.ts test/monsterMetadataFoundation.test.ts test/monsterMetadata.test.ts test/webExportUsagePruning.test.ts --maxWorkers=2 --reporter=verbose
```

The ZIP and HTML tests use the actual publication APIs and a freshly bundled,
manifest-verified collector. Complete ZIPs pass community archive validation;
HTML payloads preserve prepared project bytes. Separate pretty-JSON archive tests
prove original incoming project and ZIP bytes remain exact. Existing blank
commands, opaque/Unicode IDs, old manifests, save isolation, explicit file-copy,
and legacy/new standalone boot integrity regressions remain in the passing set.

Private disposable PostgreSQL execution, exit 0: **1 passed, 0 failed/skipped**
(43.80 seconds):

```sh
TMPDIR=/dev/shm node --test test/communityDependencyPersistence.test.mjs
```

The real upload handler rejects coherent used PNG/audio omissions outside
`requiredAssets`, system and map unknown/external refs, and mandatory empty
sprite/tileset images while both tables have zero rows. It then persists three
complete releases (background-only, custom-BGM-only, both) byte-for-byte. It also
validates a supported older selected collector after a different frozen collector
becomes default, with current editor/source/public assets unavailable to ingress.
Only the test's temporary socket-only PostgreSQL cluster receives writes.

Other passing commands:

```sh
npm run typecheck:app
node_modules/.bin/tsc -p .omo/round2-tsconfig.json
(cd community-site && ../node_modules/.bin/tsc --noEmit --incremental false)
node --check test/communityDependencyPersistence.test.mjs
npm run openwiki:index
node scripts/openwiki-index.mjs --check
git diff --check HEAD -- src test scripts openwiki
```

The local strict config extends `tsconfig.json`, sets `noEmit: true` and
`incremental: false`, includes `src` plus the three changed TS tests, and excludes
`node_modules`, `dist`, and `src/benchmark`. It does not enable `allowJs`.
LSP diagnostics were requested for all repair code and the three auto-merged
project/export files. The final collector/dialog-test LSP refreshes timed out;
the executed app and strict test compiler checks above cover those files.

## Failing-first and verification limits

Local logs are under `.omo/evidence/release-versioning/round2-*.log` (not added
alongside the lead's untracked evidence):

- `round2-red.log`: actual ZIP/HTML failures for blank background and custom BGM,
  exact-byte archive failures, editorial metadata failure, and missing collector
  display fields. The aggregate then exhausted V8 formatting an unexpectedly
  accepted full archive in the new mandatory-image assertion.
- `round2-first-green-attempt.log`: optional selections and display repaired, but
  the same mandatory-tileset acceptance exhausted V8's diagnostic formatting.
- `round2-mandatory-red.log`: after bounding rejection diagnostics to `accepted`,
  the precise regression reports `promise resolved 'accepted' instead of rejecting`
  for a mandatory empty tileset image. No assertion was removed or skipped to fix it.
- `round2-persistence-red.log`: independently reports `201 !== 422` for the same
  mandatory-image case. The collector fix, not archive mutation, closes it.
- `round2-test-typecheck-config-error.log`: initial strict config exposed missing
  JS build declarations (TS7016); the committed declaration resolves this.
- `round2-green.log`, `round2-persistence.log`, and the three final typecheck logs
  contain the final passing results.

`git diff --cached --check` reports whitespace in incoming main's raw
`output/evidence/monster-catalog/final-main-integration` logs/patches. That directory
is byte-identical to MERGE_HEAD (`git diff MERGE_HEAD -- <directory>` is empty).
Those historical records were not rewritten. The scoped source/test/script/wiki
whitespace check passes. Existing broader gate/battle-test limitations recorded
in P2-VERIFY remain outside this focused run.

## Lead handoff / ownership

No full root/community build or real exported-game browser run was performed by
this child. Tests build only an in-memory collector and disposable ingress/fixture
bundles. No retained runtime or generated public asset was edited; the tracked
static-player diff against the pre-merge HEAD is empty. No push/remote merge occurs.

Build and retain a NEW matching web + standalone + collector runtime from this
candidate, refresh the existing tracked static player through the normal lead-owned
pipeline, and select/upgrade to that new runtime for optional-map export QA. Do not
rewrite or grant new behavior to an old digest. Collector contract version remains
2; the repaired bytes obtain a new runtime content digest. Main's merged monster
metadata also changes source provenance, so existing producer outputs are stale.

Disk space was only 200-300 MiB during this turn; `/dev/shm` had 49 GiB free and held
the automatically cleaned disposable persistence fixtures. Full builds need the
lead's disk-space recovery first. Installed Node, esbuild/Vitest/TypeScript and
PostgreSQL 16 were sufficient for this child's focused verification. No package
installation, shared DB write, retained-archive edit, or public-asset workaround
was used. Fresh ultrabrain approval remains required before PR #677 can merge.
