# P2 outcomes: contracts and evidence index

Items 3 and 4 are implemented with producer verification and independent real-editor surface GREEN. This isn't P2 approval. Gate 12 stays unchecked until the lead completes supervisor gates, exact-head review, approved merge and cleanup. No checkpoint recovery, general execution-epoch framework or later-phase work is claimed.

## Contract map

- [Panel/session contract](../../../../openwiki/editor-ai-panel.md#p2-run-outcomes-and-user-scope-actions-2026-09-06): execution is the actual stop decision, goal is the canonical assessment, delivery is this run's actual pending/applied/save/proof state.
- [Tool input and exact verdict](../../../../openwiki/editor-ai-tools.md#p2-requirement-and-exact-verdict-inputs-2026-09-06): native requirement parsing, full invocation keys and explicit/advisory lifetime.
- [Publication boundaries](../../../../openwiki/editor-observability.md#p2-outcome-publication-2026-09-06): original result settlement, live getters, bridge, activity and recap compatibility.
- [Pure projection source](../../../../src/ai/runOutcome.ts), [canonical ledger](../../../../src/ai/assistantAcceptanceLedger.ts), [session owner](../../../../src/ai/assistantSession.ts).

The existing acceptance ledger remains the sole satisfaction authority. Bare unassessed scheduler plans and explicit canonical legacy acceptance aren't interchangeable. Optionality or genuine withdrawal changes only the required denominator, not observed evidence. Skip/replan retains original obligations, source, targets and request baselines. Model flags can't withdraw requirements, authorize resume or supply proof. P1 receipts, current read-only proof, image evidence, auto-apply/undo, region approval and advisory behavior retain their authority.

Pending draft wins the delivery display without erasing applied milestones. Only pending calls are applied; proof retry doesn't replay applied tools. Fresh queries can't inherit another run's delivery. Questions retain blocked work/evidence; the actual Continue action, not Ask text or a model claim, changes the Panel to Do and authorizes resume. A resumed no-write run can still end blocked/incomplete/no-change.

## Producer record, read in chronological context

These are prior executions, not tests rerun by the documentation node. Counts below were checked against their raw Vitest summaries; exact commands and captured exits are retained in the linked producer reports. Don't add overlapping suites into a fictional aggregate pass count.

| Track | Report and raw evidence | Verified checkpoint and limit |
| --- | --- | --- |
| Baseline | [baseline.md](baseline.md), [command/exit receipt](baseline-tests.receipt.json) | P1 source reuse and existing characterization only, not P2 GREEN. Historical P1 build/gate limitations remain. |
| Requirements | [requirements.md](requirements.md), [final test output](requirements-source-utterance-green.log), [typecheck](requirements-source-utterance-typecheck.log), [build](requirements-source-utterance-build.log) | 124 tests, producer reports exit 0 for tests/typecheck/build. Real session/native tools; not browser proof. |
| Pure projection | [outcome-model.md](outcome-model.md), [GREEN](outcome-model-green.log), [completed typecheck](outcome-model-typecheck-complete.log) | 437 normalized-fact tests, producer reports exit 0 and direct Node API proof. Doesn't establish honesty or freshness of owner facts. |
| QA contracts | [qa-contract-red.md](qa-contract-red.md), [qa-user-actions-red.md](qa-user-actions-red.md), [original hashes](qa-raw-evidence.sha256), [user-action hashes](qa-user-action-evidence.sha256) | Actual old-source missing-contract and Ask-mutation RED. P1 proof-failure GREEN belongs to those old-source runs, not a fresh final-head execution. |
| Integration | [integration.md](integration.md), [entry-owner GREEN](integration-entry-green.log), [build](integration-entry-build.log) | 657 tests, producer reports tests/build exit 0. Historical browser exit 1 retained for then-absent UI hooks, not relabelled as a full pass. |
| UI | [ui-outcomes.md](ui-outcomes.md), [current explicit-action report](ui-explicit-resume.md), [GREEN](ui-explicit-resume-green.log), [build](ui-explicit-resume-build.log) | 133 tests, producer reports tests/build exit 0. The explicit `userResume` correction supersedes the earlier token-based RunSurface switch. |

Requirements follow-ups remain separately preserved: [question dispatch](requirements-question-dispatch.md), [legacy/link independence](requirements-link-independence.md), [bounded comparison cost](requirements-cost.md), [original utterance](requirements-source-utterance.md). Their then-uncommitted notes describe their experiment time; the final requirements handoff records delivery. Integration also retains [fixture writer drainage](integration-fixture-drain.md) and [blocked Continue availability](integration-blocked-control.md), including their then-unresolved UI failures.

Committed current-source UI packets are [outcome-matrix](ui-explicit-resume-outcome-matrix/actions.json) and [required-skip](ui-explicit-resume-required-skip/actions.json). [Source binding](ui-explicit-resume-binding.log) accompanies real [1024 click](ui-continue-reachable-1024/continue-action-result.json), [1280 Enter](ui-continue-reachable-1280/continue-action-result.json) and [typed/bridge Ask negatives](ui-negative-continue-surface-final/negative-user-actions.json). Pixel review is separate from DOM geometry and action assertions; this documentation node claims no independent visual verdict.

## Independent surface packet and source binding

The surface node subsequently ran the native scenarios independently, without changing source or assertions. This documentation node rechecked its raw commands/exits, each machine check, source hashes against working files and committed blobs, and artifact hashes. It didn't rerun the editor or perform another remote read.

Execution HEAD: `4d37972c6aa51d672b7e14fcae6243cb30e8e139`.
Tree: `ca45a9f8a8e2ae24616765ae792bab712859fb41`.
Source subtree: `45c9a7a48f1f1c3eb9cfea2966ac477c86307957`.
The last product commit is `383c27539d8ce94846c660bf45c2a070dfd9b940`; `git diff 383c27539 HEAD -- src test scripts/qa` is empty at this documentation entry head.

**Local evidence, pending lead delivery:** `surface.md`, `surface-binding.json`, `editor/`, `required-skip/` and the `surface-red-*-check.log` files remain ignored in this worktree. They aren't silently presented as shipped files by this documentation-only commit. Paths below are relative to this directory; the lead owns their raw publication. The committed UI packets above remain available independently.

```sh
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/editor xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario outcome-matrix
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/required-skip xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario required-skip
```

| Raw packet | Direct exit | Machine checks | SHA-256 of `actions.json` |
| --- | --- | --- | --- |
| `editor/` | 0 | 148/148 | `5c25b971e324cbe1a3b9bb89028a61da5116a972f0b725acc703b624c9d8009f` |
| `required-skip/` | 0 | 107/107 | `be7cfa1a8cbee23179c5912f51ddf42c5773d3a6d83505709a55074548cc7443` |

`surface-binding.json` SHA-256: `86e311c3aaf8cae4165cf57e3ef922810837dfaf9e500437a968670130842885`. Each run binds 27 source/harness/UI paths to working bytes and HEAD blobs. The packet inventories 17 and 16 raw artifacts respectively; every artifact hash matched during documentation verification. Both raw actions have `pass:true`, `assertionsPassed:true`, no case failures and no page/route errors.

Observed matrix outcomes, in execution/goal/delivery order:

| Actual boundary | Outcome |
| --- | --- |
| Query with a foreign receipt; bare legacy skipped plan | response-final / unassessed / no-change |
| Plan-only wait | awaiting-user / unassessed / no-change |
| Ordinary apply with current remote proof | response-final / unassessed / persisted-verified |
| Abort after milestone save while proof read is held | cancelled / unassessed / persisted |
| Live house ownership edit rejects stale draft | failed / unassessed / draft |
| Commit-log HTTP 503, real project save/proof succeeds | response-final / unassessed / persisted-verified |
| Accepted save, real remote-content proof mismatch | response-final / unassessed / persisted |
| Actual tool-call budget stop | budget-exhausted / unassessed / no-change |
| Explicit canonical legacy assessment | response-final / satisfied / no-change |

Required-skip keeps the unmet event and zero real events; optional skip clears only the required denominator. Replan retains the unmet original requirement. Real withdrawal changes the live goal to satisfied while execution remains blocked, and preserves original source and false evidence. It doesn't rewrite a previously published activity row. Ask preserves blocked work; real Continue changes actual dispatch to Do, reactivates the same item in flight, then settles blocked/incomplete/no-change when no required content was authored.

Cleanup receipts bind fresh owned projects `qa-ai-surface-d4eca52f-82cf-4be2-bcbf-707d761258a7` and `qa-ai-surface-c99c576c-6b93-48d7-ac37-9244d58c7257`. Both report pre-create absence, owned deletion and post-delete absence, closed browser/server/cache/listeners/timers, released port, `activeRoutes:0` and `reusedListener:false`. This is a recheck of recorded cleanup evidence, not a new live absence check.

## Ordered implementation checkpoints

Verified using `git log --reverse --format='%H %s' 58105616b..HEAD`. Interleaved evidence-only commits remain in Git and the producer reports; this list selects implementation/harness checkpoints rather than claiming a complete log:

1. `a258dfaad4fc3eb763c09e93fb251b152bab4901`: requirements and question-safe continuation.
2. `c6de2da052373e80aea9f5ec7d7293a64f178df4`: requirement authority review corrections.
3. `919ac0f940135b39250840c5c22627377210d96e`: imported pure outcome projection.
4. `f59c1b4dc055c2df632279ed6d30f25a13cc436e`: imported real-surface contracts.
5. `0ef465d1419561a7f137f2c4636fedfb06eb8bd6`: imported real Ask/resume contract.
6. `f4ae6118e5e44fe8f3d29727fb6fd15f1a75cd66`: shared result/apply/publication settlement.
7. `bd836d57ae238405f9388dd346a35ca8371df242`: fixture writer drainage.
8. `89584faf0470cfc4601fd791180ff1f659ec7e95`: blocked Continue availability.
9. `841ee4ae1fc7cd2564e857a2a8860a91a1e6c3e3`: typed stops and continued delivery settlement.
10. `016818b8c78efbb839de6464c5932b425d423942`: pre-await fresh delivery ownership.
11. `c8fa4e965396cb53bc2f453a02c7752b64c4a0e3`: outcome presentation and scoped withdrawal.
12. `383c27539d8ce94846c660bf45c2a070dfd9b940`: explicit Continue-only mode authorization.

## Preserved failures and verification limits

- Missing-module RED proves API absence only. Fixture precondition failures, invalid native arguments, hidden-selector failures and boot/setup failures aren't behavior RED. Faithful corrected contract failures are retained beside them, never substituted silently.
- Requirements retains its initial intent-cache isolation failure. Integration retains oversized-fixture timeouts, the timed-out combined run with partial failures and its later small-fixture/serialized GREEN. UI retains stale Ask dispatch failures, the timed-out test attempt and the negative supplement's activity-observer collision. See the reports for exact commands and exits; a timeout without captured process status isn't exit 0.
- Tests that execute session adapters don't prove browser boot. The native surface executions prove their own editor boot and real UI/bridge/tool/store paths, not every headless test-double boot path. No full test gate or fresh build was run for this prose change.
- Builds retain optional-provider configuration warnings, circular record-picker chunks, mixed static/dynamic imports, unresolved runtime forest image and chunk-size warnings. The historical P1 full gate's exit 1, legacy failures and unhandled-error-reporting limit aren't erased by focused GREEN.
- Ordinary surface cases script LLM transport only. The commit-log HTTP fault is explicitly injected, not a remote outage. Local activity serialization and the registered production window bridge are real; external MCP HTTP and remote activity telemetry aren't covered. P1 proof-failure support is preserved, but the independent final surface node didn't rerun that standalone scenario.
- Markdown has no configured language server. Documentation verification is source/API review, raw evidence/source binding, new-link/anchor checks and scoped `git diff --check`, not prose tests. Existing raw logs are unchanged, including their whitespace warnings. Lead gates, exact-head approval, merge and Phase cleanup remain separate obligations.
