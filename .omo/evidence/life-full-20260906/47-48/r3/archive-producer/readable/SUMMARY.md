# Plan47/48 - NEW r3 producer handoff

## Outcome

Committed **b87c9822f431ece4674e97a9d9cd15d1956be327** on `agent/life-full-spatial-rights-r3`.

Frozen source tree: `/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3`.
Base: `b5c679efc6c5e575f7a1afb65dfa86939aade325`.
Task: `st_01a079b9`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.

This is new r3 evidence, not a replacement original RED and not a claim that missing r2 logs were recovered. All nine restored source/test/wiki owners match the immutable plan51 SOURCE-MANIFEST byte-for-byte. The only additional committed file is generated `openwiki/INDEX.md`. No product correction beyond the preserved implementation was needed. Source bytes remained unchanged across final validators and commit; the committed worktree is clean and remains present for independent verification.

Durable evidence lives only here, outside the sparse producer tree. The old dirty producer and parent product source were not modified. No reset, stash, old-tree checkout/population, dependency installation, shared-cache cleanup, server listener, UI/browser/image exercise, remote write, merge, push or PR was performed.

## Setup and identity

`setup-preflight.*`, `create-tree.*`, `initial-sparse.*`, `initial-populate.*`, `adopt.*`, `assert-inputs.*`, `setup-frozen.*`, and `SETUP-FROZEN.json` record setup. Initial disk availability was approximately 1.7 GB; the checkout's required tracked inputs were approximately 293 MB. Private validator tmp/cache/dist directories used available `/dev/shm`, not additional disk-backed build copies.

Exactly one new tree was created from the requested base, populated with full src/test/scripts/openwiki/public/vendor plus community-site/scripts and ancestor root files. `assert-inputs.stdout` contains every declared player input and its source hash, including community-site/package.json, sync-player.mjs and scripts/lib. Canonical `npm run wt -- adopt --path /home/main/z-project/rpg-zzu-life-full-spatial-rights-r3` succeeded without launching a server. Sparse setup was frozen before characterization; there were no later sparse-pattern or read-tree operations.

`red.patch` and `final.patch` were applied through the specified native Codex apply-patch executable, with exact pre-edit base checks. `red-restored.json` and `final-restored.json` record manifest comparisons. `final-source.json` records all populated tracked source bytes and the new test. `PRECOMMIT-CERTIFICATION.json` verifies the base-product equality during RED, nine preserved owners, permitted write scope, final-byte equality across validators, public results, import identities and cleanup.

The wiki index was generated and checked before source freeze. Its generator reports filesystem-sensitive dead references: this sparse checkout's generated index also lists absent docs/reports/community files. That generated churn is included without hand-editing the index or changing the generator. The successful index check applies to the frozen R3 checkout, not a claimed full-checkout index equivalence.

## Fresh execution results

| Receipt prefix | Direct exit | Actual result |
| --- | ---: | --- |
| characterization | 0 | Unchanged base: 75 passed, 2 files |
| red | 1 | Preserved final new test only: 17 failed / 5 passed / 22 total |
| diagnostics-probe-final | 0 | Configured diagnostics: four production files, four tests and final external probe all clean |
| tests | 0 | Exact recovered 18-file command, executed once on final product/test bytes: 355 passed |
| public-rights-final | 0 | Public place/collect/Save5 APIs and MemoryStorage: 24 captured cases |
| typecheck | 0 | npm run typecheck:app |
| build | 0 | One full npm run build: app, player, SDK manifest and standalone bundle completed |
| wiki-generate / wiki-check | 0 / 0 | Canonical generation and --check |
| diff-check | 0 | git diff --check |
| wrapper-adversarial | 0 | Exact-ready-signal interruption, explicit exit7 failure, cleanup and lock-release assertions |
| certification / stage / commit / committed-identity | 0 each | Evidence/source certification, exact owner staging, authorized commit, clean committed identity |

`red.stderr` contains both independent behavioral defects in full: unpaid gold evidence expected one retained record but got zero, and paid decoration recoveryItem expected item_potion/count1 but got undefined. This 22-case revision intentionally differs from the historical original 19-case RED. Historical 75/355 excerpts are not used as passes.

The final test argv is retained in `tests.command.json` and `final-commands.json`; it has one `--configLoader runner`, `--cache=false`, maxWorkers2/minWorkers1, and the exact recovered eighteen files. No suite was skipped, deleted, weakened or rerun to turn a failure green. Original validator deadlines were retained. Heavy commands use the requested flock with timeout900 and bounded command timeouts, with no nested locks. No broad 13k gate ran.

Eight LSP tool calls additionally returned no diagnostics before build. The durable configured diagnostic JSON is the independently consumable diagnostic receipt, rather than an invented raw LSP transcript.

## Preserved new-attempt failures and fixes

1. `diagnostics.*` exited1: the absolute-root probe adaptation left unused `fileURLToPath`. Removed only that unused import; original bytes are `public-rights.pre-diagnostics-fix.mts.gz`. Product/test diagnostics were already clean. `diagnostics-final.*` passed afterward.
2. `public-rights.*` exited1 before executing the probe because the default vitest Vite filesystem root did not allow the external durable evidence module. `probe.config.mjs` explicitly permits the R3 root, this evidence directory and resolved dependencies, and preserves the absolute R3 alias. It uses middleware mode and never listens. No sparse setup or product config was changed.
3. `public-rights-external-config.*` reached the public APIs but failed in a newly added probe equality assertion: runtime inventory/itemUseCharges have null prototypes, whereas structuredClone snapshots have ordinary prototypes. The assertion now compares structured clones on both sides, matching the recovered probe's other whole-state comparisons; it still compares every state value. The pre-fix probe and complete failed state/import captures are retained as `public-rights.pre-clone-fix.mts.gz` and `public-rights-external-config.{public-state,import-resolution}.json`. Final diagnostics and `public-rights-final.*` passed after this evidence-only correction.

No product/test source changed during those fixes, and the successful 18-file suite was not repeated. Final executed probe/config hashes are in `final-executed-artifacts.json` and the final evidence manifest.

The expected MemoryStorage quota refusal logs an error to probe stderr while the probe asserts failure and previous-slot preservation; it is not swallowed. Build stderr retains missing optional AI-key notices, circular chunk/import warnings, oversized chunks and unresolved runtime asset URL warnings. Those out-of-scope warnings were not suppressed or fixed; no clean-warning build is claimed. Typecheck stderr contains npm update notices, not TypeScript errors.

## Public surface and conservation review

`public-rights.mts` uses actual project public placement, recovery collection and Save writer/parser/apply APIs, with real MemoryStorage storage behavior. No transaction mocks or fabricated successful state are used. Every project import resolves absolutely into R3; `adaptation.json` lists import declarations and `import-resolution.json` records real paths and hashes. Node/package dependencies resolve through the canonically adopted dependency link, not another worktree's product source.

`public-state.json` contains whole session before/after values, snapshots, parsed slots, raw JSON slots and resumed states. Final inventory is10, gold90, with exactly one empty-item unresolved building record retaining the original gold10+item1 receipt after explicit item returns. Repeated collection refuses missing IDs without changing state. Repeated save/read/apply does not repay items or gold.

Captured public cases include persistent incompatibility, partial collection/save, inventory refusal, repeated collection, repeated save, quota failure preserving the previous slot, repeated malformed proof writer/parser/apply refusals preserving raw slots and memory, capacity and sequence refusal, ordinary frozen-item reclaim after changed/deleted definitions, changed/deleted-definition incompatible recovery, and unknown/restored items through save with no automatic payout and explicit collection afterward.

The three existing-test edits were necessary claim-layout corrections, not weakened conservation:
- lifePlacementSafety now requires exactly two claims, the same total payable items and full original gold10 receipt in the unpaid claim.
- linkedAnimalHousing requires exactly two matching-source claims and retains both the gold30/items5 original receipt assertion and the total items5 payout assertion.
- spatialPaymentReceipts retains all sixteen accepted 64-item histories and total 16*ITEM_QUANTITY_MAX returned, keeps gold0, requires exactly one original unpaid receipt, and checks the monotonic nextSequence18 and repeated save.

The new tests additionally prove one unpaid owner across split claims, conservative per-record old mixed preservation without speculative deduplication, claimed-ID removal and monotonic sequence, atomic refusal, required placementItemId/one-item cost, missing-proof legacy/starting originals without inferred historical costs, unknown items, malformed proof, ordinary reclaim, and claim-free nonrefund demolition. Retained tests cover H1/H2, housing links/limits, Project4 and Save4-to5, and live-reader/no-context-storage contracts.

## Adversarial classes and limits

- Resource/sequence/inventory bounds, malformed proof, unknown/deleted/changed definitions, legacy records, repeated collection/save, split rights and prior-slot preservation: exercised by the 18-file suite and/or public captures as described above.
- Wrapper failure/interruption: owned FIFO subscriber existed before triggering the blocking stub; exact `R3_OWNED_STUB_READY` was received before SIGTERM. Inner direct exit is -15; Python wrapper process exit is241. Explicit failure stub direct exit7 preserved stdout and stderr. Both scratch directories were removed, source hashes were unchanged, evidence survived, and lock reacquisition succeeded. No sleep, polling, retry-to-green or real suite interruption was used.
- Source interference: exact before/after source hashes checked throughout and at precommit. Intentional concurrent source mutation is N/A because this is an isolated single-owner frozen checkout; no foreign worktree was mutated as a test.
- Remote/network persistence, browser/UI/editor/scene/renderer/image behavior: N/A to this authorized nonvisual scope; unexecuted, not approved. Public storage is MemoryStorage, not a claimed browser disk run.
- Process-kill guarantees beyond the exercised SIGTERM cleanup (e.g. uncatchable SIGKILL), machine power loss, real storage exhaustion: not claimed; N/A to the bounded owned wrapper-interruption requirement. Disk was checked and no ENOSPC occurred in these validators.

## Cleanup and independent handoff

Each captured command has `.command.json`, full `.stdout`/`.stderr`, a direct `.exit`, before/after input hashes and `.cleanup.json`. `receipt.py` owns private per-command TMPDIR/cache directories; build additionally owned a dist symlink into private shared memory. All recorded owned scratch paths are absent and the owned dist symlink is removed. The exact-ready FIFO was removed. Evidence, scripts, failed receipts and public snapshots remain durable here. No shared cache or dependency directory was removed. Canonical dependency adoption and the committed R3 checkout remain available.

`committed-identity.stdout` records the actual commit SHA, ten-file commit and empty porcelain status. The independent parent verifier must inspect this frozen commit and new evidence. Task12 as a whole, independent approval, Grok/lifeFieldInteraction45, native/visual verification, Phase4 and overall goal approval remain pending.
