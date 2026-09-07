# PR677 bounded merge handoff (st_01a07a45)

## Candidate and merge intent

Assigned tree only: `/home/main/z-project/rpg-zzu-sweep11-release`.
First parent: `83bd6098d94dd6d7082d2ded6d557be928592623`.
Second parent / exact PR677 tip: `c193f62952f39be4dcbbe26f8fa2111ada3874d6`.

The PR already contains the assigned first parent (merge-base equals first
parent), so `git merge --no-ff --no-commit` succeeded with **zero conflicts**.
There were no manual resolutions or production/test edits. Before this handoff
was added, the staged tree was byte-for-byte identical to the PR tip. This is an
explicit merge commit with OmO attribution, not a replacement/squash of either
history. Resolve the final candidate with `git rev-parse HEAD` in this tree.

Save6 remains opt-in for publication; legacy Save4/5 and life reconciliation
remain present. The focused checks below cover life consumers/persistence,
legacy faces and migration, publication scopes/imports, and portable exports.
Current NPC/action, audio, project-wiki and accepted-save-proof implementations
are inherited through the first-parent ancestry; no independent rewrites were
made. `protected-path-diff.log` is an empty static comparison for its selected
unchanged paths, not a claim of gameplay coverage for every inherited subsystem.

## Executed verification

- `npm run typecheck:app`: exit 0.
- `./node_modules/.bin/tsc -p scripts/tsconfig.release.json` (90-second outer
  timeout): exit 0.
- Focused Vitest command below (240-second outer timeout): **336 passed, 27 files,
  zero failures**, exit 0, 111.90 seconds. One run, maximum two workers.
- `git diff --cached --check`: exit 0 before the evidence-only addition.
- `git diff --cached c193f62952f39be4dcbbe26f8fa2111ada3874d6 --exit-code`:
  exit 0 before the evidence-only addition.
- Directory LSP request could not run: harness-selected `biome` is not installed
  (`Command not found: biome`). No dependencies were installed. App and focused
  release TypeScript validators above are the executed diagnostic evidence.

```sh
npm test -- test/publication.test.ts test/publicationSaves.test.ts test/gameRelease.test.ts test/runtimeArchive.test.ts test/devRuntimeArchive.test.ts test/communityDependencyClosure.test.ts test/communityReleaseArchive.test.ts test/communitySaveBoot.test.ts test/publicationExport.test.ts test/publishingDialog.test.ts test/publicationSaveImportPanel.test.ts test/releaseZipHeaders.test.ts test/playerManifestContract.test.ts test/lifeSaveVersion.test.ts test/lifeSaveConsumers.test.ts test/lifeRecoveryPersistence.test.ts test/playerSaveSlotLoadGuard.test.ts test/playerSaveSlotLegacyFace.test.ts test/migrationRoundTrip.m1.test.ts test/webExport.test.ts test/webExportRuntimeAssets.test.ts test/webExportZipPruning.test.ts test/webExportCatalogAudio.test.ts test/standaloneExport.test.ts test/standaloneHtml.test.ts test/projectPackage.test.ts test/oprnGameFile.test.ts --maxWorkers=2
```

The dev-runtime suite exercises actual isolated Vite HTTP routes and watcher
signals with fixture builders; it is not an integrated production build or
browser gameplay claim. Publication tests exercise ZIP/HTML production APIs and
frozen collector integrity/optional-resource compatibility with fixtures.
Raw stdout/stderr and exit files are adjacent. App/Vitest logs are committed as
lossless `.log.gz` files (`gzip -cd` to inspect; decompressed bytes were compared
to the untouched local logs). An initial evidence-staging `git diff --check`
reported their original trailing blank lines; binary gzip retention preserves
those exact bytes without introducing text whitespace errors. No tests failed.
No whole gates, root/player/
standalone/community builds, shared DB writes, remote publishing, or production
9888 server actions were performed. No existing runtime archive was present in
this assigned tree, and none was created here (tests own temporary fixtures).

## Parent-owned root editor build/start prerequisites

After integrating this candidate in the root checkout, from that checkout:

```sh
npm run build
npm start
```

1. Use installed root dependencies with Node 24 LTS (this verification used
   v24.11.1). Retain root private environment configuration without copying keys
   into evidence. Do not perform shared SQL as part of editor build/start.
2. Verify intended BGM installation before building. Full BGM is an independently
   installed release pack; `npm run bgm:verify` is the read-only check. For local
   playback, the wiki requires an empty `VITE_BGM_CDN_BASE` before production
   rebuild. Do not infer full-pack availability from these fixture tests.
3. `npm run build` now means app typecheck -> Vite editor build -> web player plus
   SDK -> standalone player plus SDK -> `archive:runtime`. `build:app` and
   `build:fast` alone do NOT satisfy publication/export prerequisites. If only
   producer runtime outputs need regeneration, the documented sequence is
   `npm run build:player && npm run build:standalone:bundle && npm run archive:runtime`.
4. Archive inputs are `dist/export-player`, `dist/standalone-player` and the
   **entire current `public` directory**, from matching current sources. Retention
   verifies source/SDK/deployment/secret guards, identical dependency collectors,
   then copies and rehashes staged files. Ensure disk space for new dist plus a
   staged/new copy of all public and runtime bytes. This tree measured 222 MiB of
   public files and 77 GiB filesystem free; root/full-BGM footprint is unmeasured.
5. Preserve `.runtime-archive/<sha256>/` outside destructive dist rebuilds and
   backups. Do not overwrite or retrofit old digest directories/manifests.
   Only `.runtime-archive/default.json` is mutable. A new build creates a new
   target as needed; previously reviewed runtime IDs are historical evidence,
   not a target to stamp onto this build.
6. Root preview serves `/runtime-archive/` from root `.runtime-archive` through
   `devPlayerBundlesPlugin.configurePreviewServer`. **Preview does not auto-build
   or retain missing archives** (development does). Check HTTP 200 JSON for
   `/runtime-archive/default.json`, then the pointed `<target>/runtime.json` and
   inventoried payloads. Keep all selected historical targets available; missing
   publication targets fail rather than substituting the current engine. Deploying
   only `dist` without this archive and the Vite preview middleware is insufficient.
7. `npm start` is the existing `scripts/start-preview.mjs`: binds
   `0.0.0.0:9888 --strictPort`, default public origin `http://mdc-server:9888`.
   `RPG_ZZU_PUBLIC_ORIGIN` overrides from shell then `.env.local`/`.env`. Release
   ownership of an existing 9888 listener only under the parent's deployment
   authority; do not silently select another port. Retain startup/build logs and
   verify the root editor, same-origin auth/completions, publishing modal and real
   ZIP/offline HTML export after startup. This child did not start/stop that port.

Current source (`gameRelease.ts`) binds Project4 and Save4/5/6; newly retained
collectors are version **2**, with `community-save-isolation-v1` and
`project-dependency-closure-v1`. Some older paragraphs in
`openwiki/editor-workflows-misc.md` still describe contract 1 / isolation alone;
follow current source and the newer community-site release instructions.

## Separate community operations (report only; not editor prerequisites)

- Only after explicit coordination with the community DB owner, an operator must
  apply `community-site/db/0006_immutable_game_releases.sql` once after 0001-0005,
  using the server database role. It creates immutable release ZIP storage and
  deferred listing associations. No SQL was applied here.
- Keep `COMMUNITY_RUNTIME_ARCHIVE_ROOT` on operator-controlled retained builds
  (default `../.runtime-archive` relative to the community process cwd). Trust
  never comes from upload manifests. New uploads require collector 2 and both
  capabilities. Never modify older archives to advertise support.
- Community deployment, if separately authorized, requires retained producer
  archives plus current player sync/verification and `npm run build:community`.
  That command does not itself retain the standalone variant. Node 24 and root/
  community dependencies are required; webpack avoids the documented Turbopack
  external-worktree-node_modules symlink limitation. No community build or deploy
  was performed here.
- SQL/browser community integration suites were not run: the requested bounded
  no-build handoff does not claim Next production, shared DB, or integrated
  Phaser/export-browser validation. Those remain parent/operator-owned.
