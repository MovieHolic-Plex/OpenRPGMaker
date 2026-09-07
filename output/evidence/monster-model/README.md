# Monster metadata foundation evidence

Worktree: `/home/main/z-project/rpg-zzu-monster-model-0907`
Branch: `agent/monster-model-0907`
Base: `b9dec50fb`

## Scope delivered

- Optional `Project.monsterMetadata`, validation, exact raw-ID JSON/backup/package preservation.
- Pure normalized patch/reset APIs and per-resource/per-field three-way delta.
- Conditional map-patch save integration and accepted-save reconciliation guarded by content lineage.
- Bundled/profile/upload resource authority, explicit upload-kind precedence, orphan exclusion.
- Empty typed `MONSTER_CATALOG` scaffold. No production reviewed entries or inferred descriptions authored.
- Monster search and picker option delegation; general image/picture selection unchanged.
- Playable-export stripping and metadata-excluded uploaded-asset usage accounting.
- Metadata-only change totals, commit/proposal summaries, safety and construction/headless accounting.
- Existing project history round trips verified; no new history mechanism.
- Focused schema wiki documentation.

## RED, then GREEN

Commands used the repository's npm/Vitest runner, with real exit codes captured without output pipelines.
`raw-logs.tar.gz` preserves byte-exact tool output. Readable `.log` copies only normalize
trailing whitespace and extra EOF blank lines so the evidence passes `git diff --check`.

| Evidence | Result |
| --- | --- |
| `red-foundation.log` | 17 behavioral failures before implementation: malformed loads accepted, raw IDs dropped, metadata included in exports, missing diff count, search/picker authority absent |
| `red-delta.log` | 19 failures because patch/reset/delta functions did not exist yet; validator module was present and imported successfully |
| `red-persistence-accounting.log` | 8 failures, 5 passes before save/reconciliation and consumer changes: remote fields lost, fresh response reconciliation absent, optional accounting keys rejected/invisible |
| `green-foundation.log` | 36/36 passing after foundation implementation |
| `green-persistence-accounting.log` | 13/13 passing after save/reconciliation and accounting integration |
| `green-regressions.log` | 283/283 passing, 19 files, one final run, 190.74s |
| `typecheck-app.log` | `npm run typecheck:app`, exit 0 |
| `build-app.log` | `npm run build:app`, exit 0, 1513 modules transformed |

Final regression command:

```sh
npm test -- --maxWorkers=2 --minWorkers=1 \
  test/monsterMetadata.test.ts test/monsterMetadataFoundation.test.ts \
  test/monsterMetadataAccounting.test.ts test/monsterMetadataPersistence.test.ts \
  test/monsterMetadataHistory.test.ts test/monsterResourceCatalog.test.ts \
  test/audioDescriptions.test.ts test/audioDescriptionPersistence.test.ts \
  test/audioDescriptionConcurrentPersistence.test.ts test/audioDescriptionExport.test.ts \
  test/audioDescriptionDiff.test.ts test/audioResourceCatalog.test.ts \
  test/audioResourceSearchContract.test.ts test/resourceSearch.test.ts \
  test/databaseResourcePickerDialog.test.ts test/projectCommitLogging.test.ts \
  test/storePersistenceLineage.test.ts test/storePersistenceProof.test.ts test/headlessTools.test.ts
```

Async regression tests subscribe to transport entry/commit signals before actions. The owning
Vitest abort signal bounds waits. No sleeps, polling, real DB requests, new dependency, or server
were used. The wire-level in-memory transport exercises real serialization, SHA conditional
save behavior, loader, store flush, and commit boundaries. Tests distinguish different-field
concurrency, same-field local precedence, reset/clear, remote-only edits, fresh edits during RTT,
stale responses after project replacement, and failed writes retaining their baseline.

All changed TypeScript files received clean LSP diagnostics. Two broad directory scans timed
out (project/tools); targeted changed-file diagnostics replaced those scans successfully.
`git diff --check` passed. New tests do not pin prose. The reviewed-status test uses an explicitly
labeled catalog data fixture; it does not claim that the production scaffold is reviewed.

## Public API

Types from `@/project/types`:

```ts
type MonsterMetadata = {
  readonly name: string;
  readonly tags: readonly string[];
  readonly description: string;
};
type MonsterMetadataOverrides = Record<string, Partial<MonsterMetadata>>;
```

`@/project/monsterMetadata` exports:
- `validateMonsterMetadata(value: unknown): asserts value is MonsterMetadataOverrides | undefined`
- `setMonsterMetadataOverride(overrides, resourceId: string, patch: unknown): MonsterMetadataOverrides`
- `resetMonsterMetadataOverride(overrides, resourceId: string): MonsterMetadataOverrides | undefined`
- `applyMonsterMetadataDelta(base, local, latest): MonsterMetadataOverrides | undefined`
- `countMonsterMetadataChanges(before, after): number`
- `MONSTER_METADATA_FIELDS` and the four `MONSTER_METADATA_*` length/count limits.

Override/delta/count arguments are `MonsterMetadataOverrides | undefined`. Reset removes the
whole resource override; set preserves omitted fields. Delta merges changed fields only,
so reset preserves remote-only fields absent in the local baseline.

`@/assets/monsterResourceCatalog` exports:
- `MonsterResourceProject`: project projection containing optional monsterMetadata, resourceProfiles,
  and assets.uploaded. Full Project satisfies this shape.
- `MonsterMetadataSource = "project" | "catalog" | "fallback"`
- `MonsterResource`: metadata plus resourceId, origin (`bundled`/`uploaded`/`profile`), reviewStatus
  (`reviewed`/`unreviewed`), and readonly per-field sources.
- `listMonsterResources(project): readonly MonsterResource[]`
- `getMonsterResource(project, resourceId: string): MonsterResource | undefined`

`ResourceSearchOptions.monsterProject` passes project authority to monster search. The AI lane
must pass its current project at generic tool callers and account for optional
`ChangeSummary.monsterMetadataChanged` in its session/completeness consumers.

## Review and limits

New production files own metadata operations (92 pure LOC), resource authority (70), and catalog
data (3). All new files are below 200 pure LOC; every changed TS file is measured in `loc.txt`.
Existing integration files include the 200-250 warning band and oversized modules; broad
refactors are excluded by this scoped lane. No new generic helper, parameter-bloat abstraction,
cast, suppression, tagged-variant dispatch, redundant verification, negative name, or logging
boundary was introduced. Existing guard conventions are intentionally used instead of a new
validation dependency.

The build reports circular-chunk, mixed static/dynamic import and large-chunk warnings; no
warning was suppressed. This lane did not compare a baseline build or run the full repository
gate suite. Lead-owned browser/real-project QA, UI/AI integration, player/standalone full build,
and actual original-artwork catalog population remain integration responsibilities.

No old compatibility assertions were changed or removed. General image/picture picking stays
available; monster assignment intentionally requires explicit monster uploads/profiles.
The generated wiki index was not included because regeneration also rewrote unrelated stale
baseline entries; the integration lead can regenerate it after all wiki lanes land.
