# Task9 backend implementation checkpoint - PARTIAL

Stopped on the parent's root-capacity instruction, 2026-09-08. No completion claim.

## Preserved scope

- Tree: `/dev/shm/task9-runtime-5xGq1G`
- Branch: `worktree/ai-job-task9-0908`, adopted base `a01e54217`.
- Main was not edited. No commit/push/PR, installs, production changes, provider/DB calls, UI/image work or shared-cache deletion.
- Modified: `README.md`, `openwiki/quickstart.md`, `openwiki/architecture.md`, `openwiki/testing.md`.
- New, untracked: `test/aiJobsRuntimeSurfaces.test.mjs`.
- This checkpoint is the only implementation handoff so far. Final `BACKEND-HANDOFF.md` has not been produced.

## Implemented but unverified

Operator docs link the existing Chromium setup, distinguish admitted-job lifetime from tab/Node/machine lifetime, specify root-hash storage and process-environment override, explain checkout moves, whole-directory stopped backup, exclusive dev/preview ownership, and the loopback queue restriction behind public preview. Existing recovery/report/apply/save details are linked rather than duplicated.

The new Node regression uses actual runner-loaded `vite.config.ts`, scopes a build to its configured worker entry, and tests dev plus emitted preview with ephemeral listeners, fresh outside-root queue/cache/build directories and GET-only session/list/worker/SSE requests. It checks byte delivery, empty durable state, an open SSE stream closing through the real server API, writer-lock release before the HTTP close event, and repository reacquisition. Parser/request negative controls are included. It temporarily isolates process environment and cwd because the real config explicitly calls `loadEnv(mode, process.cwd(), "")`; `envDir` alone would not isolate private env files. Chromium is resolved/probed before HOME isolation, never launched/installed by this test.

**No syntax, LSP, test, or build validation has run.** The new test may need corrections; do not treat its existence or documentation as verified behavior. No RED was claimed or manufactured, and no production bug was established.

## Established source facts (do not repeat the assessment)

- Installed Vite implementation, `node_modules/vite/dist/node/chunks/dep-Dm0c1Wj2.js:48370-48503`, really exposes async `previewServer.close()` and awaits configure-preview hooks. The existing queue plugin wraps this API to close service/storage before the listener. No API compatibility fix is currently indicated.
- Empty repository initialization writes `metadata.json` (`repository.mjs:100-117`), so an empty persisted snapshot can be checked without admission.
- The installed shared npm tree currently resolves `vite`, `playwright`, `typescript`, and **zod** normally from this tmpfs checkout. `require.resolve('zod')` returned `/home/main/z-project/rpg-zzu/node_modules/zod/index.cjs`. No alias was added or justified.
- `node_modules` is a symlink to `/home/main/z-project/rpg-zzu/node_modules`; all future cache/output/temp paths must remain explicitly owned in `/dev/shm`.

## Remaining exact work after parent resumes

1. Read/review the new Node regression and run syntax/LSP before its build-containing test. Correct test defects only from evidence. Keep actual-config GET-only, empty-storage, no-provider/DB safety intact.
2. Extend `test/playerBuild.test.ts` to build the actual standalone config and assert transformed module/artifact closure, preserving existing player coverage. Add a discriminating test-only virtual queue import negative control; no production edit to manufacture RED. **This file has not yet been edited.**
3. The new `openwiki/testing.md` section describes the intended standalone coverage, so it is currently ahead of implementation. Finish that coverage or reconcile the prose before shipping.
4. Regenerate `openwiki/INDEX.md` with the existing script, then check it. Not yet regenerated.
5. Run focused Node/build-closure checks and scoped worker build only when authorized after capacity stabilizes. Capture actual exits and cleanup receipts under this tree's task-9 evidence. All artifacts and caches under `/dev/shm`; no full integrated gates or ordinary family UI suite.
6. Finish reviewed `BACKEND-HANDOFF.md` with patch/file mapping, exact commands/results, cleanup proof, and pending final stable-main gates/UI acceptance. Parent owns verification/commit.

## Stop / resource receipt

No test, build, app server, browser, provider child or background process was launched during this implementation segment. Consequently there were no owned listeners/processes to terminate and no owned test/build directories to remove. All edits remain in the tmpfs tree.

The final read-only command explicitly changed to this tree, listed the four modified docs and new test, and searched `ps` for the exact tree path. It found no matching process; grep's expected exit 1 prevented the trailing diff-stat command from running. No process was killed and no files were deleted. Root free space was transiently reported as 1.1 GiB (earlier this segment 136 MiB); this does **not** override the parent's stop instruction. `/dev/shm` had approximately 47 GiB free. No further builds/tests were started.
