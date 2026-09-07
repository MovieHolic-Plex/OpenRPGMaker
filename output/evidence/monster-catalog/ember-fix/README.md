# Ember replay fixture correction

Starting revision: `19625c8587f8b41d487bac2fdb830cd3b24299d3`.

## Change

Only `test/emberQuestToolReplay.test.ts` changes: the `en_bee` enemy call explicitly chooses `monsterResourceId: "generated-enemy-sylph-hornet"`. The unit-test fixture keeps its name, stats and references. No production/catalog code, authored app content or DB records change.

The reviewed catalog no longer supplies the old filename-inferred `말벌` tag. An explicit image choice satisfies the existing strict appearance contract without weakening it.

## Current RED, then GREEN

The RED run happened before the edit on current integration source. The GREEN run happened after the actual one-field source edit, not an injected replacement input.

| Result | RED | GREEN |
| --- | --- | --- |
| Process exit | 1 | 0 |
| Original tests passed | 3 / 5 | 5 / 5 |
| Replay calls executed | 49 | 49 |
| Calls accepted | 46 | 49 |
| Skipped/pending tests | 0 | 0 |

RED rejected these calls:

1. Call 15, `upsert_enemy(en_bee)`: `monster-graphic-required`.
2. Call 20, `upsert_troop(tr_bees)`: `enemy-not-found` for `en_bee`.
3. Call 40, `place_battle_blocker(ev_blk_2)`: `troop-not-found` for `tr_bees`.

The two failed assertions were the all-calls-success check (`expected [ Array(3) ] to deeply equal []`) and the battle-blocker count (`expected 4 to be 5`). All original assertions pass after the correction.

`call-comparison.json` verifies that only call 15 gains the explicit image field; every other argument, option, call name and ordering is identical. Removing the one added conditional field expression from the edited source reproduces the entire original file byte-for-byte, preserving all assertions.

## Verification method

Both runs execute the complete existing Vitest test file through `scripts/run-vitest.mjs`, with one worker, the original project configuration plus diagnostic-only setup, no cache, and an owned `/dev/shm/st_01a078fc/tmp` TMPDIR. Environment is scrubbed and real network calls are blocked. The trace setup wraps `runTool` with a call-through spy: it changes neither inputs nor returned results, and every call uses the actual registry, guards, draft/commit behavior, lint and reachability checks. These are in-memory project mutations, not persistence/DB writes.

The exact command/environment for each run is retained in `red-exit.json` and `green-exit.json`. Diagnostic harness source is included as `.txt` evidence; original executable copies remain under `/tmp/st_01a078fc`. The old frozen-source diagnostic experiment is not used as a substitute for these current RED/GREEN runs.

Before-edit LSP reported no diagnostics. Fresh after-edit LSP timed out after 3000ms; the fallback scoped TypeScript 5.9.3 compiler check completed with exit 0 and no diagnostics. It uses the real project compiler options and imported type graph, checking syntactic and semantic diagnostics for the changed test. This is not a repository-wide typecheck. `git diff --check` also passed for the changed test and this evidence directory.

No ENOSPC, missing assets, blocked-network or credential-read failures occurred in either run. GREEN has no suite or unhandled errors. The full suite, build and separate dependency tests remain parent-owned and are not claimed here.

## Evidence index

- `red.json`, `green.json`: complete original-test outcomes and assertion signatures.
- `red-trace.json`, `green-trace.json`: all real calls, arguments, options and outcomes.
- `red-exact-errors.json`, `green-exact-errors.json`: expanded assertion and unhandled errors.
- `red-exit.json`, `green-exit.json`, `red.log`, `green.log`: execution records.
- `call-comparison.json`: only the intended one-field argument change.
- `compiler.json`, `compiler.log`, `scoped-compiler.mjs.txt`: executed scoped compiler validation.
- `validation.json`: starting revision, LSP limitation and environmental-error audit.
- `trace-setup.ts.txt`, `vitest-config.mjs.txt`, `run.py.txt`, `no-network.mjs.txt`, `exact-errors-reporter.mjs.txt`: diagnostic harness provenance.
