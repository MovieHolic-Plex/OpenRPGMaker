# Bounded first-class gold reward contract

Task: st_01a078ac. Base: `dd37d644eb096b270504f93bcaf6bd56c9b153d1`.
Branch: `agent/ai-npc-gold-0907`.
Worktree: `/home/main/z-project/rpg-zzu-ai-npc-gold-0907`.
Review: parent `.omo/evidence/ai-playable/npc-currency-review.md`.

## Delivered requirements

- [x] Admission/guidance/shape repair: `{kind:"gold",count:20}`, no ID/name;
  exact/unspecified positive count semantics preserved; no localized-name coercion.
- [x] Scene proof: explicit `goldDelta`, gold in reward snapshots and `finalState`,
  all measured from the same real scene session; inventory stays inventory-only.
- [x] NPC completion: gold bypasses item/species lookup; exact target selection,
  physical interaction, pending-choice checks and page reselection remain intact.
  Repetition rejects any additional currency, including item-only contracts.
- [x] No reset/weakening escape hatch. Runtime `changeGold`, session ownership,
  acceptance ledgers, verification identity, image protections and baselines unchanged.

## Six regression groups

- [x] Parser: reference-free gold; invalid counts, kinds, ID/name fields fail closed;
  captured `kind:"item",name:"골드"` remains a valid item and is not shape-repaired.
- [x] Native payment: nonzero 37 -> 57 -> 57; zero/19/21, repeat payments,
  text/switch-only payment, shadowed pages and pending choices fail.
- [x] Item ID `gold` / name `골드` is inventory-only; neither reward kind satisfies
  the other; mixed contracts require both. Duplicate gold declarations fail.
- [x] Tool boundary: unsupported aliases and malformed scalar/object gold assertions
  are rejected before execution. Signed safe integers and `{atLeast:integer}` work.
- [x] Obligations survive real session continuation, planner replanning, retry,
  skip attempts and rechecking after a previously done NPC is changed. Both old
  item/monster and new currency contracts execute the same lifecycle tests.
- [x] Baseline/image/history suites retained. Added currency-history checks prove
  weaker amounts, changed reward kinds and removed repeat checkpoints cannot erase
  an earlier failed proof; unchanged assertions permit navigation repair only.

## Red first

Production files were unchanged when the first regressions ran.

- `red-first.log`: new gold variants in the session suite failed 3 cases; declaration
  client failed 2 cases. The outer command hit its 120-second execution limit after
  those suites; this is incomplete evidence, not a completed test-run exit status.
- `red-currency.log`: completed standalone currency run exited 1, **9 failed / 44 passed**.
  Valid gold admission, native scene proof, provider field, mixed currency proof,
  and rejection of currency on an item-only repeat failed as expected.

Commands: `npm test -- test/npcGoldReward.test.ts test/intentDeclarationClient.test.ts
test/npcRewardSession.test.ts --maxWorkers=2 --no-file-parallelism`;
then `npm test -- test/npcGoldReward.test.ts --maxWorkers=1 --no-file-parallelism`.

## Final verification

Raw command logs are committed byte-for-byte in `logs.tar.gz`; uncompressed copies
remain beside it in the worktree. Archiving preserves tool-emitted ANSI and trailing
whitespace without adding whitespace errors to the source diff.

- `focused-protected.log`: **389 passed, 22 files, exit 0**, one run. The complete
  command/file list is at the top of the log. Covers parser/client, NPC/scene/session,
  provider schemas, acceptance baselines, image delivery/review, verification history,
  command contract and work-item outcomes. Execution uses
  `--pool=threads --maxWorkers=1 --no-file-parallelism --reporter=dot`.
- `npm run typecheck:app`: exit 0 (`typecheck-app.log`).
- `VITE_CACHE_DIR=/dev/shm/ai-npc-gold-0907-vite npm run build`: exit 0
  (`full-build.log`), including app, export-player/SDK, standalone bundle.
  Warnings remain for chunk sizes, static/dynamic import overlap and unresolved
  `/generated/battle-reference-forest.png`. No warning was suppressed.
- LSP: no diagnostics on all five changed production files, three test files and
  the native smoke script. Initial fresh-diagnostic requests for two tests timed out;
  completed requests were clean. Markdown has no configured LSP server.
- `bun .omo/evidence/npc-gold-0907/native-tool-smoke.ts`: exit 0. Real `upsert_event`
  -> parser -> NPC gate -> registered `run_scene_test`, no browser/model/DB. Output
  `native-tool-smoke.json` shows 37 -> 57 -> 57, inventory delta zero and unchanged
  fixture project during verification. The initial inline smoke read the old project
  after `runTool` replaced `context.project`; its failure is preserved in
  `native-tool-smoke-initial.stderr`. The script consumes the actual published project.
- `git diff --check`: clean. Native runtime/session/ledger/history owners and existing
  archived evidence have no diff from the exact base.

Earlier `focused-green.log` had 201 passing assertions but exited 1 on Vitest's
`[vitest-worker]: Timeout calling "onTaskUpdate"`; it is not counted as a clean pass.
The machine had load average above 100. The final run used a single thread worker
and compact reporting; no test timeouts, sleeps, assertions or exclusions were changed.
No pre-existing test failures were observed in the completed final scoped run.

## Isolation and limits

Sparse checkout avoids bulky archived outputs on the nearly full root disk; those
tracked artifacts remain in Git. Dependencies are the adopted shared symlink; no
install was performed. Ignored `dist` points to an owned RAM-backed build output.
Neither parent nor review tree was edited; both still reported the exact base HEAD.

Round8 remains failed evidence, not a repaired currency run. No live ledger/game or
DB data was seeded or rewritten. No browser/model/provider-network request occurred.
Provider verification covers installed Google/CCA normalization and repository schema
checks, not a live provider response. No unrelated full-suite gate or final-game/R6
approval is claimed. No prerequisite/journey witness, reward-timing changes, generic
contract reset, push, PR or merge is included. The fresh-local-scene prerequisite
limitation remains deliberately visible for the separately reviewed implementation.
