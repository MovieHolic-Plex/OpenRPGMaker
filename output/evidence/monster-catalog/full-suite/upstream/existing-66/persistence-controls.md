# Three persistence assertions: controlled-response classification

## Outcome

All three formerly unresolved persistence assertions reproduce the exact frozen error messages on unchanged pristine `142db78e9` tests. They are classified **preexisting, reproduced under controlled external responses**. This is not proof of what any actual DB service returned.

Only these three assertions executed. Two Vitest processes both exited 1, with three failed assertions, zero passed assertions and zero captured unhandled errors. The targeted storePersistence run reports ten other tests as skipped because of the requested name filter; they were not rerun. The 66-file suite and live model were not rerun.

| Unchanged test | Controlled external response | Frozen and pristine outcome |
|---|---|---|
| `storePersistence.test.ts` / `reports why DB persistence is unavailable for local dev showcase projects` | A synthetic HTTP 401 from the fetch seam for GET `/rest/v1/projects`, with body `{\n  "message":"Invalid authentication credentials"\n}` | Exact `LegacyDbProjectSyncError` and body; thrown at `store.load()` before the asserted disabled/dev-showcase status |
| `unsavedChangesGuard.test.ts` / `devProject 모드: 변경→true, flush(로컬 기록)→false` | In-memory project read and successful conditional PATCH acknowledgement | Exact `AssertionError: expected 'saved' to be 'saved-local' // Object.is equality`, at test line 39 |
| `unsavedChangesGuard.test.ts` / `freshProject(저장 스킵) 모드: flush가 saved-local이어도 미저장으로 남는다` | Same in-memory read/save protocol, reset to the original project per test | Exact same error, at test line 58 |

Full assertion names, complete normalized messages and stacks are retained in `persistence-controls-classification.json`. The two unsavedChangesGuard normalized stacks also match completely. Authentication stacks have the expected baseline/frozen source-line offsets from added imports; their error messages match exactly.

## Controls and actual exercised behavior

- A separate diagnostic setup file installed only a `globalThis.fetch` seam. No application methods, source files, or test assertions were replaced. In particular, `store.load`, `store.flush`, deserialization, map merge, serialization, SHA generation, dirty-state transitions and error wrapping remained real pristine code.
- Synthetic configured values were `VITE_LEGACY_DB_URL=http://127.0.0.1:1`, `VITE_LEGACY_DB_ANON_KEY=test-anon-key` and the existing test's project-id literal. The authentication test itself overrides the URL to `http://dbserver:8100`; the seam intercepts that string without connecting to it.
- No native fetch is invoked by the seam. Existing network/credential-read guards remain underneath it. No loopback server, actual DB service or credential file was accessed. HTTP-looking PATCH/POST records in the trace are in-memory calls, not DB writes.
- The success response starts from the real pristine `createBlankProject()` serialized by the real pristine serializer. The resulting 2,451,024-byte seed has SHA-256 `e83bd501e9d20e8c57f5bca845516ae92a5879634c3ac15b73e00697fda9c003` and is retained as `persistence-control-seed.json`.
- The seam maintains an in-memory project row, including the current SHA. It validates project payload shape and conditional SHA equality before acknowledging a save, rather than mocking `flush()` to return `saved`.
- Traces show each real test loading a project, loading the map overlay, reading the project again for save merge, and issuing a conditional PATCH with its actual edited title (`미저장 변경` / `증발 위험 변경`). The pristine persistence path then returns `saved`; the original assertion fails at the same line as frozen.
- The authentication control supplies the body as external response bytes. The real `loadProjectSnapshotFromLegacyDb` reads `response.text()` and constructs `LegacyDbProjectSyncError`; the error itself was not mocked.

## Cause and minimal proposed correction

The unchanged tests import store directly after `vi.resetModules()` but do not install its dev-project factory. Pristine `store.ts:205-208` initializes `devProjectFactory` to null; app boot installs `createDevShowcaseProjectForLocation` in `src/app/mode.ts:85`. In `store.load()`, local showcase mode is selected from that injected factory, not from URL flags alone. Consequently, these tests take the remote persistence path despite using `?devProject=1` / `?freshProject=1`.

That already-existing branch explains both controlled outcomes:

1. A rejected remote load yields the external authentication body wrapped in `LegacyDbProjectSyncError`.
2. A successful remote load plus acknowledged save yields `saved`, not `saved-local`.

The frozen diff only adds monster-metadata reconciliation to the store's saved-response path and map-merge save path; it does not add this dev-project routing behavior or the authentication-error wrapper. No new persistence regression is supported by these three assertion signatures.

Minimal test correction for the parent: install the same dev-project factory as production after each module reset and before store load, with isolated storage and explicit offline boundary behavior. Keep the original local persistence and dirty-state assertions. Do not change the production return value to `saved-local` merely to satisfy tests that entered remote mode.

## Preserved control limitations

The success run also observed an asynchronous commit-audit POST to `/rest/v1/project_changes`, outside the modeled routes. The control explicitly rejected and logged it; the pristine fire-and-forget commit logger handles that error. Two post-teardown requests hit the original network-block guard (`/__oprn/edit-activity` and `/rest/v1/project_commits`). These events are retained in the trace/classification and are not claimed successful. They do not alter the reproduced project-save assertions, but this control is not validation of ancillary audit persistence. Trace labels identify the then-current fetch seam; an asynchronous audit call labeled with the second test can originate from the first test's work.

Zero unhandled rejections were captured in these two additional runs. The twelve unhandled rejections from the original 66-file run remain preserved and unchanged in that earlier evidence.

Post-run Git-blob audits again verified 4,982 files in both the shared pristine source and its isolated mirror, with no missing or modified files. All runtime temporary files use owned `/dev/shm` paths. No source/config/test edits in the project, integration execution, credentials, DB writes, or commits occurred.

## Evidence

- `persistence-controls-classification.json`: three exact comparisons, exit receipts, source audits, guard events and limitations.
- `persistence-authentication-error.json`, `persistence-success.json`: actual native Vitest reports.
- Corresponding `-exit.json`, `-errors.json`, `-fetch.jsonl`, `.log`, and available `-audit.jsonl`: receipts, errors, request/response evidence and guard events.
- `persistence-control.setup.ts`, `persistence-control.config.mjs`, `run-persistence-controls.py`: external diagnostic harness and exact commands.
- `persistence-frozen-paths.diff`: relevant pristine-to-frozen source diff.
- `assertion-classification-after-persistence-controls.json`: cumulative 66-file classification, with only these three decisions updated. The previous classification remains intact as historical evidence.

Cumulative result: 137 exact-message reproductions (including these three controlled-response cases), two timestamp-only differences, and one unresolved live-region assertion being investigated by the parent. This supplement makes no claim about the parent's later regression fixes or build results.
