# U05 verified handoff

## Outcome and provenance

- Status: all five findings verified; two atomic commits, no WIP.
- Main commit: **8f9f6c222f7ecdbfcf1a3366d33be54ece867670**, tree **69bfea47852485ea0dbb55017894587a3088769b**.
- Inline-variable follow-up: **b5521e4d73ce17b8adc971c90096217419c2c403**, tree **2719dbe69d5eb91ad25c94a1eb420755eb25befb**.
- Integration order: cherry-pick these two commits in that order, U05 before U06.
- Task st_01a076b2; parent/root session 01a07596-cae4-78dd-be1b-f0bfcd260950; depth1.
- Original terminal RED worker: st_01a0764a. Original RED base c66f5a8ac2f61005833783807c40477d045b2b35.
- GREEN base: 9c14cfdefbcfc9a71c5ba1149f35600f413777fc. Prerequisites: H0 5022679ea; U03 c68012824; U02 9c14cfdef.
- Worktree: /home/main/.herdr/worktrees/rpg-zzu/worktree-brave-valley-f078-event-remediation-0906-event-remediation-u05.
- Initial prep-manifest.md, red.json and red.log remain unchanged. Original source copies: original.test.ts and original.fixture.ts.
- Original test SHA-256: 501e9eda684f6f8b5396f567611be2837cde202d6707b98e64a2dfa434604614.
- Original fixture SHA-256: c5fe0bc0cc9f10d9f0332695e1511550096f24b39b142077e803722d960dae41.
- All original 56 cases (47 RED +9 controls), input values, expectations and helper bodies are retained. Unit-only helpers moved into the test file; pure constructors remain byte-identical. Three additional U05 cases cover mounted EXP drafts, an empty state catalog, and inline variable creation. One adjacent predicate case was added; no obsolete expectation was weakened.

## Per-finding manifest

| Finding | Captured RED | GREEN implementation and unit proof | Real editor/player surfaces |
| --- | --- | --- | --- |
| G2-F1 | 4 failing /1 control | 5 cases: 092 writes party or actual actor ID; reopens correctly; actor selection synchronizes mode; slots retained. Runtime narrowly adapts old target=actor+actorId and rejects incomplete old individuals without actor pseudo-key. | Map/common/troop Confirm and applicable outer Apply/Save; wire import/reopen. player-battle-canonical, -legacy, -party, -incomplete use real keyboard input and the next actor's actual command menu. Targeted hero gains Item; untargeted Other retains Defend without Item; explicit party affects both; incomplete affects neither. |
| G2-F4 | 2 failing /1 control; additional mounted-draft RED; additional inline-creation RED | Original3 + mounted1 + inline1 cases. EXP VariableOperand retained across actor/op/Confirm/reload; explicit source and party controls; number31/variable switching retains same nodes and inactive draft. Same-kind EXP host remount disabled only for this command. After real picker creation, current store records drive validation, preview and selected-option label. | Full map/common/troop source-switch, actor/op, invalid-clear, explicit party, Save/import/reopen; focused numeric input preserved. Dedicated player EXP Other40->15 with reward25; reward99 clamps Other to0, Hero stays80; legacy empty-party numeric EXP changes both. Follow-up real picker search/add/select/Confirm creates var_0021, preserves Other/-=/numeric31, displays its current name, and passes map Apply without remount. |
| G2-F6 | 3 failing | 3 cases: explicit number overrides preserved inactive variable ID for014/021; numeric switch, preset, Confirm/reopen and operation edit remain numeric. | All three editor contexts save/reopen number10 with reward retained inactive. Player reward99 distinguishes numeric10: hero attack7->-3; Other13 unchanged; hero HP60->70; Other45 unchanged. Edge numeric0 leaves7; damage25 gives35. |
| G2-F7 | 6 failing /1 control | Original7 + empty-catalog1 cases. Missing/empty IDs remain representable and never select first chip; Confirm rejects unresolved selection; set/toggle retained. Empty catalog produces no chip and cannot Confirm. | All three editor contexts retain toggle and explicit sleep. Two dedicated browser cases cover empty/missing_state, rejected Confirm, operation-only edits and explicit sleep/set with map Apply. Player toggle yields hero [poison,sleep], Other [sleep]; set yields hero [sleep], Other unchanged. |
| G2-F8 | 32 failing /6 controls | 38 cases: five identity forms, learnSkill and EXP separate explicit party from incomplete individual; incomplete edits stay local instead of persisting party; missing actor references rejected while intentional legacy empty-party data remains supported. | Real map/common/troop command Confirm for all seven forms, explicit party then valid individual, outer saves and actual wire import. Map inline name picker clearing + unrelated edit + Apply leaves the saved hero command unchanged. Player identity values and native EXP isolate targets; explicit and legacy party controls remain supported. |

## Verification commands and results

Main accepted narrow/adjacent command (unit-release.log):

```
npm test -- test/eventCommandRemediation/U05.test.ts test/actorM2CommandBodies.test.ts test/eventEditorStagedState.test.ts test/learnSkillCommandBody.test.ts test/changeExpCommandBody.test.ts test/commandEditModalPreview.test.ts --maxWorkers=2
```

- Exit0, **121/121**, six files, before the newly requested inline-creation increment.
- Follow-up RED: filtered `EXP inline variable creation`, one failing test/four assertions. Other58 were deselected by the CLI filter, not .skip or deletion. Real picker/recordKinds/addVariable/store.update executed; selected ID existed in the new store and not in the captured project. The old reference was not safe: preview/label stale, aria-invalid=true, Confirm rejected. inline-variable-red.log.
- Follow-up GREEN: `npm test -- test/eventCommandRemediation/U05.test.ts test/changeExpCommandBody.test.ts test/commandEditModalPreview.test.ts --maxWorkers=2`: **97/97**, including all59 current U05 cases. inline-variable-green.log.
- Final changed-file compiler checks: **11 TS files, zero syntactic/semantic diagnostics**, no emit; diagnostics-release.log and inline-variable-diagnostics.log. All12 changed files received LSP checks; touched follow-up files checked again. Scenario `node --check` and git diff --check passed.
- Main editor acceptance: **all five cases in one run, retries0**, editor-release.log / editor-release-report.json. Firefox; separate fresh contexts; actual toolbar, visible segment/custom-select controls, selected row Space, map Confirm->Apply, DB dirty Save-and-Close, filechooser import.
- Main player acceptance: **all seven cases in one run**, player-release.log / player-observation.json. Firefox, dedicated player.html, fresh contexts, real Enter/Z/ArrowDown/Enter inputs; no editor surface; canvas present. Wrong-target negative observation rejected Hero EXP15 (actual80) and released its observer.
- Follow-up editor acceptance: **one focused case passed**, inline-variable-browser-release.log / report and inline-variable-editor-observation.json. This ran after b552's production change; no unaffected acceptance batch was repeated.
- Dedicated player runtime and prior acceptance inputs are unchanged by b552; their main-commit proofs remain applicable. Do not misreport a six-case full editor run or a122-case single unit run: the follow-up was intentionally scoped.

## Exact inputs and fixture equivalence

- Mandated H0 positional CLI now succeeds: scripts/prepare-event-command-remediation.mts U05 <temporary-directory>. Pure buildFixture has no Vitest/DOM top-level dependencies; no import stubs.
- fixture-red.log retains the original `Vitest failed to access its internal state` error.
- fixture-equivalence.json proves original pure-unit output equality, unchanged original test/helper bodies, deterministic buildFixture and CLI serializer/reload equality.
- During final checking, an actually consumed stale generated fixture was found: commonEvents[0].trigger was call rather than the current typed builder's none. Preserved as qa-input-legacy-call.json; the failure is final-equivalence.log.
- This was NOT an unused artifact: qa-runner sets U05_FIXTURE to fixtures/project.json; spec reads that file instead of calling buildFixture. The player's accepted source hash exactly matched the preserved old editor export. acceptance-input-provenance.json and acceptance-normalized-hashes.json trace both paths.
- Regenerated CLI normalized SHA-256: cefa204de1e3bed4542a6e12a414c435b8848196ef6d8d0418349bf6731c0512.
- Current accepted editor-map export/player-source SHA-256: 170a17d661f8f51bb8f69269db0a34cf1284d19bb1b1d303e86eccb8fdd559dd.
- All five editor and seven player proofs were rerun against those current inputs; final-equivalence-corrected.log and release-input-receipt.json pass. No third editor repetition after the hash check.
- Immutable accepted inputs/exports/player fixtures copied to accepted-fixtures/. The inline follow-up uses the same CLI fixture with blank variable names filled in its own local seed to exercise genuine append rather than blank-slot reuse; this alteration and the new var_0021 are declared in its scenario/observation.

## Failure accounting and QA corrections

- Original47 behavioral RED remains untouched; fixture/driver/host follow-through RED is separate.
- My scoped compiler initially caught missing ReferenceSets.states and later the new fixture's invalid call type; both were fixed, and failures retained.
- Hidden native segment selects and collapsed DB groups were driver errors, not production regressions. Fixed with visible buttons/popovers and actual group expansion. driver-hidden-select-red.json / driver-collapsed-group-red.json.
- Old troop details summary assumption and DB Close-as-Save assumption corrected from actual DOM/source. driver-troop-div-red.json / driver-dirty-close-red.json. No app CSS workaround.
- Prior exit null was explicitly my SIGTERM interruption, NOT an inferred deadline. Final runner waits for complete child output, records code/signal, copies artifacts before cleanup; no outer child deadline.
- Cold module-start timeouts are retained, including the inline browser RED preflight that never reached its test. Dependency preflight and one module-load subscription run before fresh test contexts; no fixed sleep or retry loop. Vite optimize's deprecation notice is retained, not suppressed.
- Player scenario initially measured HP after class change; actual class max40 legitimately clamped HP. Added an authored text barrier before the unchanged class command so damage70 and subsequent class clamp40 are both proved. No command payload/order changed.
- Chromium ERR_NETWORK_CHANGED caused failed module loads in a later context; retained separately. Final player uses Firefox, with errors still asserted empty.
- Battle HUD is keyboard-only; removed the driver pointer-click assumption and used observed command-ready/cursor state plus real ArrowDown/Enter. player-battle-pointer-driver-red/ retained.
- Follow-up row observer initially matched only the row node while real clicks target its child label. Scoped its exact click subscription to the row and descendants; inline-variable-row-observer-driver-red.json retained. Product code was not broadened.

## Scope and integration boundary

- Main12-file commit stays in original owned paths plus explicitly authorized commandEditDialog.ts same-kind EXP branch, adjacent commandEditModalPreview test, and openDatabaseCommand test-helper correction.
- Follow-up3-file commit changes only changeExpBody and its unit/browser regressions. No shared picker, global remount or fallback changes.
- commandBodyAdvanced.ts remains only the bindCommandFormValidity import and learnSkillBody guard/binding. addFollowerBody/removeFollowerBody untouched; U06 boundary preserved.
- No shared wiki, Design, snapshots, DB content, installs, extra agents, full suite, build, gates, push, PR, merge or rebase. Wiki amendment is supplied separately, unapplied.
- No aesthetic screenshot judgment is claimed: machine-observed real UI/state and screenshots are evidence; this model could not inspect image attachments.

## Cleanup

- Final editor port36611, player35293, inline follow-up42329: owned server exit/cache-removal receipts exist. Fresh browser contexts closed, observations released, zero guarded DB writes and no page errors on accepted runs.
- accepted-fixtures/ and per-run reporter artifacts are retained before deleting the owned temporary root. See cleanup.json and commit-receipt.json for the final executed cleanup and clean git status.
