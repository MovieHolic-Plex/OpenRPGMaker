# P7 paint coverage correction - st_01a081c6

- Task: `st_01a081c6`; parent/root: `01a07680-34ac-7f79-8729-1c06bf78b736`.
- Exclusive existing worktree: `/home/main/z-project/rpg-zzu-p7-preserved-wall-st01a08194`.
- Branch: `fix/p7-preserved-wall-st01a08194`.
- Exact clean starting head: `b139e4e24144ad48c298f06e32fe7fa66892f7ac`.
- Separate correction commit follows b139; the prior commit is not amended.

## Delivered correction

CR1: an intersecting maintenance operation still selects the exact-cell coverage
path, rather than blanket-ORing ordinary changed-region intersection. Successfully
validated maintenance establishes its requested tile on the asset's executed layer.
Native changed `paint_tiles(mode:"cells")` operations for that same tile/layer can
contribute their explicit, currently matching cells. A one-cell no-op306 followed
by a complete twelve-cell paint306 with eleven actual changes now fulfills the row.
A changed rectangle, different tile, missing/short/failed/skipped receipt, wrong
executed layer, sparse bounding-box interior, or current invalidation cannot fill
that coverage. The full asset still needs coverage, not one changed intersection.

CR2: `mapTools.ts` records `data.effectiveLayer` from native routing at execution
and freezes the small scalar receipt. Completeness consumes this historical value;
it does not recompute from mutable tileset metadata or parse summary prose. Native
upper-home paint requested lower remains credited only to upper after native
`set_tile_rules` changes the home to lower with zero tile changes. Both arrays may
contain 306 without proving that the historical operation painted both layers.
Missing/invalid execution-layer evidence fails closed; there is no metadata fallback.
The scalar field survives JSON ledger serialization without summary prose.

No painting/routing/cluster algorithm, BuildSpec schema, quantity calculation,
meaningful-diff metric, changed-region accounting, canonical acceptance predicate,
recipe-repair flow, session ownership, or application/replay policy was changed.
The existing shared session/review/terminal call sites already supply the host's
current draft/applied state. Original `preserve` versus `targetChange` remains a
separate original-baseline/current-content comparison.

The wiki now states repair and historical-layer semantics. The previously stale
INDEX was regenerated, including b139's missing heading/line-count shifts.

## Red first on b139

Before production source edits, copied the review native driver/config to
`/tmp/st_01a081c6` with only its output/temp paths changed; originals were not run
again in place or overwritten. This invokes the real native tool runner, draft,
mutation, lint/commit gate and completeness predicate, without provider/DB/browser.
The driver rejects fetch and uses an empty env directory.

```sh
node_modules/.bin/vite-node --config /tmp/st_01a081c6/vite.config.mjs /tmp/st_01a081c6/native-countercases.mts
```

Exit **1**, **7 passing checks / 3 failed checks** (`native-red.json`):

- Earlier one-cell no-op + full twelve-cell repair: expected 0 warnings, actual 1.
- Metadata transition, lower asset: expected 1 warning, actual 0.
- Metadata transition, upper asset: expected 0 warnings, actual 1.

Added real native regression tests before source changes, then ran:

```sh
npm test -- test/proposalCompleteness.test.ts -t 'earlier one-cell|historical upper' --maxWorkers=2
```

Exit **1**, **3 failed / 5 passed / 63 unselected** (`tests-red.log.gz`). These fail
at the same completeness decisions, after assertions verify native changes/touches,
metadata changes, and actual tile arrays. No failing assertion was weakened.

## Green behavior and focused verification

The same native driver on the correction exits **0**, **10 checks passed / 0 failed**
(`native-green.json`). The driver's result labels identify a working correction
based on b139, not a run of unchanged b139. Logs and executable driver remain under
`/tmp/st_01a081c6`; the committed native tests reproduce both corrected cases.

One full focused test execution, without retrying failures:

```sh
npm test -- test/proposalCompleteness.test.ts test/aiCompletionAccounting.test.ts test/aiTurnAppliedAccounting.test.ts test/transparentTileLayerRouting.test.ts test/clusterRulePlacement.test.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile=/tmp/st_01a081c6/focused-green.json
```

**Exit 1: 116 passed / 5 failed / 0 skipped**, raw output `focused-run.log.gz` and
`focused-run.json`. The original temporary filename says `focused-green`; it is
not an all-green run and the raw output is preserved verbatim. Test console logs
are gzip archives so Vitest's trailing spaces/blank lines remain byte-exact without
introducing whitespace errors into text patches; read them with `gzip -dc <file>`.

| File | Passed | Failed |
| --- | ---: | ---: |
| proposalCompleteness | 73 | 0 |
| aiCompletionAccounting | 12 | 0 |
| aiTurnAppliedAccounting | 19 | 0 |
| transparentTileLayerRouting | 9 | 0 |
| clusterRulePlacement | 3 | 5 |

Thus all **104** completeness/session/terminal accounting tests and all **9** routing
tests passed in that single run. Existing partial/skipped/failed/wrong-layer/current-
invalidation, sparse-cell, meaningful-change/quantity, and preserve-versus-targetChange
coverage remains intact. The new tests also check missing/invalid layer receipts,
changed repair receipt rejection, immutable native data and summary-free serialization.
Native mutations are not mocked; existing session/UI tests replace only their transport
and fake-DOM boundaries. No sleeps, polling, random seeds or async mocks were added.

### Newly observed pre-existing failures

Extracted a full untouched `git archive b139e4e24144ad48c298f06e32fe7fa66892f7ac`
to `/tmp/st_01a081c6/b139`, with only a node_modules symlink. There ran:

```sh
npm test -- test/clusterRulePlacement.test.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile=/tmp/st_01a081c6/b139-cluster.json
```

Exit **1: 3 passed / the same 5 failed** (`b139-cluster.log.gz` and `b139-cluster.json`). Machine comparison
of full failing test identities and assertion messages is identical
(`baseline-comparison.json`). Failures, in source-line order:

- line 62: conifer paint upper tile expected 260, got -1;
- line 118: idempotent companion upper tile expected 290, got -1;
- line 134: broadleaf paint upper tile expected 262, got -1;
- line 156: scatter conifer pairs expected 3, got 0;
- line 177: scatter broadleaf upper tile expected 292, got -1.

These tests and tree/cluster code were not changed or skipped to obtain a green
summary. The prior receipt's **12 baseline fake-DOM failures** and **three baseline
fixture type errors** remain separately documented there; those failing surfaces
were not rerun or edited in this task. They are not new diagnostics of changed files.

## Typecheck, diagnostics, wiki and whitespace

```sh
npm run typecheck:app
node /tmp/st_01a08194/tsserver-check.cjs "$PWD" src/ai/proposalCompleteness.ts src/editor/tools/mapTools.ts test/proposalCompleteness.test.ts
node scripts/openwiki-index.mjs
node scripts/openwiki-index.mjs --check
git diff --check
```

All exit **0**. App typecheck output is `typecheck.log.gz`. Per-file shared LSP requests
also returned no diagnostics. The dedicated TypeScript server completed syntax,
semantic and suggestion diagnostics for all three changed TS files with **0 diagnostics
and no missing completion signals** (`diagnostics.log`). Markdown has no configured
language server; generated index and whitespace are checked directly. Index check
initially exited 1 for staleness; regeneration then passed (`index-check.log`).

## Preserved history and boundaries

Read both the prior committed implementation receipt and parent review before edits.
The existing `../p7-preserved-wall-fix-st_01a08194.md` and raw
`../b139-supervisor-tests.json/log` (**94 passed / 0 failed / 0 pending**) and
`../b139-supervisor-typecheck.log` remain unchanged. That historical 94-pass result
is not substituted for the review failures or this correction's verification.

`review-b139.md` and `review-native-failures.log/json` are byte-for-byte copies of
the parent review and `/tmp/st_01a081b5-review` failure receipts (7 pass / 3 fail).
`preserved-receipts.sha256` pins these copies and the prior committed receipts.
No original evidence was rewritten.

Scope assumption: this is a source/fixture correction, not P7 game acceptance or
integration approval. No parent/game/environment/starter/other-worktree files were
edited; no extra agents, broad gates, build, browser, live model, DB or network
operation was used. Parent integration and saved game6588 remain outside this task.
