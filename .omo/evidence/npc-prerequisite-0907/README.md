# CR-NPC-PREREQ-01: verified local prerequisite replay

Base: **954e02ee7d371cb5c91bf52b6d7023336db0f962**, not dd37.
Worktree: `/home/main/z-project/rpg-zzu-ai-npc-prerequisite-0907`.
Branch: `agent/ai-npc-prerequisite-0907`. The containing commit is the deliverable;
its first parent is the exact base. No push, PR or remote merge is included.

The full review at the parent's `npc-prerequisite-review.md` was read before edits.
`TODO.md` enumerates all six sections and all 13 regression rows.

## Implementation boundaries

- One session-owned `verify_npc_reward` tool accepts only requirementIndex and an
  action-only prelude. Entire raw arguments are validated, including nested fields,
  before execution. Generic reason-schema injection is excluded for this tool only.
- Each action asserts its current map. Physical walk, move-dir, face, explicit-ID
  interact and pending choose are admitted. Caller state, teleport/move.to, snapshots,
  assertions, grants/choices/count overrides and passing receipts are not authority.
- Current project content is privately cloned. Actual authored start state and one
  executing runtime session carry the prerequisite route, host claim and immediate
  repeat. The real chest preset and physical touch transfers are used in fixtures.
- Every earlier bound-NPC interaction must have zero requested reward-component
  deltas. No held choice may be abandoned. Host baselines follow travel and approach;
  exact claim grants and broad zero gold/inventory/owned-monster repeat are required.
- Restrictions execute at map-event entry and actual interpreter command dispatch,
  including nested/common-event frames. Protected transfer, foreign autorun/chaser
  entry and callMapEvent delegation cannot lend a reward. Unexecuted branches do not
  fail a legitimate chosen route. Hooks are absent from ordinary game execution.
- Bounds are 256 actions, 4096 movement steps, 100000 interpreter instructions over
  the entire replay. Stack/loop/instruction exhaustion and cancellation are unverified.
  Native authored waits up to 60000ms each are simulated, not real sleeps. Unsupported
  interactive operations, battle, calendar hooks, movement routes/relocation and M2
  fallback fail closed. Common-event functionality is not expanded: ordinary scene
  start still does not populate session.commonEvents; missing calls are unverified.
- Stored state contains the cloned program and original exact unique map/event pair,
  keyed by captured requirement identity (request lifetime/index), never a passing
  verdict. Every applicable completion gate replays current content. Valid replacement
  executes afresh; failed replay cannot use an old pass or fresh-local fallback.
- Continuation, retry, replan and milestone rebase preserve the program and immutable
  promises. New request/ask mode clears it. Existing unrelated failed checks, image,
  baseline, history, item completion and final-skip gates remain independent.
- Planning guidance orders prerequisite maps/chests, separate transfer links, then NPC
  authoring/verification. No reward timing or authored live content was rewritten.

`intentDeclaration.ts`, `intentDeclarationClient.ts`, `playTools.ts` and
`toolVerificationEvidence.ts` have **no diff** from the base. In particular no
goldDelta wire-schema edit or duplicate-gold admission change is included. The parent
can integrate currency sibling **f29e1076939c3f4392e22e444f61dd3a2f21ab8d** separately;
the existing duplicate-grant completion guard is retained. Interior normalization is
not part of this change.

## Red-first receipts

Raw logs are preserved byte-for-byte in `logs.tar.gz`, including unsuccessful
development attempts. No assertions or timeouts were weakened to turn failures green.

- `st_01a078cc-red.log`: initial fixture mistake, not valid red evidence. Raw preset
  tools return ToolExecResult, not the public ToolResult.ok envelope. Corrected that
  fixture check before the valid run.
- `st_01a078cc-red-valid.log`: exact-base production unchanged, **10 failed / 22 passed**.
  The legitimate prerequisite route, fresh replay and returned evidence were absent.
- `st_01a078cc-session-red.log`: **14 failed** before implementation; the new session
  tool was absent. One assertion also needed the existing scene result's nested
  data.ok envelope rather than transport ok; both attempts remain archived.
- `st_01a078cc-schema-red.log`: a separate real-session schema regression failed
  because the generic decorator required a third reason field. It now exposes exactly
  the two admitted fields and rejects reason in raw input.
- Later expansions cover the entire review table, including actual common-event
  dispatch, shared budgets, stale-content mutation, continuation/rebase/replacement,
  and the explicit easier-local-fallback counterexample. These expanded tests were
  not all present in the original exact-base red run.

## Final verification

- **379 passed / 15 files / exit 0 in one run**, no skipped tests:
  `st_01a078cc-protected-verified.log`. Full command is at its beginning. Includes the
  new prerequisite suites plus protected currency, NPC, scene/interpreter, intent
  client, verification history, image, acceptance baseline and work-item gates.
  Uses one thread worker and dot reporting, no sleeps/polling or timeout changes.
- `npm run typecheck:app`: **exit 0**, `st_01a078cc-typecheck-final.log`.
- Full `tsconfig.json` is a known non-gate: **847 errors on both exact base and
  candidate**, with identical file/line/TS-code signatures and none in changed files.
  `baseline-typecheck.mjs` overlays exact-base source read-only in the compiler host,
  excluding new files; it does not reset a checkout. Final outputs and signature
  comparison are archived. Initial 854 included seven missing sparse community inputs;
  the first overlay attempt also omitted noEmit. Both exploratory logs are retained.
- `VITE_CACHE_DIR=/dev/shm/st_01a078cc-vite npm run build`: **exit 0**, including app,
  export-player SDK manifest and standalone bundle (`st_01a078cc-build-final.log`).
  Initial build stopped at a missing sparse community-site manifest input; materializing
  that tracked directory fixed the checkout, with no build/source workaround. Warnings
  for large chunks, static/dynamic import overlap and the unresolved forest reference
  image remain unsuppressed.
- LSP: all changed production and test files returned no diagnostics. The native smoke
  script returned no diagnostics. Markdown has no configured server. The optional
  baseline compiler helper initially returned no diagnostics, but fresh requests after
  its noEmit adjustment timed out; its successful execution and exact baseline matching
  are verified separately, not mislabeled as fresh LSP success.
- `bun .omo/evidence/npc-prerequisite-0907/session-smoke.ts`: **exit 0**. Real native
  AssistantSession tool dispatch reports gold 37 -> 57 -> 57, one brass key, claim +20,
  repeat 0, 14 interpreter instructions and 16 movement steps. Removing the key grant
  through real upsert_event afterward blocks final completion. Original fixture project
  remains unchanged. Output: `session-smoke.json`.
- `git diff --check`: clean before staging. No unrelated all-project test run, browser,
  model/provider request, live project/DB operation, credential or env-file edit occurred.

## Isolation and limits

AGENTS, quickstart, worktree and runtime routing were read first. The isolated sparse
checkout was created on the exact base. Dependencies are linked, no install/copies of
node_modules or env provisioning were performed. Only required tracked build inputs
were later materialized. Ignored dist is an owned RAM-backed output; no other agent's
files or outputs were deleted. Sparse expansion pruned this worktree's earlier ignored
todo/smoke files; they were restored from this session's exact patches before staging.

This is **reachable reward proof for the supplied legitimate route**, not whole-game,
universal-path or live Round8 acceptance. The parent/review trees were not edited.
Existing unrelated full-typecheck failures are retained. No claim is made about
unrun full-suite failures or browser/gameplay UI, which this task explicitly excluded.
