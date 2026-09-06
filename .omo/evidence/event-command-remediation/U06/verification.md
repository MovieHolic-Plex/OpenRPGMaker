# U06 verified GREEN

Source base: `5c117f0ef993a6cca4bf916dbafe7b361c929be7`, branch `agent/event-remediation-u06`. Only production owner: `src/editor/panels/eventEditor/commandBodyAdvanced.ts::{addFollowerBody,removeFollowerBody}`. Final integration order remains U05 then U06. Atomic commit hash is returned by the worker and recorded by the lead; no self-referential hash in this precommit artifact.

## Commands and outcomes

All commands ran in this U06 worktree; stdout/stderr redirected directly, immediate `$?` appended as DIRECT_EXIT. No pipe-derived status.

1. Refreshed original RED after prerequisites: `npm test -- test/eventCommandRemediation/U06.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U06/red-refresh.json`: exit1;10tests,3intendedfail/7pass. Original red.json/red.log/prep-manifest.md retained unchanged.
2. The malformed first test patch changed no tests; the following unchanged RED run is preserved as red-preservation.{json,log}: exit1;10tests,3fail/7pass. Exact replacement then added one focus assertion to the existing invalid cases and one independent unrelated-scale test; no original input/assertion/positive case removed.
3. `npm test -- test/eventCommandRemediation/U06.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U06/red-preservation-corrected.json`: exit1;11tests,4intendedfail/7pass. Fourth failure is authored graphic.scale2 disappearing.
4. `npm test -- test/eventCommandRemediation/U06.test.ts test/monsterPartyFollowers.test.ts test/followerPresets.test.ts test/eventEditorRichForms.test.ts test/eventEditorStagedState.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U06/green.json`: exit0;52tests/5files passed. U06 is11/11. All seven original positive cases remain and pass.
5. `U06_STANDALONE=1 bun run test/e2e/event-command-remediation-U06.spec.ts`: attempt1exit1, test-only selector collision between parent inspector and modal. Failure screenshot/text and cleanup retained in surface-O4pKpZ. Corrected the DOM identity comparator to the intended dialog; did not weaken connected/same-node requirements or change production. Attempt2exit0: surface-XTEu1G.
6. That runner launched `node scripts/qa/runtime/event-command-remediation-u06.scenario.mjs <surface-XTEu1G/editor-exported.json> <surface-XTEu1G>`: exit0;7/7player beats,0runtime errors, exact follower arrays and wrong-target timeout discriminator passed. The negative runs after the final saved command: Bob is rejected against actual Hero renamed. Named-removal Alice/M is independently asserted at its own barrier. This placement differs from the initial prose plan but is explicit in the pre-execution scenario source and retained trace.
7. `node node_modules/vite-node/vite-node.mjs --script scripts/prepare-event-command-remediation.mts U06 <owned tmp-fixture-pAf0d5>`: exit0. Fixture imports outside Vitest. Temporary output removed.
8. `npm run typecheck:app`: exit0.
9. `VITE_CACHE_DIR=<owned tmp-build-NzBN24/cache> npm run build:app -- --outDir <owned tmp-build-NzBN24/app>`: exit0,66seconds. Vite emits existing-style dynamic chunk/large-chunk warnings; no warning suppression or bundle restructuring. Owned build output/cache removed. Lead still owns integrated aggregate gates.
10. Changed-file LSP: commandBodyAdvanced.ts, U06.test.ts, U06.fixture.ts, U06.spec.ts, and runtime scenario all report no diagnostics. The spec had two diagnostic-request timeouts before the final successful fresh result; no timeout represented as a pass.

## Real surfaces

- Actual H0 map editor, five command rows. Empty and whitespace Confirm reject with native invalidity, modal remains open, focus returns to name, canonical project unchanged. Corrected spaced Bob saves only Bob; explicit all saves all:true.
- Graphic-off saves no graphic and reopens unchecked. Edited direction/frame survive off/name-edit/on in the same mounted dialog; scale2 survives. Cancel discards name/graphic edits. Actor/name and untouched custom graphic fields preserved.
- Real project menu download `.oprn`, parse downloaded package, actual filechooser import of those bytes, all five dialogs reopen with saved values and Cancel retains project.
- Standalone `player.html`, never editor play. Real Enter/Z inputs execute editor-exported payloads inside QA-only setup/text barriers. Actor-default vs graphic-only appearance explicitly separated. Monster follower identity/object retained at every barrier. MonsterParty/monsterInstances deep-preservation additionally verified by real session integration tests; H0 mirror does not expose those collections.
- Geometry/screen captures at1024x768,1280x800,1440x900. No dialog horizontal overflow; Confirm/Cancel bounds inside viewport; focused field measured. Player canvas bounds inside viewport; editor shell absent; observation handle absent after actions.
- **Image limitation:** read was invoked on editor-3-1024.png, editor-0-1280.png, editor-2-1440.png. Each returned `Current model does not support images. The image will be omitted`. No pixel-level, object-identifiability, Lighthouse, or independent visual-review approval is claimed. PNGs retained for lead review.

## Scope and architectural self-review

1. Responsibilities: follower command forms; U06 intent regressions; pure fixture; editor proof; player proof. Production module remains oversized by explicit symbol-ownership restriction, not an excuse to refactor other owners.
2. Boundary purity: existing typed Command/Project and production package/serialize/deserialize boundaries; no new production unknown payloads.
3. Variants: no new tagged-union dispatch. New condition tests native select values; existing unrelated dispatch untouched.
4. Escape hatches: none added. Original RED fixture/test non-null assertions retained under explicit preservation instruction.
5. Defensive layers: none added to trusted production values. Invalid-name parsing is a real user-input boundary.
6. Helpers: no production helper/import introduced; existing DOM controls own inactive draft state. Test operations reuse H0 and local repeated control helpers.
7. Tests: faithful RED->GREEN for all original failures plus scale preservation; actual browser/player positive and negative results retained.
8. Parameters: new functions use at most3parameters.
9. Redundant verification: no new production post-delete/set-query layer; test assertions deliberately observe saved behavior.
10. Naming: positive graphicEnabled retained; no new negative-form feature flag.
11. Logging: no new production logging; QA follows adjacent runner CLI-output practice, catches retain evidence and rethrow. No silent errors.

Pure LOC: production1583(preexisting oversized shared module); unit234; fixture57; editor spec201; player scenario101. Unit/spec are in warning band; split their proof responsibilities before any future substantial expansion. U06 introduces no unrelated refactor, CSS token, motion, dependency or runtime change.

## Cleanup

- First editor port41769, final editor38467, final player39923: all closed; `ss -ltnp` shows no listeners on these owned ports.
- Browser contexts/processes closed in finally; H0 observation traces record disposed observers/listeners/timers.
- Unique editor/player caches, fixture output and isolated build output removed. `find` reports no U06 `tmp-*` directories.
- No DB-authored content, installs, push/PR, other-worktree modifications, shared harness/wiki/plan/snapshot changes, or extra agents.
- Original RED receipts and every correction attempt retained. Binary screenshots/package and large exported fixture remain on disk with hashes in artifacts.json, not staged as source.
- `git diff --check` passes. Root temporary debug journal moved into evidence before commit. Shared wiki amendment proposal is wiki-amendment.md.
