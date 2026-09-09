# U14 sound/BGM remediation

## Delivered scope

Working-tree repair against `a79a04bbd` for G1-F2, G1-F9, G1-F23 and G4-F3 only. No commit, push, or database content write was performed. Earlier lead work moved the new worktree to the integration base using reset and temporarily stashed/restored tracked source for the historical red run; the subsequent child repairs and actual-base gate comparison used neither operation. The final gate review includes a narrowly reviewed migration of only the five U14 M2 surface baseline/floor entries; no blanket regeneration or unrelated baseline change was made. New deliverable files have intent-to-add entries so ordinary `git diff` includes tests and focused evidence; no file content is staged. The supervisor ran `npm run gates`; its nonzero result and actual-base failure classification are recorded below.

| Finding | Implemented behavior | Evidence |
| --- | --- | --- |
| G1-F2 | Sound Layer selects music/sound; ambient uses looping BGS; ME/SE are one-shots. Per-track volume multiplies the existing user volume group and explicit zero fade survives interpreter/engine forwarding. Gain survives group changes, same-track requests and save/resume. Native battle callbacks retain channel/options. | `handoff-red-final.log`, `focused-first.log`, `surface/editor-receipt.json`, `surface/player-layers/manifest.json` |
| G1-F9 | Both memory commands have no dead authoring inputs. Replay emits an actual BGM request; absent memory remains a no-op. | `focused-first.log`; editor forms 1/2; player `memorized-restored` beat and native request count for the original track |
| G1-F23 | Actual alias insertion creates `stopAudio { channel: "bgm" }`, retained through .oprn export/import. Native blocking/parallel and saved-M2 fadeout paths preserve the other channels. Omitted channel still means stop all. | Editor reimport screenshot/receipt; unit engine spies; player `bgm-only-stop` native pause/playing records |
| G4-F3 | Picker `resourceId` is consumed, with legacy `value` fallback. Supported field/battle BGM and defeat/escape SE overrides belong to the session and are persisted by the additive save `systemAudio` record. Battle DOM/juice receives its owning session explicitly instead of global overrides. | Save-slot parsing and overlapping-session regressions; player map transfer, battle entry and normal defeat cue, using the editor-selected resources |

## Review follow-up: same-track and battle gain

The lead found two P2 regressions in the first delivered diff. Seven added cases failed before further production edits (`gain-review-red.log`: **7 failed / 13 passed, exit 1**).

- Same-track ordinary Play BGM and map entry now treat omitted requested volume as gain 1, matching session/save semantics. The existing audio element is not restarted; explicit gain behavior is unchanged. Unit and real-player cases verify layer 25% -> ordinary/map gain 1 -> actual save-slot write -> load/resume at the same 0.7 group output.
- `BattleAudioSession` now retains the complete `AudioTrackState` rather than only its resource ID. Exit restores loop and volume to both engine and session. Regressions cover 0.25 and 0 gains with same/different battle tracks, plus preservation of a legacy explicit loop flag. Strengthening the latter test exposed a loop-derived channel mismatch (`gain-channel-red.log`: 1 failed / 19 passed, exit 1); restore now explicitly selects BGM while retaining the saved loop flag.
- Only `src/player/audio/audioEngine.ts` and `src/player/battleAudio.ts` received follow-up production edits. Diagnostics, 241 tests and the full affected build passed before the final source-stable notification. The earlier gates run was explicitly invalidated before the final channel-pinning edit; no production edits or broad builds followed the final notification.
- Expanded native-player QA passes **8 scenarios / 50 beats**. The six new cases use real save/load menu keys and normal battle result/exit transitions. The observation shim delegates actual Storage writes unchanged before recording the saved audio shape. Battle input subscribes to the exact non-busy command state, and the existing seed capability fixes RNG; there is no sleep/retry-based completion.
- The first expanded QA attempt reached a command prompt while intro sequencing was still busy, so confirm only fast-forwarded the intro. `gain-review-player.log` retains that failure; `gain-review-player-final.log` records the corrected run; `gain-channel-player.log` repeats all eight cases successfully against the final channel-pinned source.

## Supervisor gate classification against the actual base

The supervisor's final gates exited **1**: app typecheck **0 / 0 errors**, CSS **0**, Vitest **167 failed / 14732 passed**, surface **1**, including CSS-live. This report is not dismissed using the stale `.omo/gates-baseline.json`.

`gate-review/classification.md` and `classification.json` account for **every one of the 167 failed assertions across all 91 failed suites**. The complete tracked `a79a04bbd` tree was archived into an isolated directory, retaining the same dependency installation and environment configuration. Each failed suite ran once on base and once on current with two workers: both runs exited 1 with **167 failures / 925 passes**. Equal totals conceal one obsolete U14 interpreter assertion and one extra base-only store-persistence failure; the comparison uses assertion identities and error details, not counts.

- **165 supervisor failures** reproduce with the same diagnostic on base/current, after normalizing only repository paths, timestamps, ANSI output and source stack coordinates.
- **Interpreter:** the old assertion expected `session.audio.ambient`. It now asserts real BGS state with gain 0.65, no ambient engine slot, and preservation of an existing BGM. Production behavior was already correct.
- **M2 surface:** only 027/028/063/064/210 baseline/floor entries were migrated to the intended forms. System audio gains explicit supported slots instead of dead volume controls; memory commands have no controls; Sound Layer has exactly audio resources rather than images. Five added hard behavior tests enforce exact resource membership, supported channel/slot values, absence of dead fields and continued snapshot-axis membership. Existing engine/player tests remain intact. `surface-migration.json` records each before/after entry; all unrelated entries are byte-preserved.
- **Final changed-contract run:** **94 passed / 1 failed, exit 1**. Interpreter and all U14 audio/surface contracts pass. The one remaining M2 failure is textually identical to actual base: `m2-019-change-state.classCount 29 < 30`, with the same seven existing changes in 019/022/023/024/025/069/091. No unrelated floor was lowered.
- **CSS-live:** base and final current both exit 1 with byte-identical output: the same 12 weighted-branch classes are missing from its stale canonical baseline. No CSS/CSS baseline edit was made. Other failing surface axes (condition, portal, form, interaction and commit probe) likewise reproduce on actual base with identical diagnostics.
- All 24 suites newly flagged against the stale stored baseline are classified individually in the report, including AI narration/observability/transport/queue, database previews/guards, forest/interior content, modal/local-DB/name-role guards, and tileset modal failures. None requires an unrelated U14 source fix.
- LSP reports no errors for the two changed TypeScript tests. JSON LSP is unavailable because Biome is not installed; both JSON files were parsed and the exact five-key change set was independently checked. No compiler/build/browser rerun was needed for these test-contract-only changes; the production hashes remain those already built and exercised in `gain-review.json`.

The deliverable is therefore a **fully reasoned actual-base failure comparison**, not a claim that all repository gates are green. Large single-line Vitest reports were parsed with Python; detailed assertion diagnostics and raw-report hashes are retained in `gate-review/`.

## Red provenance

The incoming implementation was already partially changed. The lead reports an earlier baseline run of the original 13 contracts: 10 failed / 3 passed, followed by 34 related passes. The incoming `red.log` retains only the G4-F3 tail. This is **not** a claim of fresh preimplementation TDD for the whole repair.

Before further behavior changes, `handoff-red-final.log` recorded **10 failed / 7 passed, exit 1**, across the new 13 handoff tests and 4 battle callback tests. Failures distinguish ignored gain/zero fade, saved-M2 fadeout, battle option forwarding, missing override save persistence and cross-session result ownership. Picker insertion and memorized engine replay already passed in the incoming diff. Earlier local harness attempts had an incomplete scene stub/invalid catalog ID; those were corrected before this retained red run.

## Exact verification

| Check | Result | Log |
| --- | --- | --- |
| Individual LSP diagnostics on all 37 changed/new code files | Tool reported no errors. The directory-wide request selected an unavailable Biome server; individual file requests succeeded. Compiler results below are independent verification. | `diagnostics.json` |
| Focused + adjacent Vitest after gain review (all files from both commands below in one invocation) | **241 passed / 17 files, exit 0** | `gain-channel-green.log` |
| Initial focused / adjacent runs, retained historical evidence | **82 / 152 passed**, both exit **0** | `focused-first.log`, `adjacent-tests.log` |
| App typecheck | **exit 0**; final build reran `tsc --noEmit -p tsconfig.app.json` | `gain-channel-build.log` (initial separate command: `typecheck-app.log`) |
| `npm run build` after gain review (app + player + standalone bundle) | **exit 0**, chunk-size warnings retained | `gain-channel-build.log` |
| Initial `npm run typecheck` (non-gate full project, before gain-review additions) | **exit 2**, 767 diagnostics; historical comparison, not a fresh full-project check of the follow-up | `typecheck-final.log` |
| Base `a79a04bbd`, same TypeScript executable/config and complete imported source/test/script/community graph in an isolated archive | **exit 2**, the same 767 diagnostics; **0 added / 0 removed** after normalizing only repo-root paths and source line positions | `typecheck-baseline-final.log`, `typecheck-comparison.json` |
| Actual editor controls + .oprn export/import | **exit 0** | `editor-verified.log`, `surface/editor-receipt.json` |
| Standalone `player.html`, Firefox + real native media playback after gain review | **exit 0**, 8 scenarios / 50 beats; no runtime-console errors or remote writes | `gain-channel-player.log`, `surface/player-observations.json`, all eight player `SUMMARY.md`/`manifest.json` pairs |
| `npm run openwiki:verify` | **exit 0** | `wiki-check.log` |
| `git diff --check` | **exit 0** | Final working-tree check |
| Supervisor `npm run gates` | **exit 1**, app/CSS pass; every failed test/surface assertion compared to actual base and U14 deltas corrected | `gate-review/classification.json`, `gate-review/classification.md` |

Focused command:

```sh
npm test -- test/eventAudioHandoffs.test.ts test/eventAudioCommandContracts.test.ts test/battleEventWaitAudio.test.ts test/battleAudio.test.ts test/audioEnginePlaybackControls.test.ts test/audioEngine.test.ts test/cc0AudioPlayback.test.ts test/runtimeAudioIndicator.test.ts test/eventCommandPickerAudio.test.ts test/playAudioCommandBody.test.ts test/screenSaveRestore.test.ts --maxWorkers=2
```

Adjacent command:

```sh
npm test -- test/mapBgm.test.ts test/mapBgmVariety.test.ts test/m2RuntimeSupportCompleteness.test.ts test/battleDomKeyboard.test.ts test/battleDomIncremental.test.ts test/commandContracts/m2Command.contract.test.ts --maxWorkers=2
```

Reproduce the editor and then feed its actual exported command payloads into the dedicated player harness:

```sh
node_modules/.bin/vite-node scripts/qa/event-command-remediation-u14.mts
PULSE_SERVER=unix:/run/user/1000/pulse/native XDG_RUNTIME_DIR=/run/user/1000 \
  node scripts/qa/runtime/event-command-remediation-u14.scenario.mjs
```

The explicit Pulse/PipeWire path is this workstation's existing service, not an application dependency. With no `XDG_RUNTIME_DIR`, Firefox decoded the PCM but reported sink/playback failures. `pactl info` confirmed the explicit connection and the `auto_null` sink. Final evidence establishes browser decoding and playback into that sink, **not a human listening assessment**. The audio probe delegates native `play()` unchanged and subscribes directly to media events before playback; no sleeps, fabricated playback events, timer-based polling or session mutation stand in for audio execution. Battle-result fixture setup uses the established vitals capability and a deterministic real enemy attack; sound selection still uses the actual editor commands.

## Surface observations and limitations

- Editor screenshots `editor-0.png`, `editor-1.png`, `editor-3.png`, `editor-4.png`, and `editor-reimported-fadeout.png` show the authored ambient/25/0 inputs, parameter-free memory form, supported music/effect slots and preserved BGM-only intent. Confirm/Apply/reopen/Cancel and file import assertions use exact command values.
- Player screenshots show the actual field/battle surfaces without editor chrome. Native event receipts, rather than screenshots, prove audio: BGS volume 0.175, SE 0.4, ME approximately 0.28 under the existing music group, original-BGM replay, BGM pause while BGS/SE remain playing, replacement field/battle music and the selected defeat SE. Some screenshots capture ongoing glyph/result-panel entrance animation; text layout is not the behavior under review.
- New `player-gain-command` and `player-gain-map` receipts observe exactly one original playback request through gain reset, the saved `{ resourceId, loop }` shape, and a second native playback at volume 0.7 after real menu-driven load. The four `player-battle-gain-*` receipts verify volume 0.175 or 0 after battle exit and a second playback request for the restored field track. Fresh screenshots capture the return/load surfaces (some during the existing transition's black cover); numeric native-event receipts, not screenshot appearance, are the mute/gain evidence.
- Firefox reports native error code 4 after the existing engine deliberately sets a disposed element's `src` to empty. Receipts retain these events. The check accepts only the measured **disconnected + source-cleared + paused + code 4** disposal state; any active playback error fails.
- A separate already-dead-party-at-battle-mount case stalls before rendering its result panel. `battleDom.syncView` computes result visibility before updating the director state, and the resolved tick path does not resync it. This pre-existing-looking lifecycle issue was observed but not repaired or claimed resolved; normal defeat playback is verified.
- No unsupported M2 troop execution, new system-audio slot families, BGM seek-position restoration, or unrelated battle/UI behavior was added.
- One earlier editor run attempted an AI activity-log POST; the QA guard blocked it. Final isolated editor/player runs have zero attempted remote writes. No content was persisted to a DB.
- The OpenWiki index generator would also refresh roughly 240 lines of unrelated stale baseline coordinates. Its generated changes were discarded (the file was clean on entry); only the two focused wiki pages are included.
- Delivered text logs have trailing whitespace/extra EOF blank lines removed solely for `git diff --check`; original bytes (including the incoming historical tail) remain beside them as ignored `*.raw.log` files. Exit codes, diagnostics and assertions are unchanged.
- Original large `.oprn`, exported fixture JSON and full editor observations remain local reproducible artifacts. `editor-receipt.json` retains compact command/import results and SHA-256 provenance so they need not inflate the delivered diff. Final runtime temporary fixture/cache directories and owned browsers/servers were removed.

## Handoff

The four findings are marked resolved on behavior evidence in the ledger; their commits arrays remain empty. The supervisor's gate run is recorded above, including all remaining failures and their actual-base comparisons. No unresolved U14-caused failure remains in that set; the overall repository gate remains red for documented pre-existing failures. Production source is unchanged by the final gate-contract repair.
