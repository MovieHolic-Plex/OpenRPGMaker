# P3 documentation handoff

## Accepted plan metadata follow-up

After documentation commit `feb044fa9395019af63bb677c69c9dc4642b4a19`, the lead
explicitly authorized including the existing plan metadata unchanged. The lead
reports independent acceptance of item6 and integration at `9b2782f18`, including
the raw 872/872 result, all eight native scenarios, source hashes and cleanup.
Items 5 and 6 are checked with their exact evidence; gate 13 remains unchecked.
This acceptance doesn't complete the overall goal or replace final P3 approval.

This follow-up includes only `.omo/plans/ai-harness-omo-adoption.md` and this report
update. The plan's SHA-256 is unchanged from the prior handoff:
`13a1237a2184bd22536fa8cc75a3c02976d06f80ec4eb01c7927628554257dd6`.
No checkbox or evidence text was rewritten. The earlier foreign-plan cleanliness
block below is historical and is resolved by this explicit inclusion permission.
The initial human deadline/execution-envelope limit and history-transport isolation
warning remain unchanged in the committed wiki and evidence README.

No behavior validator, wiki gate or investigation was rerun. The scoped staged
diff check, unchanged plan hash, direct commit exit, final index/file hashes and
whole-tree cleanliness are recorded in `raw/metadata-delivery.json`; the original
`raw/delivery.json` remains the receipt for the first documentation commit.

## Outcome and scope

This documentation-only change records implemented client-local run retirement,
stale-base rejection and preserved P1/P2 contracts. It updates the matching AI
Panel/tools, observability and testing pages, the P3 evidence README and generated
OpenWiki INDEX. No product, test, QA, dependency, schema or plan behavior changed.
It doesn't mark the overall goal complete or grant whole-P3 approval.

- Task: `st_01a07cd1`; parent/root: `01a07564-2645-75ee-8627-2f0990a25d52`.
- Sole writable worktree: `/home/main/z-project/rpg-zzu-ai-harness-p3-20260907`.
- Every shell command used `TMPDIR=/dev/shm/rpg-zzu-ai-harness-p3-01a07564`.
- All authored edits used the installed `apply_patch`; INDEX is generator output.
- No full gate, build, native browser, product test, nested agent, moving-main
  fetch or protected PR operation was run by this node. This is prose-only work;
  no prose-pinning test was added.

## Source and index binding at entry

| Field | Observed identity |
| --- | --- |
| Source HEAD | `9b2782f182cd1ae0b8fc8862de51a001a7ff3884` |
| HEAD / index tree | `2fdc1dbd9ed48c3818cd24f5745560b1e3128b0a` |
| Product src tree | `8b2265557ab9ae5eb12beb068036a165adb02d35` |
| Shipped test tree | `9a6c37fbd506975524aa55ee0347f78dbea53f5f` |
| Index-file SHA-256 | `304f656ea26215fce543ef1decc66326197f47b937020874ad4024aed8a04eb8` |
| `git ls-files --stage` SHA-256 | `774078be791763b458df22d4ea4ebfcfdc5615b6acd01820b27a82fbb05a4374` |
| Approved merged P2 | `f22d64f7c2d95247189e8dacbffecc90dd0721d7` |
| Metadata-only bootstrap | `3eceba70c0d58af825ec0ca5423f1468fd8dcd5e` |

Native execution labelled precommit HEAD `d5d5c015f`, but its tested index and
working source hashes bind it to the integrated commit above. The docs commit
changes only documentation, not those product/test/QA bytes.

All ten P3 product paths were inspected, through focused reads and actual diffs.
Their working SHA-256 values at this source are:

| Path | SHA-256 |
| --- | --- |
| `src/ai/assistantSession.ts` | `874f5a5101c24dc07f9ace58d65b169e3389abe2f77e63f43ed4e2718bdfa7f1` |
| `src/ai/runOperation.ts` | `02780e549c601983d44a11f20965b6455ea4b3f16e2253a2f2fdee4b645c2b9b` |
| `src/editor/aiAssistantBridge.ts` | `8c28f072c86cb8a4e99786e254abec7cc56b14a4a8cee1d36ec500efad5207de` |
| `src/editor/panels/aiChatPanel.ts` | `8d1cafa3f7066c8e0b45c5485208a04bf02347e091149304bb01413133544a7c` |
| `src/editor/panels/aiProposalCard.ts` | `7e613446d50ed4f388a45518524287bbffe102c3dcbeceb288fe0436d643ccec` |
| `src/editor/panels/aiTurnRunner.ts` | `953758338005d1b58ebfed0fb0ab52152f0c7d055bf7fe80736f4e82531f4044` |
| `src/editor/panels/clusterAiModal.ts` | `963f22f09c6a222743838492d79aaf197bcde62e091c080814c85d524888f6a4` |
| `src/editor/tools/applyChangesetToStore.ts` | `c8c78ec6c8c9c3b9d02b7638e1b757ec9e1b4d53cc5cb313175373d9de86f6e8` |
| `src/project/store.ts` | `11aee18a0e04f6e5f28d6630cd18d4c596929a0a3c72ab61f244df7fa4521763` |
| `src/project/legacyDbProjectSync.ts` | `9fd14d6496c7bee89c221da2d17cbcbd31fbc9074151e37839733b2cfa6853a6` |

## Instructions and producer evidence reviewed

Read the parent phase-p3 execution contract, scoped AGENTS, quickstart, INDEX,
PROJECT_WIKI, CPEN wiki instructions and matching AI/observability/testing sections.
Read all P3 producer/integration reports: frozen baseline; epochs; synchronous
reentry; preservation/isolation audit; runner-slot and exact-case extension; stale
base and key-order correction; both QA RED producers including the human record
follow-up; the late-green gap packet and corrected calibrated proof; integration.
The final human report was read through its historical tail, not just its addendum.

The lead's preserved item5 marker is `accepted:true`, scoped to item5 and permission
to start item6, not whole-P3 approval. It explicitly rejects the earlier gap packet.
The integration baseline manifest remains `passed:false`, direct exit 1. Neither
old producer handoff language nor later passing totals overrides those scopes.

## Contracts documented

1. **Execution ownership.** Capture `getRunOperation()` before asynchronous work.
   `retireRun()` revokes old authority; `RunOperation.wait` releases its caller
   without waiting for an uncooperative producer. Terminal snapshots and successful
   tool/protocol accounting precede synchronous callbacks. Normal authoring settlement
   still allows valid current-owner error proposals and later P1 proof.
2. **Runner slot and retained work.** Abort allows B without awaiting A. Backend
   authority and controller-slot identity are separate. A releases only its own
   orphaned slot, never B's; the actual same-runner C send remains part of the
   contract. Already-applied content survives. Cancelled pending work can support
   authorized same-goal resume, while explicit new goal retires its authority and
   detached payload before preparation, preserving immutable history and live work.
3. **Captured base and synchronous write.** Required `ProposalBase` carries frozen
   store lineage/generation, project identity and authored/world comparison strings.
   The adapter compares content even if counters match, accepts no-op/own-save and
   object-key reorder, rejects value/array-order changes and same-byte replacement
   lineage, then rechecks immediately before undo/replacement. Ordinary world
   preservation and reset-world matching remain distinct. No asynchronous global
   queue or late whole-project replay is claimed.
4. **Rejection and new work.** `stale-base`, `retired-run` and `commit-rejected` are
   separate adapter reasons. Stale rejection creates no undo/mutation/commit/early
   apply callback. Ask can inspect the detached draft without offering its calls.
   The next authorized non-question user authoring turn rebases and recalculates,
   rather than replaying stale tools. The native unassessed case is
   `failed / unassessed / draft`; P2 still owns other goal assessments.
5. **P1/P2 preservation.** Early local `onApplied`/`recordAppliedMutation` isn't a
   save receipt. Actual commit completion, accepted project save and current proof
   stay separate. Requirements, exact-scope verdicts, independent outcomes, user-only
   withdrawal/new-goal/Continue, Ask, immutable history, wiki apply/save ownership,
   ordinary/milestone apply, undo, region approval and advisory policy remain intact.
6. **Observation and isolation.** Bridge/result notifications are owner-bound.
   Native late-cancel awaits the original host promise plus terminal activity, not
   an already-resolved terminal signal. Unit history transport needs independent
   isolation; turning off ProjectStore persistence alone is insufficient. The six
   known ambient history pairs were deleted and independently absence-checked,
   not generalized to other IDs or unmeasured project rows. Vitest needs explicit
   top-level `cacheDir`; native/build `VITE_CACHE_DIR` doesn't establish that.

## Observed verification, not rerun by docs

Read direct integration receipts: focused, app typecheck, build, completion-wrapper
contract and all eight final native commands exit 0. The original focused JSON
contains 872 passed, zero failed/pending tests; the integration report identifies
52 files. This isn't evidence that the red full baseline passed.

| Native packet | Reviewed SHA-256 | Result |
| --- | --- | --- |
| `integration/native-late-cancel/actions.json` | `6258c8d200570fbd1ee736ef2a3d2eb6f5d4748a9df6d49bcd4c1482a5d589f3` | Exit 0; 19 checks, no page/route errors or late observations; actual detached completion observed. |
| `integration/native-human-edit-race/actions.json` | `83d9586a09dcb3bcce23ecdc32029e6b3944397ae39c4b5bc0153dace7552b53` | Exit 0; 39 checks, no page/route errors; tile 7, width 336, existing item price 137 retained; zero apply receipts and two rejection notifications. |

The [README](../README.md) preserves exact completed native and 52-file test
commands. Its cache/port/env values come from raw command receipts, not guesses.
Notifications aren't adapter invocation counts. Subjective pixels, external MCP
HTTP and remote telemetry aren't established by window-bridge/DOM evidence.

Original failures remain visible: P2 late-cancel has eight violations, final P2
human attempt-05 has eighteen; terminal-only apparent GREEN is an unaccepted
verification gap. Integration's first human attempt exits 1 on the two recorded
deadlines with invalid release ordering, then isolated identical source/scripts
pass. The concurrent-load limit isn't converted to a product fix or arbitrary-load
guarantee. Producer setup/type/expanded-suite failures remain in their reports.
The full baseline remains 198 Vitest failures, 23 pending, one suite-only failure
and seven surface failures, exit 1. Its initial watcher expiry remains incomplete.

## Documentation validators and original local failures

- `npm run openwiki:verify`: direct exit 0, existing structural validator; raw
  stdout and exit are in `raw/openwiki-verify.log` and `raw/openwiki-verify-exit.txt`.
- Markdown LSP diagnostics were requested on all seven changed documentation files.
  The tool reports `No LSP server configured for extension: .md`, not a clean
  diagnostics result. No configuration outside scope was changed.
- Initial `git diff --check`: direct exit 0.
- The first one-off link/command review exited 1 because this report hadn't yet
  been authored: `AssertionError: ('output/evidence/ai-harness/p3/README.md',
  'docs/report.md')`. It stopped before command/hash checks. That is a documentation
  sequencing failure, not behavioral RED. The report was then added at its required
  path; no link expectation was removed. A read-only search also found no shared
  `output/evidence/ai-harness/README.md`; the scoped P3 README is the actual new index.
- Final one-off review: direct exit 0. All 56 new/changed Markdown link targets
  and anchors exist in the phase worktree. The 52-file test argv and both native
  command/env blocks match their actual integration receipts. Every source hash in
  both native race packets matches the current working file, and product/test/QA
  diffs from the source HEAD are empty. `raw/review.json`, `raw/review.log` and
  `raw/review-exit.txt` retain the result. This isn't a shipped prose-pinning test.
- `npm run openwiki:index`: direct exit 0 after staging the final file set.
  `npm run openwiki:index -- --check`: direct exit 0. The generated diff also
  refreshes pre-existing stale P2 coordinates and missing-file inventory; no
  unrelated wiki page or generator was edited. Original generator punctuation
  remains machine output, not newly authored prose.
- `git diff --cached --check`: direct exit 0. The staged set contains only the
  four scoped wiki pages, generated INDEX, evidence README and this report.
  No product tests, full gates or native scenarios were rerun for prose changes.

## Owned cleanup and remaining boundary

This node started no browser/server/port, remote fixture, build or test process and
created no cache or TMPDIR child. It owns only the documentation changes and its
`output/evidence/ai-harness/p3/docs/` evidence. No producer packet, shared cache,
dependency, foreign fixture/worktree or shared TMPDIR root was removed. Reports
and raw docs-validator receipts are intentionally retained for lead preservation.

The tree already contained a lead-owned unstaged
`.omo/plans/ai-harness-omo-adoption.md` edit at entry, SHA-256
`cf1b163774bfc75b206da801c70a9fa3b27296542a83268d1e71389a12ba5181`.
It changed again externally during this turn. This node didn't edit, stage, restore
or commit it. Whole-worktree cleanliness cannot be claimed while that foreign edit
remains. The observed precommit foreign-plan SHA-256 is
`13a1237a2184bd22536fa8cc75a3c02976d06f80ec4eb01c7927628554257dd6`.
The final docs commit identity, index/hashes, direct commit exit and scoped versus
whole-tree status are retained separately in `raw/delivery.json`, avoiding a
self-referential commit hash in this committed report.

No durable checkpoints, remote schema, distributed/two-tab writer guarantee,
generic DAG/code runner, coach marks, P4/P5 or whole-goal completion is documented
as implemented. Independent final verification, lead gates, protected review/merge
and phase resource cleanup remain outside this documentation handoff.
