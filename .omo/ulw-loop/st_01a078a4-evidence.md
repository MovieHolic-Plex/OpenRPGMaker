# R4 native read delivery evidence

- Task: `st_01a078a4`; evidence key: `r4`.
- Branch: `agent/ai-full-context-r4`; baseline: `398ef9708fbbcc50b0d237e1b1a8f99870c28ea8`.
- Scope: native read receipts in `AssistantSession` / `ToolReadEvidence`, focused
  regressions, and the matching AI-tools wiki paragraph. No sibling changes.

## RED

Added `assistantNativeReadDelivery.test.ts` before implementation and ran:

```sh
npm test -- test/assistantNativeReadDelivery.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000
```

Observed the assigned cause: `An executed read stripped before first writer
delivery cannot authorize a write: expected true to be false`. The fixture used
an existing 512,029-character description, omitted originals on the conservative
128k model, an early full native read followed by six summary reads, actual
session compaction and actual request clamping. Both writer requests lacked the
description; the second contained only `{ok:true,summary:...}` for that read.
The old implementation nevertheless changed the price. No compaction, request
assembler, registry, runner, or write-gate mock was installed.

## Fix and GREEN

Native execution now queues a detached result, without granting lookup credit.
After a writer request returns and before its response executes, receipt matching
checks the pending call ID, tool name, success, summary, and complete exact data.
Malformed, stripped, rewritten and non-tool messages do not qualify. Delivered
credit is retained after history loss and still checked against current-record
fingerprints. `begin` clears both pending and delivered receipts for a new goal;
real continuations retain them. New project sessions cannot import receipts from
copied history. Project identity remains owned by the existing panel session-drop
boundary, not a fabricated identity field on `Project`.

The main regression now proves `[refused, refused, allowed]`: the stripped native
read cannot authorize a write, the last original page cannot authorize a write
in its own response, and all 22 exact original pages allow the next writer to
change price 50 -> 654 while preserving the complete description. Paging crosses
genuine continuations under the existing round caps. A separate public-session
case delivers the complete current native result after a host rebase: same-batch
write refused, next continuation write allowed, original snapshot still omitted.

```sh
npm test -- test/assistantNativeReadDelivery.test.ts test/toolReadDelivery.test.ts test/originalContext.test.ts test/assistantOriginalContext.test.ts test/contextCompaction.test.ts test/assistantSessionCompaction.test.ts test/messageBudget.test.ts test/assistantIndependentReview.test.ts test/independentReview.test.ts test/projectWikiSession.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000
```

Result: **10 files, 143 tests passed**, exit 0. Includes original receipt/range
validation, current fingerprints, malformed/partial receipts, pending snapshots,
request scoping, real compaction, review/parser/budget behavior, and awaited wiki
checkpoint ownership. After restoring sparse-checkout exclusions, the two new
files also passed again: **12/12** tests, with the adjacent failure below visible.

- LSP diagnostics: no diagnostics on all four changed TypeScript files. One
  refreshed test-file check timed out under parallel load; the subsequent check
  returned no diagnostics.
- `npm run typecheck:app`: exit 0, after diagnostics.
- `git diff --check`: exit 0.
- Manual runnable-entry check: Node + Vite `ssrLoadModule` loaded the real session,
  runner and fixtures; `configFile:false`, `envFile:false`, middleware mode, no HMR,
  private `/tmp` cache, network explicitly refused, server closed in `finally`.
  Result:

```json
{"writer":2,"summaries":1,"delivered":[false,false],"writeOk":false,"issue":"read-before-write-required","draftPrice":50,"stoppedReason":"max-tool-calls"}
```

## Unchanged adjacent failure

The complete `assistantReadContract.test.ts` was run, not skipped or weakened:
**4 passed, 1 failed** at line 98 (`made.ok`, expected true, received false).
Its unrelated fixture calls `upsert_enemy` without a graphic. The same real
runner call in the Node entry check returned `monster-graphic-required` before
that test reaches read-evidence assertions. The registry, enemy tool, graphic
assignment and this existing test are unchanged. No fixture or production
workaround for that separate baseline failure is included.

## Integration and limits

`ToolReadEvidence.begin`, `observe` (used by exact original pages), and
`beforeWrite` retain their signatures and fingerprint rules. Added `queue` and
`observeDelivered`; session edits are limited to native response queuing, delivery
after the actual writer call, and removing end-of-batch credit. Catalog, original
paging, review/parser, budgets, wiki checkpoint ownership, save/undo and combat
proof implementations are untouched.

No external model/DB, authored game content, full app build/gates, browser, push,
PR or merge was run. The lead owns integrated whole-goal validation and the
required subsequent ultrabrain review; this evidence is not merge approval.
