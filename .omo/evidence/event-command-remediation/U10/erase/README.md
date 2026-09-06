# U10 independent G1-F1: selected Erase Event

Verified source base: `5d4680616acf51f3d9b67e53dd3746a4bbba983e`.
Only production change: `commandCatalog.executeM2Command` Erase Event branch passes the stored target, retaining empty/omitted current-host fallback. No editor, schema, spawn/remove, media, lifecycle or shared H0 source edits.

## Results

| Check | Result | Exit |
| --- | --- | --- |
| Original seven G1-F1 cases before fix | 4 failed, 3 passed | 1 |
| Same original seven cases after one-line fix | 7 passed | 0 |
| Standalone erase + adjacent suites | 81 passed, 0 failed, 0 skipped; 5 files | 0 |
| Pure H0 U10 fixture export, original fixture unchanged | success, no runtime-helper separation needed | 0 |
| App typecheck | success | 0 |
| App build | success; existing large-chunk warning retained | 0 |
| Standalone Firefox editor/player replay | 3 editor cases + 4 player cases | 0 |
| Changed TypeScript diagnostics | 0 in every committed TS file | 0 |
| Residual U10 imports after extraction | 2 unused imports removed; final diagnostics 0 | 0 |
| Runtime scenario JS syntax | success | 0 |

The original filtered RED/GREEN reports list 19 cases outside the G1-F1 filter. No skip modifiers were added. The committed standalone test entry executes all seven without filtering. The remaining 19 G3-F19/G3-F20 cases are deliberately **uncommitted and unresolved** in `test/eventCommandRemediation/U10.test.ts`; they were not rerun here. Prior complete U10 provenance records 14 failures/5 controls in those two groups on its older base, not a fresh result.

## Exact commands

Run from this worktree/repository root:

```sh
# Recorded before production edits; original package preserved as original-U10.test.ts.gz.
npm test -- test/eventCommandRemediation/U10.test.ts --maxWorkers=2 -t 'G1-F1' --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U10/erase/red.json
# Same command after fix, with outputFile=.../green-original.json.

npm test -- test/eventCommandRemediation/U10.erase.test.ts test/eraseEventCommandBody.test.ts test/eventRuntimeExecution.test.ts test/interpreter.test.ts test/roguelikeRooms.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U10/erase/green-focused.json

node node_modules/vite-node/vite-node.mjs --script scripts/prepare-event-command-remediation.mts U10 .omo/evidence/event-command-remediation/U10/erase/pure-fixture-original
node node_modules/vite-node/vite-node.mjs --script test/eventCommandRemediation/U10/replay.mts
npm run typecheck:app
VITE_CACHE_DIR="$PWD/.vite-cache/u10-erase-build" npm run build:app
node --check scripts/qa/runtime/event-command-remediation-u10-erase.scenario.mjs
```

`replay.mts` invokes the real editor spec's exported proof directly (no Playwright retries/config/shared server), then executes the named runtime scenario entry. Each run owns an ephemeral strict editor port, a separate strict player port, unique caches, fresh Firefox contexts, 15s actions/observations and separate 120s navigation/boot bounds. It uses acknowledged H0 subscriptions before triggering actions, not sleeps or polling.

The runtime scenario is independently replayable with the exact exported JSON:

```sh
mkdir -p .omo/evidence/event-command-remediation/U10/erase/replay-input
 gzip -dc .omo/evidence/event-command-remediation/U10/erase/editor-exported.json.gz > .omo/evidence/event-command-remediation/U10/erase/replay-input/project.json
node scripts/qa/runtime/event-command-remediation-u10-erase.scenario.mjs .omo/evidence/event-command-remediation/U10/erase/replay-input/project.json .omo/evidence/event-command-remediation/U10/erase/replayed-player
rm .omo/evidence/event-command-remediation/U10/erase/replay-input/project.json
rmdir .omo/evidence/event-command-remediation/U10/erase/replay-input
```

## Real-surface evidence

Successful run: `surface-zQ7Es6/`.

- Editor: selectedOther, explicit empty/current-host, and retained unknown option; selection stays staged; Confirm -> parent Apply -> reopen -> edit to host -> Cancel; actual `.oprn` download -> package reader -> filechooser import -> all three reopened values. Unknown `futureOption` survives selected-target editing. Zero remote writes.
- Player: exact exported erase command object is inserted unchanged between a READY barrier and switch/text continuation markers. Selected and common-host cases remove selectedOther from the **actual Phaser sprite map**, leaving host unchanged. Explicit current erases host only. Unknown ID leaves both sprites unchanged. Every following marker executes. Map-away/map-back restores both sprites after temporary selected erasure. No console/page errors, no editor shell, no remote writes.
- No-host common/empty behavior is verified through the original actual `runCommands` scene-consumer tests, whose graphics boundary is a test fixture. This is not a claim of browser editor-context or parallel-scheduler support.
- Geometry: 9 editor observations and 12 player observations at 1024x768, 1280x800, 1440x900. Positive-size controls/canvas remain in viewport; no dialog horizontal overflow. 25 successful-run screenshots retained locally and excluded from git.
- Two image Read calls returned **pixels omitted because the model does not support images**. No visual pixel-QA claim is made.

The first replay (`surface.log.gz`, exit 1, `surface-ZSTijs`) exposed an ambiguous test selector matching inspector and modal. Only the QA selector was scoped to the command dialog. The changed replay passed (`surface-02.log.gz`, exit 0). This is not counted as product RED.

## Diagnostics and provenance

Initial LSP diagnostics returned clean for source, fixture, standalone tests and drivers. Fresh editor-file LSP requests timed out. A TypeScript compiler API pass using the repository tsconfig checked syntactic/semantic diagnostics of every changed TS file: all committed files had 0; the uncommitted residual had only 2 unused imports caused by extraction. Removing those imports retained its test bodies byte-for-byte; its targeted recheck returned 0 (`residual-diagnostics.log.gz`). No errors/warnings were suppressed.

`red-inputs.txt`, `surface-inputs.txt`, `surface-02-inputs.txt` record exact commands and source/input hashes **before** their invocations. `final-inputs.sha256` records the exported JSON/package and final source hashes. `extraction.json` and `verification.json` prove exact group-body equality and unchanged fixture bytes. Original test/fixture, old RED provenance, original pure fixture output, and exact exported JSON are preserved as gzip; executable support lives under `test/`, not evidence. Raw logs are gzip without whitespace rewriting.

## Cleanup and scope review

Both editor servers (38931, 43553) and the player server (40355) were closed by their owning drivers after awaited exits/close calls. All browser contexts/browsers closed, H0 observations disposed, unique editor/player caches removed. The owned build output/cache and temporary fixture/export/package originals were removed after byte-preserving archival. No DB work, external API, agents, push, PR, or other-worktree edits occurred. There is no upstream configured for this local branch.

Production responsibility remains command-step routing; no refactor was authorized. The inherited catalog is 979 pure LOC, unchanged in size. New standalone test 116, editor driver 110, runtime driver 128, replay 55; unchanged shared U10 fixture 85. Residual U10 is 239 after import cleanup, in the warning band, with no new test bodies. Original test-fixture casts/non-null assertions are retained for provenance, not introduced into production. No new boundary parsing, tagged variants, parameter bloat, defensive layers, single-use abstraction, redundant destructive verification, negative names, logging subsystem or prose-pinning test was added. The behavioral change is locked by the genuine pre-fix RED.

The focused wiki amendment is `wiki-amendment.md`; lead owns shared wiki integration. Full repository gates remain supervisor integration work, not claimed here.
