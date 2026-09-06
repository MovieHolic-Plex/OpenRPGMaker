# Phase 3 execution goal

Base: e33c93afbd1b0d8824f273c62d234d66c8802323, verified Phase 2 PR #646.
Integration branch: agent/life-full-p3. Delivery: stacked PR against
agent/life-full-p2 after verification and independent ultrabrain approval;
never remote-merge.

Execute approved tasks 6..10 completely: disabled automatic XP must not reject
harvests; zero yield and independent regrowth countdown; authored tool-rule
parity; maker deadlines across every game-time path; actual fishing/forage
input priority, refusal consumption and rendering. Preserve all approved
atomicity, Save5/Project4, old-original and explicit-recovery contracts.

Dependency/ownership schedule: tasks 6 -> 7 -> 8 run serially on overlapping
harvest/tool files. Task 9 is independent and runs in its own worktree. Task 10
starts only after verified 8 and 9. Shared session/save/renderer/wiki files are
never edited concurrently. Workers report unexpected ownership conflicts.
Wiki and INDEX integration is parent-serialized; workers supply exact notes.

First wave: task6 in life-full-harvest-xp; task9 in life-full-maker-clock.
Both began at the exact phase base and are now verified and integrated. Catalog
queries did not expose workflow, but a direct schema query later confirmed it.
Completed tasks 6 and 9 are not rerun. The remaining native graph is 7 -> 8 -> 10
-> independent verification. Parent-confirmed handoff files gate every node
against actual verified/integrated HEADs; node completion alone never authorizes
downstream edits.

Resolved source ownership: farming transactions are in src/player/farming.ts.
The initial task6 dispatch mistakenly named src/project/farming.ts; the parent
verified the real file and corrected that grant without changing task scope.

Each task owns RED-first behavioral tests, success/failure public entrypoint
proof, relevant related tests, touched-file diagnostics, app typecheck/build,
raw exits/HEAD/tree and cleanup receipts. Each verified increment is committed.
Parent verifies/integrates units independently. Runtime UI proof uses dedicated
player.html; no fixed sleeps, polling, weakened tests, guessed state or fake
successful outcomes. No remote authored content write belongs to this wave.

Inherited verification limits remain visible: Phase 2's full Vitest timed out
twice at1200s without a report, while targeted/manual evidence and build pass;
six surface failures matched the original phase base. Do not absorb failures
into baselines or pretend inherited limits are resolved. Whole-project gates
and the51-feature/F01..F13/remote-persistence/final-review obligations remain.

## Ready-only workflow recovery

The initial graph counted three waiting turns as completed; none of those
implementations or verification results were accepted. Their manual watchers
were ownership-checked and removed. A settled run refused send, so generation2
amends the SAME run: keep verified task7, execute ready task8, then independently
verify its actual committed result in an isolated verification tree. Task10
remains pending in the approved plan and preserved initial definition. After
parent verifies/integrates8, add ready10 and rerun integrated verification through
another amendment; never start a node whose parent handoff is still missing.
