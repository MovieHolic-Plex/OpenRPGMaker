# Task12 UI + Task52 combined CLI delivery - build-r3

## Outcome: NEEDS-FIX, no commit

Astra child `st_01a07b66` (`PI_MODEL=gpt-6-astra`), 2026-09-07, inspected the serial frozen unit in `/home/main/z-project/rpg-zzu-life-full-p4`. The combined full build and safe CLI/documentation gates completed, but required native coverage is incomplete. No source/test/UI/scene/core fix, staging, commit, remote operation, browser run, or image interpretation was performed. `COMMITTED.json` intentionally does not exist.

HEAD remains **ea6b2b358088cb6061783f6ffd162169764a07e9** (control metadata, not a commit of this increment). The index is unchanged. All 14 declared code/test files remain exactly equal to producer-r3/Task52 handoffs; the intentional 17-path dirty scope is 12 UI/test + 2 accepted Task52 + 3 wiki/index paths. No unknown changes were found. Only factual wiki edits and canonical INDEX generation were added here. See `scope.json`, `initial-identity.json`, `certified-identity.json` and `docs.diff`.

## Concrete release blockers

1. **Native decoration move and rotation success are missing.** Final native steps `move-rug` and `rotate-rug` both report `blocked`. Rug placement succeeds, but unchanged existence is not proof of movement or rotation. Required evidence is successful movement to different coordinates and a resulting orientation/owner change through the native surface.
2. **Native last-local-exit refusal is missing.** The player walks from `(1,2)` to `(2,2)` after setup. The subsequent action places shed3 at `(4,0)`, spends gold460 ->450, and records `lastExitBlocked:false`. The script only logs that boolean and still exits0. A valid last-exit fixture/action must refuse with costs and owners unchanged; this is not evidence of a product defect in the tested geometry.

Producer-r3 HANDOFF honestly declares these limits. Its native exit0 is not a complete prerequisite pass, and neither producer-r2's partial native run nor its 88 tests substitutes for them. No whole Task12, native/visual, Phase4, or overall-goal approval is given.

## New direct CLI execution

All commands ran from the worktree above. `serial-lock.command.json` records `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock` around the complete serial runner. Each validator has full separate `*.stdout`/`*.stderr`, actual `*.exit`, argv/cwd/environment/timestamps/stream hashes in `*.command.json`, and before/after source, index, HEAD, wiki and producer inventories. Ordinary bounds were900 seconds; full build1200, with TERM and kill-after30s. No timeout was treated as success.

| Receipt | Actual command | Direct result |
| --- | --- | --- |
| diagnostics | `node .omo/evidence/life-full-20260906/12/ui/build-r3/diagnostics.mjs` | 0; configured tsconfig.json syntactic + semantic diagnostics empty for all14 declared code/test files, including Task52 and new rendered-body replay test |
| typecheck-app | `npm run typecheck:app` | 0 |
| build | **`npm run build`** | **0; fresh combined app, export-player, SDK and standalone build** |
| openwiki-index | `npm run openwiki:index` | 0 |
| openwiki-index-check | `npm run openwiki:index -- --check` | 0 |
| openwiki-verify | `npm run openwiki:verify` | 0, `ok:true` |
| whitespace | `git diff --check` | 0 |
| whitespace-new-0..3 | `git diff --no-index --check /dev/null <new-file>` | 1 each, empty stdout/stderr; difference-only status, no whitespace diagnostics |
| certification-final | bounded/shared-locked `python3 .../build-r3/certify.py` | 0; frozen source/index/producer and cleanup assertions |

The fresh full build fulfills Task52's deferred combined **build** gate on these exact working bytes; it does not finish Task52/12 delivery or waive native prerequisites. SDK output reports artifact `71c97532b02b23a0`, source `1fc916aeb300aa37`, schema4. `build-output-manifest.json` preserves SHA-256/size of generated files before owned dist cleanup. Full build stderr retains missing optional AI-key notices, circular/dynamic import warnings, chunk-size warnings and runtime-resolved asset notices. This is not a warning-free build claim.

### Honest evidence-runner failures

`serial-lock.exit` is1 because the wrapper conservatively classified every nonzero as failure, including Git's four difference-only new-file statuses. Original receipts were not edited. A private two-input calibration produced clean exit1 with empty streams and trailing-whitespace exit3 with actual diagnostics (difference bit1 plus whitespace bit2). The initial certificate incorrectly expected2, so `certification.exit` is1 with the retained AssertionError and `certify-initial.py`. Only evidence classification was corrected; final certification reads the original calibration, asserts1/3 and the original four empty streams. No product validator or test suite was retried. `whitespace-assessment.json` records this distinction rather than falsely changing exits to0.

## Producer/native/remote evidence inspected, not rerun

Read producer-r3 HANDOFF, SOURCE-HANDOFF, script, final UI streams, remote save script/command/streams, native command/script/state/log and raw owners, plus Task52 PARENT-WORKING-VERIFIED, producer SOURCE-HANDOFF, independent VERIFY, and exact `47-48/VERIFY.md` with its independent receipts. `borrowed-receipts.json` fingerprints original commands/streams/exits; `native-audit.json` retains extracted actual state and equality checks. Original producer119 files are unchanged before/after this node. All seven PNGs were mechanically SHA-256 compared (`png-comparison.json`), not opened or visually assessed. This comparison establishes preservation, not a fabricated producer execution-time screenshot manifest.

- Final UI suite: **91/7, exit0**, including45 lifeFieldInteraction and3 new rendered-body replay cases; no Grok UI suite rerun. The new test hash is `f7ffd8d8a89a2fb10ef67ee13a459a8bda592e63e7035a50b63a75d27b06cc97` and matches both handoff manifests/current file.
- Isolated remote project `rpg-zzu-life-full-p4-t12-ui-01a07b22`: saved/reloaded3x3/passRows1. Remote saved hash `350f3b2d133b555976eadf60dbbfdce9121e4b4146922f13fca6abd4fc99df27`; local serialized-reload fixture hash `e48e935a33b8f6ed42e987ea7231ca508d1ae05abfc4862e11364e0357c54ff2`. These are different identified artifacts, not a claim of byte equality. No remote call occurred here.
- New Game starts at foot `(8,8)` with empty farmPlots. Spaces targets `(7,9)`, not the1x1 `(8,9)` target. Place spends500 ->490; overlap refuses without another owner; upgrade reaches level2 at stored `(7,9)` with gold470; meaningful native move changes to `(11,6)` while retaining level2/payment proof.
- Actual hoe action (`item_hoe`, `tilled` receipt) creates plot7,9. Placement there and at the map edge refuse without cost/building changes. There is no authored ProjectSession farmPlots extension.
- Moving NPC origin `(16,5)` versus logical destination `(16,6)` is recorded with3x3/pass1. At player `(16,2)`, the target's row3 overlaps origin full body but not destination top4; placement refuses with gold450 unchanged. `fractional:false` is the actual sprite receipt: this is origin/destination moving-body evidence, not a claim of observed fractional sprite pixels.
- Raw key `task12-ui-native-r3:save-slot:v5:1` contains three sheds, rug at `(3,1)` orientation down with frozen item proof, and tilled plot7,9. Parsed owners equal raw owners. Load-menu slot1 is activated; loaded building owners equal raw exactly and rug testids remain. Load message is empty. There is no intervening mutation proving restoration from divergent state and no browser-page reload claim; the remote Project reload and native menu Load are distinct receipts.
- Native final aliases equal attempt18 log/stderr/exit; final evidence equals native-evidence. Native stderr/page errors are empty, with one recorded audio `net::ERR_ABORTED` request. Navigation subscribes before selection/mode/coordinate actions. Script contains hoe-timeout and movement fallback catches, but final steps show prompt digit1 hoe selection and no movement-fallback error entries: an actual swallowed timeout was not established in this final run. Those catch paths are not endorsed as reliable future acceptance logic. The unasserted false last-exit result is a demonstrated incomplete gate.

## Accepted core and Task52 identities

`task52-source-comparison.json` finds no difference for any comparable inventoried source/test/config input against independent135-test execution; accepted Task52 source/test hashes remain:

- `src/project/databaseRecordModel.ts`: `c27eb4c534e39a6b0c68c2d3650aadb905c8f42e0d053d10f79c8092aa6cbdfd`
- `test/playerBodyProjectPersistence.test.ts`: `0dd6e5c03614aa124a4d953c8f80e6189fbdaebe0c31bf0b3335619861372ef1`

Thus its existing135/9 exit0 evidence is retained for identical accepted inputs, not claimed as a new run. The new replay test is separately identified in the UI handoff. The exact47-48 core355/18 receipt remains historical evidence of its reviewed source; all comparable nondeclared inputs and18 test files remain equal. `core355-source-comparison.json` explicitly lists the10 declared later differences (UI/test plus accepted Task52 normalizer), with **zero unexpected differences**. A complete old-source355 pass is not relabeled as a fresh combined run or as full-source equality after the Task52 normalizer change. No new undeclared core change was absorbed or fixed.

Wiki now documents independent optional authored body/passage retention through public IO, absent-key preservation, malformed-wire rejection, full body versus passage, unchanged Project4/Save4-5 contracts, existing empty new-game plots, live target/body gating, actual native observations and missing coverage. No prose-pinning test was added. Canonical INDEX changes only document sizes/section coordinates and aggregate counts.

## Cleanup and frozen handoff

`writer-check.json` found only this node's inspection processes in the scoped worktree; no active producer/source writer was observed. Shared lock was bounded, serial, released and not deleted. Private `/dev/shm/st_01a07b66` caches/dist and `/dev/shm/st_01a07b66-certify` calibration scratch are absent. Only this node's owned dist symlink was removed; dist was absent before setup and is absent afterward. Producer tmpfs `/dev/shm/st_01a07b22` is also absent. Dependencies, browser caches, shared caches, original evidence and source bytes were preserved. Cleanup receipts are `cleanup.json`, `certification-cleanup.json`, and `certification-final-cleanup.json`.

The unit stays intentionally uncommitted and frozen for the parent/independent Grok. `NEEDS-FIX.json` is the delivery status. No COMMITTED record or clean-source-status claim is made.
