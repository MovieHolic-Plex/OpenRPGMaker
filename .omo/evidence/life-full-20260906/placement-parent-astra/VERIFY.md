# Astra parent combined-tree validation

## Verdict

The integrated NONVISUAL placement checks pass, but **unqualified recovery/conservation approval is blocked by proved-rights gaps** reproduced below. This is the first combined-input validation, not a producer retry. No approval of scene reader/ledger wiring/native walking, whole task12, Phase4, or the overall goal.

Source: `/home/main/z-project/rpg-zzu-life-full-p4`, HEAD `b5c679efc6c5e575f7a1afb65dfa86939aade325`; exact tree/parents in identity-before.txt. PI_MODEL=gpt-6-astra. All five core source/test files match `462a7f3425079abc94fefafe2142dfcd5b42b034` both by git object bytes and producer SHA256. Product/test/config source was not edited. Tracked populated file hashes (excluding explicitly ignored CLAUDE.md) were checked before/after each validator; HEAD remained frozen. Full manifests and final verification are retained.

Read canonical EXECUTED_PLAN.md occupancy/recovery contracts and task12, 12/core/SUMMARY.md, source.sha256, actual compressed red, red-behavior, final-green and cache-isolated-green output, plus independent st_01a0792c-new-core/VERIFY.md and its probe sources. Historical RED has unavailable exports and fixture errors distinct from four behavioral failures; historical 269 is not claimed as this run's count.

## Execution and scope exception

Exact executable commands: run-checks.sh and commands.txt. Direct stdout, stderr, and exit are separate for every validator. All heavy runs use shared `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`, bounded command timeout/15s kill grace, private tmpfs TMPDIR, and at most two test workers. No nested lock, dependency install, remote access, shared-cache cleanup, broad gate, test edits/skips, or repeat-to-green suite run.

The producer's exact 15-file arguments were inspected. `test/lifeFieldInteraction.test.ts` explicitly executes `handleAction`, `renderEventLayer`, `renderPlaceableOverlays`, scene test routing and generated-forage sprite rendering (including lines205-241). Per the user-provided UI-specific exception, this entire mixed scene/renderer file is **deferred to Grok**, not run or claimed covered. The other fourteen exact targets were run once unchanged. Happy-dom in housing/receipt/recovery tests is a local Storage adapter, not visual work.

| Check | Direct result |
|---|---|
| Focused permitted selection | exit0, **224/224 tests, 14/14 files**, no skipped/pending |
| TS configured compiler syntactic/semantic diagnostics on four core modules and new test | exit0, zero diagnostics, before app typecheck/build |
| Public transaction/restore/farming/Save probe | exit0 |
| Independent public-seams probe | exit0 |
| npm run typecheck:app | exit0 |
| npm run build (app, exported player/SDK, standalone bundle) | exit0 |
| Independent recovery-rights criterion | **exit1, genuine conservation failure**, not setup failure |

Build stderr retains 106 lines: missing optional proxy credentials, circular record-picker chunk warning, static/dynamic import chunk warnings, unresolved runtime asset URLs, and large chunks. Build success is not renderer/native runtime verification; warnings were not suppressed or attributed as new regressions.

## Covered behavior

The unchanged 11-case lifePlacementSafety suite exercises all nine full3x3/passRows1 body cells, four outside-body targets, freshly moved NPC between preview/apply, complete moved/rotated/upgraded footprints, map boundary/actor overhang, last-local-exit refusal with whole-session/cost equality, actual plots versus own water/harvest, static restore retaining rug/building under actor overlap, Save roundtrip, no extra player/npcs/reader fields, forage plot reservation, and persistent plot incompatibility with exactly-once item recovery.

public-state-save.json captures whole refusal before/after sessions, actual Save5 snapshot, parsed slot, raw key/string, restored session, and farming state. Public probe performs accepted preview then moved-NPC apply refusal, accepted building/rug, static restore, till/plant/water/day/water/day/harvest, and invalid direct apply with previous raw slot unchanged. This is a real library/MemoryStorage surface, not browser quota testing.

independent-seams-state.json captures last-exit refusal unchanged, moving the left wall to the final old right exit while opening the alternative with no gold spend, and an explicit persisted-overlap boundary fixture showing the self-plot farming exemption does not exempt a building.

Task11 checks remain unchanged in the run: linkedAnimalHousing20 and spatialPaymentReceipts21, plus lifeRecoveryPersistence40, including H1 historical aggregation, H2 65-item splitting, cumulative bounds, claim-capacity/previous-save preservation, and voluntary demolition at4096 claims. No claim that all recovery rights are safe follows from those green assertions.

## Concrete recovery blockers (no fixes)

New independent `recovery-rights.mts` uses actual placeFarmBuilding/placeHomeDecoration, createSaveSnapshot/applySaveSnapshot and collectLifeRecoveryClaim. It pays gold10+item1 for a building and item1 for a rug; adds genuine persistent plots at their cells; creates/restores Save5; collects available recovery; saves/restores again. Whole state is in recovery-rights-state.json.

1. **Unpaid proved gold evidence is destroyed on collection.** Incompatible building becomes an item1 claim with the full receipt retained as unresolved evidence. Collecting that claim succeeds, credits the item only, and deletes the whole claim including the gold10 receipt. Gold remains90 (initial100), no building owner and no remaining building recovery record after Save5 roundtrip. Exact criterion failure, exit1:
   `PROVED-RIGHTS GAP: collecting building items deletes its unresolved receipt including unpaid gold10`
   Source: lifeRecovery.ts135-139 selects only receipt.items; 152-154 retains original receipt; collectLifeRecoveryClaim deletes the entire claim after item credit. Required correction criterion: collection must not erase still-unpaid proved rights; preserve them or fulfill them under the approved policy. No invented gold payout is proposed as validation.
2. **New paid decoration has no frozen recovery item evidence and no payable recovery.** placeHomeDecoration consumes placementItemId but stores only placementFields (spatialPlacementTransactions.ts128). Reconciliation forces decorations unresolved-only; its claim items are[], explicit collection returns `{ok:false,reason:'unresolved'}`. Original placement survives unresolved, but the actual paid item ID/count was not recorded. This is unresolved preservation, not refund/conservation completion, especially if the type changes/disappears. The accepted plan explicitly requires new decoration recovery-item proof. Retain frozen proof and preserve/pay rightful recovery rather than equating deletion with conservation.

These are observed on frozen combined input. The implicated recovery behavior also exists outside the new occupancy changes; no unsupported claim of core-introduced regression is made.

## Setup/fixture failures and wrapper provenance

Copied independent public-probe.mts and independent-seams.mts only after checking imports. Changed five parent segments to four to resolve into THIS tree; fixtures/assertions unchanged. diagnostics.mjs copied unchanged. import-resolution.json records local resolved paths/hashes; all loaded production dependencies are covered by the tracked source manifest. No producer-checkout source imports.

The additional recovery probe's first run failed before its target criterion because Node structuredClone strips null dictionary prototypes: original session inventory/itemUseCharges were compared directly to a clone. Preserved exact wrapper/log/status as recovery-rights-clone-error.*. Corrected only the evidence comparison to structuredClone(session) versus the before clone; no field/assertion removed. The corrected run reaches and fails the genuine unpaid-rights criterion above. Neither focused tests nor build were rerun. This fixture error is not product RED.

## Cleanup and limits

Owned tmpfs dist symlink/cache/TMPDIR removed by trap; cleanup.json and cleanup-size.txt record it. Additional rights-probe scratch removed (recovery-rights-cleanup.txt). No server, browser, image capture, commit, merge, push, product edit, or original-evidence overwrite. Evidence stays in this directory only. Final identity/hash checks and cleanup are captured; source movement would have stopped execution rather than relabeling results.

Grok still owns lifeFieldInteraction scene/renderer selection and all actual scene live-reader/event position/body resolution, ledger callers/targets, native walking and visual acceptance. Whole13k gates and prior global failures were not rerun or waived.
