# Phase3 gate triage: ready for parent execution, not approval

Task `st_01a07799`. Package root:
`/home/main/z-project/rpg-zzu-life-full-p3/.omo/evidence/life-full-20260906/phase3-gate-triage/`.
The inherited shell cwd was a different tree; every authored file is in the explicitly assigned P3 evidence directory. No product, test, config, package, tracked cache, baseline, original receipt, or root plan/state was edited. CLAUDE.md files were not read.

## Execute once

Inspect `run.mjs`, `manifest.json`, and the safety/uncertainty sections below, then run exactly:

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock   node /home/main/z-project/rpg-zzu-life-full-p3/.omo/evidence/life-full-20260906/phase3-gate-triage/run.mjs
```

Do not add `flock --close`: the harness verifies the inherited locked descriptor against `/proc/locks`. Do not launch the script naked, add another nested blocking flock, run concurrently, or retry to choose a better outcome. The lock stays held across both sides and cleanup. A lock-acquisition failure prevents the script from starting; the outer flock's real exit/stderr is authoritative in that case.

Order is **current -> base**, once each, with one worker and no file parallelism. Each side uses `timeout --signal=TERM --kill-after=15s 1185s` (at most 1200s including kill grace). The pair may therefore take up to 2400s plus the 900s lock wait and metadata/hash checks; do not put the entire pair under a single 1200s supervisor deadline. Individual metadata commands have 30/60-second bounds. No test/hook/per-case deadline is increased. Existing test-local deadlines remain part of the unchanged files.

The core test invocation on each actual root is:

```text
node scripts/run-vitest.mjs run <the exact same 113 whole-file paths>
  --config <unique evidence/side/triage.config.mjs> --configLoader=bundle
  --no-file-parallelism --maxWorkers=1 --minWorkers=1 --no-cache --retry=0
  --silent=false --reporter=verbose --reporter=json
  --outputFile.json=<unique evidence/side/report.json>
```

The generated config imports that root's unmodified `vitest.config.ts`, preserves its exclusions, environment, isolation and deadlines, narrows `test.include` to the exact 113 files (also passed as CLI filters), sets a private cache path, and records the resolved config. There is no `-t`, test-name filter, skip, source patch, mock injection, baseline update, outcome substitution, or retry.

## Identity and coverage

- Current HEAD: `b4395f929ec6a386f9aa274531efd8722ffc8252`.
- Verified prior-phase base: `e33c93afbd1b0d8824f273c62d234d66c8802323`.
- Base tree object: `bb854c6938045c387d94ddd7f69aec02acb50868`.
- Base worktree: `/home/main/z-project/rpg-zzu-life-full-p3-base-compare`.
- Base path was absent, created with `git worktree add --detach` at the exact base, immediately locked, then adopted from `/home/main/z-project/rpg-zzu` with `npm run wt -- adopt life-full-p3-base-compare --path <absolute base path>`. All three commands exited 0. See `base-worktree-receipt.json` for actual commands, timestamps, stdout/stderr, clean status and detached/locked record. Adoption reused installed dependencies and copied `.env.local`; no install occurred.
- Both dependency symlinks resolve to `/home/main/z-project/rpg-zzu/node_modules`. Observed Node v24.11.1, Vitest 3.2.4, Vite 6.4.3, vite-node 3.2.4, happy-dom 20.10.6; installed reporter/CLI hashes are pinned.
- The 113 selected files are present and byte-identical between current and base. They originally collected **1251 cases: 1032 passed, 219 failed, zero pending**. The stale baseline contains 71 of these files, with **143 failed cases**; **42 absent-from-baseline files contain 76 failed cases**. All are included, not only the 42.
- `selection.json` retains all original selected assertion records, including original passes, full failure arrays, duplicates, durations and file messages. Thus new failures within an already-baselined file cannot disappear behind filename matching.
- `manifest.json` pins input, original full receipt, mutable-location full report, and the additional immutable archive `phase3-gates/vitest-report.json`. The two report copies were byte-identical when prepared. Whole report counts were **13910 total / 13676 passed / 219 failed / 15 pending**; the completed Vitest receipt has exit1. The parent's later overall gate/surface boundary is not substituted for that completed Vitest result.
- Per-side preflight verifies HEAD, clean tracked status, product-file SHA256, all selected test bytes, config/package/env hashes, dependency realpath and reporter code. It repeats checks immediately before each command and after execution/finally. Product hashes cover tracked root files plus src/test/scripts/public/vendor/docs/openwiki/.vite-cache, excluding CLAUDE.md; clean tracked status covers other tracked files too. Read-only mounts protect all tracked bytes during execution.

## Why a filesystem/network sandbox is required

The whole-file constraint includes side effects that a plain Vitest invocation would not contain:

- `emberQuestGame.test.ts:181-189` always writes `.playwright-mcp/ember-quest.json`.
- `genrePackReceiptCli.test.ts` creates `output/evidence/genre-cli-*` fixtures and invokes the real vite-node CLI. `playerRuntimeCss.test.ts` invokes the real player build in a temporary output folder. These existing test bodies are retained; the harness itself starts no separate build/browser journey.
- `toolCatalog.test.ts` can overwrite tracked docs under `UPDATE_CATALOG=1`; surface-support helpers can create/update fixtures. The harness rejects active UPDATE/REGENERATE/BLESS variables and unexpected Node preloads/coverage output. Source/test/docs/baselines remain read-only even if a write path is reached.
- **`regionAiHouseTreeNpc.probe.test.ts:116-228` contains a live LLM case reading `.env.local` and calling the real region task. It failed in the original report.** Other store tests can also reach real persistence when mocks do not intercept all paths. No network or remote-write authorization was supplied.

Installed **bubblewrap 0.9.0** therefore supplies a no-network PID/user/mount namespace and a read-only host view. Root directory mountpoints are reconstructed in namespace tmpfs without creating directories in either real worktree. Existing output evidence is exposed read-only; newly created test artifacts are redirected into this package's unique side/artifacts directories. The old ember-quest artifact is not overwritten. All host paths, including other people's evidence and shared dependencies, stay read-only except this run's side directory and its private artifact/cache mounts.

Vite's config bundler normally writes shared `node_modules/.vite-temp` even with a custom `cacheDir`. Each side masks shared `.vite`, `.vite-temp`, `.cache` and root `.vite-cache` with distinct private directories. Nested Vite invocations also receive `VITE_CACHE_DIR=<side>/cache/nested`. `/tmp` is a private per-side evidence directory inside the namespace, not host `/tmp`. There is no dependency install, shared-cache mutation, cache warmup, browser run, or remote request that can reach the host network.

The adopted `.env.local` files differ only in DEV_SERVER_PORT (current42491, base9841); both child processes explicitly override42491. Other environment values are retained, not stripped to make tests pass. Environment identity is recorded by file hashes and an inherited-environment digest/key list, never credential values. Private run directories use mode0700; retain raw logs locally because test code may print sensitive data.

**Sandbox effects are an explicit comparison limitation, not a fix.** An attempted real network call will fail, including the live LLM case. No case is skipped or marked successful for being offline. Compare those failures as restricted-environment observations, not as proof of product regression or inheritance. Kernel namespace permissions and the complete mount/runner path have NOT been runtime-exercised by this child: only syntax/structure checks were permitted. If bubblewrap cannot start, the harness retains its real failure and marks the comparison incomplete; it never falls back to an unsafe unsandboxed run.

## Outputs and interpretation

Each invocation allocates `run-<unique>/`; it never reuses or overwrites prior evidence. Read:

1. `summary.json`, `preflight.json`, `lock.json`, `cleanup.json`.
2. `current/receipt.json`, `base/receipt.json`: exact commands, timing, real timeout-wrapper exit/signal/error, resource snapshots, raw log paths and SHA256. A normal wrapper exit is the underlying runner exit; on timeout the underlying unfinished result remains unknown, not inferred as a normal failure.
3. Each side's `report.json`, **both `stdout.txt` and `stderr.txt`**, `resolved-config.json`, and `validation.json`.
4. `comparison.json`: the union of every original/current/base case keyed by relative filename + full test name + occurrence. Missing/extra/pending cases make coverage incomplete. File-level collection errors are retained separately; missing reports never count as pass.

`pair-complete-review-required` means coverage completed, NOT no regressions or approval. Harness exit1 retains a completed red pair; exit2 means incomplete execution/integrity/cleanup. Even a zero exit is only observed test outcomes and never final Phase3 acceptance. The harness does not auto-classify causes. If a report cannot be parsed, the raw bytes/logs and receipt remain authoritative.

Cache/tmp directories belonging only to this unique run are removed after child completion and recorded in cleanup. Generated config, reports, raw logs, received values and artifact directories are retained. PID namespace teardown and `--die-with-parent` contain descendants; TERM/KILL deadlines also bound interruptions. The base worktree stays detached and locked for the parent; the harness does not unlock, remove, commit, merge or push anything. A SIGKILL of the orchestration process cannot guarantee a final cleanup receipt; preserve partial evidence as incomplete rather than reusing it.

## Reporter contract verified from installed code/help

`reporter-contract.json` records the actual installed CLI help (exit0) and source coordinates. The CLI declares reporters as an array and supports outputFile dot notation. JSON uses `getOutputFile(config, "json")`; VerboseReporter prints every failed `error.message` and inherits detailed DefaultReporter failure output. JSON's assertion serialization uses `error.stack || error.message`, explaining why **63 original failed cases in 31 files contain STACK_TRACE_ERROR** without disclosing the real message. That sentinel is not itself a timeout diagnosis. `--outputFile.json=...` separates machine JSON from verbose raw console output; do not guess a `--outputFile.verbose` file reporter contract.

## Initial hypotheses, not Phase3 classifications

`historical-observations.json` maps **every one of the 219 original failures** to the older Phase2 full report at HEAD `34c279bb6a481b18bf428fb985bc4fa4916d1e29`: **166 had failed and 53 had passed** there. It retains the complete old/new assertion records and evidence hashes. That old HEAD is NOT the verified exact Phase3 base. Matching names or stack sentinels are not matching causes.

- **Registry fixture gap:** the two actionDebounceFootprint failures have the same concrete `undefined.registry` head in older retained Phase2 evidence. The current fixture supplies runtimeDom but no game.registry, while `syncCutsceneHudVisibility` dereferences `scene.game.registry` at playSceneMapRuntime:658. This is a grounded inherited-fixture hypothesis, not a new blanket classification of unrelated tests. The exact-base pair still runs the entire file, including previously passing action cases affected by Phase3 movement changes.
- **Dashboard/module evaluation and scheduling:** databaseOverviewDashboard resets modules and uses fake timers before each case, dynamically imports store/database and exercises deferred charts; ten current failures have opaque stack sentinels. Task28 previously observed focused passes for earlier dashboard failures. Cold import costs/fake-timer interaction and full-suite contention are plausible, but the original message did not identify the stall. Do not turn approximate durations into timeout proof or treat a serial pass as a fix.
- **Persistence and lifecycle:** storeFlushShaEvidence explicitly documents pending edit-activity fetch contamination and resets it during teardown. Older store paired receipts retained nine failures on both prior trees, but current autosave/store/unsaved cases include additional or differently surfaced failures. All remain in scope; compare full received values and human cause text, not just that the filename was already red. Existing timer/microtask-driven tests are potential nondeterministic bugs; no sleep, poll, mock edit or deadline increase was added here.
- **Lexical/diff gates:** roleNameComparisonGate can fail with the same case name while its offender list changes; existing testing guidance documents that exact trap. Human received arrays are required. No filename waiver is valid, including the 143 failed cases inside stale-baseline files.
- **Execution context:** original full run was parallel/default-cache, whereas this paired run is one-worker, empty-private-cache, verbose and network-isolated. Shared OS page cache and unrelated host load are not controlled by the cooperative flock. Base-pass/current-fail is a regression candidate, not automatic causation; same complete failure on both is stronger inheritance evidence; original-fail/both-pass remains execution-sensitive and unresolved. No retries are authorized to erase any of these outcomes.

The parent's surface comparison, CSS axes, eight passing Phase3 changed-test files, full-gate boundary and final acceptance are outside this package. No duplicate surface-only execution or attribution was performed. Read AGENTS/quickstart, PROJECT_WIKI/INDEX, testing (especially diagnostic-content comparison), agent-worktree provisioning code, relevant observability guidance, original receipts/reports and the representative tests before preparing this package.
