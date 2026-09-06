# Sweep4 runtime local merge candidate

Base: `58105616b` (origin/main when assigned). Only the assigned runtime worktree was changed; no push, shared-main edit, PR comment, database write, build, or full gates.

## Ordered imports

1. PR654 `6c810f93b91e26359475f60d14c4e6a5eb397e51` -> merge `f36aeaea7`.
2. PR656 `a17dc0896982ba8bda9a43187b90121994ca45d7` -> merge `53bdc9f6a`.
3. PR658 `45a424ad8c43ef58057a147c9e171fd9dcdfcc03` -> merge `4af2ed6a8`.
4. PR659 `a073749edd739e6a48d1eae20b3e0797fbbfda99` -> merge `6f951c705`.

## Conflict resolutions

- PR654: regenerated `openwiki/INDEX.md`; retained both battle wiki additions; kept mutable battler level and growth skill refresh; preserved authoritative class/lineage/permanent-skill write-back and derived-vital refresh; combined authored audio gain with capability-gated QA observation. Files: `openwiki/runtime-battle.md`, `src/battle/battleBattlers.ts`, `src/battle/battleEvents.ts`, `src/player/audio/audioEngine.ts`, `src/player/battleRewardsToSession.ts`.
- PR656: regenerated INDEX; combined pre-import abort ownership and nullable cancellation with NPC foreground/map/process validity; retained real choice hosting and post-reveal reward commits; shared command battle handling ignores cancelled outcomes; retained Save5 life recovery and growth parsers alongside strict pursuit/detection parsing. Files: `src/player/PlayScene.ts`, `playSceneBattle.ts`, `playSceneInterpreter.ts`, `playSceneTypes.ts`, `saveSlots.ts`.
- PR658 and PR659 merged without textual conflicts. Default front view hides battlefield allies but retains party HUD/keyboard targeting; Pokemon back sprites and explicit side-view sprites remain supported. ESC skill rows/showcases crop one animation cell.
- Follow-up tests cover same-ID map replacement and owner invalidation. The export closure test now exercises default, Pokemon, and side views explicitly: back-sprite bytes remain required for Pokemon, while the other views do not ship unused derived back sprites. No production asset collector was changed.

## Verification

- `npm run typecheck:app`: exit 0. No production changes after that check.
- Individual TypeScript LSP diagnostics: no errors for manually resolved battle/player/audio/save files and the export test. Directory-wide diagnostics could not run because their Biome server is absent; no dependency installation was attempted.
- All Vitest invocations used `--maxWorkers=2`.
- Initial 60-file invocation reached its 300-second bound after 44 file results; it did not produce a successful command exit and is not presented as a passing run. The remaining 16 files completed separately: 239 tests passed, exit 0.
- Final focused 15-file invocation completed in 86.99 seconds: 274 passed, one unchanged portal snapshot failure, exit 1. It includes the corrected three-view export closure assertions, real battle choices/cancellation, NPC ownership, growth, Save5, audio, front-view sprites and ESC icons.
- Across latest completed results for all 60 requested files: 1,118 passed, one failed. This is aggregated per-file evidence, not a claim that a single 60-file command passed.
- The unchanged failure was reproduced on detached `58105616b` in this same assigned tree, then the candidate branch was restored. Only two baseline tests were run: portal snapshot failed; player manifest contract passed. No expansive baseline triage.
- Unchanged portal output: `commandPickerTab3` retains the same tag-count drift (circle -2, div/path/span/svg -1); `npcGraphic` adds five charset-teaching test IDs, three controls/classes and loses its old slot label. The imported support changes alter absolute span counts, not this pre-existing -1 discrepancy. No snapshot refresh or assertion weakening was used to hide it.
- `npm run openwiki:index -- --check`: current. `git diff --check` and base-to-candidate diff check: clean.
- Imported `.omo/evidence` additions from PR654 (one file) and PR656 (three files) were compared byte-for-byte with their source revisions and remain identical.

Local untracked execution evidence remains under `output/evidence/sweep4-runtime/`: `typecheck.log`, `test-targets.txt`, `tests.log`, `remaining-targets.txt`, `tests-remaining.log`, `baseline-two-failures.log`, `tests-final.log`.

## Parent-owned shipping-player QA

Run from the final combined tree. These are handoff commands, not browser runs claimed by this child. They use the actual player surface, not editor play mode; fixture scenarios do not require DB writes.

```bash
node scripts/qa-event-command-battle-flow.mjs --flow both --case choice-enter
node scripts/qa-event-command-repairs.mjs --scenario battle-state
node scripts/qa-event-command-repairs.mjs --scenario map-effects
node scripts/qa-event-command-repairs.mjs --scenario audio-layers
node scripts/qa/npc-behavior.mjs --scenario trainer
node scripts/qa/npc-behavior.mjs --scenario pursuit
npm run qa:runtime -- --scenario battle-frontview
npm run qa:runtime -- --scenario esc-menu
```

Parent owns cross-group conflicts, final combined build, runtime/browser acceptance, restart and deployment.
