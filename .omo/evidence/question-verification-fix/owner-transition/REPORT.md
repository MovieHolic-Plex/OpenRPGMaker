# Request-owner transition correction: frozen follow-up

This follow-up supersedes the prior frozen source hashes in `../REPORT.md`.
All earlier reports, logs, patches and manifests remain untouched as historical
verification of their original bytes. The earlier app build does NOT verify this
follow-up's changed production bytes.

Task st_01a07fa8; model observed again: `gpt-6-astra`.
Integration `/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570`.
HEAD unchanged: `57757e41e0c233ee9ca9ef9f45ef5057ccdb1571`.
No commit, UI/helper change, schema/persistence change or full build.

## Observed RED before production changes

Added the real-session regression:
`assistantQuestionVerification :: current-question native verification ownership :: retires question B evidence when Resume restores A before raw Ask continuation`.

The complete question-verification file ran first on prior frozen production
SHA-256 `68717c8303413dabe110b2127f70ad0f4f41207915c9467d6fa89b0a29a577d4`.
Result: **1 failed, 11 passed; exit 1** (`red.log`, `red.json`, `red.exit`).

The test observed all of these before the failing assertion:
1. Authoring A has request ID `request-1` and a real retained `set_title_screen` draft.
   Its anchored canonical `toolVerdict(run_lint,{})` remains unverified; no lint ran in A.
2. Question B has request ID `request-2`, state `answer`, and an actual registered
   `run_lint` result `{ok:true, pass:false}`. Its RunOutcome is blocked.
3. Explicit Resume restores `request-1` without a new checker invocation.
4. Raw `continue` with composerMode Ask retains `request-1`, state `answer` and has
   zero tool calls in that send.
5. Despite that ownership, the response incorrectly repeats B's real lint failure:
   `검증이 아직 통과되지 않았습니다.\n- run_lint: 침엽수 상단(260)은 하단(290) 바로 위에 있어야 합니다.`

The same-ID Ask-continuation retention control passed in that same RED run.
This distinguishes the actual evidence leak from a new request being created, an
A-owned failed checker, or a model-only claim.

## Minimal confirmed correction

One additional production line in `src/ai/assistantSession.ts`, directly before
Resume restores `this.currentRequestId`:

```ts
if (this.currentRequestId !== request.requestId) this.answerVerificationEvidence.clear();
```

The existing new-request clear stays unchanged. Same-ID continuation does not clear
its own failed check. All currentRequestId assignments were inspected: new-goal
retirement/new-request creation already clear via the existing new-request branch;
the restored-ID branch was the missing ownership boundary. No separate evidence
owner ID, completion mechanism, schema or helper was introduced.

Cumulative production patch versus HEAD: **14 insertions, 4 deletions** (one more
insertion than the earlier correction). The new regression adds the exact transition;
the wiki documents Resume changing owners. The original audit regression is unchanged
from the preceding freeze and continues using real run_lint.

## Observed GREEN and current checks

- Three complete files: **46 passed, 0 failed; exit 0** (`green.log`, `green.json`, `green.exit`).
- The new transition regression and same-ID Ask-continuation control both pass.
- A's final Ask receives the normal scripted answer, with canonical outcome
  `{execution:"response-final", goal:"incomplete", delivery:"no-change"}`.
  The incomplete goal is A's still-unverified source obligation, not B's checker.
- No final-Ask checker or write executes. A's raw source and draft remain unchanged;
  B's previous result remains blocked and immutable. Result/recap/harness/final event
  publication agree. Existing current-failure, exact-scope, freshness, question
  authority and explicit-resume contracts also pass in these complete files.
- LSP on changed `assistantSession.ts` and `assistantQuestionVerification.test.ts`:
  **No diagnostics found**, before app typecheck.
- Refreshed `npm run typecheck:app`: **exit 0** (`typecheck-app.log`, `.exit`).
- `git diff --check`: exit 0.
- `git diff --quiet HEAD -- src/editor test/requiredOutcomeFixture.ts test/e2e`: exit 0.

Exact commands, all from integration:

```sh
# Every test/typecheck shell used command-local ulimit -c 0; no core dumps.
# RED: exit 1
node scripts/run-vitest.mjs run test/assistantQuestionVerification.test.ts --configLoader bundle --maxWorkers 1 --minWorkers 1 --reporter verbose --reporter json --outputFile.json .omo/evidence/question-verification-fix/owner-transition/red.json

# GREEN: exit 0
node scripts/run-vitest.mjs run test/assistantFinalAudit.test.ts test/assistantQuestionVerification.test.ts test/assistantQuestionAuthority.test.ts --configLoader bundle --maxWorkers 1 --minWorkers 1 --reporter verbose --reporter json --outputFile.json .omo/evidence/question-verification-fix/owner-transition/green.json

# Current bytes: exit 0
npm run typecheck:app
```

Runner stdout/stderr are captured together in the matching log. Each `.exit` was
written immediately from the actual command status, without a pipeline.

## Current frozen files and limits

- assistantSession.ts: `8c4d6231a3f8024afecd5de42511e2eacd1643504ed47801cec77a6d3f6c14ae`
- assistantFinalAudit.test.ts: `99e9266043d910bf597ad884f6e57df41ff3074c1c616e3cce1057fb065311fe`
- assistantQuestionVerification.test.ts: `c52006df2c98ffecc53c6f4d67e2082594bede057f002e4c95df57c82623e856`
- editor-ai-panel.md: `f75273f9f39333f581694743d058d01a92450fb8d0084681b32aadc5562611e3`

`core.patch` and `fix.patch` here are the CURRENT cumulative production-only and
production/test/wiki patches versus HEAD; parent-directory patches remain historical.
`frozen-files.sha256` and `evidence.sha256` here freeze this follow-up.

Architectural review: the correction owns only request-identity transition lifetime.
No parser, helper, type escape, tagged variant, new parameter, defensive null layer,
logging or persistence owner was added. The test uses real session/native tools,
scripted model transport and deterministic send settlement, with no sleep or polling.
The test file is 211 pure LOC (warning band); future additions should split its
ownership-transition cases rather than grow it past 250. No refactor is included in
this one-line fix. The existing large session module is intentionally unchanged in
structure. Only this task's new journal section is removed after evidence capture.

Disk was observed at 723 MiB, then 472 MiB before GREEN, then 838 MiB after validation.
No new build, browser, provider call, whole gate, full-suite run or large artifact was
created. The prior build and 119-test aggregate cover PRIOR bytes only. This follow-up
has current LSP, typecheck and the 46-test complete-file result, not a refreshed build.
The full harness remains not green; other fixture/resource recovery remains separate.
