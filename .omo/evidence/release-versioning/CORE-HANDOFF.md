# Core release-versioning handoff

## Ownership and scope

Core identity checkpoint: `204ba00773e586312091584a177be9a55c13668a`.
This checkpoint completes the project/runtime/archive/export/standalone/save/editor
side. No community-site file, community test or community wiki was edited.
The lead integrates the community-only changes and owns final full gates, full
build, editor-menu/gameplay QA, community route/SQL QA, review and merge.

## Delivered contracts

- Optional Project4 publication identity; legacy validation generates no IDs.
- Save6 game/lineage namespace, Save4/5 legacy behavior, directional compatibility,
  explicit non-overwriting copy imports and visible accepted-predecessor load controls.
- Korean Game & publishing modal with staged prepare/version/upgrade/fork,
  immediate-predecessor acceptance, exports, cancellation and persistent opener focus.
- Explicit current-editor-engine preview label for publication drafts.
- Common exact-byte release inventory and canonical release digest; strengthened
  stored-ZIP local/central/CRC/trailing-byte checks.
- Operator-retained web and standalone builds with both SDKs, schema/collector
  metadata and public assets. Existing SDK/deployment/source/secret guards run
  before retention; staged bytes are rehashed. Existing digest directories are
  never overwritten. Normal dist rebuilds do not remove the archive.
- Pinned ZIP exports use only selected archived dependencies and retain all 60
  required runtime assets. Existing legacy pruning assertions remain unchanged.
- Standalone release ID, both SDK payloads, original/transformed CSS proof,
  project identity and decoded payload checks before executable launch.
- Focused OpenWiki operational and compatibility documentation; runnable artifact,
  offline browser and extended editor-export QA entry points.

## Focused verification

All commands below exited 0. No full-gate success is claimed.

```sh
npm run typecheck:app
npx tsc -p scripts/tsconfig.release.json
node scripts/run-node-tests.mjs playerArtifact playerRelease communityPlay playerBoot
```

Node artifact result: 85 passed. App and focused strict script/test diagnostics:
no errors. `git diff --check` also passed.

125 tests in 20 files passed in one focused run:

```sh
npm test -- test/publication.test.ts test/publicationSaves.test.ts test/gameRelease.test.ts test/runtimeArchive.test.ts test/publicationExport.test.ts test/publishingDialog.test.ts test/publicationSaveImportPanel.test.ts test/releaseZipHeaders.test.ts test/devPlayerBundles.test.ts test/playerLoadPanel.test.ts test/lifeSaveVersion.test.ts test/migrationRoundTrip.m1.test.ts test/playerSaveSlotLoadGuard.test.ts test/webExport.test.ts test/webExportRuntimeAssets.test.ts test/webExportZipPruning.test.ts test/standaloneExport.test.ts test/standaloneHtml.test.ts test/standaloneCli.test.ts test/projectPackage.test.ts --maxWorkers=4
```

Runtime production entry points and real artifact/browser checks passed:

```sh
npm run build:player
npm run build:standalone:bundle
npm run archive:runtime
npx vite-node scripts/qa-release-artifact.mts
node scripts/qa-release-offline.mjs
npx vite-node scripts/qa-release-artifact.mts verify-shots/release-artifact/B
node scripts/qa-release-offline.mjs verify-shots/release-artifact/B/release.html
```

Build warnings remain visible: large chunks and the existing unresolved-at-build
`/generated/battle-reference-forest.png` CSS reference. No warning was suppressed.

## Real A/B evidence

Runtime A: `a1cca49a9374025f49f664332ba71f25d09813ace59b156073a8e2c06dd335b7`.
Release A: `1245e513eab9a6717c1f082f8ac1d40596e9942ea2f074844683c2f7966f9f10`.
742 payload files; ZIP 58,142,846 bytes; HTML 85,789,083 bytes.

Runtime B: `4671b456fd0cd5ab1f2828a7842be50d329a8dfcf8a7e2e372cf9affdb1508e9`.
Release B: `16660c313bc3752ac6b84e022f22807cf4103d95b2fc6f353944ec3a1fc732ef`.
742 payload files; ZIP 58,144,422 bytes; HTML 85,791,411 bytes.

After B replaced the installed default, A's retained web JS and standalone JS/CSS
all passed `sha256sum --check`. Both HTMLs booted over file:// and moved from
map_blank_start (10,8) to (11,8), with zero HTTP requests and zero runtime errors.
This is boot/movement evidence, not a claim of full gameplay or visual review.

Local artifacts, reports and screenshots are under `verify-shots/release-artifact`
and its `B` subfolder. They are intentionally not committed (about 138 MB per
pair). Both runtime directories remain in the gitignored `.runtime-archive`.
Detailed red/green logs and final receipts remain beside this document locally.

## Parent integration / remaining gates

- Community consumes unchanged signatures `verifyGameRelease(bytes, trusted)` and
  `readTrustedRuntime(archiveRoot, target)`. Runtime metadata binds Project4,
  Save4/5/6 and collector version 1. Project wire version must match that schema.
- Operator trust must come from the retained archive, never uploaded manifests.
  Additional allowed media/JSON (including SVG) must receive non-executable,
  sandboxed serving headers. Uploaded HTML/JS is not a trusted runtime.
- Rebuild producer artifacts after integration before community prebuild checks.
- Run the real editor-menu path with the worktree server:
  `npm run qa:export -- --editor-url http://127.0.0.1:<port> --publication --out verify-shots/release-versioning`.
  The extended harness is typechecked; the full editor-menu narrative is lead-owned.
- Legacy Save4/5 adoption is deliberately an explicit known-key API operation
  (`importSaveCopy` with `adoptLegacy: true`), never a scan of title/slug namespaces.
- Parent reported clean full gates timed out and pre-existing surface failures;
  those are unresolved baseline debt, not passing gates or core regressions.
