# Executed evidence

## E01 — installed OMO pure completion/continuation seams

Surface: lead `functions.eval(language="js")`, 2026-09-06.
Modules under installed Senpi `dist/core/extensions/builtin/`:
`todotools/todo-operations.js`, `goal/todo-gate.js`,
`goal/transitions.js`, `goal/continuation.js`.

```js
const baseline = [{ name: "Verify", tasks: [
  { content: "Persist authored map and reload", status: "pending" }
] }];
const branch = phases => [{ type: "message", message: {
  role: "toolResult", toolName: "todo", details: { phases }
} }];
for (const op of ["done", "drop", "rm"]) {
  const result = ops.applyParams(structuredClone(baseline),
    { op, task: "Persist authored map and reload" });
  gate.openTodoTaskContents(branch(result.phases));
}
trans.transitionGoalStatus(
  { id: "probe", status: "active", objective: "Save remote map", updatedAt: 1 },
  "complete", "model", undefined, 2);
trans.transitionGoalStatus(
  { id: "probe", status: "active", updatedAt: 1 },
  "blocked", "model", "unknown", 2);
```

Continuation inputs: active goal, unattendedContinuations=150, idle=true,
no pending messages, lastStopReason=stop, all consecutive/recovery/stall
counters zero, continuationPending=false. Compare immediate vs monitorDelayed.

Captured result:

```json
{
  "before":["Persist authored map and reload"],
  "done":{"errors":[],"open":[]},
  "drop":{"errors":[],"open":[]},
  "rm":{"errors":[],"open":[]},
  "completeWithoutEvidence":{"id":"probe","status":"complete","objective":"Save remote map","updatedAt":2,"completedAt":2},
  "blockOnFirstOccurrence":{"id":"probe","status":"blocked","updatedAt":2,"blockedReason":"unknown","blockedAt":2},
  "unattended":{"kind":"deny","reason":"unattended"},
  "monitorExemption":{"kind":"continue","prompt":"full","stallNotice":false}
}
```

Verdict: confirms the policy/enforcement boundary, not achievement of any
user goal. The full update_goal tool was not invoked. Cleanup receipt:
in-memory probe objects only; no files, processes, actual goals or DB writes.

## E02 — actual RPG run-end proof body with isolated store outcomes

Surface: lead JS eval. Source was read from
`src/ai/assistantSession.ts:2517-2570`, wrapped in a class and transpiled in
memory with `Bun.Transpiler({loader:"ts"})`. The body was unchanged. Only
dependencies were supplied: complete plan, enabled remote persistence,
flush=saved/sha-probe, empty commit list, and varied reload outcome.
The first extraction accidentally included the next unterminated source comment;
it failed before any execution. Removing that trailing comment fixed the probe.

Each case invokes the same instance method twice:

```json
[
  {"reloadKind":"reloaded","flushCallsAfterTwoInvocations":1,"savedAudit":true,"completionStatus":"자율 런 저장 증명 완료 — projectId=probe-project sha256=sha-probe reload=reloaded","guard":"probe-plan"},
  {"reloadKind":"failed","flushCallsAfterTwoInvocations":1,"savedAudit":true,"completionStatus":"자율 런 저장 증명 완료 — projectId=probe-project sha256=sha-probe reload=failed","guard":"probe-plan"},
  {"reloadKind":"cancelled","flushCallsAfterTwoInvocations":1,"savedAudit":true,"completionStatus":"자율 런 저장 증명 완료 — projectId=probe-project sha256=sha-probe reload=cancelled","guard":"probe-plan"}
]
```

Verdict: `agent_run_saved` is not proof of successful reload, and the plan-id
attempt marker prevents a second proof attempt on the same plan. This is a
faithful branch probe, not a live Supabase outage or browser failure reproduction.
Cleanup: only memory objects and transpiled strings; no store, project, network,
process, temporary file or actual goal mutation.

## E03 — supplemental researcher test execution, not a green full gate

rpg-gaps reported:

```text
npm test -- test/aiComposerModeSession.test.ts test/aiAskPendingPlan.test.ts \
  test/assistantVerificationEvidence.test.ts test/aiMilestoneTurnAccounting.test.ts \
  test/aiWorkItemStall.test.ts test/autonomyHarness.test.ts \
  test/assistantReadContract.test.ts test/aiAutonomousRunSmoke.test.ts \
  test/applyProposedProjectHouseProtection.test.ts test/aiConversationReplay.test.ts

exit 1: 78 passed, 1 timeout
timeout: aiAutonomousRunSmoke.test.ts:151, 30-second test deadline
reported wall time: 107.72 seconds
```

The isolated timed-out case later passed (1 passed, 3 filtered, exit 0).
This does not erase the original timeout. The lead does not claim a green
application gate from the researcher summary. The prose-only planning change
does not attempt to fix unrelated timing behavior.
