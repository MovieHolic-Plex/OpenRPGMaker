# Validation — 2026-09-21

- `npm run typecheck:app`: exit 0.
- `npm test -- test/characterScale.test.ts test/ioFootprintValidation.test.ts test/eventEditorFootprintField.test.ts test/editSceneEventFootprint.test.ts test/runtimeEventFootprint.test.ts test/renderFootprintCenter.test.ts test/generatedMonsterFieldSprites.test.ts --maxWorkers=2 --minWorkers=1`: exit 0, 7 files / 118 tests passed.
- `node scripts/qa/character-auto-scale.mjs`: exit 0. Dedicated player.html/export store shim; automatic player/NPC/follower scales on 32→48→16→32 action transfers, manual 1 and legacy 1.5 preserved, real attack tween and out-and-back jumps restore scale. No sprite scale overrides in this QA.
- `TILE_EDITOR_URL=http://127.0.0.1:9856 node scripts/qa/character-auto-scale-editor.mjs`: exit 0. Actual event editor automatic 2x display, manual 1x save + serialize/deserialize + reopen, return to automatic + reload; zero uncaught errors.
- `git diff --check`: exit 0.

Runtime screenshots are unmodified captures. The 640×480 browser viewport displays the default 320×240 logical player surface at 2x; the 48px-world character frame is 48×64 logical pixels (automatic sprite scale 2). Existing manual scales and collision footprints remain authored values. Only walking charsets receive automatic fit; props and fitted monster battler art retain existing behavior.

Scope: pure engine/editor changes and synthetic contract QA. No authored game project, asset resampling, or remote persistence. Full suite/gates not run. Prior tile import/pointer/collision evidence: ../tile-size-support/SUMMARY.md.
