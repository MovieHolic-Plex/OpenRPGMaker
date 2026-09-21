# Interior authoring/load consistency: engine verification

Base: `dd37d644eb096b270504f93bcaf6bd56c9b153d1`.
Branch: `agent/ai-interior-load-consistency-0907`.
Worktree: `/home/main/z-project/rpg-zzu-ai-interior-load-consistency-0907`.
Task: `st_01a078ba`.

This is a code-fix receipt, not a replacement acceptance result. The archived
Round8 diagnosis was read completely and remains failed and unmodified.

## Requirements / completed todo

- [x] Shared PROJECT-layer composition of the 26 pack and 13 supplemental groups,
  separate from per-tile runtime seeding; preserve existing IDs and full records.
- [x] New upper-layer cabinet cells retain their underlying floor.
- [x] Migrate complete known legacy seeded kits only; preserve custom/ambiguous
  content, provenance, explicit layer metadata, runtime priority and grafts.
- [x] Real normalization mutations remain dirty until persisted; schedule after
  load activation; compare raw structure rather than trusting helper flags.
- [x] Real room pipeline -> accepted save -> fresh editor canonical identity.
- [x] No 39/26 group oscillation across authoring/load.
- [x] User group memberships, rules, grammar, layer home and origin survive.
- [x] Default and nondefault floors remain under new upper cabinets.
- [x] Eligible legacy saved-kit precedence resolves to upper cells.
- [x] Explicit lower-layer counterexamples, including maps with room plans, survive.
- [x] Load/reload/reconnect migration failure and concurrent-edit catch-up retain
  truthful dirty state; old-lineage saves cannot overwrite new-lineage authority.
- [x] Graphical/both title graphics and authored nondefault arrays remain significant
  under the unchanged existing canonical identity contract.
- [x] Focused tests, LSP, app typecheck, full build, offline pipeline execution,
  matching OpenWiki, and authorized local commit. No push or remote merge.

## Red-first receipts

Local raw logs are under `output/evidence/interior-load-consistency/` (gitignored).

- `red.log`: frozen production source, corrected minimal fixture, 19 failed / 2
  passed. Failures included deleted/overwritten groups, lower new cabinet,
  unchanged legacy kit, destructive lower-map repair, unequal fresh-store hash,
  and falsely clean migrated load. No production fix had been applied.
- `red-priority.log`: expanded counterexamples, 1 failed / 29 passed before the
  earlier minimal runtime seeder was taught to preserve cabinet priority overrides.
- The initial fixture had a `mapTree.push` mistake; it was corrected to
  `mapTree.children.push` before the recorded red receipt above. The corrected
  test failed on the actual canonical identity mismatch instead.
- Subsequent lifecycle failures exposed a real cross-lineage coalescing deadlock.
  Replacement migrations now use their own flight. The lineage test requires an
  accepted migration receipt for load as well as reload/reconnect, rather than
  relying on the old falsely clean initial-load behavior. Its exact receipt
  object, SHA, identity, stale-proof rejection, baseline and later-save assertions
  remain in force.

## Final verification

### Focused suite

Command (inside `bwrap --unshare-net --dev-bind / /`, with the local blank
`disabled.env` read-bound over this worktree's `.env.local`):

```sh
npm test -- \
  test/interiorLoadConsistency.test.ts test/tilesetHarness.test.ts \
  test/interiorRoomVocab.test.ts test/interiorObjectCatalog.test.ts \
  test/interiorTransparentPropLayerRepair.test.ts test/interiorRoomPipeline.test.ts \
  test/interiorRoomPipelineParity.test.ts test/roomHarnessEngine.test.ts \
  test/storePersistence.test.ts test/storePersistenceLineage.test.ts \
  test/storePersistenceProof.test.ts test/loadNewRemoteProject.test.ts \
  test/transactionalNewRemoteProject.test.ts test/layerRouting.m1.test.ts \
  test/structureKitRasterModel.test.ts test/storeFlushShaEvidence.test.ts \
  test/storeMutationInstrumentation.test.ts test/storeEventDraftPreserve.test.ts \
  test/structureKitPlacementConditions.test.ts test/structureKitGrowth.test.ts \
  --maxWorkers=2
```

`final-focused.log`: **250 passed, 7 failed, 257 total; 17 passed files / 3 failed**.
The new regression file passes **30/30**. Existing proof **18/18**, lineage **8/8**,
transactional new-project **16/16**, mutation instrumentation **8/8**, and SHA
evidence **2/2** pass. No sleeps, polling, skipped failing tests, or test timeout
changes were introduced. Async gates are subscribed before actions and bounded.

The seven remaining failures also fail against frozen production source in
`baseline-focused.log` / `baseline-isolated.log`:

1. `layerRouting.m1`: all fence tiles preserve ground (expected 303, received 243).
2. `tilesetHarness`: castle roof-deck/wall-face/round-tower default groups
   (expected true, received false).
3. `storePersistence`: no LegacyDb writes before load (unexpected test fetch).
4. `storePersistence`: dev showcase does not autosave (undefined response.ok).
5. `storePersistence`: fresh project ignores local override (undefined response.ok).
6. `storePersistence`: dev showcase save/reload (undefined response.ok).
7. `storePersistence`: showcase persistence status (fetch failed / EAI_AGAIN).

Frozen-source comparison used read-only file binds of exact `git show` content,
not edits in the parent/review trees. The baseline run additionally fails the
new group-preservation expectation, intentionally red on the old deletion policy.
No broad baseline test was removed, suppressed or relaxed to obtain the result.

### Static validation and build

- LSP requested for every changed TypeScript source/test file: no diagnostics.
  One earlier wave failed with ENOSPC; after disk availability recovered, all
  requests completed. LSP did not catch two intermediate tsc errors; both were
  fixed and the actual app compiler below was the gate.
- `npm run typecheck:app`: **exit 0**, `typecheck.log`.
- `npm run typecheck`: **exit 2**, broad known-red test surface, 847 diagnostics;
  the new `interiorLoadConsistency.test.ts` has **zero** type errors. Existing
  `Promise.withResolvers` library errors in the lineage test predate this change.
- `npm run build`: **exit 0**, `build.log`; editor, export player + SDK manifest,
  and standalone bundle all built. Build ran network-isolated with `dist` and
  `/tmp` mounted as temporary RAM-backed filesystems to avoid root-disk pressure.
  Build output was intentionally ephemeral; no deployment occurred.
- Build warnings remain: large chunks, mixed static/dynamic imports, and an
  unresolved `/generated/battle-reference-forest.png` runtime asset reference.
- `git diff --check`: **exit 0**.

### Separate real pipeline execution

`manual-pipeline.log`: offline Bun invocation of real `runRoomPipeline` on a
minimal one-room cabinet fixture, followed by serialize/deserialize, bundled
normalization, legacy repair and room-harness ensure. Assertions all passed:

```json
{
  "before": "9d070ed8310b5f667674bc50ae384f4696795587ebb8fc58f799b593df7a6e1e",
  "after": "9d070ed8310b5f667674bc50ae384f4696795587ebb8fc58f799b593df7a6e1e",
  "groups": 39,
  "reportedChanged": true,
  "cabinet": { "upper": [148, 178], "lower": [72, 72] }
}
```

This independently demonstrates a structurally unchanged normalization despite
a true helper flag. Store regression coverage verifies that a fresh editor stays
clean/idle and a clean flush does not submit another write.

## Rationale and limits

- The fix changes writers and ownership, not serialization or persistence proof.
  No group/hash exclusion, pre-hash project normalization, or weaker proof exists.
- Legacy `learnedFrom` is just provenance. Migration also requires the complete
  known old kit, exact bundled artwork identity and absence of overrides.
- Placed tile arrays have no per-cell authorship/floor receipt. Even a matching
  room plan and kit cannot distinguish deliberate lower paint from the old writer.
  Such maps remain untouched; only eligible kit definitions are upgraded. This is
  a deliberate preservation boundary, not a claim that old maps were visually fixed.
- The initial unisolated baseline run allowed a test to attempt an unintended
  configured-host read, which failed authentication. Subsequent verification was
  network-isolated. No live DB/content edits, UI, model calls or currency work were
  performed. No browser rendering, live DB save/reload or new Round8 acceptance
  run is claimed. Local test transports are not evidence of a live database write.
- Root-disk availability fluctuated during concurrent work. No other agent's
  worktree, assets, logs or evidence were deleted; dependencies were shared and
  full-build output used temporary RAM storage.
