# Task14 - life authoring bounds and runtime labels

## Result

Implemented and verified the assigned task14 changes on branch
`agent/life-full-authoring-bounds` in
`/home/main/z-project/rpg-zzu-life-full-authoring-bounds`.
This is scoped task14 evidence, not overall life-system completion or phase approval.
The delivery commit uses `fix(editor): align life authoring bounds and runtime labels`.

Base HEAD: `966f414c07729e7d9474c568cbaf19a94d2bc740`.
The Phase3 verdict's exact reviewed HEAD,
`bd81a933cbecfeb8b25ef15bf57bc24911011aa8`, is an ancestor (git merge-base exit0).
`source-manifest.json` records the SHA256 of every delivered product/test/wiki file.
Each command receipt records its actual base HEAD/tree, cwd, argv and exit.
The working changes, not base HEAD alone, were exercised by these commands.

## Contract results

| Contract | Evidence |
| --- | --- |
| Birthday max follows authored calendar; 40/40 allowed | Unit regression; both native editor sizes type40 with max40, Ctrl+Z to39/Ctrl+Y to40 |
| Existing 28/29 diagnosed, not repaired on render | Native value29/max28/aria-invalid/visible warning and unchanged serialized bytes; unit assertion |
| Omitted weather effective forecast1/intensity0.5 | Unit/public forecast and native range value; optional fields remain absent until edit |
| Explicit 3/0.65 retained | Native keyboard edits and undo restoring omission, redo restoring values, local Storage/public Project4 roundtrip |
| Weather 128 limit | Native 127->128 add/undo/redo; both 129th-add controls yield zero store mutations and unchanged bytes; unit also checks no undo entry |
| Skill max10/new reward2..max | Native and unit input bounds; native reward2 add/undo/redo and valid switch binding; max1 add refusal in unit |
| Legacy reward1 preserved | Native display/roundtrip remains1 and unit pure render/roundtrip; explanatory hint says it is not a level-up grant |
| Linked automatic names, shared identity, explicit override | Actual public playGiftSelection/runEvent/runCommands tests plus native player.html dialogue/gift menu/feedback; explicit empty speaker also retained in unit |
| Crop frame/label/fallback truth without backfill | Existing renderer inspected; labels now describe frame selection, editor-only labels and color-rectangle fallback; undefined/[]/authored graphics purity tests and mounted crop card captures |
| Phase3 tool behavior unchanged | 103-case related selection includes toolActionAuthoringParity and databaseLifeCraftingView; existing wiki tool-authoring paragraph preserved |

No schema, project version, Save5/key/raw-preservation, housing/reference/recovery,
farm-animal, Phase3 tool resolver, dependency, service, authored demo or WISH file was changed.
The skill model's existing MAX_LIFE_SKILL_LEVEL is reused rather than changing normalization.

## RED -> GREEN and retained failures

1. `setup-failure.*`: first command could not find apply_patch on PATH and Vitest had no new
   file; this is harness setup failure, not product RED. The available `/tmp/apply_patch`
   entry point was inspected and used for authored changes thereafter.
2. `characterization.*`: two initial whole-wire assertions exposed existing blank-project
   load normalization (titleGraphic removal and timeSystem defaults), not task14 behavior.
   The fixture now establishes that existing load normalization before checking render and
   repeat-roundtrip purity. No production change was made to accommodate this failure.
3. `characterization-normalized.*`: all 3 legacy characterization cases pass before any
   behavioral production edit.
4. `red.*`: 8 intended bounds/name regressions fail, plus 3 crop harness import failures
   (wrong renderCropsTab name; actual export is renderCropTab). All original output remains.
   Tests and diagnostics then corrected fixture types, including real command.body fields,
   without removing assertions. `diagnostics*.txt` preserves those intermediate errors.
5. `native-editor.*`, `editor-red-state.json`: actual Firefox additionally exposed range
   value0.5 becoming1. util/dom sets value before type/step, so native range sanitization
   rounds using default step1. The weather control now assigns value after its attributes.
   This was a real browser-only product RED missed by HappyDOM.
6. `native-editor-range-fixed.*`, `editor-roundtrip-check-state.json`: an overly strict
   first-load byte assertion failed after keyboard appending forecastDays. The final harness
   checks full parsed project equality, records the actual weather key order
   enabled/seasons/forecastDays -> enabled/forecastDays/seasons, and checks byte-stable
   subsequent canonical roundtrip. Render comparisons remain byte-exact. No data field or
   value was discarded to pass this assertion.
7. `native-editor-history.*`, `editor-cold-boot-timeout-state.json`: a cold editor boot hit
   the unchanged 120s DOM deadline before any actions, at observed host load204/32CPUs with
   nearly exhausted swap. Cause is not conclusively attributed to load. The final harness
   awaits Vite cold-graph request completion before boot; it does not extend the DOM timeout,
   sleep, poll, retry inputs or skip assertions.
8. `native-player.*`: wrong relative harness import failed before any browser execution;
   corrected relative import passes as `native-player-import-fixed.*`.
9. `typecheck-interruption.md`: the first combined tool call was terminated at180s without
   a typecheck child exit receipt. It is not counted as passing. The complete separate
   invocation is retained below.

## Final validation

| Command / receipt | Actual result |
| --- | --- |
| `npm test -- test/lifeAuthoringBounds.test.ts`, `green-final.*` | exit0, 14/14 in one final run |
| Related tests, exact argv in `related.json` | exit0, 103/103 across9 files |
| TypeScript syntactic/semantic diagnostics, `diagnostics-shipping.*` | exit0, no diagnostics on all8 production files and direct test |
| `npm run typecheck:app`, `typecheck-complete.*` | exit0 |
| `npm run build`, `build-shipping.*` | exit0, app/export-player/standalone; unresolved asset, mixed-import/circular-reexport and large-chunk warnings retained in raw output |
| `npm run openwiki:verify`, `wiki-verify.*` | exit0 |
| `npm run openwiki:index -- --check`, `wiki-index-check.*` | exit1: `openwiki/INDEX.md` is stale; generated index is outside assigned write scope and left to parent integration |
| Product/test/wiki `git diff --check` | exit0 |

The parent-owned whole repository gates/13k suite were not rerun. The inherited Phase3
whole-gate failure/timeout disposition remains in its original verdict and is not relabeled green.

## Real surfaces and limits

**Native editor:** `editor.mjs`, `native-editor-history-warm.*`, `editor-state.json`.
Firefox at1024x768 and1440x900; 16 subscribed successful changes per size, plus both
zero-mutation over-limit refusals. Real mounted database controls, keyboard input and
Ctrl+Z/Y use the actual store/history. Every mutation observer/subscription is installed
before the triggering input. No sleeps, polling or retry loops. The existing Life-group
header requires pointer navigation; field edits/actions are keyboard. The fixture setup
and invalid-data setup are explicit engine-only local data, not authored shipped content.
remotePersistenceEnabled is false before and after; no observed nonlocal writes. Local
edit-audit POSTs are not remote project persistence. Roundtrip uses real serialize/
deserialize plus localStorage, not the production remote-save/import dialog.

**Native public player:** `player.mjs`, `native-player-import-fixed.*`, `player-state.json`.
Separate player.html at1280x960 with exportProjectStoreShim, not the editor shell. Only the
project JSON HTTP endpoint is substituted; scene/input/dialogue/gift/interpreter are real.
Keyboard talk shows Explicit command then Linked resident, with friendship0->10. Birthday
gift consumes one of2 potions and grants160 (friendship170). A second event sharing the
profile rejects a second gift, keeps inventory1/friendship170 and does not grant a second
talk bonus. The QA face hook only sets direction between the two authored event locations;
it does not inject ownership or relationship outcomes. Zero page errors or writes.

**Public unit consumer proof:** playGiftSelection, runEvent and runCommands are imported and
executed, not helper-only tests. Dialogue/camera/render endpoints are recording substitutes;
they are not claimed as native rendering. The separate player evidence supplies that surface.

**Images:** 16 PNGs retained with dimensions/hashes in `screenshots.json`. The image reader
returned `Current model does not support images`; therefore native DOM/state/keyboard and
PNG capture are verified, but visual-model readability/aesthetic approval is **unverified**.
The parent should inspect the birthday/warning/weather/skills/crop shots at both sizes and
player-explicit/player-gift/player-shared-limit. No overall visual approval is claimed.

## Cleanup and integration

`cleanup.json` records closed task ports39841/39842, closed contexts/browsers/servers,
removed task-owned editor/player caches and removed generated dist. The pre-existing
`.vite-cache` was retained. No remote content write, main checkout, push, merge or PR was
performed. Parent integration must regenerate its owned OpenWiki index and independently
verify/integrate the delivery commit; broader task18/final visual and full-journey obligations
are not completed by this task.
