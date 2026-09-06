# Isolated Chromium execution - supervisor evidence

Date: 2026-09-06. Scope: task 3, real assistant execution; remaining families and UI are not claimed.

## RED and characterization

Read worker `red-isolation.log`: the actual graph reached `project/store.ts`,
`mapEditHistory.ts`, `editorState.ts` and `applyChangesetToStore.ts`, failing the
empty-forbidden-import assertion. This was a behavior/graph failure, not a missing import.
Worker's foreground characterization preceded extraction; boundary tests subsequently
covered malformed input, incomplete output and unnecessary full-project journals.

## Supervisor tests

Monitor `mon_KRNKXBAE5PBAZARZ` completed exit 0:

```sh
npm test -- --maxWorkers=4 test/aiJobWorkerIsolation.test.ts test/aiSessionJobHost.test.ts test/aiMilestoneTurnAccounting.test.ts test/assistantSessionIntent.test.ts test/assistantSessionCompaction.test.ts test/assistantSessionYield.test.ts test/historyRevertTool.test.ts test/toolDomainScoping.test.ts test/showMapRegion.test.ts test/renderGroupSampleTool.test.ts test/mapCanvasTexture.test.ts test/eventCommandAssist.test.ts test/runtimeEventPageMovement.test.ts test/regionSnapshot.test.ts
node --test test/aiJobsBrowserExecutor.test.mjs test/aiJobsHttp.test.mjs test/aiJobsScheduler.test.mjs
npm run typecheck:app
```

Observed: 14 Vitest files / 128 tests passed; 28 Node tests passed; app typecheck passed.
LSP checks returned no diagnostics on session core/host, worker entry, parsers,
assistant executor, browser/provider adapter and Bun provider worker.

## Real browser and provider process

Supervisor ran:

```sh
node .omo/evidence/ai-job-queue/task-3/browser-proof.mjs
node .omo/evidence/ai-job-queue/task-3/provider-runtime-proof.mjs
```

Monitor `mon_29P1XT6EZVVKHZHR` completed exit 0. It drove actual Chromium and real
AssistantSession/tool execution with a controlled HTTP provider boundary:

- Job `68dfdc7d-0bd6-4e1b-b3cf-59e283984505` was admitted, then the submitting
  browser closed while its provider response was held.
- Generation completed with application awaiting-review and save unsaved. The
  isolated draft contained the expected item, and the submitted project did not.
- Restart retained the exact result and three provider responses.
- Actual multi-entry app build emitted a worker closure of 5 chunks / 606 modules,
  with no editor/store/PWA boot.
- Built preview job `4a4d3b00-b5f6-4a7b-a0b4-c06aba35c871` completed through three
  wire operations. Owned browser was disposed.
- Cancellation/shutdown signalled the provider and closed owned contexts/browsers.
- Actual Node adapter spawned the installed Bun worker using the existing controlled
  runtime stub and awaited its process termination. No paid provider or user DB write.

The browser screenshots are fixture submission/result surfaces, not the forthcoming
user-facing inbox/report UI. The proof script, action log, request graph and durable
result are retained in this evidence directory.

## Review and cleanup

Supervisor reviewed the new boundary modules and copy-aware diff: the session core is
98% copied from the prior session, with explicit host seams; the foreground wrapper
retains its previous default behavior. Provider identity is captured, not substituted.
Snapshot/checkpoint parsing uses project validation, and incomplete stops are retained.

Cleanup: proof scripts removed owned temporary repositories/build outputs and closed
HTTP/browser/Bun resources. Supervisor `ss -ltnp` found no `:19841` listener. Pre-existing
`:9841` was untouched.

Worker documented three unrelated baseline failures in the broader map-edit/tile-graft
suite; they were not deleted, skipped or edited. Final whole-repository gates will
compare against the repository baseline rather than infer full-suite success here.
