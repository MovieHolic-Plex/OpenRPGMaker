# S0 isolated final-validation launcher

## Delivery and scope

- Tree: `/home/main/.herdr/worktrees/rpg-zzu/worktree-final-validation-0908`.
- Branch: `worktree/final-validation-0908`; adopted HEAD `d4303a65fa738c5bf4bf8ebc2f020368cdf18b26`.
- Delivered: `scripts/qa/isolated-validation.py`, direct `test_isolated_validation.py`, this handoff, and selected value-free evidence at `.omo/evidence/ai-job-queue/verification/s0/SELFTESTS.json`.
- No product/runtime/AI/UI code, config, dependency, baseline, existing assertions or main-tree file was changed. No commit/push/PR, installation, real provider/DB request, browser launch or project gate/build occurred. Main's live palette was not captured as final source.
- **The lightweight S0 boundary is verified; parent independent verification and the real frozen-source capture are still required. N1/N2/N3/B1/B2/G1 have not run.**

## Boundary implemented

1. **No host-network fallback.** `unshare --user --map-current-user --keep-caps --net` establishes a new network/user namespace, enables only its loopback, then `setpriv` drops bounding/inheritable/ambient capabilities and enables no-new-privileges. Bubblewrap then establishes its filesystem/user/PID/IPC/UTS boundary, maps uid/gid1000, and drops all capabilities before the command. Its entry assertion checks uid/gid, zero effective/permitted/inheritable/ambient/bounding capabilities, no-new-privileges, only `lo` up, and no nonlocal IPv4/IPv6 routes. Local/broadcast loopback routes are legitimate; no default/external route exists. Descendants inherit the boundary.
2. **No host HOME or whole-root mount.** Neither host HOME, `/run`, source checkout, dependency realpath, Git metadata nor private queue/auth files are exposed. System `/usr/{bin,sbin,lib,lib64,share}`, the exact installed Node/npm/Bun inputs, font/loader configuration and the explicit managed-browser directory are read-only. `/proc` belongs to the new PID namespace; `/dev` is synthetic. `/etc/passwd`, group and hosts are synthesized with no private values. Browser bytes are opaque and unchanged.
3. **Environment allowlist, not secret-name guessing.** The child starts with bubblewrap `--clearenv`. HOME is `/home/validation`; HOME/XDG/auth/default queues are confined to fresh private mounts; `AI_JOBS_DIRECTORY=/state/jobs`; npm user/global configs are distinct empty files and cache is fresh/offline. No proxy, credential, `NODE_OPTIONS`, `NODE_PATH`, inherited Git config or agent env is forwarded. npm cannot fetch/install missing tools from the network. The parent's environment is not modified.
4. **Disk-backed private writes.** Source and installed dependency regular files are streamed into independent private files, not hard links. Vite/npm/config-bundle caches and `.git` writes land in owned copies. `/dev/shm` inside the child is a bind of the owned **disk-backed** scratch `shm` directory, so `TMPDIR=/dev/shm` is retained without placing copied builds/traces in host RAM. The existing browser alone is mounted read-only at `/dev/shm/task8-managed-chromium-cHQvga`. Scratch roots on tmpfs/ramfs are refused.
5. **Explicit fixed source.** Tracked worktree files are selected against an exact `--expected-head`. Modified/deleted tracked source needs individual `--include`; explicitly included new files are supported. Private/dotenv/auth files, agent material and output roots are excluded even if tracked. `.omo` is excluded except the three authentic gate baselines and explicitly named AI-queue evidence **code** such as the N3 driver; logs/images/receipts there cannot be included. Missing requested files fail. `UNBORN` exists only to test disposable no-commit repositories; use a full commit SHA for final verification.
6. **Capture is fail-closed.** Inotify watches are armed before reading selected contents; an event/overflow, content/stat drift, HEAD/selection change or copy-hash mismatch aborts without launching. A write-and-restore is not accepted. Regular input opens walk ancestors with `O_NOFOLLOW`; source symlinks are refused, not followed into private data. Dependency `.bin` links are reconstructed only within the copied dependency root; external/file-to-private or directory symlinks are refused. Already-installed supplemental packages can be copied explicitly with `--package name=/absolute/package-directory`; existing packages cannot be overwritten. No original source/dependency realpath is mounted.
7. **Receipts and cleanup.** The exclusive output directory retains source paths/hashes/modes, aggregate dependency identity, command-argv hash (not argv/env values), source HEAD, run UUID, owned scratch device/inode/uid/path, boundary assertions and separate sandbox/command/launcher exits. Normal command exit 23 remains 23. Boundary/launch/timeout/export/cleanup failures return 125, not success; missing executable is recorded separately from an executed failing command. `--retain-log` and exact regular `--retain` files are opt-in; symlink/private output retention fails. No private HOME/queue/source dump is retained. Inspect selected output before public delivery.
8. **Owned lifecycle.** The launcher waits on a pidfd with a bounded selector deadline, not sleeps/polling. Bubblewrap owns a PID namespace and parent-death cleanup; its exit kills even detached command descendants. SIGTERM/SIGINT and timeout clean the exact launched session, then its UUID/device/inode/uid-checked scratch. No name-based kill or shared-cache removal. SIGKILL/power loss cannot run Python cleanup: do not infer cleanup from that condition; inspect the exact retained ownership information before any recovery action.

The copied Git repository has a fresh index of selected source, no remote or original configuration/history, and **no commit**. `git ls-files` works; a test requiring original history, `HEAD` in the copied repository, excluded agent/output data, a host service, an arbitrary absolute source path, an external dependency symlink or missing installed software must fail/report that limitation. Do not restore private mounts or rewrite tests/baselines to make such a check green. This is a narrow launcher for trusted repository validators, not an arbitrary-host-secret detector, hostile-code resource limiter or general sandbox framework.

## Lightweight verification performed

All commands executed with cwd explicitly set to the validation tree above, not main.

| Check | Observed result |
| --- | --- |
| Fixture-only unsafe characterization: `S0_TEST_UNSAFE_BASELINE=1 ... python3 ... test_isolated_validation.py Boundary.test_boundary` | RED exit 1: `checkout privacy boundary absent`. It executes only a disposable fixture check, not a missing launcher import or a live project. No unsafe launcher mode exists. |
| Initial full boundary run | 11 tests, one failed: npm rejected double-loading `/state/npmrc` as both user/global config. The launcher was corrected to use two empty private files; failure output is retained, not relabeled. |
| Final `PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 -I -S scripts/qa/test_isolated_validation.py -v` | **12 tests passed in one run, 4.276s, exit 0; no skipped cases.** Use `-B` in future invocations below so the host test loader does not emit a Python bytecode cache (`-I` ignores PYTHON* environment flags). |
| Final LSP, both Python files | No diagnostics, before final self-tests. Earlier style warnings were corrected, not suppressed. |
| Python AST parsing of both files; whitespace checks | Passed. No project build was run. |
| Independent receipt/resource check | 19 final receipts; every owned scratch removed; no process with a recorded owned work-directory device/inode remained. Actual recorded launcher exits include 0, 23 and 125. |

The tests use fake tracked checkout env/agent/output files, fake HOME/auth and dependency env values. The normal boundary case proves that the original source/dependency/private byte hashes remain unchanged despite child source/cache/Git/HOME writes; no sentinel value reaches retained output. An actually listening parent loopback socket is reachable from the parent but refused from both child and grandchild. The child serves/reads its own loopback HTTP response. A detached, TERM-ignoring descendant acknowledges readiness before parent exit and cannot survive PID-namespace teardown. Capture mutation is triggered synchronously at the real copy boundary; launch denial and SIGTERM exercise actual cleanup. Only launch/copy seams are fault-injected; no successful sandbox behavior is mocked.

Retained raw lightweight evidence (intentional, outside served roots):
- Final: `/var/tmp/s0-boundary-green-sKyrzx0B/tests.log`, `tests.exit` and its value-free receipt subdirectories.
- Earlier npm-config failure: `/var/tmp/s0-boundary-evidence-ChOZJJa5/tests.log`, `tests.exit` and receipts.
- Portable selected summary/receipts: `.omo/evidence/ai-job-queue/verification/s0/SELFTESTS.json` (ignored evidence subtree; parent must explicitly retain it when integrating).

No full real-source/dependency capture was performed, and no managed Chromium process was started. Node/npm/Bun **version commands only** ran inside the boundary and passed. The original global browser cache remains untouched; the explicit managed directory is only exposed read-only.

## Parent safe invocations (not executed here)

### 1. Independently verify S0 first

```bash
cd /home/main/.herdr/worktrees/rpg-zzu/worktree-final-validation-0908
/usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/usr/sbin:/bin LANG=C.UTF-8 \
  /usr/bin/python3 -I -S -B \
  /home/main/.herdr/worktrees/rpg-zzu/worktree-final-validation-0908/scripts/qa/test_isolated_validation.py -v
```

This command uses only disposable fixture repositories, existing tools and loopback. It is not a project test/gate run. Failure must stop progression; no host-network retry.

### 2. Capture only after GROK finishes and parent approves the source set

Set `S0_SOURCE` to the absolute frozen source tree, `S0_HEAD` to its **full verified HEAD**, and list every approved tracked modification/deletion/new file as its own `--include`. Do not automatically accept whatever a moving tree currently contains. Include the N3 helper from the outset so all later commands share the same manifest. The launcher does not use ambient environment configuration for these choices.

```bash
cd /home/main/.herdr/worktrees/rpg-zzu/worktree-final-validation-0908
set -euo pipefail
: "${S0_SOURCE:?parent must supply the frozen source tree}"
: "${S0_HEAD:?parent must supply its verified full HEAD}"
S0_OUTPUT_ROOT=$(/usr/bin/mktemp -d /var/tmp/s0-supervisor-XXXXXXXX)
S0_INCLUDES=(--include .omo/evidence/ai-job-queue/task-9/verify-build-closure.mjs)
# Append individual parent-approved --include paths to S0_INCLUDES as needed.
S0_PIN=()
S0_RETAIN=(--retain-log)
S0_PACKAGES=()
# Only if needed and already installed: --package name=/absolute/package-directory.

s0_check() (
  cd /home/main/.herdr/worktrees/rpg-zzu/worktree-final-validation-0908 || exit
  label=$1; shift
  /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/usr/sbin:/bin LANG=C.UTF-8 \
    /usr/bin/python3 -I -S -B \
    /home/main/.herdr/worktrees/rpg-zzu/worktree-final-validation-0908/scripts/qa/isolated-validation.py \
    --source "$S0_SOURCE" --expected-head "$S0_HEAD" \
    --dependencies /home/main/z-project/rpg-zzu/node_modules \
    --browser /dev/shm/task8-managed-chromium-cHQvga \
    --bun /home/main/.bun/bin/bun --scratch-root /var/tmp \
    --output "$S0_OUTPUT_ROOT/$label" --timeout 7200 \
    "${S0_INCLUDES[@]}" "${S0_PIN[@]}" "${S0_PACKAGES[@]}" "${S0_RETAIN[@]}" -- "$@"
)

s0_check capture /usr/bin/true
# Stop on nonzero; inspect source.json and receipt.json before accepting the hash.
# Assign S0_SOURCE_SHA from that inspected receipt, not from a guessed/future tree.
: "${S0_SOURCE_SHA:?parent must accept the capture receipt sourceSha256}"
S0_PIN=(--expected-source-sha256 "$S0_SOURCE_SHA")
```

Commands start in `/work`, with the fixed environment described above. Each invocation uses a fresh disk copy and empty private state; the pin enforces identical selected source across invocations. Compare `dependenciesSha256` too if installed dependencies change. The private source is writable for validators, but changes never propagate to original code or dependencies. To test build/preview or restart continuity using the same generated output/repository, run those ordered steps **inside one authorized invocation**; independent invocations intentionally do not share state.

The capture-only command above is a **future parent action**, not a claim this session captured main. It must not run while GROK is still changing the intended input. No command below is authorized merely by appearing in this document.

### 3. Exact N1/N2/N3/B1/B2/G1 payloads behind that boundary

Run sequentially with one heavy workload. Preserve failure exits/output and compare the authentic baseline under the same isolation; no retries/deadline changes/baseline saving. LSP on final changed files belongs before build-containing checks. `--timeout` is a launcher workload bound, not a test deadline adjustment.

```bash
# All examples use the s0_check function above (explicit validation-tree cwd).
s0_check N1 node --test --test-concurrency=1 \
  test/aiJobsRepository.test.mjs test/aiJobsHttp.test.mjs \
  test/aiJobsScheduler.test.mjs test/aiJobsBrowserExecutor.test.mjs

s0_check N2 npm test -- --maxWorkers=1 --no-file-parallelism \
  test/aiJobCanonicalReplay.test.ts test/aiSessionJobHost.test.ts \
  test/aiJobWorkerIsolation.test.ts test/aiJobWorkerRouting.test.ts \
  test/aiRegionJob.test.ts test/aiDatabaseJob.test.ts test/aiImageJob.test.ts \
  test/aiEventCommandsJob.test.ts test/aiTilesetJob.test.ts \
  test/aiJobApplication.test.ts test/aiJobIdentity.test.ts \
  test/aiApplyActivityLabels.test.ts test/aiJobReports.test.ts

s0_check N3-surfaces node --test test/aiJobsRuntimeSurfaces.test.mjs
s0_check N3-closure node .omo/evidence/ai-job-queue/task-9/verify-build-closure.mjs
s0_check N3-setup node --test --test-concurrency=1 \
  test/aiJobsRuntimeSetup.test.mjs test/setupLocal.test.mjs test/macLauncher.test.mjs

s0_check B1-typecheck npm run typecheck:app
s0_check B1-build npm run build

# B2 is blocked until the parent verifies an already-installed tsx/dependency closure.
S0_RETAIN=(--retain-log --retain dist/nonui-qa-standalone.html)
s0_check B2 npm run build:standalone -- --out dist/nonui-qa-standalone.html

S0_RETAIN=(--retain-log --retain .omo/gates-vitest-report.json)
s0_check G1 npm run gates -- --json
```

- **B2 prerequisite is unverified/missing at narrowly checked paths.** No `tsx` was found in the selected dependency root, `/home/main/node_modules`, `command -v tsx`, or the checked `/usr/{local/,}bin` and corresponding `.bin` entries. This is not an exhaustive machine inventory. Do not run an installer or permit npx online fallback. Parent may explicitly provide a verified already-installed package closure; otherwise report B2 blocked. `npm run build` does not assemble standalone HTML.
- B1's SDK/bundles and N3's actual scoped config builds are distinct gates. Opt-in retain paths must be exact regular output files; directories/symlinks are rejected. Default scratch deletion is intentional. A missing selected report/artifact is an export error (125), while an executed command's actual exit remains separately recorded.
- G1 receives the built-in one-worker Vitest pool env. The full gate still compares failing **files**, not assertion deltas inside previously red files; retain/review detailed JSON. No `--only`, baseline rewrite/update env, skipped test or prose-assertion change is supplied by S0.
- This launcher is not the Task8 controlled provider/persistence fixture. All later family UI work still requires that fixture and its dedicated config, not ordinary Vite/page-only mocking or shared 9841/19841 endpoints. No family/UI/preview/gameplay acceptance is claimed.

## Final state and remaining ownership

The host test loader emitted one bytecode file for the newly created launcher because `-I` ignored the environment flag. Its exact uid1000/inode41961185 file was removed; no shared cache was deleted. Future commands use `-B`. The exact validation-tree language-server process check found none.

The S0 fixture workloads/listeners/descendants and their scratch directories were cleaned; only the named lightweight evidence outputs are intentionally preserved for supervisor inspection. No shared source/dependency/browser cache was removed. Parent owns independent verification, integration with preserved UI changes, actual frozen-source capture, full project gates/builds/runtime checks, final cleanup review and delivery. No integrated approval or production-defect conclusion follows from these lightweight boundary tests.
