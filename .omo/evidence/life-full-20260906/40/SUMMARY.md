# Task40 - remaining Save5 QA consumers

## Outcome and scope

Implemented only `scripts/playtest-driver3.cjs`, `playtest-driver4.cjs`,
`playtest-driver5.cjs`, `playtest-driver6.cjs`, `capture-fullscreen-scale.cjs`,
`test/lifeSaveConsumers.test.ts`, and this task-owned evidence directory.
No product/player/codec/recovery code, task39 files, shared helpers/wiki/INDEX,
legacy fixtures, baseline, dependency, or adventure steps outside the save boundary were changed.

Worktree: `/home/main/z-project/rpg-zzu-life-full-save-consumers-final`.
Branch: `agent/life-full-save-consumers-final`.
Base HEAD: `b7f68fe23e1e1670e0d1d4bbc329708a69256f16`.
Base tree and implementation file SHA-256 values: `identity-and-cleanup.log`.
Read the complete B2 block in the initial Phase2 review and task40/Scope in the
parent plan; read actual initializers/callbacks, repaired driver2 and gate-transfer
patterns, and `test/e2e/saveWriteSignal.ts`. CLAUDE.md was not read.

## Correction

- All five initializers remove only the default namespace's current and legacy
  manual slots 1..3. The current prefix is the existing writer's real
  `oprn:save-slot:v5:` prefix, also used by repaired driver2.
- Drivers4/6 import `saveSlotKey` and `readSaveSlot`, inspect the actual current
  JSON, require numeric schemaVersion 5 and a present valid public-reader result,
  and mutate only the current raw session. Driver4's speculative fallback shapes
  were removed. Legacy bytes do not become the mutation target.
- The existing `armSaveWriteSignal` is imported in the browser and armed for
  `saveSlotKey(1)` BEFORE save input. Successful write completion is awaited;
  timeout throws, and `finally` disposes on success or failure. The helper's
  existing five-second failure bound is unchanged. Only the save-completion delay
  and delayed fallback input were replaced; unrelated adventure waits remain.
- The original 15 consumer tests/assertions are a byte-identical prefix of the
  changed test. Added 31 tests: five actual cleanup loops, plus both drivers'
  actual read/mutation callbacks on real public-writer data, invalid JSON,
  missing/invalid session, versions 4/6/999/string-5, and legacy/other namespaces.
  New namespace fixture keys come from `saveSlotKey`, and actual writer bytes
  are asserted non-null before comparisons.

## RED, exact extraction, and authenticity

Before script edits, extended `lifeSaveConsumers.test.ts` AST-extracted all five
actual `for` cleanup statements and both drivers' actual `page.evaluate`
read/mutation callbacks. TypeScript transpilation changes only import transport
for Node VM execution; imports are bound to the real public save module.
Happy DOM's real Storage is populated through `createSaveSnapshot`/`saveToSlot`.

`RED.log`: exit 1, **31 failed / original 15 passed**. Both current-only observers
returned false. Each cleanup retained current manual slots 1..3. Both mutation
callbacks changed legacy bytes while the current reader's owner retained its
original position. Exact extracted source plus results are retained in
`RED-extracted-results.jsonl`; this is a genuine failing desired-contract test,
not a passing defect-demonstration mislabeled GREEN.

`GREEN.log`: 46 consumer tests, 18 version tests, and 7 existing real save-menu
signal tests passed (71 total). Original legacy/corrupt fixtures are untouched.

`browser-probe.mjs` AST-extracts the exact changed cleanup statements and the
contiguous actual save block from prearming through mutation in each warpVia.
`GREEN-extracted-source.json` retains this exact source. It runs only these
scoped statements, not the historical adventures. Its private page on port
42201 imports the exact helper through the same Vite browser URL and uses a real
button listener calling public `saveToSlot` with a real snapshot. It does not
fake a writer result or claim earned gameplay. The listener checks that the
signal exists before input. An unrelated-key write cannot resolve the signal.
The current key starts absent; the real write is observed and then the extracted
mutation changes the same owner returned by `readSaveSlot`.

Browser results: five cleanups clear both default manual families and preserve
other namespaces/autosaves/unrelated data; both drivers return valid Save5
current-owner position `map_probe,7,9`, preserve legacy and other-namespace bytes,
and dispose/restore Storage.setItem. Both input-throw and actual five-second
no-write timeout paths also dispose correctly. No sleeps/polls or timing retries
are used by this probe. The bounded timeout itself is the behavior under test.

The first browser probe failed (exit 1): its private route was installed after
Vite's fallback, so the served document lacked the button. Retained in
`browser-first-failure.log` and `validation-exits.log`. Corrected the evidence
harness by registering that route in configureServer before Vite middleware;
no product change or timing retry. Corrected probe exit 0: `browser.log` and
`browser-exit.log`.

## Commands and verification

All heavy runs were serial under
`flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock` in this worktree.
No Bun targets or full historical adventures were run.

1. `npm test -- test/lifeSaveConsumers.test.ts --maxWorkers=1 --no-file-parallelism --silent=false`
   - Before scripts changed: exit 1, 31 failed / 15 passed; `RED.log`.
2. LSP diagnostics on the changed test and all five changed scripts: no
   diagnostics (test: all severities; scripts: errors). Executed before build.
3. `npm test -- test/lifeSaveConsumers.test.ts test/lifeSaveVersion.test.ts test/playerOpenSaveMenu.test.ts --maxWorkers=1 --no-file-parallelism --silent=false`
   - One GREEN execution, exit 0, 3 files / 71 tests passed; `GREEN.log`.
4. `node --check` on all five touched scripts and the evidence probe: exit 0
   for each; `syntax.log`. Corrected probe rechecked: exit 0 in
   `identity-and-cleanup.log`.
5. `node .omo/evidence/life-full-20260906/40/browser-probe.mjs`
   - Initial evidence routing failure exit 1 retained; corrected run exit 0.
6. `VITE_CACHE_DIR="$PWD/.omo/evidence/life-full-20260906/40/build-vite-cache" npm run build`
   - Exit 0; app tsc, editor Vite, export player/SDK, standalone bundle completed.
     Build's existing large-chunk/dynamic-import warnings remain visible in
     `build.log`; no warnings were suppressed.
7. Source `git diff --check` before evidence staging: exit 0; original consumer
   prefix byte comparison: true. Full staged diff check subsequently reports
   exit 2 solely for original captured log whitespace (Vitest terminal excerpts,
   final blank lines, and Vite reporter lines). Raw output is intentionally retained
   rather than silently rewritten; no source whitespace errors were reported.
8. Final staged `node scripts/openwiki-index.mjs --check`: exit 0, INDEX current;
   see `index-check.log`. Shared INDEX is parent-owned and unmodified.

## Cleanup and handoff

Browser contexts/browser/private Vite server close in finally, including on the
first failed probe. Port 42201 has no listener (`identity-and-cleanup.log`).
Generated untracked dist in this private worktree was removed after successful
build; `git ls-files dist` returned empty. No shared/tracked cache was deleted.
No private Vite cache directory remained. Temporary patch input files are
outside the repository and are removed before handoff. No remote DB writes,
external network messages, push/PR/merge, history rewriting, root state edits,
or integration-tree edits occurred. Browser routes reject non-local origins.
Only the six owned implementation/test files and own40 evidence are committed.

## Supervisor lossless packaging

During serial integration, `git diff --check b7f68fe2 HEAD` returned 2 solely
for original whitespace in `GREEN.log`, `RED.log`, and `build.log`. Their exact
UTF-8 bytes are now retained as entries in `raw-log-archive.json`, using the
same format as the phase-level archive. The paths above identify the original
outputs inside that archive; no result, warning, error, or trailing byte was
edited. Each entry carries the original repository path, byte length and SHA256.

To print an original output, parse `raw-log-archive.json`, select its entry by
`path`, then decode `content` from Base64. For example in Node.js:

```js
const fs = require('node:fs');
const archive = JSON.parse(fs.readFileSync('.omo/evidence/life-full-20260906/40/raw-log-archive.json', 'utf8'));
const entry = archive.entries.find(entry => entry.path.endsWith('/RED.log'));
process.stdout.write(Buffer.from(entry.content, 'base64'));
```
