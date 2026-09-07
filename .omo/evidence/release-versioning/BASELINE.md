# Clean baseline verification

Revision: `5d2649d0c`.

Focused checks ran before implementation in
`/home/main/z-project/rpg-zzu-release-versioning`.
Full gates ran in a separate, unchanged detached worktree:
`/home/main/z-project/rpg-zzu-release-versioning-baseline`.

| Check | Result |
| --- | --- |
| `npm run typecheck:app` | Exit 0 |
| Focused Vitest export/save/migration suite | 49 passed, exit 0 |
| Node player artifact/release/boot suite | 85 passed, exit 0 |
| Full `npm run gates` | Unresolved: 1800-second timeout, exit 124 |
| `npm run gates -- --only css` | Exit 0; budget and graph both passed |
| `npm run gates -- --only surface` | Exit 1; 7 failed, 108 passed across 10 test files |

Focused Vitest command:

```text
npm test -- test/webExport.test.ts test/webExportRuntimeAssets.test.ts test/webExportZipPruning.test.ts test/lifeSaveVersion.test.ts test/playerSaveSlotLoadGuard.test.ts test/migrationRoundTrip.m1.test.ts --reporter=json --outputFile=.omo/release-versioning-baseline-vitest.json
```

Node command:

```text
node scripts/run-node-tests.mjs playerArtifact playerRelease communityPlay playerBoot
```

Full gate command:

```text
timeout 1800 npm run gates -- --save-baseline --baseline .omo/release-versioning-clean-baseline.json --json
```

The full command produced only npm's command banner before its deadline. This
does not establish passing tests or a usable complete baseline. The timeout is
retained as an unresolved result; focused passes are not a replacement for it.

The surface failures reproduce on the unchanged starting revision:

- `test/eventEditorCommitProbe.baseline.test.ts`: 2 failures.
- `test/eventEditorFormSurface.baseline.test.ts`: 1 failure.
- `test/eventEditorInteractionSurface.baseline.test.ts`: 1 failure.
- `test/eventEditorM2Surface.baseline.test.ts`: 2 failures.
- `test/eventEditorPortalSurface.baseline.test.ts`: 1 failure.

They concern pre-existing event-editor form, picker, and commit snapshot drift.
The gate reports these as regressions against its older stored snapshots even
on the clean starting revision. Do not update those snapshots to hide failures.
Compare the final change against this measured starting state.

## Integrated main baseline

The implementation merged main at
`4088801212247aa816578587edf13911cd70d988` (second parent of `0537420dc`).
The comparison worktree was advanced to exactly that commit, with no local
source edits, and `npm run gates -- --only surface` was run again.

Result: exit 1, 7 failed and 108 passed across 10 files; 6 files failed.

- `test/databaseAllTabsRenderWalk.test.ts`: 1 failure.
- `test/eventEditorCommitProbe.baseline.test.ts`: 2 failures.
- `test/eventEditorFormSurface.baseline.test.ts`: 1 failure.
- `test/eventEditorInteractionSurface.baseline.test.ts`: 1 failure.
- `test/eventEditorM2Surface.baseline.test.ts`: 1 failure.
- `test/eventEditorPortalSurface.baseline.test.ts`: 1 failure.

This later result is the applicable surface comparison for the integrated
branch. The initial full-gate timeout remains recorded above; this narrower
run does not turn that timeout into a full-suite pass.

## Isolated integration environment

Community lockfile dependencies were installed with
`npm ci --no-audit --no-fund` (exit 0).

A private local PostgreSQL 16 cluster was initialized for this session. Existing
community migrations `0001` through `0005` applied successfully with
`ON_ERROR_STOP=1`. All future migration/upload/retention QA must use this private
database, not shared project or community rows. Connection details are runtime
session state, not repository configuration.
