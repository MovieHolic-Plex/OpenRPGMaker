# P2 / latest-main compatibility merge

## Delivered state

The prepared merge is resolved and staged, but **not committed**. Both the P2 canonical-outcome contract and the incoming action/NPC/wiki/catalog/specification contracts are retained. No merge, abort, reset, rebase, dependency installation, full gate, commit, push or PR operation was performed by this worker.

- Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-qa-20260906`
- Branch: `agent/ai-harness-p2-main-compat-20260906`
- Unchanged P2 parent HEAD: `86b39ac178ba111d863b84eabf5d7835125b5ccd`
- Unchanged MERGE_HEAD: `147218a2dcfd5d5996e666395e53626706904a60`
- **Verified resolved index tree:** `93601a27eac5f0c1451358201fdcaea6574c7441`
- Verified `src` subtree: `188f1b659a3a328577d861de36c4708495d02bb3`
- Zero unmerged entries; working content matched the index before and after every final validator.

The verified tree above is from **`git write-tree`**, not `HEAD^{tree}`. Adding this evidence packet changes the enclosing index tree without changing product/test/harness bytes. The final handoff prints that evidence-inclusive index tree separately. `owned-paths.json` contains all 18 worker-owned paths, index blobs and SHA-256 hashes; it also verifies that all other initially staged entries remain unchanged.

## Verification result

All commands ran inside the sole writable worktree with:

```sh
TMPDIR=/dev/shm/rpg-zzu-ai-harness-p2-01a07564
```

The private lead-owned memory root was preserved. Tests used two workers, not a full gate. `run-receipt.py` records the full argument array, working directory, timestamps, direct child exit, exact index tree, and per-file working SHA-256/index blob before and after execution. Each final receipt has identical before/after identities.

| Validator | Result | Exact evidence |
| --- | --- | --- |
| 52 targeted Vitest files, P2 plus incoming contracts | **1,200 collected; 1,199 passed; 1 baseline-existing failure; 0 pending; 0 new failed-case identities**; direct exit 1 | `verified-targeted.receipt.json`, `verified-targeted.log`, `verified-targeted-vitest.json`, `baseline-comparison.json` |
| Full `npm run build` | **exit 0** on verified index `93601a27...`; application tsc, editor, exported player/SDK and standalone bundle | `verified-build.receipt.json`, `verified-build.log`, `build-artifacts.json` |
| Native P2 outcome matrix | **exit 0; 148/148 checks; 10 cases** | `verified-native-matrix.receipt.json`, `verified-native-matrix/actions.json` |
| Native P2 required skip / Ask / user resume / withdrawal | **exit 0; 107/107 checks; 5 cases**, including actual user actions | `verified-native-required.receipt.json`, `verified-native-required/actions.json` |
| Native P1 proof failure / retry / stale live edit | **exit 0**, one applied tool, same-revision retry, no local overwrite | `verified-native-proof.receipt.json`, `verified-native-proof/actions.json` |
| `bun test test/ohMyPiFullCatalog.bun.test.ts` | **14/14 passed in its single run**, exit 0; 42 assertions | `catalog-bun.receipt.json`, `catalog-bun.log` |

The Bun run bound earlier index `b0e1cc08...`; its full-schema transport contract passed before the later exact-verdict-store correction and transport-fixture-only adaptation. Its dependency/catalog/schema bytes are unchanged. It is not relabelled as an execution on the final tree. All final Vitest/build/native executions bind `93601a27...` directly.

The remaining failing identity is:

```text
assistantSessionIntent.test.ts
의도 선언이 세션 라우팅을 정한다 auto 모드는 같은 선언에도 멈추지 않고 진행한다(F-05)
expected '완료 검증이 아직 미완성입니다.\n- 집 하나 만들어줘: Missi…'
to be '야외 집으로 진행합니다.'
```

It remains intact, not skipped or weakened. `baseline-comparison.json` independently compares the actual final failure identity against the lead's supplied latest-main raw Vitest report, SHA-256 `085c0e6c60b05a3ee365acc33b28f46d1e9f4dc4c4ff3c351731e04676e7fcf1`. That baseline contains 16,960 tests, 16,735 passes, 202 failures and 23 pending. The lead's baseline receipt binds main `147218a2...` to tree `882eb36743bb5eeace219bc35877ecb093a0124e`. No baseline execution or full gate was repeated here. The other ten failures in the earlier 1,198-case run were merge interactions and were corrected, not classified as baseline.

## Contract reconciliation

The actual three conflict stages were read and retained under `stages/`, with blob IDs in `unmerged-before.txt`. `reconciliation.md` is the pre-resolution source-backed incompatibility record, not a claim that conflict-marked code could execute. Its initial single-key proposal is superseded by the verified exact-invocation correction below.

1. **Criterion/parser/provider shapes:** both `toolVerdict` and `actionCombat` survive. The flattened P2 provider shape exposes the incoming action discriminator without reintroducing `oneOf`/`anyOf`. Runtime validation still rejects missing/mixed fields, ambiguous targets and fabricated evidence. Schema roundtrips now include existing-map and newly authored-map action targets across requirements, acceptance and repair surfaces (73 provider-schema tests pass).
2. **One canonical acceptance ledger:** immutable P2 request source, original baseline/target binding, optionality and genuine withdrawal remain. Incoming intent-owned action obligations and authoritative current map-bound runtime receipts remain outside replaceable planner IDs. Required verification problems enter the same canonical snapshot; optional or withdrawn authored promises do not become verified merely by denominator exclusion. Tests combine those facts rather than testing only isolated happy paths.
3. **Exact evidence versus navigation repair:** incoming same-NPC/assertion navigation correction still replaces the corresponding failed normalized obligation; weakened assertions and foreign NPCs remain distinct. Within the same `ToolVerificationEvidence` instance, a set retains every independently observed exact explicit pass. Negative results revoke their exact pass; writes/changed applied revisions clear all current exact passes; advisory checks cannot create or renew them. Thus two distinct passing exact invocations can coexist without donating proof to unexecuted arguments. No second requirement ledger or source of satisfaction was introduced.
4. **Required versus advisory:** `problems("required")` includes explicit failures, declared required tools and skipped-item obligations. Pure advisory failures remain in full problem/audit reporting but do not become new goal obligations or suppress a satisfied milestone's P1 proof. Both ordinary and milestone apply now retain the same P2 outcome policy, while incoming mandatory scene/action failures still block completion.
5. **Session lifecycle:** wiki preparation remains awaited before intent and original authoring context. Failed/aborted wiki checkpoints publish typed failed/cancelled results. P2 reactivation remains after the intent decision and requires explicit host resume or the existing permitted non-Ask continuation. Questions retain blocked state, retry counters and goal evidence. Fresh questions recapture original-data context independently of retained goal evidence. NPC reward requirements remain retained for resume but are not injected as active obligations into Ask.
6. **Incoming per-map/dependency behavior:** map-owned specs, map-local successful expansion, failed-write dependency deferral, per-target retry budgets and corrected scene navigation remain. No incoming relocation, audio metadata/persistence lineage or unrelated editor/runtime implementation was overwritten. Targeted tests cover actual relocation execution, NPC rewards, wiki application, original grounding and audio persistence alongside P1 proof.
7. **Intent/footer/catalog:** PR667's complete first Do catalog intentionally supersedes the old selective schema-absence assertion. The revised test asserts both names are exposed and the actual declarer receives only the original instruction, never the appended context footer. Existing Ask and inferred-question negatives still assert no write schemas, actual write refusal, successful read execution, unchanged project/plan, and typed no-change outcome.

Source commits inspected include `df6b0c4b4` / `272443788` (full catalog/originals), `7e55a2f70` / `69e83d466` (action evidence), `6d1e855a0` / `cdd9c9017` (per-map/dependent writes), `4f6858372` (blocked-event relocation), and the actual `5003e3f06` audio/persistence-lineage merge. The semantic auto-merges in DESIGN, tools wiki, acceptance evaluation, recap, Panel, proposal card, runner and autonomous-surface double were reviewed. Acceptance evaluation required adding `actionCombat` to both exhaustive target switches; the other UI/recap/spec auto-merges were retained.

## Faithful intentional test adaptations and retained REDs

- `initial-targeted.log`: 12 failures / 166 tests after first textual reconciliation. It exposed action target-switch failures, stale original-context lifecycle, wiki-before-intent ordering, Ask reward-note injection, and expected full-catalog/schema assertion conflicts. It is an early working-tree diagnostic run, not final staged-tree verification.
- `targeted.log`: 11 failures / 1,198 tests on index `90371114...`. Besides F-05, these were six next-turn accounting status errors, two injected-runner exception expectations, one retry authorization case and one milestone/advisory collision.
- `milestone-red.log`: direct assertion records the passing map-dimensions item plus the erroneously required automatic lint finding. The required/advisory distinction fixes the cause; no lint result is suppressed.
- `aiCompletionAccounting` still tests failed/throwing writes, unchanged maps/specs, successful expansion, implicit expiry, unapplied drafts and no replay. Its second ordinary request no longer assumes that arbitrary prose resumes a stopped canonical goal or resets the bounded repair counter.
- Both injected-runner tests now assert P2's structured `stoppedReason: error`, exact injected error and typed failed/incomplete/no-change, while preserving the failed tool response and unchanged spec/map checks. Returning a typed failure is not suppressing the exception.
- The target-retry test now supplies actual host `goalAction: resume`; it still proves four-attempt exhaustion across spelling/page-path changes and unrelated writes, then rearming and correction. It additionally proves previously pending independent writes are retained and delivered once instead of being erased. `interacting.log` retains the transitional failure that exposed this pending-write expectation.
- `exact-invocations-red.log`: one failure proves that the initial normalized-key reconciliation incorrectly discarded the first of two independently passing exact invocations. The final 8-case scene-repair suite passes, including advisory/write invalidation negatives.
- `typecheck-initial.log`: the first app typecheck returned 2 for an insufficiently typed merged promise metadata union. Explicit merged metadata typing corrected it. Later app typecheck and all full builds returned 0.

## Native transport adaptation and real surface evidence

The initial completely unchanged native runner failed because its P2 responder treated **every tool-free request as intent**, returning `{mode: ...}` to the newly incoming wiki extraction checkpoint. The real parser correctly rejected `Unexpected wiki field: mode`; the later cancellation case could not reach its expected save event. `native-outcome-matrix/` retains the entire failure, including 24 failed checks out of 44, the bounded event timeout, screenshots and successful remote cleanup. This is a transport-fixture incompatibility, not a passing browser result.

The only harness adaptation imports incoming `test/wikiTransportFixture.ts` and uses `isWikiExtraction` to recognize the machine-consumed request payload, returning scripted `{upserts: []}`. **Assumption: these narrowly scripted contract instructions contain no lasting project lore/design facts.** The real wiki coordinator/parser still executes; it is not disabled or mocked away. All other scripted responses, scenario definitions, assertions, event gates, timeouts and real remote operations are unchanged. `unchanged-scenarios.json` proves byte equality against P2 HEAD for the scenario/observation/resume/proof/cleanup modules. The lead explicitly accepted this transport-only adaptation.

The final native runs exercise the actual editor, registered bridge, session, tool runner, apply adapter, activity serialization, recap and visible outcome DOM. They cover query/no-change, plan-only wait, current persisted proof, cancelled/applied, stale-draft rejection, injected commit-log HTTP 503 versus successful project persistence, real remote proof mismatch, budget stop, legacy assessed/unassessed, required/optional skip, preserved replan, genuine user withdrawal, Ask and actual Continue. The resumed unmet requirement ends blocked/incomplete/no-change. The separate P1 run proves retry without replay and preservation of a newer live edit.

Final owned projects and ports:

| Packet | Fresh owned project | Port |
| --- | --- | --- |
| `verified-native-matrix/` | `qa-ai-surface-6306a729-de8a-4d0f-8076-d6dcc54543a6` | 39767 |
| `verified-native-required/` | `qa-ai-surface-fbd370ed-41ee-4e98-8366-473190fb41e8` | 39768 |
| `verified-native-proof/` | `qa-ai-surface-182621f8-12fd-4775-a44c-8cb57d19fdd4` | 39769 |

Raw native `sourceSha`/`sourceTree` fields still describe the uncommitted P2 parent because the existing runner reads HEAD. **They are not the tested resolved tree.** The adjacent `verified-native-*.receipt.json` index bindings and working/index hashes are authoritative for this merge verification; raw historical fields were not rewritten.

## Diagnostics, cleanup and limitations

- LSP diagnostics were requested on every worker-edited product/test/harness file. All returned no diagnostics except fresh `assistantSession.ts` requests timed out at the tool's fixed 3-second limit. Its actual app compiler/build passed. Markdown has no configured server. `diagnostics.json` records these limits; no timeout or type error was suppressed.
- Full builds retain warnings for optional provider configuration, mixed static/dynamic imports and oversized chunks, and the unresolved runtime `/generated/battle-reference-forest.png` reference. These are recorded in raw build logs; no warning settings were changed.
- `cleanup.json` verifies **all seven** run-owned remote fixtures, including failed/intermediate runs, were deleted with actual absence reads. Native cleanup closed browsers, servers, routes, listeners, timers and each unique worktree-local cache. Ports 39763-39769 were independently rebound successfully at final cleanup. Port 37025 was never used or touched.
- The newly created, untracked `dist/` was hashed (2,001 files) and removed. Its pre-task absence is recorded. The existing `.vite-cache` parent and lead-owned TMPDIR remain; unrelated resources were not removed.
- Screenshots are retained, but the image tool reported that this child model cannot view images. No independent pixel/design verdict is claimed. Native DOM/action assertions establish the tested user-visible behavior, not visual approval or the entire desktop matrix.
- LLM responses are scripted; real provider reasoning and live OAuth catalog acceptance were not tested. Wiki extraction uses the no-lasting-facts response described above. Commit-log failure is an explicitly injected HTTP fault, not a claimed remote outage. External MCP HTTP and remote activity telemetry are outside these native tests.
- No full gates or landing approval are claimed. The lead owns final review, full-gate composition and the eventual merge commit. This worker leaves the merge uncommitted.
