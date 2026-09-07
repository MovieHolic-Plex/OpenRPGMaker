# P2 / PR678 main-increment composition verification

## Outcome and handoff

The prepared no-conflict merge is verified at the requested scope and remains **fully staged, uncommitted** for lead finalization. No product, test, scenario or transport-adapter reconciliation was necessary. The only worker additions are this evidence packet; the receipt helper's import formatting was corrected after its own Ruff diagnostic.

- Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-20260906`
- Branch: `agent/ai-harness-p2-20260906`
- Unchanged HEAD: `898740f18dec669ad862dc806e8f8f6c341b5dca`
- Unchanged MERGE_HEAD: `83bd6098d94dd6d7082d2ded6d557be928592623`
- **Actual tested index tree, obtained with `git write-tree`: `234192958b210f6290c4fa7f2aea9f1dfe8e16f6`**
- Tested `src`: `faefee85c07e7ccd07623eea19ab89cde3c8b646`
- Tested `test`: `c852d396f63d820a258a52fda269085d34b54087`
- Tested `scripts`: `9018fdd59f3b38d703bb933dad3d0f725cb8c7de`

Every validator receipt records the actual index tree, clean working-versus-index, zero unmerged entries, and 33 focused working SHA-256/index-blob pairs before and after execution. All six receipts have identical before/after identities (`receipt-checks.json`). `source-audit.json` also proves that every originally staged path is unchanged. Staging this packet changes the enclosing index tree, not the tested source/test/harness subtrees. The evidence-inclusive final tree is printed in the bounded handoff rather than recursively embedded in its own report.

Raw native `sourceSha`/`sourceTree` fields still describe HEAD because the unchanged runner reads HEAD; they are not the tested uncommitted merge tree. The adjacent index-bound receipts are authoritative. Historical raw fields were not rewritten.

No merge, commit, abort, reset, rebase, push, PR operation or full gate was run. Lead alone owns final approval and finalization.

## Direct verification

Every shell command used `TMPDIR=/dev/shm/rpg-zzu-ai-harness-p2-01a07564`. Commands ran from the sole writable worktree. The lead-owned temporary root was preserved.

| Validator | Observed result | Direct evidence |
| --- | --- | --- |
| 74 focused Vitest files, two workers | **1,433 collected; 1,432 passed; 1 baseline-existing failure; 0 pending**, exit 1 | `targeted.receipt.json`, `targeted.log`, `targeted-vitest.json`, `targeted-files.json` |
| Full `npm run build` | **exit 0**: app TypeScript, editor, exported player/SDK, standalone bundle | `build.receipt.json`, `build.log`, `build-artifacts.json` |
| Bun user-image conversion and full native catalog | **38 passed, 0 failed, 69 assertions**, single execution, exit 0 | `vision-catalog-bun.receipt.json`, `vision-catalog-bun.log` |
| Native P2 outcome matrix | **148/148 checks, 10 cases**, exit 0 | `native-matrix.receipt.json`, `native-matrix/actions.json` |
| Native P2 requirements / Ask / real user resume | **107/107 checks, 5 cases**, exit 0 | `native-required.receipt.json`, `native-required/actions.json` |
| Native proof failure / retry / stale live edit | **exit 0**, one applied tool, same-revision retry, no local overwrite | `native-proof.receipt.json`, `native-proof/actions.json` |

The targeted command is `npm test -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=output/evidence/ai-harness/p2/main-increment/targeted-vitest.json` followed by the exact 74 paths in `targeted-files.json`; the full argument array is also in the receipt. This extends the parent compatibility selection with all incoming Vitest test files plus context/read-contract coverage, including monster appearance, catalog, metadata, dependency, serialization and concurrent persistence tests.

Bun command:

```sh
bun test test/ohMyPiVision.bun.test.ts test/ohMyPiFullCatalog.bun.test.ts
```

Native commands, each launched through `run-receipt.py`:

```sh
QA_PORT=39841 EVIDENCE_DIR=output/evidence/ai-harness/p2/main-increment/native-matrix xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario outcome-matrix
QA_PORT=39842 EVIDENCE_DIR=output/evidence/ai-harness/p2/main-increment/native-required xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario required-skip
QA_PORT=39843 EVIDENCE_DIR=output/evidence/ai-harness/p2/main-increment/native-proof xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario proof-failure
```

### Preserved baseline failure

The single failing case is unchanged:

```text
test/assistantSessionIntent.test.ts
의도 선언이 세션 라우팅을 정한다 auto 모드는 같은 선언에도 멈추지 않고 진행한다(F-05)
Expected: 야외 집으로 진행합니다.
Received: 완료 검증이 아직 미완성입니다.
- 집 하나 만들어줘: Missing or malformed criteria: repair_acceptance required
```

`baseline-comparison.json` compares the exact file/full test-name identities and retains full failure messages from this run and the parent `main-compat/verified-targeted-vitest.json`. There are **zero new failed-case identities and zero missing baseline failure identities**. The current raw Vitest JSON SHA-256 is `3cc9f39bda5c00a43dbe94f7da84b649b62393c55a66c538210abb3648881227`. No assertion was changed, skipped or suppressed. The earlier parent report already independently attributed F-05 against pinned main; that baseline/full gate was not repeated.

The lead-supplied 898 full-gate collection count (17,668) and its two previously attributed room-furniture/telemetry-timer red cases are background, not new executions or conclusions here. Those unrelated investigations were not redone.

## Composition audit

Authority read: the parent P2/main-compat report in the QA worktree and shared `.omo/ulw-loop/ai-harness-implementation-01a07564/phase-p2.md`. Audit base is pinned main `147218a2`; incoming main is `83bd6098`, including deferred dependencies `19625c858` and image conversion `a364b0951`.

Of the **75 incoming source/test/harness paths**, 73 match incoming main byte-for-byte. Only `assistantSession.ts` and `assistantDependencyRetry.test.ts` also contain the retained P2 changes. The unchanged P2 acceptance ledger, exact tool-verification evidence, pure outcome module, recap, apply runner, bridge, activity serialization and native scenario modules are checked against P2 HEAD in `source-audit.json`.

1. **Informed monster selection and grounded request budget.** `ToolReadEvidence` delegates appearance authorization independently of generic read requirements. Executed full reads enter a call-ID-bound pending set; only the exact successful data actually present in the post-compaction model request becomes appearance evidence. Index-only, same-batch, lost-to-budget, historical, malformed, mismatched and stale-image cases cannot authorize a new selection. Full snapshots include an uploaded image/meta digest without shipping the data URL. Fresh matching tags authorize exact IDs; intentional transparency, unchanged artwork and custom display names remain valid. The original-context manifest now has reserved tokens and estimator-based history reconciliation; full tools remain exposed, and irreducible overflow fails explicitly. Session, real loopback HTTP, transport-compaction, image-identity and original-context cases all pass.
2. **Deferred dependency composition.** `batchRecordTarget` tracking now runs even when a producer was deferred rather than executed. The recursive ID-reference check therefore propagates an unavailable new enemy through troop and encounter dependents. Existing records remain available after a failed/deferred update; unrelated writes can execute. Deferred dependents do not consume independent retries or count as successful work. The production session tests exercise real metadata delivery, transitive deferral, correction and reference-read requirements. The retained P2 host-authorized resume case still rearms bounded retries and delivers previously pending independent writes once. No requirement is satisfied merely by scheduler completion.
3. **Metadata and persistence proof.** Raw-ID, per-field overrides preserve explicit clears and exact stored data through serialization/package roundtrips; metadata does not register art or retain unused export assets. Change counts reach completeness, safety, preview, construction parsing/audit, commit aggregation and headless summaries. CAS merge applies only locally changed fields. Store adoption remains behind the existing content-lineage guard and never replaces live maps with a late save response; receipt identity still derives from the detached accepted snapshot. Concurrent metadata/audio persistence, lineage and P1 proof tests pass alongside the native current-proof/mismatch/stale-edit scenarios.
4. **User-image transport.** OpenAI-style user parts preserve text/image order, PNG/JPEG/WebP bytes and allowed detail. Invalid/remote URLs, noncanonical base64 and invalid detail fail at the input boundary. The Bun run includes the real pi-ai serializer with scripted HTTP, tool replay and a real worker loopback HTTP 400, plus unchanged full-catalog transport rejection coverage. This is transport verification, not a claim of live model vision reasoning.
5. **P2 exact outcomes, requirements and user authority.** Canonical request source/baselines, exact invocation evidence, advisory/required separation and immutable outcome projection remain untouched. Focused P2 tests retain fabricated/stale/foreign-evidence negatives and apply/ownership/lifecycle cases. Native agreement checks exercise actual session, bridge, getter, activity, recap and outcome DOM across no-change, plan-only wait, current persisted proof, cancelled/applied, stale apply rejection, commit-log fault versus persistence, real remote mismatch, budget stop and legacy assessed/unassessed. Required/optional skips, replan preservation and genuine withdrawal survive. Actual Ask then actual Continue ends **blocked/incomplete/no-change** when the original requirement remains unmet.

The existing wiki extraction response adapter is unchanged: it recognizes the machine-consumed extraction request and returns scripted `{upserts: []}`. The real wiki coordinator/parser still runs. Assumption retained from the approved parent harness: these narrow scripted instructions contain no lasting project lore/design facts. No product gate was disabled, and no scenario assertion or timeout was weakened.

## Diagnostics and execution limits

Before build, directory LSP requests inspected `src/ai`, `src/project`, `src/editor`, `src/assets` and `test`, plus the exact image-converter file. Directory requests are **capped at 50 files each**, not exhaustive typechecks. Product directories reported no errors; assets reported an unrelated async-conversion hint in `transparentColorKeyBackground.ts:37`.

The test-directory response contained 11 existing errors (despite its aggregate header saying zero files with errors): seven missing `AiConfig.authMode` diagnostics in `assistantProposalAssembly.test.ts` at lines 69, 87, 113, 134, 158, 182 and 193; two missing union `capacity` properties in `p1FarmAnimals.test.ts:59,61`; unknown `getChatDock` in `aiChatPanelUxRepairs.test.ts:44`; and an untyped condition-key index in `conditionEvaluatorParity.test.ts:149`. These files and the asset hint file are byte-identical to HEAD (`source-audit.json`). They were not repaired or suppressed. App compilation is green; no all-tests TypeScript-clean claim is made.

Additional exact-file LSP requests returned no diagnostics for `assistantSession.ts`, `monsterAppearanceEvidence.ts`, `store.ts`, `supabaseProjectSync.ts`, `assistantDependencyRetry.test.ts`, `monsterMetadataPersistence.test.ts` and `ohMyPiVision.bun.test.ts`. The evidence helper's sole Ruff E401 warning was fixed by splitting imports; its final diagnostic and Python AST syntax checks pass. Markdown has no configured language server.

Build warnings remain in `build.log`: optional provider configuration, a circular cross-chunk re-export involving `openRecordPickerPanel`, mixed dynamic/static imports, oversized chunks, and `/generated/battle-reference-forest.png` unresolved at build time. Warning settings were not changed.

One attempted native-required receipt startup collided with the concurrently starting native-proof `git write-tree` index lock, before its validator or any native resource was created. `native-required-startup-failure.json` records the command, git exit 128 and wrapper exit 1. No lock was deleted. After native-proof finished and lock absence was verified, native-required was launched serially and passed. The focused Vitest and Bun commands were each executed once. Serialize receipt launches when reusing this helper against one index.

Screenshots are retained. An attempted image read returned **Current model does not support images**. No independent pixel, artwork/species or design verdict is claimed. DOM/action assertions establish the tested behavior; imported upstream visual evidence is not relabelled as independently reviewed. Native responses are scripted, not live-provider reasoning. External MCP and unrelated telemetry are outside these scenarios.

## Cleanup and bounded remaining work

`cleanup.json` verifies all three fresh run-owned fixtures were deleted with real absence reads for project, maps, tilesets, commit records and associated changes:

| Native packet | Run-owned project | Unique port |
| --- | --- | --- |
| Matrix | `qa-ai-surface-bbad9129-c901-4898-993d-33a8c3b59763` | 39841 |
| Requirements | `qa-ai-surface-e4fb195c-b0df-4c41-b435-5830133764a2` | 39842 |
| Proof | `qa-ai-surface-4b6994fe-e53e-40d1-9908-34089b0e1973` | 39843 |

Each native run verified its port free before launch and released afterward. A separate final socket bind independently confirmed all three ports free. Browsers, server process groups, routes, listeners, timers and per-run worktree-local Vite caches were closed/removed; active routes are zero. Existing `.vite-cache` entries and lead TMPDIR entries exactly match the initial snapshot. Port 37025 and other owned worktrees were untouched.

`dist/` already existed before this task. The required full build refreshed it; it remains in place rather than deleting a pre-existing directory. Focused build artifact hashes and current file count are retained in `build-artifacts.json`. No temporary child directory remains from this task.

**No newly demonstrated composition blocker remains.** The known F-05 test failure and unrelated test typing diagnostics remain explicitly reported. This is scoped merge verification, not full-gate or landing approval. Source plus evidence are staged with MERGE_HEAD intact; only lead finalization remains.
