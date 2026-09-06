# Monster metadata verification

## Delivered behavior

The bundled catalog covers 162 raw monster resource IDs. Korean names, tags and
descriptions were authored from actual original-image inputs, with source hashes
and observation provenance. Database -> 전투 몬스터 -> 몬스터 소재 edits the same
effective metadata that the AI reads. Runtime enemy names, stats and resource IDs
are separate from editable resource labels.

`list_monster_resources({})` returns the complete index. Full/detail reads expose
untruncated metadata and a compact image identity. AI assignments require current
delivered detail and specific appearance tags; wrong-kind IDs, stale uploaded
images and generic-only identity declarations are rejected.

## Evidence matrix

| Criterion | Result | Evidence |
|---|---|---|
| Complete original-image coverage | PASS: 162 IDs, no missing/extra entries or image-hash changes | `src/assets/monsterCatalogReview.json`, `visual/manifest.json`, seven `visual/observations-*.json` files |
| Image bytes actually reach provider | PASS: byte/order tests and actual red/blue controls; pre-fix hallucinated responses discarded | `vision-proof.json`, `test/ohMyPiVision.bun.test.ts` |
| Catalog regression | PASS: empty scaffold RED, then 127 tests in six files GREEN; existing Korean aliases retained | `README.md`, `test/monsterCatalogCoverage.test.ts` |
| Override/codec/concurrency foundation | PASS: parent 58 tests; child extended 283-test scope | `output/evidence/monster-model/README.md` |
| Actual AI discovery and creation | PASS: real OAuth intent/model calls; separate full-index read delivered all 162; filtered goblin detail produced correct art and preserved protected data | `live-ai-proof.json` |
| Remote creation persistence | PASS: dedicated QA project reload retained `generated-enemy-goblin-scout` for `밤의 족장` | `live-ai-proof.json` |
| Real UI edit and save/reload | PASS: name/tags/description, tag deduplication, literal markup, current accepted-save proof and exact AI lookup parity | `ui-functional-proof.json` |
| Real UI reset and reload | PASS: override removed, default metadata restored, gameplay enemy preserved | `ui-functional-proof.json` |
| Preview containment | PASS after actual visual RED: grid intrinsic sizing fixed without cropping; three desktop widths recaptured | `preview-overlap-red.json`, `final-visual-runtime-proof.json`, `final-ui-fixed-*.png` |
| Uploaded image replacement | PASS: stale identity RED, then parent 44 tests GREEN including fresh-read recovery and existing-art compatibility | `output/evidence/monster-ai/c4/README.md` |
| Latest-main integration | PASS: schema/tool/history preservation and original-context budgeting regression fixed | `/tmp/st_01a07849-focused-final.log`, merge `cc09b9dd` |
| Production build | PASS after preview fix: editor, player SDK and standalone | parent monitor `PREVIEW_FINAL_BUILD_EXIT=0` |
| Exported runtime | PASS: player.html/shim route, two beats, no runtime errors; visible green humanoid with spiked club, no editor chrome | `runtime/SUMMARY.md`, `runtime/02-goblin-battle.png`, `final-visual-runtime-proof.json` |
| Final CSS gate | PASS: no baseline regression | parent monitor `FINAL_FIXED_CSS_EXIT=0` |
| Surface gate | Seven failures are pre-existing: exact 23 failure signatures match pristine upstream `142db78e9` | parent comparison record; no baseline/snapshot relaxed |
| Full repository tests | First all-in-one gate exceeded 30-minute command deadline; not a pass. Complete observable rerun with four workers is pending | `.omo/monster-final-vitest.json` when finished |
| Ultrabrain approval and PR merge | PENDING | Final review must approve the exact revision before merge |

## Actual QA target and export

Only `qa-monster-catalog-01a077c7-20260907` was changed. The original user project
`oprn-e98456e1d8` was not modified.

After UI reset verification, the dedicated QA project received one test troop and
an automatic, one-time battle event. That setup was saved and reloaded before
export. The exported fixture was produced by `prepareWebExport`; an export-only
metadata sentinel was removed. `runtime-project.json` is the exact playable input.

```sh
npm run qa:runtime -- --browser firefox --scenario monster-catalog \
  --out output/evidence/monster-catalog/runtime
```

The runtime harness closed its owned browser and server. Parent browser contexts
were also closed after UI verification. The editor QA server and the current full
test run remain until final review/cleanup.

## Limits kept explicit

- Native image attachments were unavailable to the lead model. Visual observation
  used verified actual-image requests to Gemini, followed by lead editorial review
  and independent-model checks of ambiguous anatomy. No filename-only captioning
  or claim of native image visibility is made.
- Tag matching is not general machine vision or proof of user intent. Specific
  custom authored tags and intentional display names remain supported.
- The initial full-gate timeout and upstream surface failures are not reported as
  all tests passing. No tests, warnings or baseline entries were suppressed.
