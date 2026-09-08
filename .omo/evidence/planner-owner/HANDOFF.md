# Frozen G2 ownership patch - st_01a0810b

## Scope and identity

- Model: opencodex/gpt-6-astra, confirmed in this child session.
- Worktree: `/home/main/z-project/rpg-zzu-unbounded-planner-owner-01a07570`.
- Branch: `agent/unbounded-planner-owner-01a07570`.
- Base/HEAD: `b078738e0f378b3c0e09be74a36558adffa780f2`, adopted clean and still locked.
- No commit, push, merge, rebase or unlock. No browser/image execution, live model
  or remote database writes. The integration tree, native16 processes/reports and
  separate G1 tree were not modified. Quick-reply branches and contrary test are unchanged.

## Exact deliverable

`frozen.patch` contains only:

| File | Added | Removed |
| --- | ---: | ---: |
| src/ai/assistantSession.ts | 78 | 35 |
| test/assistantAsyncOwnership.test.ts | 255 | 0 |
| openwiki/assistant-async-ownership.md | 28 | 0 |

Patch SHA256: `4ef8eb477c9b627f6149a1c4e60dfb5be3c943e4b406a63f061a57728c5bb76b`.
Reverse `git apply --check` against the frozen working tree exits 0 (`patch-check.exit`).
No staged or committed changes are required to consume this patch.

### Mechanism

The existing result object plus `executionGeneration` jointly own awaited work.
Planner success and rejection check captured ownership and user/project boundaries
before parsing/adoption/error/fallback publication. Entry and recovery drivers also
retire before another model/tool round or result decoration. Declaration failure,
wiki delivery/preparation, compaction and native tool/advisory yields guard their
own post-await mutations. Old-loop cleanup cannot remove newer orchestration.
Original-context delivered evidence is recorded only after ownership validation.
Transient retry cannot issue another provider call after retirement.

Current-owner abort still completes its read-only native batch, preserving the
existing batch tests; different owner/generation or project cannot receive those
results. Canonical WorkPlan/Acceptance and existing provider-usage accounting remain
the only engines. No source criteria, quantities, policy or completion gate is weakened.

The outgoing request's existing `buildGroundedRequest -> compactMessagesForRequest
-> repairToolCallProtocol` repairs an interrupted old tool call in the transmission
copy. Retired work therefore need not mutate newer conversation state to pair it.

## RED/GREEN and validation

All artifacts below are relative to this directory. JSON reports contain actual
complete-file assertion identities; logs and exits are retained separately.

| Receipt | Passed | Failed | Total | Exit |
| --- | ---: | ---: | ---: | ---: |
| `red` (initial 9-case race, before production edits) | 1 | 8 | 9 | 1 |
| `final-red` (final 16-case file on exact base product) | 1 | 15 | 16 | 1 |
| `green` (final frozen patch, complete new file) | 16 | 0 | 16 | 0 |
| `final-related` (17 complete related files) | 256 | 7 | 263 | 1 |
| `related-base` (4 complete files for failure attribution) | 38 | 7 | 45 | 1 |

All final related failures are reproduced on the exact base, with byte-equal
failureMessages by file/full test name (`baseline-comparison.json`). Six are in
`aiNewGoalDraftRetirement.test.ts`: five expect unassessed instead of the already
captured incomplete source, and one expects a null acceptance snapshot despite
early source capture. One is `assistantCoreIntegration.test.ts`'s failed held
preparation expectation (unassessed vs incomplete). These were not edited or waived.
Raw expected/received differences remain in both verbose logs.

The first related run (`related`) also exposed two introduced advisory-on-abort
regressions; ownership guards were narrowed without changing tests. Both pass in
`final-related`. That first run timed out one unchanged 30-second milestone test;
the unchanged test passed on base and in final-related. No timeout increase,
sleep, retry setting, skipped test or suppressed error was used to obtain the final
receipt. Initial setup collected zero tests because apply_patch was unavailable;
`setup-incomplete` is not credited as RED. Interim compaction fixture deadline
failures were corrected to hold only the old summary; `red-compaction` captures
the actual two product failures before that production increment.

Complete final related file inventory:
`assistantAsyncOwnership`, `assistantSessionIntent`, `assistantQuestionVerification`,
`assistantAcceptanceSession`, `assistantAcceptanceSourceIntegration`,
`assistantVerificationEvidence`, `assistantVerificationContinuation`,
`assistantProposalAssembly`, `assistantCoreIntegration`, `aiOutcomeEntryOwnership`,
`aiNewGoalEarlyOwnership`, `aiNewGoalDraftRetirement`, `aiAskRetainedDraft`,
`aiMilestoneTurnAccounting`, `assistantSessionCompaction`, `assistantBatchCompletion`,
`aiRunEndProof` (all `test/*.test.ts`). Final run: forks, minWorkers=1, maxWorkers=2,
retry=0, allowOnly=false; no whole suite or browser suite.

- Fresh LSP: no diagnostics for changed source or test. Markdown has no configured
  LSP server; that limitation is explicit in `diagnostics.json`.
- `npm run typecheck:app`: exit 0 (`typecheck-app.log/.exit`).
- `npm run build:app`: exit 0 (`build-app.log/.exit`), 53.62s. Warnings retained:
  Zod PURE annotations, circular record-picker re-export, mixed static/dynamic
  imports, large chunks and missing optional local proxy keys. No suppression.
- `git diff --check`: clean. `final-inputs.sha256` rechecked after validation.

## Exact public surface evidence

`public-probe.mjs` loads actual modules using Vite SSR, without listening or opening
a browser. The final `public-probe.log/.exit` is a separate public send execution:

```
calls=2
older.stoppedReason=aborted
newer.execution={requestId:request-2,state:answer,segment:1,rounds:0,roundCap:1}
before.plan=null; after.plan=null
before.acceptanceItemIds=[request-1:source:0]
after.acceptanceItemIds=[request-1:source:0]
full snapshot unchanged; returned answer immutable; writes=0; applies=0
fixtureFetches=0; exit=0
```

RED logs show 3 calls instead of 2 and OLD_PLANNER_GOAL/old-required donation.
The tests additionally cover invalid/rejected fallback, retained native evidence,
declared source/draft/WorkPlan/history, abort, project switch, same-result generation,
held retry, declaration 401 blocker, wiki preparation, native tool/advisory yields
and successful/rejected compaction. No private session mutation or test sleeps.
Every held operation subscribes first and finally aborts/releases/awaits; bounded
timers are failure deadlines. The public probe's first harness run left an activity
mirror timer, producing a relative-URL warning after fetch restoration; the final
harness explicitly resets activity timers before/after and has no such warning.

## Cleanup and assumptions

`cleanup.json`: no remaining owned processes; generated dist and probe cache removed;
adopted shared node_modules symlink retained. Temporary child patch/read files removed.
SSR server closed; controllers aborted; held work released and awaited; fetch restored.
Worktree remains locked, dirty only with the three intentional patch files. Evidence
is ignored by git and retained for the parent, not committed. Changes were applied
with `/tmp/public-ui-tools/apply_patch` once discovered; earlier unified patches used
a local apply_patch wrapper over git apply because no executable was on PATH.

The full objective and G2 review were read; this is only a G2 handoff, not final-goal,
browser, remote-durability, native-suite or PR approval. Neighboring ownership audit
was closed for reproduced seams, not presented as proof of every asynchronous path
in the entire session. The parent owns adoption/publication and final integration gates.
