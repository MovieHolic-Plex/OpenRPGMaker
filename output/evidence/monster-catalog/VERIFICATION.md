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
| Production build | PASS after dependency repair at `d23f26ce2`: application typecheck, editor, player SDK and standalone; chunking warnings retained | `full-suite/repair-build-parent.json` |
| Exported runtime | PASS: player.html/shim route, two beats, no runtime errors; visible green humanoid with spiked club, no editor chrome | `runtime/SUMMARY.md`, `runtime/02-goblin-battle.png`, `final-visual-runtime-proof.json` |
| Final CSS gate | PASS: no baseline regression | parent monitor `FINAL_FIXED_CSS_EXIT=0` |
| Surface gate | Seven failures are pre-existing: exact 23 failure signatures match pristine upstream `142db78e9` | parent comparison record; no baseline/snapshot relaxed |
| Full repository tests | Complete coverage at `d932aa66b`: 1,768 unique files; 17,108 tests, 16,880 passed, 205 failed, 23 skipped. No missing, duplicate or unexpected files. This is a complete failing run, not a pass. The five confirmed integration failures are repaired; one historical live-provider failure remains unattributed. | `full-suite/raw-d932/manifest.json`, archived native reports, `check-shards.mjs` |
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
and the editor QA server were also closed after verification. All 16 shard
processes terminated, and their owned temporary directories were removed.

## Complete repository run and comparison

The initial 30-minute all-in-one gate and 60-minute four-worker run timed out
without a complete JSON report. Neither attempt is a pass. The replacement
changed execution granularity, not test selection: native Vitest discovery
selected 1,768 files, and 16 native run shards covered each exactly once on
`d932aa66b322412929d04a43af9f7f2b228f2884`.

The first attempts for shards 13 through 16 encountered actual `ENOSPC` errors.
Those reports were quarantined under `.omo/monster-shards/attempt-1`. Only those
four shards were repeated using owned `/dev/shm` temporary directories; the clean
reports contain no `ENOSPC`. Their terminal exit codes remain 1.

`full-suite/raw-d932/` preserves the discovery list, fixed baseline, plan, terminal
receipts, all 16 native reports and the aggregate. The manifest hashes the saved
files. The checker distinguishes complete coverage from passing tests, verifies
counts against individual assertions, and rejects missing reports, duplicate
files, unfinished assertions and contradictory process receipts. Its 25
fail-closed controls also exercise the actual CLI.

There are 106 failed files. Of the 40 absent from the stored failed-file baseline,
38 reproduce upstream failures; `assistantDependencyRetry.test.ts` and
`emberQuestToolReplay.test.ts` contain integration-only failures. The five original failing assertions were repaired in `19625c858` and `d23f26ce2`.
Parent reruns passed 156 dependency/appearance/context tests and all five Ember
replay tests; no original assertion was removed. The dependency repair additionally
proves deferred-producer recovery and existing-record references. See
`dependency-fix/`, `ember-fix/` and `full-suite/*-parent*.json`.

All 140 failed assertions in the other 66 files were also compared against pristine
`142db78e9`: 134 have exact messages and two differ only in edit-activity timestamps.
Three additional DB-dependent failures reproduce on pristine code under controlled
in-memory responses, bringing this group to 137 exact messages plus two timestamp-only
differences. The controls are not proof of actual DB-service behavior.

One historical live assertion remains unattributed: `regionAiHouseTreeNpc.probe.test.ts:211`.
Its original `LIVE_RESULT` stdout was filtered out of persisted notifications and is no
longer recoverable from the terminal/session stores. It is neither called pre-existing
nor fixed. No expired credential was retried to manufacture a comparison. The actual
monster-discovery/creation and remote persistence scenarios have separate passing
evidence in `live-ai-proof.json`. See `full-suite/region-log-recovery/README.md` and
`full-suite/upstream/existing-66/persistence-controls.md` for the precise limits.

The archived run is immutable evidence for `d932aa66b`, not a claim that later
code changes were tested by that run. Final repair commits require their own
verification and exact-revision Ultrabrain review before merge.

## Limits kept explicit

- Native image attachments were unavailable to the lead model. Visual observation
  used verified actual-image requests to Gemini, followed by lead editorial review
  and independent-model checks of ambiguous anatomy. No filename-only captioning
  or claim of native image visibility is made.
- Tag matching is not general machine vision or proof of user intent. Specific
  custom authored tags and intentional display names remain supported.
- The initial full-gate timeout and upstream surface failures are not reported as
  all tests passing. No tests, warnings or baseline entries were suppressed.
