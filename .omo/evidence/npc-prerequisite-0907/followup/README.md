# Parent-review follow-up: landing authority and reason guidance

Separate follow-up to `7409a16033e0c819ded0360d17fb8975a884b9d7`; no amendment.
Same isolated worktree and branch. No parent/interior/gold integration was performed.

## Demonstrated gaps and narrow fixes

1. Two deterministic red countercases proved that legacy `isPassable` accepted a
   right-only tile whose neighbor had no compatible left-entry bit. An adjacent chief
   paid exactly 20 and repeat paid zero: the authored-start case used zero movement;
   the physical-transfer case used one movement step. Both incorrectly passed proof.
   `proofPosition` now calls the existing shared `isPassableLanding` authority, retaining
   integer and blocking-event checks. Neither collision helpers nor ordinary movement
   or transfer execution were rewritten. Tests explicitly retain ordinary scene behavior
   and require proof to pass once the incompatible neighbor is repaired.
2. The global contextBuilder prompt unconditionally required reason while this tool
   intentionally rejected it. The prompt now explicitly excludes verify_npc_reward,
   naming its only two allowed keys. The tool description states the same exception.
   No schema properties, required fields, admission rules or authority were widened.
   Tests assert actual session request-schema fields, not prompt/description prose:
   exactly requirementIndex/prelude for proof, required reason on ordinary set_build_spec,
   and raw reason rejection before proof execution.

## Verification

Raw outputs are committed in `logs.tar.gz`.

- `red.log`: **2 failed** on unchanged 7409 production, both demonstrating false passes
  with generated +20/0 reward receipts. Other tests were excluded only by the focused
  red test-name selector; the green run has no skipped tests.
- `green.log`: **261 passed, 9 files, exit 0**, one run. Includes prerequisite runtime
  and session suites, currency, NPC acceptance/lifecycle, ordinary scene/collision,
  contextBuilder and toolReason. Full command is at the beginning of the log.
- `typecheck-app.log`: `npm run typecheck:app`, **exit 0**.
- `build.log`: full `npm run build`, **exit 0** (app, player SDK manifest, standalone).
  Existing large-chunk, static/dynamic-import and unresolved forest-reference warnings
  remain visible. RAM-backed outputs/cache were reused because root disk was nearly full.
- `session-smoke.json`: native AssistantSession tool smoke, **exit 0**; gold 37 -> 57 -> 57,
  one key, +20 claim/zero repeat, and completion denied after key-chest mutation. Original
  fixture project unchanged. Reproduce with `bun .omo/evidence/npc-prerequisite-0907/session-smoke.ts`.
- LSP: no diagnostics on all three changed production files and both changed test files.
  Markdown has no configured LSP server. `git diff --check` passed.

No sleeps, polling, weakened assertions, timeout changes, new runtime capability,
live project/DB/browser/model/provider operations, credentials or env-file edits.
No goldDelta/duplicate-gold or interior-normalization changes. This retains the original
reachable-route proof scope and its documented unsupported-operation limits.
