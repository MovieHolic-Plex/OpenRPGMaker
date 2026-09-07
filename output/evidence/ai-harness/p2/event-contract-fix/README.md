# Verification publication event-contract correction

Task: st_01a078cb. Parent/root: 01a07564-2645-75ee-8627-2f0990a25d52.

## Delivered scope

- Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-event-contract-20260906`.
- Branch: `agent/ai-harness-p2-event-contract-20260906`; no upstream configured.
- Adopted base: `6f203da81c6d9d956a0e4b8d23c3f9f0a2b23c19`.
- Atomic test correction: `bc417f9fbce1b99e70cb52836d6076594b22b73b`
  (`test(ai): match final verification publication by event type`).
- Test commit tree: `16c25ac395f4d6bfeb9ae46967fb05bcf889e7db`.
- Only code change: `test/assistantVerificationEvidence.test.ts`, four added lines,
  one replaced line. Exact patch: [source.diff](source.diff).
- This evidence is a separate scoped documentation commit, not part of the test commit.

## Cause and retained contract

The supplied independent verifier log was read at
`/home/main/z-project/rpg-zzu-ai-harness-p2-20260906/output/evidence/ai-harness/p2/verify-st_01a078b9/focused-tests/command.log`.
It reports six failures at line 69 and 555 passes across nine files. Every preceding
assertion in the six verifier cases passed. The provided pre-P2 20/20 baseline is
context supplied by the lead, not an additional run performed by this task.

Source trace at the adopted base:

1. `AssistantSession.sendUserMessage` (`src/ai/assistantSession.ts:1526-1578`)
   completes the real turn through `finishRunRecap`.
2. `recordToolResult` (`:2449-2463`) observes the real verification evidence,
   preserves tool execution `ok`, and only records passing verification as success.
   `ToolVerificationEvidence.observe/passed/problems` preserves scoped negative
   verdicts and stale evidence. The six cases continue to use this real path.
3. `finishRunRecap` (`:2922-2967`) appends remaining verification problems to the
   returned assistant text and publishes that assistant message before metadata.
4. `publishRunOutcome` (`:2757-2772`) updates the returned handle with the typed
   outcome and emits it. `finishRunRecap` intentionally publishes a terminal
   `run_outcome` after `run_recap`, so the old `events.at(-2)` selects recap now.

The test now filters by `event.type === "assistant_message"` and takes the last
matching event, still requiring its complete content to equal `result.assistantText`.
This is not a search for any conveniently matching message. Missing final publication
or later incorrect assistant content still fails. ES2022-compatible `filter().at(-1)`
avoids adding an ES2023 `findLast` requirement.

Every meaningful existing assertion, all six verifier rows, the other 14 tests,
fixtures, mocks, and timeouts remain unchanged. Two additional assertions require a
present returned outcome and exact terminal `{ type: "run_outcome", runOutcome }`
agreement with that result. No production event ordering or outcome rules changed.

## RED and GREEN (one run each)

Exact command, executed directly from the assigned worktree both times:

```sh
npm test -- test/assistantVerificationEvidence.test.ts --maxWorkers 1 --minWorkers 1
```

| Run | Direct exit | Result | Duration | Evidence |
| --- | --- | --- | --- | --- |
| Unchanged RED | 1 | 6 failed / 14 passed (20) | 28.19s | `red/command.log`, `red/exit-code.txt`, `red/facts.log` |
| Corrected GREEN | 0 | 20 passed (20) | 21.10s | `green/command.log`, `green/exit-code.txt`, `green/facts.log` |

The faithful RED contains all six names, the actual `run_recap` mismatch, and the
line-69 stack. No retries, test deletion, skipping, suppression, fixed sleeps,
polling, or test timeout changes were used. Logs contain the direct npm output;
exit codes were captured immediately from the command, without a pipeline.

GREEN ran before the test commit at base HEAD plus exactly the recorded patch.
Its test SHA-256 equals the subsequently committed source SHA-256:
`26e94e2c522e2bec3a98d6a7f359e00f8f079378959b9706f23751929f3301fd`.
The unchanged RED SHA-256 is
`2fe12c82a70e1143f78407a605cde243e8b183c82d709328974c6fdc76415228`.
`committed-facts.log` binds the committed HEAD/tree/source and scope comparison.

## Diagnostics and limits

- Baseline LSP request for the test returned `No diagnostics found`.
- Post-edit LSP request timed out waiting for fresh diagnostics after 3000ms;
  this is not recorded as a clean post-edit LSP result.
- Supplemental `diagnostics.mjs` uses installed TypeScript 5.9.3 and repository
  compiler options, requests syntactic and semantic diagnostics for this test
  only, and performs no emit. Its base variant overlays the original test in memory
  through the compiler host; neither checkout nor production source is rewritten.
- `node output/evidence/ai-harness/p2/event-contract-fix/diagnostics.mjs base`
  and the same command with `candidate` both exited 0 with empty diagnostics.
  Full structured outputs and direct exits are retained in `diagnostics-*.json/txt`.
- No pre-existing typing issue was observed in this file by that scoped check.
  Quickstart documents unrelated whole-repository test typing failures; no full
  typecheck was run and no repository-wide type cleanliness is claimed.

The unchanged real AssistantSession/ToolVerificationEvidence tests are the affected
entry-point execution for this test-only correction. Per task scope, no build, full
gate, browser, content authoring, remote persistence, merge, push, or PR was performed.

## Scope and cleanup

`git diff --check` passed for the test correction. The separate evidence staging
check exited 2 because faithful Vitest logs retain their emitted trailing blank
lines, RED retains a whitespace-only stack-context line, and `source.diff` retains
a unified-diff blank context marker. These raw artifacts are intentionally not
rewritten or covered by a whitespace suppression rule. After the test commit,
tracked status was empty and the
base-to-HEAD file list contained only the target test. Explicit comparison of `src`,
`package.json`, `package-lock.json`, config paths, `.github`, and `scripts` against
base exited 0 with no diff (`committed-facts.log`). The evidence commit changes only
this evidence directory. No other tests or product files were edited.

The adopted dependencies and `.env.local` were already present; only the assigned
port value (`9841`) was inspected, not credentials. No server was started. A `/proc`
cwd-scoped check found no remaining Node/test/server process in this worktree
(`cleanup.json`). No unrelated process was killed or shared dependency cache removed.

Read before the correction/commit: root AGENTS, quickstart, wiki index/project map,
relevant testing and P2 assistant contracts, local development-ontology instructions,
and the installed shared git-master skill. Ontology classify returned only a weak
EventAuthoring keyword match; file/task queries supplied no additional mapping.
Actual source and the approved additive event contract determined the correction.
Recent history uses English Conventional Commit subjects; both scoped commits follow it.
