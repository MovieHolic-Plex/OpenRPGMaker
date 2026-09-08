# G1 frozen minimal increment

G1 is fixed in this exclusive worktree. Model quick-reply markers no longer
override autonomous applied-state checkpoint/recovery. One authorized request
survives one or three markers, runs its native title writer, and settles applied
and verified-local exactly once without another user message.

The own-goal held-preparation fixture is also corrected: captured nonempty required
source is immediately incomplete, including when preparation fails. The final
complete assistantCoreIntegration file passes 25/25 (exit0), and the scoped receipt
union is 97/97. This fixture correction is separate from the six G1 RED cases.

## Exact ownership and patch

- Owner/task: st_01a0810a; confirmed PI_PROVIDER=opencodex,
  PI_MODEL=gpt-6-astra; session 01a0810a-0898-7731-8ea5-70d8d17164e9.
- Parent/root: 01a07570-3fcb-7988-b994-b5b369ac125d.
- Tree: `/home/main/z-project/rpg-zzu-unbounded-quick-reply-01a07570`.
- Branch: `agent/unbounded-quick-reply-01a07570`.
- Base/unchanged HEAD: `b078738e0f378b3c0e09be74a36558adffa780f2`.
- Adopted clean, remains locked `review:quick-reply-blocker`.
  `ownership.before.txt` and `ownership.frozen.txt` record observed git state.
- Deliverable: `frozen.patch`, SHA256
  `c87060d65ee96a8d921b3503f85f92a6cc126025d7a49f19cdd3bb097bcaa94a`.
  Three tracked files only; no staged files or commits.
- Production hunk: `src/ai/assistantSession.ts:4493-4502` only, removing five
  lines of autonomous marker-based early return and adding two explanatory lines.
  No planner await/adoption/declaration ownership edits; G2 retains those seams.
- Tests: focused replacement/additions in `test/assistantCoreIntegration.test.ts`.
- Wiki: only the finite-segment/quick-reply paragraph in
  `openwiki/editor-ai-panel.md:91-101`.
- `workPlan.ts` is byte-unchanged. The finite detached helper is deliberately not
  redefined; its old marker pause is not autonomous execution authority.

Final SHA256 (`source.frozen.sha256`, successfully rechecked after all validation):

| File | SHA256 |
| --- | --- |
| src/ai/assistantSession.ts | bdec78e1c244efcc6b6d5470ae2aff2b82ba858517b8078c42faee86f635c4ac |
| test/assistantCoreIntegration.test.ts | 8fb15c89c00bc6e218abeb11f4fa3bebf4816f001f80ceaffbdfe9bf54d5160b |
| openwiki/editor-ai-panel.md | c20f899be7a11a2a9a9edb7bcec36dc4d67d86378743a0f401c701e3dac6e624 |
| src/ai/workPlan.ts (unchanged) | c21f248b539694585abfe5e4580ccf882af03e6450b751bbf48f422438e330ea |

## Mechanism and preserved boundaries

Public send establishes execution authorization and milestone auto-apply;
runTurnLoop now takes every autonomous candidate final to the existing checkpoint.
That checkpoint observes actual user boundaries, applies pending native proposals,
and refreshes canonical acceptance from the applied store. Unfinished work enters
existing recoverRequest/runAutonomousDriver, including ordinary recovery replans.
Neither a model marker nor accompanying claims of missing input establish a wait.

No new ledger, scheduler, cumulative cap, threshold, contract, tool or missing-input
classifier was added. The autonomous declaration clarification branch already
bypasses model clarification. The only remaining `missing-input` occurrence in
assistantSession is a type-union member, not an emitted terminal path. Existing
transport/store blockers carry code-established evidence. Detached clarification
and finite legacy scheduling remain separate non-autonomous compatibility paths.

New marker-adjacent tests preserve actual abort, queued correction and project
identity switch (subscribed run_state callback before triggering the send), plus
an actual injected 401 transport failure with original obligation/source evidence.
Ask marker remains answer-only. Existing complete-file Plan/Confirm and raw-continue
non-escalation tests passed. No timing sleeps/polling were added. Assertions inspect
native calls, real applied title, current canonical criteria/evidence, source owner,
one user audit entry and one milestone, not prose or a mocked completion ledger.

## Observed RED/GREEN and exact validation receipts

All commands ran from the exclusive tree. Each `<name>.command.txt` contains the
exact command; matching `.log`, `.exit`, and test `.json` retain raw evidence.
Native Vitest uses one fork, no file parallelism, retry=0, allowOnly=false.

| Receipt | Exit | Observed result |
| --- | ---: | --- |
| red | 1 | Before production edit: 18 passed / 7 failed. Six G1 failures; one own-goal fixture mismatch. |
| baseline | 1 | Original base test file and unchanged production: 17 passed / 1 failed. |
| red-final | 1 | G1 test bytes before held-preparation fixture correction against exact base session via Vite load hook: same 18/7. |
| green | 1 | Initial five complete-file run: 95 passed / 2 failed. One fixture routing defect, one own-goal preparation fixture mismatch. |
| green-final | 1 | Previous complete core file: 24 passed / 1 own-goal fixture mismatch. All eight G1/compatibility cases pass. |
| fixture-green | 0 | Final complete core file: 25/25; actual held-preparation failure retained with required uncovered source/ownership assertions. |
| typecheck-app | 0 | `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck:app` |
| build-app | 0 | `NODE_OPTIONS=--max-old-space-size=8192 VITE_CACHE_DIR="$PWD/.omo/evidence/g1-quick-reply/build-cache" npm run build:app`; 42.06s. |
| manual-probe | 0 | `NODE_OPTIONS=--max-old-space-size=8192 node .omo/evidence/g1-quick-reply/manual-probe.mjs` |
| audit | 0 | Machine pairing of six G1 RED->GREEN cases, distinct own-goal fixture correction, complete-file union and scope. |
| diff-check / source-frozen-check / cleanup | 0 | Whitespace clean, frozen hashes match, no abandoned owned workers. |

The initial three-marker fixture did not distinguish the existing no-tools recovery
planner from the writer: it donated its scripted write to planning. This was a test
defect, not a second production fix. The final fixture explicitly responds `resume`
to that real planner invocation, then supplies the native write; it asserts one
planner invocation for the three-marker case. The final-base RED repeats the same
six G1 failures after this correction. No test was skipped or weakened.

The other four complete files passed against identical production bytes in `green`:
`aiUnboundedExecution.test.ts` 18/18 (including 64 native applied segments),
`autonomyHarness.test.ts` 7/7, `workPlan.test.ts` 40/40,
`aiRunOutcomeIntegration.test.ts` 7/7. Combined with final core: **97/97 distinct
assertions passed**, no skipped/todo tests. This is a scoped receipt union, not a
whole-suite result; the fresh complete core command itself is fully green.
No build/typecheck or other unchanged complete-file tests were repeated for the
test-only fixture correction, per the parent's explicit verification scope.

Fresh final source/test LSP: no diagnostics. Markdown LSP unavailable for `.md`;
focused prose reviewed and diff check passed (`lsp.txt`). Build warnings were not
suppressed: dependency PURE annotations, circular record-picker re-export,
mixed static/dynamic imports, and large chunks remain in `build-app.log`.

## Independent public-session execution

`manual-probe.mjs` uses Vite in-memory SSR of actual source modules, not Vitest or
private-method substitution; no HTTP listener/browser. Its real send has exact
nonempty full source `[0,23)` and literal title binding `[13,23)`, native plan,
three model markers also claiming they need a choice, recovery planner resume,
then actual native title write. `manual-probe.log` observes writer calls=5,
plannerCalls=1, segment=4, checkpoints=[Required], appliedCalls=1,
response-final/satisfied/applied, verified-local and canonical expected/observed
title Required. Exactly one original user audit entry is asserted.

All fetches are intercepted before session/store actions. The local fixture records
edit-activity and project_commits/project_changes requests without dispatching them;
remote persistence is disabled. This proves local application/verification, not
remote durability. The bounded deadline is a failure guard; no success polling.
Controller, pending send and SSR server are closed/awaited in finally.

## Own-goal fixture correction, remaining scope and cleanup

The prior report incorrectly classified the held-preparation mismatch as outside
this goal. Its b078 reproduction establishes only that it predates G1, not that it
is unchanged-f22. Parent confirmed c829ef268 intentionally publishes captured
nonempty required source before preparation settles. The test now expects
`failed/incomplete/no-change`, keeping the actual held preparation exception.

The strengthened test checks the sole active required uncovered row
`request-2:source:0`, raw new source and exact span, null undeclared criteria,
before release and unchanged after failure. It retains every prior assertion and
adds complete old request/acceptance history preservation, the frozen old result,
old draft retirement, new request ID ownership, no new declaration or writer call,
no proposal/application, unchanged project title, no proof/receipt, and no tool,
milestone-applied or persistence-proof publication for the failed request.

`green-final.json` records the observed fixture RED independently of G1;
`fixture-green.json` records its correction and all six G1 regressions still green.
`verification-summary.json` separates `fixed` (six G1 cases) from
`fixtureCorrection`. No additional production/wiki change was made. Fresh final
test LSP is clean. Frozen hashes and patch were refreshed; prior freeze is retained
as `source.g1-before-fixture.sha256` and `g1-before-fixture.patch`.

There is no remaining blocker in this scoped increment. G2 remains separate and
is not fixed or claimed closed here.

All validation workers ran synchronously and returned. Final `/proc` cwd inventory
has no remaining verification workers; only the tool-managed TypeScript LSP service
and its tsserver/typingsInstaller children remain attached (`cleanup.json`). These
are retained tool infrastructure, not abandoned test/build/probe workers. An initial
overbroad zero-process cleanup assertion detected that fresh LSP infrastructure;
the corrected inventory explicitly classifies it rather than killing the service.
The generated, gitignored, newly created dist output was removed. No probe/build
cache directories remained. The worktree and evidence are retained locked for parent
integration. No live model/DB writes, browser/image work, commits/push/merge/rebase,
unlock or integration8441 tree/process/evidence edits occurred.

Tooling note: apply_patch was available at `/tmp/public-ui-tools/apply_patch` rather
than PATH and was used for every authored patch. One malformed evidence-only patch
envelope was rejected with exit1 before opening a file; no file was created. An
earlier global utility-location search timed out; no verification worker was left.
These are not test/production failures and are not represented as successful calls.
