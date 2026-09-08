# P1: reject bound-NPC rewards before the protected claim snapshot

Task: `st_01a07920`. Exact base: `9a0c335f29c372ce0bead33419e20143ff645192`.
Branch: `agent/ai-npc-approach-p1-0907` in the explicitly reusable clean worktree
`/home/main/z-project/rpg-zzu-ai-npc-prerequisite-0907`.
The old branch remains at `282c599f2ca487e1fc1e3f7d74b4d89f2d9b21cd`.
No reset/clean, parent/review-tree edits, remote operation, or store.ts change.

## Delivered behavior

`sceneTestRunner.ts` now tracks whether the host-owned claim snapshot was taken,
independently of the protection/reporting phase. All bound-NPC interactions before
that snapshot require zero requested-component delta. Host approach remains in the
protected phase, so foreign events and transfers are still rejected there.

Each completed interaction is checked, including each touch inside a single walk.
Synchronous baselines are local to their interaction so a nested event cannot discard
an outer NPC's baseline. Held choices preserve their baseline until completion.
No total-balance comparison to authored start is introduced. Unrelated legitimate
prerequisite chest rewards and unrequested early components remain allowed.

Production change is confined to the proof-scoped runner. Witness admission/binding,
immutable grants, session closure, interpreter/game behavior and persistence are not
rewritten. The matching contract in `openwiki/ai-workflow.md` is updated.

## Red-first receipts

- `frozen-counterexample.ts` copies the supplied frozen characterization, changing only
  absolute imports to this worktree's relative imports. Run against the exact base:
  `bun .omo/evidence/npc-approach-p1-0907/frozen-counterexample.ts`, exit 0.
  `baseline-counterexample.log` records host approach passing at 77 from 37, with
  claim +20 / repeat 0; equivalent explicit prelude fails; zero-early control passes
  at 57. Real AssistantSession tool dispatch also passes and accepts final completion.
  This is a baseline-only characterization, not a test expected to pass after repair.
- Original `/tmp/st_01a07913-source-review/npc-approach-characterization.ts` was not
  edited. SHA-256: `2806925bc662ab531f4747666970579a40de60666dbac96f8d6038179bf122b8`.
- `red-final.log`: final initial regression matrix on unchanged production source,
  `node scripts/run-vitest.mjs run --configLoader bundle test/npcApproach.test.ts --maxWorkers=2`,
  exit 1: **8 failed, 13 passed**. Failures expose early gold/items/monsters, negative
  early deltas, two offsetting touches within one walk, and the real-session host false pass.
- `intermediate-chaser-red.log`: an additional regression caught an intermediate
  implementation clearing the outer NPC baseline during a nested zero-reward chaser.
  The targeted run exited 1 with a false proof at 77. Local per-interaction baselines
  fix that case; it is included in the final 22-test approach suite.

## Final green receipts

Committed console logs normalize trailing whitespace only. Raw output is preserved at
`/tmp/st_01a07920-raw-receipts/`; no warning or failure lines were removed.

| Validator | Result | Receipt |
| --- | --- | --- |
| Focused/protected Vitest run, 2 workers | exit 0; **322 passed / 13 files** | `green-final-protected.log` |
| Bun actual SDK currency/image wire suites, one final run | exit 0; **17 passed, 0 failed** | `green-final-wire.log` |
| Repaired frozen counterexample through verifier and actual AssistantSession | exit 0 | `green-counterexample.log` |
| LSP on source, regression and both evidence scripts | no diagnostics | `lsp.txt` |
| `npm run typecheck:app` | exit 0 | `typecheck-app.log` |
| `npm run build:app -- --outDir /dev/shm/st_01a07920-app-build` | exit 0 | `build-app.log` |
| `git diff --check` | exit 0 | executed before staging |

Final Vitest command:

```sh
node scripts/run-vitest.mjs run --configLoader bundle \
  test/npcApproach.test.ts test/npcPrerequisite.test.ts \
  test/npcPrerequisiteSession.test.ts test/npcGoldReward.test.ts \
  test/npcRewardAcceptance.test.ts test/npcRewardSession.test.ts \
  test/assistantAcceptanceSession.test.ts test/assistantAcceptanceRequestBaseline.test.ts \
  test/assistantAcceptancePromiseBaseline.test.ts test/assistantImageEvidence.test.ts \
  test/assistantImageTransport.test.ts test/assistantVerificationEvidence.test.ts \
  test/sceneVerificationRepair.test.ts --maxWorkers=2
bun test test/ohMyPiGoldRewardWire.bun.test.ts test/ohMyPiImageTransport.bun.test.ts
bun .omo/evidence/npc-approach-p1-0907/repaired-counterexample.ts
```

The **22 new regressions** cover currency/items/monsters, host/explicit reward-boundary
equivalence, zero early then +20 / 0, negative gold/item deltas, per-touch isolation,
nested-event isolation, unrelated prerequisite rewards, unrequested components,
protected host foreign-entry/transfer denial, ordinary scene 37 -> 77 behavior, and
real AssistantSession rejection/acceptance at tool and final closure.

Repaired counterexample: both paying approaches fail before the claim snapshot at 57;
neither has claim/repeat proof. Zero-early +20 / 0 still passes at 57. Real session tool
returns `ok:false` and the final completion sentinel is not accepted. Fixture projects
are unchanged. An unrelated chest's prior +20 followed by a legitimate +20 / 0 claim
still passes at 77; the same test covers item/species counts of 40.

Event observers are registered before real session dispatch and tests await the actual
turn-completion promise under existing Vitest bounds. No sleeps, polling, timeout
changes, skipped failures, relaxed prior assertions, or prose-pinning tests were added.
The nested-chaser fixture's authored `wait` is executed by the existing simulated
runtime clock; it is not a wall-clock test delay.

## Limits and approvals

This is a local, source-only P1 repair. It proves the supplied executable routes, not
all possible game paths or live provider/game acceptance. Final parent source/game
approval remains **OPEN**; archived Round8 remains failed evidence. P2 migration timer
repair belongs to the other child and `src/project/store.ts` is byte-unchanged from base.

No live DB, browser/UI, model service, game content, credentials, ledger or original
evidence was changed. The manual executable surface was real AssistantSession with
scripted local providers (the copied counterexamples reject all fetches), not a browser.
No push, PR, or remote merge. Full repository gates and player/standalone export builds
were not run; the requested app typecheck/build and bounded protected suites were run.

Build succeeds with visible warnings: circular record-picker re-export, mixed static/
dynamic imports, large chunks, and external output-directory notice. Missing optional
provider-key notices are retained, not repaired. Build output uses a new task-owned
`/dev/shm` directory rather than the reused worktree's existing `dist` symlink, preserving
the old child's build/evidence. No warning suppression or unrelated cleanup was done.
