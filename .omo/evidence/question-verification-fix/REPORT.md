# Frozen current-question explicit-verification correction

Task: st_01a07fa8. Parent/root: 01a07570-3fcb-7988-b994-b5b369ac125d.
Model independently observed in this child: `PI_MODEL=gpt-6-astra`.
The separate read-only fixture planner also reports `gpt-6-astra` in parent
`ai-unbounded/adjacent-fixture-repair-plan.md`; none of its proposed repairs were applied.

## Frozen target and exact change

Integration: `/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570`.
Base/current HEAD: `57757e41e0c233ee9ca9ef9f45ef5057ccdb1571` (UI commit above core `87a87017b`).
No commit, push, merge, rebase, unlock, UI edit, fixture-helper edit or persistence/schema edit.

Production delta is only `src/ai/assistantSession.ts`: **13 insertions, 4 deletions**.
Five seams, no change to the verification owner implementation:

1. One answer-request-scoped instance of the existing `ToolVerificationEvidence`.
2. Existing applied-state refresh invalidates answer evidence on changed content,
   using the same fingerprint/currentness boundary as authoring evidence.
3. New request entry clears answer evidence; retained non-authorizing Ask continuation
   keeps the same request's evidence.
4. `recordToolResult` records current answer checks before returning, still never
   feeding authoring successTools, work-item evidence or canonical verifier receipts.
5. `finishRunRecap` selects current answer evidence rather than excluding all checks.
   A failed/stale answer check changes response-final to blocked through the existing
   run owner. Existing final-message/audit/result/recap publication is reused.

`RequestExecution.state` remains `answer`: a failed checker is not permission to
resume or repair old authoring. `RunOutcome.execution` is `blocked`; goal assessment
and delivery still come from the unchanged canonical projection. A passing read
creates no satisfied goal, applied delivery, receipt or persistence proof.

Other shipped changes: strengthen (not replace) the original real-lint regression in
`test/assistantFinalAudit.test.ts`; add focused `test/assistantQuestionVerification.test.ts`;
add the current-question contract to `openwiki/editor-ai-panel.md`.
`core.patch` contains the production-only patch; `fix.patch` also contains tests/wiki.
`frozen-files.sha256` freezes these four files. `evidence.sha256` freezes this evidence package.

## Observed RED / GREEN / counterfactual

The **first test command** ran the complete, unchanged original audit file before
any test or production edit. Original failure was reproduced exactly:
`expected 'MODEL_SUCCESS_SENTINEL' not to contain 'MODEL_SUCCESS_SENTINEL'`.

| Evidence stem | Complete files | Passed | Failed | Exit |
|---|---:|---:|---:|---:|
| red-original | 1 | 2 | 1 | 1 |
| red-contracts (production unchanged) | 2 | 6 | 5 | 1 |
| green-contracts | 2 | 11 | 0 | 0 |
| green-related | 7 | 119 | 0 | 0 |
| toggle-red (only production patch reversed) | 2 | 8 | 6 | 1 |
| frozen-green (exact production patch restored) | 2 | 14 | 0 | 0 |

Each stem has its complete `.log`, `.json`, and direct runner `.exit`.
The counterfactual restored production exactly to HEAD (`git diff --exit-code --
src/ai/assistantSession.ts`, exit 0), reproduced six failures including current-failure
reporting with retained authoring, then restored the patch byte-for-byte.
`toggle-restore.log` records successful comparison with `pre-toggle.sha256`.
The final 14 cases include three ownership controls added after the initial 11-case run.
No failing test was removed, skipped, weakened, or substituted with a precomputed lint result.

## Runtime truth and ownership

The original regression's native result assertions run before the false-success
assertion: actual `run_lint` execution is `ok:true`, but `parseToolVerdict.pass` is false.
The standalone public-session probe captures actual values in `manual-qa.json`:

| Scenario | Native lint result | Final RunOutcome | Model success retained |
|---|---|---|---|
| broken upper tile | ok=true, errors=1, pass=false | blocked / unassessed / no-change | no |
| clean map | ok=true, errors=0, pass=true | response-final / unassessed / no-change | yes |
| changed revision after pass | ok=true, errors=0, pass=true, subsequently stale | blocked / unassessed / no-change | no |
| changed revision plus exact rerun | two real ok=true, errors=0, pass=true checks | response-final / unassessed / no-change | yes |

Broken-map response observed:
`검증이 아직 통과되지 않았습니다.\n- run_lint: 침엽수 상단(260)은 하단(290) 바로 위에 있어야 합니다.`
Stale response identifies exact scope `["run_lint",{}]` and requires rechecking.
All four probe cases have `proof:null`; project input remains unchanged; no applied/proposed calls.
The probe uses public `sendUserMessage("Check the authored map")`, actual registered
lint and existing audit/recap/RunOutcome owners. Only intent/model transport is scripted.
This is **not** paid-provider, browser, live save or exported-game QA.

Focused tests additionally observe:

- A negative and a positive real `check_reachability` invocation in different scopes:
  both execute successfully, but the positive scope cannot erase the negative one.
- Both explicit Ask and declared question refuse a real attempted `set_title_screen`
  with `composer-mode-ask`, keep project bytes unchanged and do not recover authoring.
- Prior authoring with an anchored, required, unverified `toolVerdict(run_lint,{})`,
  real pending title draft and WorkPlan stays intact. An unrelated question ignores
  its old failed lint; a current question's failed lint is reported; a current passing
  lint cannot satisfy that older canonical obligation. Original source, draft, plan,
  prior result and delivery ownership remain unchanged.
- Same-request Ask continuation retains its failed evidence; a new unrelated question
  clears answer evidence without rewriting the old source.
- Final response, last assistant audit entry, last assistant-message event, result,
  recap, harness snapshot and last `run_outcome` publication agree.
- Existing question authority, explicit resume, source omission recovery, canonical
  verifier freshness, advisory semantics and no-check fingerprint cost all pass in
  the seven-file run. This is not a new whole-repository aggregate.

## Exact validation commands

All commands ran from the integration directory, Node v24.11.1, Vitest v3.2.4.
No pipeline was used to derive test/build exit status; status was captured immediately
from the runner and written to the matching `.exit` file.

Common complete-file runner suffix:

```sh
--configLoader bundle --maxWorkers 1 --minWorkers 1 --reporter verbose --reporter json --outputFile.json .omo/evidence/question-verification-fix/<stem>.json
```

Full prefixes / substitutions:

```sh
# red-original: exit 1
node scripts/run-vitest.mjs run test/assistantFinalAudit.test.ts <suffix stem=red-original>

# red-contracts: exit 1; green-contracts: exit 0; toggle-red: exit 1; frozen-green: exit 0
node scripts/run-vitest.mjs run test/assistantFinalAudit.test.ts test/assistantQuestionVerification.test.ts <suffix stem=as-listed>

# green-related: exit 0, all 119 assertions/cases passed
node scripts/run-vitest.mjs run test/assistantFinalAudit.test.ts test/assistantQuestionVerification.test.ts test/assistantQuestionAuthority.test.ts test/aiAskPendingPlan.test.ts test/assistantAcceptanceCost.test.ts test/assistantVerificationEvidence.test.ts test/agentVerification.test.ts <suffix stem=green-related>

# Manual public-session probe: exit 0; stdout is manual-qa.json, stderr is manual-qa.stderr
node_modules/.bin/vite-node --config vitest.config.ts .omo/evidence/question-verification-fix/manual-qa.mts

# Both exit 0; logs/exits retained
npm run typecheck:app
npm run build:app

# Both exit 0
git diff --check
git diff --quiet HEAD -- src/editor test/requiredOutcomeFixture.ts test/e2e
```

Changed-file LSP before app typecheck/build:
- `src/ai/assistantSession.ts`: no diagnostics, including after exact toggle restoration.
- `test/assistantFinalAudit.test.ts`: no diagnostics.
- `test/assistantQuestionVerification.test.ts`: no diagnostics on final test bytes.
  One fresh-diagnostics request timed out at 3000ms while the related run was active;
  after it completed, the same file returned no diagnostics.
- Evidence `manual-qa.mts`: no diagnostics.
- Wiki: no Markdown LSP configured; inspected diff, no prose-pinning test added.

Build completed in 1m8s. It reports six mixed static/dynamic import warnings and the
large-chunk warning. None was suppressed or altered. No new claim of full build/gates
or full-suite success is made. The typecheck/build ran on the exact production bytes
restored and checked by `pre-toggle.sha256`; no second build was necessary.
A display-only Node summary command initially had an extra `)` (SyntaxError); the
probe itself had already exited 0. Corrected summary parsing exited 0 and is saved
in `manual-summary.log` / `.exit`. No product/test change was made for this typo.

## Scope, review and cleanup

Single-responsibility change: current answer-check evidence lifetime and final publication.
Parsing remains at the existing ToolResult/verdict boundary; no new parser, completion
engine, type escape, tagged variant, catch/log layer, helper API or parameter was added.
New tests/probe contain no sleeps, polling or timing-based success; revision changes
are triggered at the exact subscribed tool-result event.
Measured pure LOC: existing session 4888, original audit test 76, new question test 159,
manual probe 49. The pre-existing session monolith is intentionally not refactored in
this expressly minimal correction. Existing multi-parameter methods are not redesigned.

No debugger, browser, server, source instrumentation or worker was launched for this
fix. Only this task's appended journal section is removed; the prior gate journal and
all previous reports remain. Ignored build output is not part of the patch. Evidence
is deliberately retained as requested, not deleted as temporary debugging material.

Final read-only check found disk at 1.4 GiB free. After the lead's disk notice, no
build, test, probe or large-output command was started; only small manifest/report
writes and read-only freeze checks were performed. The existing evidence package was
276 KiB before these small final manifests. No owned/unowned crash dump was deleted here.

Limits remain: full test harness is **not green** and still needs the separate fixture/
resource recovery. Prior 11/22-frame UI and full-build evidence is preserved, not
recast as proof of this correction. No whole gates, full2537, browser/image/UI tests,
provider usage, new remote persistence proof, schema changes or fixture repairs were run.
