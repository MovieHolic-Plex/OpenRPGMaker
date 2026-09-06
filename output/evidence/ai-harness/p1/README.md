# P1 persistence proof report

P1 binds AI storage proof to an accepted save revision and verifies its target
and normalized content with a nonmutating remote read. Failed proof can retry;
newer live edits aren't replaced or marked verified by historical evidence.
This report documents the implemented contract and recorded runs on
`agent/ai-harness-p1-20260906`, not release approval or later-phase delivery.

## Contract and ownership

- [Store contract](../../../../openwiki/runtime-project-schema.md#p1-accepted-save-receipts-and-read-only-proof-2026-09-06):
  `flush().receipt`, `verifyPersistedRevision` and
  `isPersistenceReceiptCurrent`. Receipts are in-memory, exact-object tokens for
  accepted normalized content, not durable checkpoints or wire-hash proof.
- [Session contract](../../../../openwiki/editor-ai-panel.md):
  `proveAppliedRevision`, `RunEndProofState` and `persistence_proof` events serve
  autonomous completion and ordinary applied proposals. Only a current matching
  proof emits `agent_run_saved`. Whole-goal satisfaction isn't inferred.
- Optional commit ids come from the actual apply result and its captured store
  object, never a newest-row query. Commit-log failure is separate from project
  persistence; the editor run observed `commitId:null` with successful proof.
- Existing auto-apply/undo, region approval, ask/plan/resume and explicit/advisory
  contracts remain in place. There is no new retry UI, requirements ledger,
  RunOutcome projection, checkpoint recovery, epoch protection or P2-P5 claim.

## Recorded RED and GREEN

These are inspected upstream execution records, not commands rerun by the docs
node. Detailed commands and raw output are retained in the linked reports.

| Evidence | Exit | Meaning |
| --- | --- | --- |
| [Store RED](persistence-red-bounded.receipt) | 1 | Before production edits, 12 failures reached absent receipt/verifier APIs, not an old verifier falsely succeeding. |
| [Session RED](session-red.receipt), [log](session-red.log) | 1 | Before production edits, a real session completion read returned HTTP 503 but emitted one saved sentinel instead of zero. |
| [Retry RED](session-retry-red.receipt) | 1 | Two retry regressions before the retry fix. |
| [Session GREEN](session-green-final.receipt) | 0 | 85 tests across four files; [preserved contracts](session-contracts.receipt) add 47 passing tests. |
| [Surface related tests](surface-tests.receipt), [log](surface-tests.log) | 1 | 89 passed, six established legacy store failures, not a wholly green suite. |
| [App typecheck](surface-typecheck.receipt) / [full build](surface-build.receipt) | 0 / 0 | Recorded combined-source validation; warnings remain in raw logs. |
| [Browser mutation RED](editor-red.receipt), [log](editor-red.log) | 1 | In-memory removal of proof guards is caught: real content mismatch incorrectly becomes verified. Product bytes aren't changed. |
| [Exact editor](editor.receipt) / [exact remote](combined-remote.receipt) | 0 / 0 | Both required real-surface commands passed. |

The six legacy failures are reproduced on unchanged production source in
[persistence.md](persistence.md): activity POST/fetch-count assumptions,
three missing dev-fixture responses, invalid test authentication, and extra
missing-project fetches. They weren't skipped or repaired to claim GREEN.
Initial boot, port, import and command-timeout failures remain recorded and
aren't counted as successful behavioral RED. See [session-proof.md](session-proof.md)
and [surface.md](surface.md) for their exact limits.

## R1 boundary corrections and follow-up

Review of `7671a7dc` found three counterexamples that the original passing
surfaces did not cover. Each correction has independent failing-first tests
and an actual API probe:

- [Receipt lineage](r1-001.md): an accepted save finishing after load/reload/adoption
  remains historically provable but cannot regain current-editor authority.
- [Apply correlation](r1-002.md): synchronous subscriber edits cannot borrow the
  earlier AI apply's commit id; the mutation-boundary snapshot is retained.
- [Proof publication](r1-003.md): reentrant or overlapping attempts cannot publish
  stale success or overwrite the newer attempt's state.

GitHub records PR #647 merged at `2026-09-06T12:06:45Z`, with head `7671a7dc`
and merge commit `c26f7398`, before final ultrabrain approval. That merge is not
retroactively approved by these corrections. A successor corrective PR must
receive fresh combined-tree verification and exact-head ultrabrain approval
before its merge; P2 cannot start until that P1 delivery and cleanup are complete.
The historical runs below and the individual worker reports are not a claim
that this follow-up has passed its final integration gate.

## Exact real-surface acceptance

```sh
QA_PORT=41583 EVIDENCE_DIR=output/evidence/ai-harness/p1/editor xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario proof-failure
node scripts/qa/ai-harness-remote-proof.mjs --create-isolated-project --scenario all --report output/evidence/ai-harness/p1/combined-remote.json
```

The [editor action record](editor/actions.json) captures HEAD `23bc6838`, real
headed Firefox composer interaction, session/tools/apply/store and live Supabase.
LLM responses are scripted. Target:
`qa-ai-surface-573bdbb5-c9ac-4ebe-a319-d9a588659949`; receipt
`27e9f6dc-5193-4351-a8ba-984ee3e36166`, generation 2. A real remote PATCH keeps
the wire hash unchanged but causes `mismatch-content`, `verified:false` and zero
saved sentinels. Restore plus composer continuation verifies the same receipt
without another project write or tool replay. A gated read with a newer local
store edit yields failed/stale and preserves the live object, bytes and dirty
state; final continuation saves and verifies that newer edit. Six PNGs accompany
the record. They aren't a subjective visual-design pass or proof of human UI
input for the injected local-edit race.

The [combined remote record](combined-remote.json) captures HEAD `5c103676`:
target `qa-ai-proof-9136d6ba-6e46-43f1-88c7-e9f0fe5875c3`, receipt
`c8507f4e-f19f-4842-bb48-b62f90b351cb`, generation 1. Accepted, initial and
restored normalized identity is
`b44812d4a41c4601efc8ef3525e289831dc130832bd2ff24a9e31a8883996414`.
Real changed content mismatches despite an unchanged wire hash; restore retries
the same receipt. Transport 503, wrong target, disable and cancel are explicitly
labeled injections, not observed service outages. Producer `remote.*` artifacts
and their original manifest remain separate from this combined acceptance.

## Cleanup, verification and limits

[surface-validation.json](surface-validation.json) records both isolated targets
deleted with root/child absence checks, browser/server/cache closure, port 41583
released, zero active routes/transports and no pending proofs. The configured
user project wasn't accessed by these runs. Earlier owned fixtures and their
cleanup are listed in [surface.md](surface.md). No listener or remote fixture was
created by this documentation task.

Documentation verification checked the source references, all 33 new relative
links/anchors, and the three source hashes recorded by surface validation.
`git diff --check` passed. Markdown LSP diagnostics were unavailable because no
Markdown server is configured; no prose tests were added or product gates rerun.
Full-repository supervisor gates, review, PR and merge approval are outside this
report's DoneClaim. Historical raw-log whitespace diagnostics are retained,
not rewritten to hide failures.
