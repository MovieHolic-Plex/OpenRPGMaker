# P3 item6: stale proposal bases

## Latest follow-up: object-key order

The lead's targeted no-op comparison case exposed false stale-base rejections.
They are corrected in **`21978d30f1eddb991e4a18d78cabb2259a49683e`**, tree
**`0745df78be21aa7e4dd26c1495f35feafb318002`**. [Key-order report](key-order/report.md)
records real record/map/reset-world reorder RED, reuse of the existing JSONB
canonical comparator, array-order rejection, **11 files / 132 passing tests**,
zero changed-file compiler diagnostics, app typecheck/build exit 0, source hashes
and owned cleanup. No prior ownership work, native acceptance or full gate was
rerun. The sections below retain the original delivery evidence and its source
identities; their raw-JSON comparison description is superseded by this follow-up.

## Original delivered source and scope

Production is implemented in **`32b46b5c065ffb441170fa288e94df2be92eb879`**
(`fix(ai): reject proposals built on stale project bases`). The tested index and
committed source tree both equal **`653535ce9fc0493fc5a9a0a414fe4b58adff792b`**.
This is the item6 producer handoff, not whole-P3 approval, gate13 closure, or
completion of the active goal.

The original source/test handoff is **`586d06a517aad000eabd84192b4a15992d197ea6`**,
tree **`90544d1f7f41d6a856337d74c60f8420c007b288`**. This second commit only adapts
three cluster-modal test doubles/awaits to the captured-base contract. Production
bytes are unchanged from the fully built and native-verified first commit.
`raw/cluster-source.json` records its exact tested index and file hashes.

- Task: `st_01a07c73`; parent/root: `01a07564-2645-75ee-8627-2f0990a25d52`.
- Sole writable worktree: `/home/main/z-project/rpg-zzu-ai-harness-p3-20260907`;
  branch: `agent/ai-harness-p3-20260907`.
- Starting source: `0fa1403f181c9e82e8eb6b8b61ed61a150173f7d`, tree
  `8a1ec5b66b8a47368ab6e5e2dbec6221a8778a64`; src tree
  `e0956ccde2a014bec26f21f66769392ab1469b18`, test tree
  `b6deaf53c5326a7165ad5e7f298764c93eb4894f`.
- Read the phase contract, scoped AGENTS, quickstart/index/project wiki,
  editor routing/observability/AI tools/panel/testing guidance, epoch report,
  current epoch commits, and final human-edit-race oracle before editing.
- The required lead acceptance marker was initially absent. Exact filesystem
  creation monitors ran while source/tests stayed read-only. Editing began only
  after `accepted:true` named the above source and the corrected item5 native
  proof. Its original bytes are retained in `raw/item5-acceptance.json`.
- No QA script, foreign worktree, dependency, remote schema, protected PR, P4/P5,
  nested agent or full repository gate was changed or operated.

`raw/verified-source.json` binds every one of the 26 source/test files to its
SHA-256 and index blob before compiler/build/native verification. The commit command exited 0;
`raw/source-commit.log` and `raw/source-commit-exit.txt` retain its direct result.
`raw/cleanup.json` rechecks all those blobs against the committed source and
records the post-source-commit index SHA-256 and owned resource absence.
The three test-only follow-up files have their own `raw/cluster-source.json`
binding and `raw/cluster-commit*` direct exit 0. Both source commits are immutable.

**Cleanliness boundary:** source/test worktree and index are clean. The sole
remaining unstaged path is the lead-owned `.omo/plans/ai-harness-omo-adoption.md`
metadata update, which appeared during this task and was neither authored,
staged, reverted nor committed by this node. Whole-worktree cleanliness is not
claimed while that foreign edit remains.

## Faithful failing-first evidence

Before production edits, `test/aiStaleProposal.test.ts` exercised the real
AssistantSession, registered title tool, apply adapter, ProjectStore and undo.
Both the non-house tile and existing `item_potion` database record were edited
after the detached proposal had been built; system width was also changed.

The actual old implementation returned success and overwrote all three values:

| Value | Human value before apply | Old value observed after apply |
| --- | ---: | ---: |
| Non-house lower tile | 7 | 240 |
| `database.items[item_potion].price` | 137 | 50 |
| `system.playResolution.width` | 336 | 320 |

`raw/red.log`, `raw/red.json`, `raw/red-exit.txt`, `raw/red-hashes.txt`, and the
exact original `raw/red.test.ts` retain **direct exit 1**, four assertions on the
one stale case, and the meaningful current-base apply/undo control passing.
This was an actual overwrite, not a missing new helper or import failure.

Original failures remain visible:

1. An initial broad read-only AGENTS discovery exceeded its 20-second process
   bound. It made no changes and was not a behavioral test.
2. The first authored fixture used nonexistent `system.resolution.width` rather
   than the UI's actual `system.playResolution`. Both tests failed in setup.
   `raw/setup-resolution-original*` retains that exit 1. The actual UI source
   and native oracle established the correct field before the faithful RED.
3. The expanded suite initially had 13 passes and one fixture assertion failure:
   wiki normalization adds the required `w_` ID prefix. The fixture now authors
   canonical `w_owned_wiki`; `raw/expanded-green*` retains the original exit 1.
   No production workaround or weakened ownership assertion was added.
4. Three concurrent LSP calls timed out waiting for fresh diagnostics. Later
   calls completed; the compiler comparison below, not LSP silence, is the
   authority for the inherited test diagnostics.
5. The additional cluster-modal control run on `32b46b5c` exposed two obsolete
   session doubles without `getRunOperation`/`getProposalBase`: two rebase-signal
   timeouts and two unhandled missing-method errors, exit 1, retained in
   `raw/cluster-original*`. The test-only follow-up supplies real captured bases
   and operations, preserving every application assertion. Guessed microtask
   drains now await exact session/image producer promises. The same four files
   subsequently pass all 19 cases, exit 0, with no unhandled errors.

## Ownership and write boundary

- `ProjectStore.getVersionToken()` exposes only frozen client-local lineage and
  mutation generation. It does not change counters, persistence behavior,
  receipts, remote state or writer exclusivity.
- `captureProposalBase(project)` captures immutable authored content, world
  content, store lineage and project identity before authoring. The session
  stores that base privately and only replaces it on real project rebase.
  Merely refreshing context or reading a pending draft cannot renew authority.
- `ApplyProposedProjectOptions.base` is required. All actual source callers and
  direct test callers now carry their own captured base; none infers it from a
  latest global receipt or captures a new live base at stale application time.
- Application checks current project lineage/identity and the content that will
  be replaced, then checks again after validation immediately before history
  and replacement. Rejection returns `{ok:false, reason:"stale-base"}` with no
  undo entry, replace, commit, early application callback, or replay.
- This client's actual local write critical section is synchronous. There is no
  await or external callback between the final guard, history snapshot and
  replacement. No queue holds replacement B behind an old uncooperative commit
  response. The later commit/wiki awaits never write the old whole-project
  snapshot again; wiki uses its existing fresh document-delta coordinator.
- Ordinary proposal hosts capture base and operation before callbacks. Cluster
  confirmation captures both before its actual approval awaits and rechecks
  ownership before application and after its awaited result.
- Wiki-only changes remain independently owned: ordinary proposals preserve the
  live world rather than replace it. Full reset proposals must match the world
  too. No-op updates and real own saves remain valid if authored content is
  unchanged. Even identical project replacement invalidates the old lineage.
- Stale rejection remains inspectable through Ask, without offering apply calls.
  The next authorized authoring turn rebases from fresh live data and performs
  new work. It does not retry the old snapshot or replay its old tool calls.
- House protection and integrity validation remain separate guards. The two
  former non-house overwrite controls now require preservation; new current-base
  malicious-house cases retain the original integrity refusal/zero-write contract.

The base fingerprint is a conservative in-memory JSON comparison, not a durable
checkpoint, remote version, two-tab lock, normalized remote proof or content hash
protocol. P1's accepted-version/current-read proof remains unchanged.

## Verification commands and direct outcomes

Every shell command exported
`TMPDIR=/dev/shm/rpg-zzu-ai-harness-p3-01a07564`; verification ran in the owned worktree.
Vitest used `vitest.config.mjs` here, which preserves repository settings and
explicitly sets top-level `cacheDir` to the owned `stale-st_01a07c73/vitest`
child. This is not a claim that `VITE_CACHE_DIR` configures Vitest.

The faithful RED command was:

```sh
node scripts/run-vitest.mjs run test/aiStaleProposal.test.ts \
  --config output/evidence/ai-harness/p3/stale/vitest.config.mjs \
  --configLoader runner --maxWorkers=4 --minWorkers=4 \
  --reporter=verbose --reporter=json \
  --outputFile=output/evidence/ai-harness/p3/stale/raw/red.json
```

| Validator | Actual result |
| --- | --- |
| Initial stale/house/apply/wiki focused selection | Exit 0; `raw/initial-green*` |
| `bash output/evidence/ai-harness/p3/stale/run-focused.sh` | **Exit 0, 47 files / 820 tests passed**, zero failed/pending |
| Additional four cluster-modal suites (command below) | **Exit 0, 4 files / 19 tests passed**, zero failed/pending/unhandled errors |
| LSP on every changed source/test path | Fresh results obtained after the three recorded timeouts; inherited Promise API diagnostics remain visible |
| `node --max-old-space-size=8192 output/evidence/ai-harness/p3/stale/check-changed-types.mjs` | Exit 1: 10 inherited scoped diagnostics and one inherited dependency diagnostic |
| Same scoped compiler command with `--baseline` | Exit 1: exactly the same diagnostics against starting HEAD bytes |
| `check-cluster-types.mjs`, final and `--baseline` | Both exit 1: the same two inherited `vi.spyOn` generic variance diagnostics; zero new |
| `npm run typecheck:app` | **Exit 0** |
| `VITE_CACHE_DIR="$TMPDIR/stale-st_01a07c73/build-vite" npm run build` | **Exit 0**; app compilation, editor, player/SDK, standalone and archive |
| Native `retained-draft-ask` below | **Exit 0**, actual editor and independent remote readback |
| Staged diff check and source hash/index checks | Exit 0 |

The full focused selection and exact command are in `run-focused.sh` and
`raw/focused-controls-command.txt`. The 14 new stale cases cover all live values,
actual pre-write recheck, same-byte replacement, context-refresh non-authority,
no-op/own save, ordinary/reset wiki controls, real own-wiki save/proof, intervening
commit awaits, cancellation/replacement, real runner stale -> Ask -> fresh work
-> no replay -> undo, and actual autonomous milestone rejection. Existing
epoch/slot/bridge/Ask/new-goal/requirements/outcome/Continue/wiki/P1 controls all
passed in that same invocation. Counts alone are not aggregate approval.

The additional executed selection was:

```sh
node scripts/run-vitest.mjs run test/clusterAiModal.test.ts \
  test/clusterAiModalHouseProtection.test.ts test/clusterAiModalImageFirst.test.ts \
  test/clusterAiModalRangeClassify.test.ts \
  --config output/evidence/ai-harness/p3/stale/vitest.config.mjs \
  --configLoader runner --maxWorkers=4 --minWorkers=4 \
  --reporter=verbose --reporter=json \
  --outputFile=output/evidence/ai-harness/p3/stale/raw/cluster-green.json
```

`raw/changed-types-comparison.json` confirms exact diagnostic equality, including
multiplicity: two `Promise.withResolvers` errors in `aiApplyCommitCorrelation`,
eight in `aiRunEndProof`, and the existing `runOutcomeApplyFixture` PassFlag
dependency type error. No new diagnostic exists in the changed source or new
stale test. These inherited errors were not suppressed or fixed outside scope.
The three test-only follow-up files also received LSP and compiler checks;
`raw/cluster-types-comparison.json` confirms zero new diagnostics against their
pre-follow-up bytes, retaining both original generic-variance errors. Build and
native commands were not repeated for this test-only commit: their exact
production src tree and all 23 native source/script hashes remain identical.
Build warnings about mixed/circular chunk imports, large bundles and the existing
unresolved generated forest image remain in `raw/build.log` unchanged.

## Native positive control and remote cleanup

```sh
QA_PORT=33771 \
  QA_CACHE_ROOT="$TMPDIR/stale-st_01a07c73/native-cache" \
  EVIDENCE_DIR=output/evidence/ai-harness/p3/stale/native-retained-draft \
  xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario retained-draft-ask
```

The unchanged QA surface created only
`qa-ai-surface-9dfefda0-1029-4bbb-96f7-6d421d44b9cb`, after connection and absence
checks. It exercised actual Abort, explicit/inferred questions, typed Continue
in Ask, authorized resume, no replay and undo, with real save/read. Initial and
both undo normalized remote identities equal
`cbaff2102e0516e2ee4a9142122f036870f902ffd50ad1c57557fc6721074f71`.
There were no page/route errors, and every owned project/map/tileset/commit/change
row was deleted and absence-checked. Seven commit IDs are retained in the cleanup
receipt. Browser/server/listeners/timers/routes/cache were closed; active routes
are zero. This node independently rebound and released port 33771 afterward.

The native report's HEAD fields describe precommit `0fa1403f`, because candidate
source was staged during execution. `raw/native-source-binding.json` verifies all
23 executed source/script SHA-256 values against the tested index and committed
source, with zero mismatches. Screenshots remain available; image read reported
that this model cannot view images, so no subjective pixel approval is claimed.

This is the existing P2 native positive control, not the separate P3 native
human-edit-race GREEN. The latter and the corrected late-cancel scenario remain
integration/verifier-owned; their original assertions must not be weakened.

## Documentation handoff and limits

The docs node owns wiki changes. Update the matching AI panel/tools,
observability/persistence and testing pages with:

1. Required captured `ProposalBase`, minimal read-only store version API, and
   typed stale-base rejection distinct from integrity or retired-run rejection.
2. Synchronous local write boundary versus later commit/wiki awaits; no global
   apply queue waiting for old uncooperative responses and no distributed claim.
3. Independent live wiki preservation, stricter reset-world checks, no-op/own-save
   controls, and unchanged P1 receipt/current-proof authority.
4. Stale draft retained through Ask; explicit fresh authoring recalculates from
   live data without replay, while existing goal/history/Continue contracts stay.
5. Unit transport isolation must disable/isolate the independent commit-history
   transport as well as ProjectStore persistence. This task's tests did so;
   native checks used the fresh owned remote fixture, never an ambient project.

Owned `dist`, `.runtime-archive` and the entire `stale-st_01a07c73` TMPDIR child
were removed after verification; shared TMPDIR and dependency caches were not
removed. The worktree/branch and evidence are retained for the next phase node.
Full gates, independent final approval, native P3 integration and protected PR
delivery remain with their assigned owners. The active overall goal is not done.

Evidence packaging initially stopped before commit: `git diff --cached --check`
returned 2 on literal trailing whitespace in tool-generated build/command logs
and a blank final typecheck-output line. Raw output was not rewritten. Those
three files and that original packaging diagnostic are committed as lossless
`.gz` siblings; `gzip -dc <file>.gz` recovers the exact original bytes. The plain
originals and native screenshots remain in this node's ignored evidence folder.
`raw/packaging-whitespace-original-exit.txt` retains the original failure.
