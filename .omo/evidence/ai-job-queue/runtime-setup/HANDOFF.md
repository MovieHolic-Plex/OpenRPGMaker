# Task9 independent runtime provisioning slice - handoff

Completed 2026-09-06 for task `st_01a077f3`. This delivers explicit managed Chromium
provisioning only, not the remainder of Task9 or concurrent Task7 UI work.

## Worktree and integration ownership

- Worktree: `/home/main/.herdr/worktrees/rpg-zzu/worktree-ai-runtime-setup-0906`
- Branch: `worktree/ai-runtime-setup-0906`
- Base/unchanged HEAD: `db9f9748608b28af7da235fd5be77d34806702d2`
- No commit, staging, push, PR, dependency installation, environment rewrite, real
  browser download, system-package installation, sudo, paid call, or user Supabase write.
- Caller silver-harbor worktree was read only for the requested integration draft.
- Supervisor owns review, verification, staging/commits and integration. This repository's
  `.gitignore:19` ignores new `.omo/evidence/*` paths; explicitly force-add this evidence
  directory when committing it. No ignore rules were changed.

## Exact changed files

1. `package.json`: adds `setup:ai-runtime`; no dependency or lockfile changes.
2. `scripts/setup-local.mjs`: new explicit runtime branch and exported `setupAiRuntime`;
   narrow `runCommand` abort/cancellation cleanup extension. No separate production helper.
3. `scripts/lib/aiJobs/browserExecutor.mjs`: missing-runtime recovery message only;
   no scheduler, admission, execution or provider behavior change.
4. `test/aiJobsRuntimeSetup.test.mjs`: 15 focused tests using temporary npm-layout fixtures,
   actual copied CLI/process execution, and injected process boundaries.
5. `openwiki/quickstart.md`: runtime prerequisite, command, ownership and recovery notes.
6. `openwiki/testing.md`: focused test/evidence contract and supervisor boundary.
7. `.omo/evidence/ai-job-queue/runtime-setup/`:
   - `HANDOFF.md` (this file)
   - `red.txt` (meaningful pre-implementation CLI failure)
   - `initial-focused.txt` (intermediate fixture failure, preserved rather than hidden)
   - `green.txt` (final 50-test pass)
   - `verify-installed.mjs` (repeatable read-only acceptance; refuses installer in API probe)
   - `installed-runtime.json` (actual installed-runtime acceptance)
   - `installed-runtime.stderr.txt` (empty: no acceptance stderr)

Existing `test/setupLocal.test.mjs`, `test/macLauncher.test.mjs`, and
`test/aiJobsBrowserExecutor.test.mjs` were run unchanged.

## CLI/API and behavior

User CLI from the checkout:

```sh
npm run setup:ai-runtime
# Equivalent:
node scripts/setup-local.mjs --ai-runtime
```

Node 24 remains required by the guarded setup CLI. No argument retains the existing
`ensureDependencies -> setupLocal` private Supabase wizard path. All other arguments,
including repeated flags and extra credential-like values, fail with `ARGUMENTS` before
any setup action. The Mac launcher and its private credential/env behavior are preserved.

New API: `setupAiRuntime({ root, signal, run = runCommand, log = console.log })`.
`root` is the absolute npm checkout path. It returns `{ installed: boolean }` only after
successful probe and browser closure. The injected `run` boundary is for isolated testing;
normal job execution never imports or invokes this provisioning API.

- Resolve the checkout's actual `node_modules/@playwright/test/package.json`, including
  adopted worktree symlinks. Resolve its matching transitive Playwright runtime and CLI bin
  from the same installed npm tree; reject NODE_PATH/global packages and mismatched versions.
- If the matching executable is missing (`ENOENT`), run exactly
  `process.execPath <resolved-local-playwright-bin> install chromium`, with `shell:false`.
  Chromium support artifacts selected by Playwright are included; no Firefox/WebKit,
  `--with-deps`, package-manager fallback, or system-library installation.
- Recheck executable access, then launch that exact executable headlessly in a Node-owned
  probe subprocess with a 15-second Playwright launch timeout and `finally` browser close.
  Present/usable runtime succeeds without any installer invocation. Present/unusable runtime
  fails rather than silently reinstalling or changing cache permissions.
- Runtime-only setup does not invoke `ensureDependencies`, parse or write `.env*`, ask for
  settings, contact Supabase/providers, open an app page, or start the local server.
- Raw child output is withheld. Errors are value-free `SetupError` codes:
  `AI_RUNTIME_PACKAGE`, `AI_RUNTIME_ACCESS`, `AI_RUNTIME_INSTALL`, `AI_RUNTIME_PROBE`,
  `CANCELLED`; messages explain prerequisite checks and retry command without private values.
- `runCommand` keeps its original first two parameters and ordinary spawn options. It also
  accepts `signal`, `signals` (event source), and `spawnProcess` (spawn boundary) in options.
  Cancellation is latched even if a child exits zero, waits for child close, and removes
  signal listeners. Pre-aborted work never spawns. A supplied controller owns OS forwarding
  to avoid duplicate signals. Existing no-signal SIGINT/SIGTERM forwarding remains intact.
- Restart an already-running local server after successful provisioning to refresh its
  unavailable executor snapshot. The production recovery message now says this explicitly.

## TDD and focused validation (actual commands/exits)

All commands below were executed with explicit `cd` to the assigned worktree above.

### RED before production implementation

```sh
node --test test/aiJobsRuntimeSetup.test.mjs
```

Exit **1**, one behavior test failed: the actual copied existing CLI rejected
`--ai-runtime` with `ARGUMENTS`, returning 1 instead of the required 0. No missing import,
undefined export or syntax error served as RED. Exact output: `red.txt`.

### Intermediate focused run (recorded failure, corrected)

```sh
node --test test/aiJobsRuntimeSetup.test.mjs test/setupLocal.test.mjs test/macLauncher.test.mjs
```

Exit **1**, 37 passed / 1 failed. The new no-argument preservation test's fake npm executable
used `require` inside an ESM fixture and caused `NPM_MISSING` instead of `CONFIG_EXISTS`.
Corrected that fixture to use ESM; production ordinary setup and all existing tests passed
in this run. Output: `initial-focused.txt`. This was a fixture bug, not a pre-existing failure
or timing retry.

### Final GREEN (single invocation)

```sh
node --test test/aiJobsRuntimeSetup.test.mjs test/setupLocal.test.mjs test/macLauncher.test.mjs test/aiJobsBrowserExecutor.test.mjs
```

Exit **0**, **50 passed / 0 failed / 0 skipped / 0 cancelled**, 4.77 seconds.
Output: `green.txt`. This includes installed-browser executor boot against a temporary
loopback static fixture, with provider dispatch forbidden, and the original setup/mac
preservation checks. No full app server or assigned port 9841 was used.

Runtime tests cover exact nested local installer selection, missing browser installation,
already installed no-op, installer failure/false success, probe/close failure, missing
package/CLI, global and mismatched-version rejection, invalid arguments, ordinary CLI
protection, existing env byte/inode/mode/mtime preservation, no process-env mutation,
pre-abort, signal forwarding, zero-exit cancellation, spawn failure listener cleanup,
actual fixture installer/probe child reaping and cancellation between phases. Event
subscriptions/readiness precede cancellation; no sleeps or polling.

### Syntax, diagnostics, review

Each of these commands exited **0**:

```sh
node --check scripts/setup-local.mjs
node --check scripts/lib/aiJobs/browserExecutor.mjs
node --check test/aiJobsRuntimeSetup.test.mjs
node --check .omo/evidence/ai-job-queue/runtime-setup/verify-installed.mjs
git diff --check
```

LSP reported **no diagnostics** for each changed `.mjs` production/test/evidence file.
`package.json` LSP was unavailable because Biome is not installed; no tool was installed.
The file was parsed using Node and its exact new script value validated successfully.
Markdown has no configured LSP; documentation was read-reviewed. No prose-lock tests added.

## Actual installed-runtime acceptance

First, a local package-resolution/access check established installed Playwright **1.61.0**
and an executable managed Chromium. No installer was invoked for that check.

```sh
node .omo/evidence/ai-job-queue/runtime-setup/verify-installed.mjs
```

Exit **0**, stderr empty. `installed-runtime.json` records:

- Linux, Node **24.11.1**, Playwright **1.61.0**, Chromium **149.0.7827.55**.
- API probe returned `{ installed: false }`; its injected run boundary rejected any attempted
  installer. Exactly one probe child was observed closed with code 0 and PID absent afterward.
- Actual **`npm run setup:ai-runtime`** exited **0**, reporting successful probe without download.
- Independent real browser launch/close emitted `disconnected`; `isConnected()` was false.
  No page, context, provider endpoint or Supabase target was opened in this acceptance script.
- Existing managed executable metadata unchanged; both existing env files retained exact
  bytes/inode/size/mode/mtime, and process environment remained unchanged. Values and hashes
  were not written to evidence.
- Zero real browser downloads, app servers, provider calls or Supabase requests.

## Assumptions, limitations and cleanup

- This slice targets the repository's existing npm dependency layout, including nested or
  hoisted Playwright and adopted shared `node_modules`; it does not redesign provisioning
  for other package managers or resolve arbitrary independently linked package trees.
- Real missing-browser download/failure QA is deliberately fixture-only. Download transport,
  proxy infrastructure and OS-library provisioning were not exercised or modified.
- Probe cancellation uses real child fixtures that model Playwright signal cleanup; existing
  installed Chromium was actually launched/closed. No real download was interrupted.
  Installed Playwright's downloader source also closes its download worker on IPC disconnect.
- Failed/cancelled user installations may retain partial cache files. Nothing deletes shared
  caches, repairs OS libraries or installs npm dependencies in runtime-only mode.
- Linux evidence does not establish macOS/Finder behavior. No app build or full gates were run,
  per slice scope. Package JSON/Markdown LSP limitations are stated above.
- All test temporary roots were registered for removal. Final `/tmp` inspection found no
  `RPG runtime setup space *` fixture directories. Owned fixture/probe children were reaped;
  real browsers closed, temporary HTTP/Vite test fixtures shut down through existing teardown.
  No process on 9841 was started, reused or killed, and no persistent app server remains.

**Supervisor-owned remainder:** complete Task9 dev/production preview integration and service
lifetime checks, player/static-export isolation, remaining documentation/migrations,
full build/typecheck/gates and same-base failure analysis, final end-to-end acceptance,
review, commits and integration. This slice is ready for that integration, not a claim that
Task9 or the full queue rollout is complete.
