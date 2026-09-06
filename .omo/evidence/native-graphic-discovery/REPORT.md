# R14 native charset discovery

Base: `fe3a6d88a91b8f2600b8992f198cf0eb0604adac`.
Worktree: `/home/main/z-project/rpg-zzu-ai-native-graphic-discovery-0907`.
Task: `st_01a0774f`.

## Delivered contract

- `searchResources("charset", ...)` / `list_resources` and `list_npc_graphics`
  retain their existing fields and user label/tag overrides, adding `nativeGraphic`.
- Its `{sprite:{type:"bundled",id},direction:"down",pattern}` can be copied directly
  into native `upsert_event.event.pages[n].graphic`.
- Both paths use the already-exported `charsetFrameIndex`; no helper extraction,
  editor-to-assets dependency, native-input heuristic, runtime change or catalog relabeling.
- Native schema explains sheet frame versus characterIndex. Slots 0..7 down-idle:
  `25,28,31,34,73,76,79,82`.
- Read the exact R13-R16 review at the adversarial tree's
  `.omo/evidence/ai-playable/review-round3.md`, plus the actual round3 `REPORT.md`
  and `final-harness.json` sign/gate upsert evidence. Object2 slot0 is not relabeled.

## Red / green

Final regression, with only the production patch temporarily reversed to the base:

```text
npm test -- test/nativeGraphicDiscovery.test.ts --maxWorkers=2
Tests 8 failed | 5 passed (13), exit 1
list_resources people1 slot 0 lacks nativeGraphic
list_resources object1 slot 0 lacks nativeGraphic
list_resources object2 slot 0 lacks nativeGraphic
list_npc_graphics people1 slot 0 lacks nativeGraphic
list_npc_graphics object1 slot 0 lacks nativeGraphic
list_npc_graphics object2 slot 0 lacks nativeGraphic
```

The other two failures were absent nativeGraphic on overridden-label results.
All five native-frame compatibility cases already passed on the base.
Raw local evidence: `red-final.log`.

Restored production patch, one successful focused-suite execution:

```text
npm test -- test/nativeGraphicDiscovery.test.ts test/resourceSearch.test.ts test/charsetQuery.test.ts test/charsetLabelOverrides.test.ts test/eventCompileGraphic.test.ts test/aiNativePageContract.test.ts test/runtimeEventPageGraphics.test.ts --maxWorkers=2
Test Files 7 passed (7)
Tests 82 passed (82), exit 0
```

Raw local evidence: `green.log`. One earlier fixed-code run failed a new test's
incorrect assumption that the broad `people1` query returned only one sheet:
resource search legitimately includes Scarloxy People1 too (16 matches).
The test now selects the requested texture and still requires exactly eight slots;
no production search behavior changed. Both final red and green used that correction.

The new test uses real `runTool` discovery and native upsert, then serialize/deserialize,
runtime page selection and `renderTiles`. Only the sprite/tile drawing sink is a fixture;
texture/frame arguments selected by the actual renderer are checked against explicit
independent sheet-frame tables, not production encoder/decoder roundtrips.
Coverage: both tools x People1/Object1/Object2 x eight slots x four runtime directions;
user overrides; all 96 stored frames; rendered native 0/3/7/95 compatibility.
Existing high-level `place_npc` / `make_villager` compilation tests remain green.

## Other verification

- `npm run typecheck:app`: exit 0 (`typecheck.log`).
- LSP: zero diagnostics for all three changed production files. New-test initial
  diagnostics were empty; fresh requests after its filter edit timed out.
- Fallback TypeScript compiler API: read repository tsconfig, use all its `.d.ts`
  roots plus `test/nativeGraphicDiscovery.test.ts`, check the complete transitive
  program with `noEmit:true`: zero diagnostics (`diagnostics.log`). No errors filtered.
  Earlier ad-hoc root selections were unsuitable: test-only omitted ambient declarations
  (10 errors); all-src plus Node test pulled in unrelated timer-type conflicts in
  customSelect.ts/showAnimationPlayback.ts (2 errors). Neither was called a pass.
- `npm run build`: exit 0, editor + export-player SDK + standalone bundles (`build.log`).
  Warnings remain: mixed static/dynamic imports, chunks over 500 kB, and unresolved
  `/generated/battle-reference-forest.png` at build time. No warning limits changed.
- `git diff --check`: passed before commit.

## Limits / ownership

This is engine/tool code plus unit fixtures, not authored game content. No DB writes,
model requests, remote reloads, environment edits, occupied-port9841 interaction,
push, PR, merge, or main edits. Raw logs are local ignored evidence; this concise
report is committed. No temporary production patch remains.

The parent still owns final-head gates/build, stronger-model UI generation with
actual dispatched-model/image receipts, remote identity reload, dedicated-player
journey and ultrabrain approval. This local build does not replace those integrated
checks. No visual art identification, R6 closure, or approval is claimed; externally
merged PR653 is not goal completion.
