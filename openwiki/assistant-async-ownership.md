# Assistant asynchronous request ownership

`AssistantSession` uses its existing result owner and execution generation together.
A new public send replaces the result owner; a public retry advances the generation
even when it retains the same request ID and result owner. Request ID equality alone
does not authorize a delayed response.

The planner captures that invocation before calling the provider. After success or
rejection, it checks the captured owner and current abort/queue/project boundary
before parsing, adopting requirements, resetting WorkPlan evidence, injecting a plan,
or publishing fallback/error state. Its entry and recovery callers also check before
continuing execution. A stale send returns aborted without finalizing into the new
owner or removing the new owner's orchestration messages.

Preparation delivery callbacks and declaration failures use the same ownership
rule. Conversation compaction retires both successful summaries and rejected results
before changing messages or audit state. Native tool-yield and layer-verification
publication check ownership inside the awaited method, not just in the outer caller.
Current-request cancellation still reports its terminal boundary; it does not install
an obsolete planner result. Session-wide provider usage accounting remains cumulative.

`test/assistantAsyncOwnership.test.ts` exercises these races through public sends,
retry and compaction. It holds exact provider/UI-yield events, finishes the newer
explicit Ask, then releases the old work. Assertions preserve canonical sources,
native verification evidence, WorkPlan, draft/applied state, conversation, historical
results and exact provider counts. The fixtures use local transport only, bounded
failure deadlines and finally abort/release/await cleanup. This is focused async-owner
coverage, not a browser, remote-durability or whole-suite approval.
