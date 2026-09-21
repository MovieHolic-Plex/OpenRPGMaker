# Stale-base object-key order follow-up

## Outcome and exact source

The lead's concern was reproduced: raw JSON insertion order caused three false
stale-base rejections even though the live project had identical authored values.
The correction is committed as **`21978d30f1eddb991e4a18d78cabb2259a49683e`**,
tree **`0745df78be21aa7e4dd26c1495f35feafb318002`**, on starting HEAD
`84f94fc0d379bfb57ce392bb5145c512b9ac9bb0`.

Only three source/test files changed:

- `legacyDbProjectSync.ts`: export the already existing `canonicalJsonString`.
  Its recursive key-order comparison implementation and save callers are unchanged.
- `applyChangesetToStore.ts`: use that comparator for proposal content and world
  after the existing JSON projection. This retains JSON omission behavior without
  adding schema normalization, dropping authored fields, sorting arrays, or
  creating another evidence subsystem.
- `aiStaleProposal.test.ts`: reconstruct a live item record, live map, and live
  world document with identical values and different member order; require real
  apply/undo success. The world case exercises `resetProject:true`. A negative
  control reverses the actual item array and requires stale-base rejection with
  the reordered live array preserved.

The existing required-base API, actual human value-change rejection, project
lineage checks, wiki/reset policy, run cancellation and rechecking at the final
synchronous write boundary remain unchanged. P1's normalized remote comparison
and persistence receipts were not modified. Using its full `serializeForComparison`
here would also introduce schema normalization; reusing the already established
JSONB key comparator instead keeps this correction limited to key order.

## RED and GREEN

The failing-first run executed only the four new comparison cases against the
unchanged old adapter. Each positive case first asserted deep project equality
and unequal raw serialization after a real `store.update`, then the actual apply
returned `ok:false`. **Three failed / one array-order control passed, exit 1**.
The other 14 cases were outside this named RED selection, not disabled or deleted.
The final GREEN ran all tests in every selected file without a name filter and
had zero pending cases. Original log/JSON/test bytes and adapter/test SHA-256 values
are retained in `raw/red*`. Before compiler verification, the new world test's
equivalent immutable assignment replaced its direct readonly-property assignment.
No failing runtime assertion was removed.

All shell commands exported
`TMPDIR=/dev/shm/rpg-zzu-ai-harness-p3-01a07564` and ran in
`/home/main/z-project/rpg-zzu-ai-harness-p3-20260907`.
`vitest.config.mjs` preserves repository settings and uses an explicit top-level
private cache at `$TMPDIR/stale-key-order-st_01a07c73/vitest`.

RED used the same runner/options below with only `test/aiStaleProposal.test.ts`
and `--testNamePattern='object-key reorder|array reordering'`, output `raw/red.json`.
The final targeted GREEN command was:

```sh
node scripts/run-vitest.mjs run \
  test/aiStaleProposal.test.ts test/applyProposedProjectHouseProtection.test.ts \
  test/applyChangesetToStore.test.ts test/projectWikiApplication.test.ts \
  test/projectWikiDelivery.test.ts test/aiGateCommitRejection.test.ts \
  test/projectResetTool.test.ts test/storePersistenceProof.test.ts \
  test/aiRunEpoch.test.ts test/aiRunEpochProof.test.ts test/legacyDbProjectSync.test.ts \
  --config output/evidence/ai-harness/p3/stale/key-order/vitest.config.mjs \
  --configLoader runner --maxWorkers=4 --minWorkers=4 \
  --reporter=verbose --reporter=json \
  --outputFile=output/evidence/ai-harness/p3/stale/key-order/raw/green.json
```

**Direct exit 0: 11 files / 132 tests passed, zero failed/pending.** This includes
all 18 stale cases, real runner resynchronization, actual human tile/item/width
preservation, current-base apply/undo, house refusal, current wiki/reset behavior,
own wiki save/proof, P1 store proof and the existing JSONB map-save conflict tests.

| Validator | Direct result |
| --- | --- |
| LSP, all three changed files | No diagnostics |
| `node --max-old-space-size=8192 output/evidence/ai-harness/p3/stale/key-order/check-changed-types.mjs` | Exit 0; zero changed-file diagnostics |
| `npm run typecheck:app` | Exit 0 |
| `VITE_CACHE_DIR="$TMPDIR/stale-key-order-st_01a07c73/build-vite" npm run build` | Exit 0, after diagnostics; full editor/player/standalone/archive build |
| Source/index hash checks and source commit | Exit 0 |

The compiler still reports the already recorded `runOutcomeApplyFixture.ts`
PassFlag dependency diagnostic. Its path/code/message match the original stale
report's retained diagnostic; it was not suppressed and no full-test typecheck
success is claimed. Build chunk/import/generated-forest-image warnings remain
in the original build log. Tool output with literal whitespace is archived
losslessly as `.gz`, with plain originals retained in the worktree.

## Evidence, cleanup and remaining scope

`raw/verified-source.json` records precommit HEAD, the tested index tree and all
three source/test SHA-256/blob identities. `raw/cleanup.json` checks them against
the final source commit, records source/index status and removes only owned
`dist`, `.runtime-archive`, and `stale-key-order-st_01a07c73` cache output.
The shared TMPDIR/dependencies are preserved. No server, port or remote fixture
was created by this follow-up. Unit store/history transports were isolated.

No item5 investigation, native scenario, full gate, QA script, remote schema or
adjacent implementation was redone or modified. Existing native evidence remains
historical; this follow-up makes no new native/pixel approval claim. The targeted
checks exercise the actual store/apply and public runner paths. Whole-P3 native
integration and independent final verification remain with their assigned nodes.

The lead-owned `.omo/plans/ai-harness-omo-adoption.md` unstaged change remains
untouched. Source/test/index cleanliness is verified separately from that foreign
metadata. Docs should replace the earlier raw-JSON description with the reused
key-order-independent JSONB comparator and its preserved array/value semantics.
The overall goal remains active.
