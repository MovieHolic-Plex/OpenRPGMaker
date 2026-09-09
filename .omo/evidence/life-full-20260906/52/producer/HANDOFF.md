# Task52 producer handoff

Status: **FROZEN UNCOMMITTED**, scoped nonvisual correction complete. No Task12, native, Phase4 or overall approval. Independent judgment and the final combined native/build/docs/commit delivery remain outside this producer's scope.

Worktree: `/home/main/z-project/rpg-zzu-life-full-p4`  
HEAD: `ea6b2b358088cb6061783f6ffd162169764a07e9`  
Task: `st_01a07af2`  
Machine-readable handoff: [SOURCE-HANDOFF.json](SOURCE-HANDOFF.json)

## Correction and exact source

`normalizeSystemRecords` previously discarded already-declared `SystemRecords.playerFootprint` and `playerPassRows` while reconstructing the system object. The public Project parser invokes that normalizer. A seven-line addition (including one import) now preserves each defined optional independently, using `normalizeCharacterFootprint` and `normalizePassRows` with normalized authored height.

| File | SHA-256 |
| --- | --- |
| Product before, identical to HEAD | `390700d58fe0cd382dab957e096351047ff76c81c25e0018964bdfca5e9a299f` |
| `src/project/databaseRecordModel.ts` final | `c27eb4c534e39a6b0c68c2d3650aadb905c8f42e0d053d10f79c8092aa6cbdfd` |
| New `test/playerBodyProjectPersistence.test.ts` | `0dd6e5c03614aa124a4d953c8f80e6189fbdaebe0c31bf0b3335619861372ef1` |

[scoped.diff](scoped.diff) contains only this product correction and the new 22-case test. `databaseRecordModel.before.ts`, `baseline.test.ts`, `red.test.ts` and `red-contract.test.ts` preserve source/test checkpoints. The final test is byte-identical to the contract-corrected behavioral RED test.

No new setting, broader system whitelist cleanup, schema bump, movement/render change, session/farming/save edit, or authored starting plots. Absent optionals stay absent. Strict malformed wire rejection remains unchanged; direct in-memory normalization uses the established bounded helpers. Session override priority remains independent per field, with passage rows clamped to resolved height.

## Executed proof

Each stage retains complete separate stdout/stderr, direct exit, exact command, before/after source identity and scratch cleanup receipts under its label. Source identities were unchanged during every validator. Every heavy command ran behind shared `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`, with bounded execution and private tmpfs caches.

| Stage | Actual result | Receipts |
| --- | --- | --- |
| Before-product characterization | 28 tests / 5 files passed, exit0 | `baseline.*` |
| Initial behavioral RED | 20 failed / 2 passed, exit1 | `red.*` |
| Final-test behavioral RED, still before product edit | 20 failed / 2 passed, exit1 | `red-contract.*` |
| Configured diagnostics before typecheck | Source, new test and retained TS probe: zero diagnostics, exit0 | `diagnostics.*` |
| Final focused suite, run once on final source | 135 tests / 9 files passed, exit0 | `green.*` |
| Actual public CLI probe | Assertions and parsed input/results, exit0 | `public-probe.*`, `public-input.json`, `public-result.json` |
| `npm run typecheck:app` | exit0; npm update notice only | `typecheck-app.*` |
| Final scope/hash/cleanup certification | exit0 | `certify.*`, `preservation.json`, `cleanup.json` |

Final suite command:

```sh
node scripts/run-vitest.mjs run --configLoader runner --cache=false --maxWorkers=2 --minWorkers=1 \
  test/playerBodyProjectPersistence.test.ts test/playerFootprint.test.ts \
  test/characterFootprint.test.ts test/ioFootprintValidation.test.ts \
  test/lifeSaveVersion.test.ts test/p0ProjectSchema.test.ts \
  test/p1FoundationSchema.test.ts test/p2ProjectSchema.test.ts test/p2SpatialSchema.test.ts
```

The baseline proves legacy absence, default1x1/passRows1 and byte-stable Project4 behavior using the existing legacy fixture (only the unrelated redundant titleGraphic seed is omitted). Final tests cover 3x3/passRows1, 2x5/passRows2 and 8x8/passRows7 through actual serialize/deserialize/startSession/body APIs; independent absence; repeated canonical wire/normalization stability; malformed and bounded direct inputs; unchanged wire rejection; nonfinite direct inputs; and independent session override priority. Existing Save4-to-Save5 and Project schema regressions passed unchanged.

### Preserved failure interpretation

The initial RED includes the real valid 3x3/passRows1 -> 1x1 loss, not an import/export failure. It also exposed an incorrect test expectation: malformed wire geometry is strictly rejected before normalization. The test was corrected **before product editing** to retain every malformed case, assert existing rejection, then separately normalize direct input and round-trip the normalized result. No test was removed, skipped or weakened. Canonical repeated-byte comparison starts after initial normalization because arbitrary input property ordering is not a storage contract. The exact final test then produced the second behavioral RED. Both complete originals survive.

A later evidence-only certifier initially misread `git diff --no-index --check` exit1 for a nonempty new file as an error. Its empty streams, original script and traceback are retained in `whitespace-new-test-initial.*`, `certify-initial.py`, and `certify-initial-failure.txt`. Only the receipt interpreter was corrected to require exit1 plus empty diagnostics; product/test/probe and the completed final behavioral run were not repeated or changed.

## Public API observations

Run through retained `probe-runner.mjs` and `public-probe.ts`, using a Vite module loader with no HTTP listener, application env load, watcher, browser or mocked success:

- Real serialized input written to disk and read through public `deserialize` retains authored3x3/passRows1; a new real session resolves the same body.
- At foot anchor(5,7), full body is left4/right6/top5/bottom7; passage is left4/right6/top7/bottom7.
- Three additional Project cycles retain3x3/passRows1 and stable canonical bytes; direct normalization is idempotent.
- Session override2x2/passRows2 wins without mutating project settings.
- SaveSnapshot version5 creation/apply without session body overrides retains the project-authored3x3/passRows1. This is **not** a new override persistence contract.
- Legacy absence resolves1x1/passRows1. Malformed wire is rejected; direct width99/height3/passRows0 normalizes to8x3/full3rows.
- New-session farmPlots is `{}`. This is intentional: ProjectSession declares no authored farmPlots. Later native QA must till or provide a declared valid Save input.

## Preservation and cleanup

All **11 UI/test carryover files and 3 wiki/index files remain byte-identical** before/after. The11 match producer-r2 and build-r2 source identity; the3 match build-r2 final docs identity. The older producer-r2 wiki hashes differ for INDEX/schema due to already-existing intervening docs work, not Task52 changes. Full per-file hashes are in SOURCE-HANDOFF and `carryover-before.json` / `carryover-after.json`.

Tracked verification inputs changed only in the authorized product/test paths. Git index remains unchanged; no stage/commit/merge, checkout/reset/stash/sparse operation, dependency install, remote write, UI/browser/image work, existing-test edit or wiki edit occurred. Own tmpfs scratch was removed after each command; the probe loader closed in finally. Evidence was not cleaned. Whitespace and retained runner syntax checks completed with direct receipts.

Full build is **not run, not waived and not claimed** here. The later final combined Task12 CLI node owns full build/docs/commit after native prerequisites. The small correction remains intentionally uncommitted in the shared increment.

Fact-only final docs brief: [WIKI-BRIEF.md](WIKI-BRIEF.md). Core prerequisite reviewed at the exact absolute path `/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/47-48/VERIFY.md`; its scoped core acceptance is not expanded by this handoff.
