# Follow-up: canonical filesystem replay proof

Base commit: `4ff74d8b1e3d9f860c19d452c4e04cf662675be2`.
Branch/worktree: `agent/aiq-region-silver`,
`/home/main/z-project/rpg-zzu-aiq-region-silver`.
This is a new follow-up commit, not an amendment of the first commit.

## Confirmed remaining defect

The supervisor's concern was correct. The first commit's parser preservation
fix and insertion-order memory host did not prove replay through actual storage.
`openAiJobsRepository.putJson` uses recursive `canonicalJson` key sorting. A
recorded ToolResult/delta therefore comes back in sorted disk order, not its
original runTool order. Tool responses embed JSON *strings* in provider messages;
the ledger canonicalizes outer objects but cannot normalize those strings.
Preserving parser input order alone still yields different paid request bytes.

`red-disk.log` proves the failure for BOTH actual assistant and region execution:
`ASSISTANT_INCOMPLETE: Stable provider key was reused with different input`.
The failure is produced by the real, unchanged provider-operation ledger after
closing and reopening the real filesystem repository and scheduler.
`red-nested.log` separately reproduces hash mismatch for absent, zero and
nonzero optional mapPropertiesChanged and nested data ordering.

This supplement supersedes the first handoff's claim that parser-order
preservation alone fixes generic durable replay. The first commit itself,
including its evidence, remains unchanged.

## Smallest shared correction

Only production change: `src/ai/jobs/providerBridge.ts`.

Before the existing wire encoder, createJobChat canonicalizes object keys in
JSON-container tool-message content on BOTH initial dispatch and replay. It
recurses through objects inside arrays but preserves array order. This handles
ToolResult.diff, optional mapPropertiesChanged, nested data, and any other
machine JSON container in tool responses, regardless of storage/parser order.

User messages, assistant content, tool-call arguments, nested string values,
non-JSON tool text and scalar-JSON tool content remain unchanged. JSON containers
are validated with the existing JSON guard. SyntaxError means the supported
plain-text tool format, which is preserved rather than discarded; other errors
propagate. The input ChatRequest is not mutated.

No exported signature, job/checkpoint schema, operation key, provider retry,
provider ledger, mismatch check, UI or foreground code changed. The original
parser fix remains, but correctness no longer depends on its property order.

Existing historical operations dispatched with the old unsorted bridge are
NOT rewritten or silently replayed. Their stored request hashes still have
full mismatch protection. The proven contract is initial dispatch plus restart
retry using the corrected bridge; no historical ledger migration was added.

## Exact executable proof

`test/aiJobCanonicalReplay.test.ts` has six tests:

1. Actual executeAssistantJob -> actual AssistantSession/runTool(create_map) ->
   runTool(get_project_summary) -> durable fourth provider response -> controlled
   worker failure. The test then closes scheduler and fs repository, reopens both,
   resets intent cache, subscribes before retry, and executes the real adapter.
2. The identical filesystem/scheduler/provider-ledger restart flow through
   executeRegionJob and its explicit captured assistant adapter.
3-5. Real create_map ToolResult plus nested data objects/arrays/string values;
   optional mapPropertiesChanged absent, zero, and seven. Actual fs putJson/readJson
   changes insertion order (explicitly asserted); actual createJobChat must produce
   identical persisted request hashes. A changed nested value still fails the
   strict hash check with OPERATION_MISMATCH and no second physical dispatch.
6. Plain-text and scalar-JSON tool content remains byte-identical; a root array
   canonicalizes each object without changing array order.

For each full-session restart test, the real ledger persists four paid fixture
responses before interruption. Retry must:

- finish successfully with no executor or scheduler error;
- keep the exact four operation request BlobRefs, with no new operation;
- produce exactly two identical requests for every deterministic operation key
  (initial attempt and replay), including embedded JSON strings;
- perform exactly four physical fixture dispatches TOTAL, zero on retry;
- retain the same generated map ID/content from the checkpoint;
- retain awaiting-review / unsaved semantics.

No entire executor/session/tool is mocked. Only the trusted physical provider
callback returns local wire fixtures. The separate real scheduler regression
also proves meaningful provider-key mismatches still fail without redispatch.

## Commands and outcomes

All commands executed in this worktree. Logs are beside this handoff.

| Command | Evidence | Exit/result |
| --- | --- | --- |
| `npm test -- test/aiJobCanonicalReplay.test.ts --maxWorkers=1 --no-file-parallelism` before product edit | red-disk.log | 1; both actual disk-restart flows failed mismatch |
| `npm test -- test/aiJobCanonicalReplay.test.ts -t 'canonicalizes nested' --maxWorkers=1 --no-file-parallelism` before product edit | red-nested.log | 1; all three optional/nested cases failed mismatch |
| `npm test -- test/aiJobCanonicalReplay.test.ts --maxWorkers=1 --no-file-parallelism` after bridge fix | green-disk.log | 0; five initial disk/roundtrip tests passed |
| `npm test -- test/aiJobCanonicalReplay.test.ts test/aiSessionJobHost.test.ts test/aiRegionJob.test.ts --maxWorkers=1 --no-file-parallelism` | green-focused.log | 0; final 31 tests / 3 files passed, including all six new cases |
| `node --test test/aiJobsScheduler.test.mjs` | node-ledger.log | 0; 13 passed, including actual OPERATION_MISMATCH/no-redispatch regression |
| `npm run typecheck:app` | typecheck.log | 0 |
| per-file LSP, severity all, providerBridge.ts and aiJobCanonicalReplay.test.ts | tool results in task session | No diagnostics found for both |
| `git diff --cached --check` | task commit command | exit 0 before commit |

One earlier broad run had 30 passing tests and the unchanged import-graph test
hit its 15-second watchdog (graph-timeout.log). Concurrent typecheck hit its
150-second tool-command limit. Machine load was 153 on 32 cores. Running validators
without concurrency passed typecheck and the complete identical 31-test command.
No test timeout was raised, no failing case skipped, and no assertion suppressed.
The typecheck shell command was given a longer execution budget, not a changed
compiler/test configuration. Log trailing whitespace is trimmed for git diff checks.

## Cleanup and integration

Each fs test owns a mkdtemp directory, closes scheduler/repository, and removes
only that directory in finally. Outcome listeners are installed before trigger,
use bounded timeouts, and are removed on completion/failure. No sleep or polling.
No application/browser/HTTP/provider process was started, no paid request or
remote or live-project write occurred, and no environment file was read. Fixtures are
local temporary repositories, not user projects. No matching test temp directory
remains after verification. No UI, sibling adapter, package, or configuration edit.

Integrate this NEW commit after the first region commit. No public API consumer
change is required. The commit SHA is returned in the task result rather than
self-referenced inside the commit. Whole builds and six-family browser acceptance
remain supervisor-owned and are not claimed by this follow-up.
