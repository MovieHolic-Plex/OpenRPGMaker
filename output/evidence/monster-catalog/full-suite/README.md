# Complete repository verification for PR678

## Result

The frozen run at `d932aa66b322412929d04a43af9f7f2b228f2884` covered every
file selected by the unchanged Vitest configuration:

| Measure | Observed |
|---|---:|
| Terminal native shards | 16 / 16 |
| Discovered / reported unique files | 1,768 / 1,768 |
| Missing / duplicate / unexpected files | 0 / 0 / 0 |
| Total tests | 17,108 |
| Passed / failed / skipped | 16,880 / 205 / 23 |
| Failed files | 106 |
| Aggregate process result | Exit 1: complete coverage, failing tests |

This is not an all-tests-passed claim. The two earlier monolithic attempts timed
out without complete reports. Four initial shards encountered `ENOSPC`; only
those shards were repeated with owned tmpfs temporary directories. Their original
infrastructure failures remain under `.omo/monster-shards/attempt-1` in the
recorded worktree. No test exclusion, assertion weakening or baseline refresh
was used.

## Attribution and repairs

The stored baseline listed 98 failed files. Forty frozen failed files were outside
that list: 38 reproduce upstream failures, while two contained five confirmed
integration-only failing assertions.

- `19625c858`: informed-image fixture setup and the actual deferred-producer
  dependency repair. A missing new-record ID now defers same-batch and transitive
  consumers without consuming their retry targets. Existing records remain
  referenceable. The new real-session cases failed before the production edit.
- `d23f26ce2`: the Ember unit-test replay explicitly selects the reviewed hornet
  image for `en_bee`. Its other 48 calls and every original assertion are unchanged.

Parent verification passed 156 dependency/appearance/context tests and all five
Ember replay tests. The parent full production build also passed application
typechecking, editor, player SDK and standalone stages; chunking warnings remain.
These are separate post-repair results, not replacements for frozen failures.

The 66 files already in the stored baseline were also compared assertion by
assertion. Of their 140 frozen failures, 137 reproduce exact messages on pristine
`142db78e9`, and two differ only in edit-activity ISO timestamps. Three of the exact
reproductions use controlled external responses; they do not prove actual
DB-service behavior.

One historical live-provider failure remains unattributed:
`regionAiHouseTreeNpc.probe.test.ts:211`. Its underlying `LIVE_RESULT` stdout was
not persisted and cannot be recovered. It is not called pre-existing, fixed, or a
confirmed regression. No expired credential was retried. The requested actual
monster lookup, goblin creation and remote persistence have independent passing
evidence in `../live-ai-proof.json`.

## Evidence map

- `raw-d932/manifest.json`: hashes and byte counts for all 21 archived inputs.
  Native JSON values are preserved; trailing whitespace is normalized to one LF.
- `raw-d932/.omo/monster-shards/aggregate.json`: full completeness check, raw
  failures, native counts, process receipts and baseline file-set comparison.
- `raw-d932/.omo/monster-shards/shard-*.json`: all 16 native reports, not summaries
  of selected passing tests.
- `upstream/classification*.md`: first 26 newly listed files.
- `upstream/final-11/`: the last 11 newly listed files and exact comparisons.
  The three event/database surface files are covered by the earlier exact
  upstream surface comparison in `../final-gate-comparison.json`.
- `upstream/existing-66/assertion-classification-after-persistence-controls.json`:
  authoritative cumulative classification of the other 140 failed assertions.
  `classification.md` retains the earlier four-inconclusive stage; the later
  `persistence-controls.md` explains resolution of three of them.
- `region-log-recovery/README.md`: checked persistence surfaces, original
  monitor identity and why the one live diagnostic is unavailable.
- `dependency-parent*.json`, `ember-parent*.json`, `repair-build-parent.json`:
  parent-run post-repair checks and actual exit receipts.
- `checker-parent-self-test.json`: parent execution of all 25 fail-closed
  controls. `self-test-results.json`, `native-reporter-results.json` and
  `actual-report-results.json` retain checker-development evidence; the last
  can contain an intentionally incomplete early report.

## Checker contract

The verification-only checker targets this recorded Vitest 3.2.4 run, not future
repository baselines. Its discovery/report paths retain the original workspace
identity. From the recorded worktree, whose `.omo` inputs remain available:

```sh
cd /home/main/z-project/rpg-zzu-monster-catalog-0907
node output/evidence/monster-catalog/full-suite/check-shards.mjs \
  --exits .omo/monster-shards/exits.json
```

Expected result: complete coverage with exit 1, never exit 0. Missing or invalid
evidence produces exit 2. The archived inputs make every file and assertion
available for independent inspection without relying on a successful checker
message. All archived manifest hashes and JSON syntax were verified by the parent.

Native JSON omits some unhandled-error information and retains only the first
file-level error. Nonzero process exits remain failures even when assertion
counters alone cannot explain them. Baseline membership never changes pass/fail.
The final Ultrabrain review must explicitly consider the remaining live-case
limitation before approving the exact final diff.
