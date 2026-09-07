# Live request coverage and saved-player handoff

Base: `e05a99b915102de113ac4634f4a06a5bb3267788`, worktree
`rpg-zzu-ai-acceptance-live-qa`, isolated editor/API server `127.0.0.1:9860`.
No configured default/user project was written. The exclusively owned project was
confirmed absent before creation and retained remotely. No PR, push or merge is
part of the implementer handoff. The lead's graphical-player comparison now passed
as described below. The full-gate baseline comparison remains pending.

## Canonical deliverable

- Project ID: **`oprn-qa-functional-48c68b5f-2d4`**.
- Independent remote reload: [`handoff/project.json`](handoff/project.json).
- Save receipt: [`handoff/save-receipt.json`](handoff/save-receipt.json).
- Remote serialized SHA-256: `b03e73c068b972a35221b3e84447f296f54986552da1743997a1f32e452ce30c`.
- Store content identity: `e2c46e107c26e5d0ed8a6ed4286869fb90b11bcd1e2eac38ea2ef8a78cb1127e`.
- Receipt revision ID: `799d55e1-77a9-49ed-839e-05b977a5954c`.
- Canonical JSON file SHA-256: `ce9695ca460f438ffa130798d8f887257de4eba1a792a50dc91fce2c7a3380c4`.
- Store `verifyPersistedRevision`: `kind=verified`, `isCurrent=true` at verification.
- Separate commit-log receipt: `persisted=false`, `commitId=null`; this is **not**
  a successful remote commit-log claim. The actual project save and independent
  reload succeeded. The optional commit-log failure was not diagnosed further.

[`handoff/evaluation.json`](handoff/evaluation.json) contains the original live
requirements, request-to-check mappings, canonical ledger results, exact scene
steps/outcomes, and player checkpoints. **All three original functional checks
pass**, and the combined real-interpreter scenario passes **16/16 steps**. It ends
at `(10,8)` on `map_blank_start` with **80 gold, two potions and one antidote**.
No test-state injection or convenience teleport was used in that scenario.

The overall request remains **unverified**. Starting-gold has no typed criterion
in the current ledger, although the combined execution observes 100 -> 80. The
model's static route criterion targets occupied NPC tiles rather than adjacent
interaction positions. The final quote-gap parser also retains unquoted original
instructions as unresolved. Those obligations have not been removed or weakened
to obtain a green overall goal. Runtime functional success is not a visual or
exhaustive semantic-completion claim.

## Independent shipping-player actions

The lead ran `scripts/qa/acceptance-live-player.mjs` through the real
`player.html` / export-store-shim surface in Firefox. All eight checkpoints
passed with exit 0 and no page errors. The final state exactly matched the
16-step interpreter result above: `(10,8)`, 80 gold, two potions, one antidote.
Mira, Rowan's first interaction and Rowan's repeat interaction each emitted a
distinct handled action receipt (sequences 1, 2 and 3).

The script uses actual QA direction/action inputs plus native keyboard controls
for dialogue and purchasing; it never teleports or assigns money/inventory.
Its input file hash is checked against the independently reloaded handoff.
See [`lead-player-final/SUMMARY.md`](lead-player-final/SUMMARY.md) and
[`lead-player-final/player-comparison.json`](lead-player-final/player-comparison.json).

```sh
node scripts/qa/acceptance-live-player.mjs output/evidence/acceptance-live/lead-player-final
```

Two earlier observer attempts failed and remain separate evidence under
`lead-player` and `lead-player-r2`. Releasing direction only after a browser-host
round trip allowed an extra tile to start. The final observer releases direction
inside the browser's arrival callback, before the next simulation step, and
requires movement to be settled. No product code, test state, sleep or test
deadline was changed to obtain the passing comparison.

Use the real `player.html`/export-store-shim surface, not editor Play mode. The
existing runtime QA harness can boot this exact file (the smoke scenario is only
a boot check, not the full comparison):

```sh
npm run qa:runtime -- --browser firefox --scenario smoke \
  --project output/evidence/acceptance-live/handoff/project.json
```

The verified player checkpoints are:

| Action | Exact checkpoint |
| --- | --- |
| Start a new game | Cedar Village, `map_blank_start`, `(10,8)`, 100 gold; potion/antidote quantities 0/0 |
| Face up and interact with Mira | `ev_mira` at `(10,7)`; advance her greeting to the normal shop |
| Buy `item_potion` twice at 10 each, then close the shop | 80 gold; potion quantity 2; antidote 0 |
| Walk right twice to `(12,8)`, face up, interact with Rowan | `ev_rowan` at `(12,7)`; after dialogue antidote quantity 1 |
| Interact with Rowan again | Antidote stays 1, potion stays 2, gold stays 80 |
| Walk east along row 8 onto `(18,8)` | `ev_east_gate`, name `East Gate`, transfers to `map_meadow`/Meadow `(2,8)` |
| Walk left onto Meadow `(1,8)` | `ev_village_gate`, name `Village Gate`, transfers back to Cedar Village `(17,8)` |
| Walk left seven tiles | Original `(10,8)`, 80 gold, potion 2, antidote 1 |

Both gates use authored `playerTouch` commands and are transparent below-priority
events. Both NPCs have fixed movement. Rowan uses self-switch A and a second page
without a grant. The village is deliberately small/minimal. The implementer's
handoff did not claim graphical verification; the lead's later run above supplies
that functional comparison without claiming visual-design quality.

## Real model evidence, not mocks

[`models-and-prompts.json`](models-and-prompts.json) indexes every original prompt,
requested model, actual returned model field, parsed declaration/audit and outcome.
Each run directory contains `session.json` and untouched `transport.json` responses.
The returned model field comes from the companion's SDK assistant message, not
from a claim in model prose. Provider credentials stayed in local configuration/
auth storage; no keys or tokens are included.

| Run | Boundary and observation |
| --- | --- |
| `before` | Real Gemini declaration + real planner on the base. Only purchase/round-trip/reward entered the ledger. Sunset refusal, undecided sunset, starting money and negative combat constraints lacked checks. No remote write. |
| `after`, `after-fence` | Actual Gemini audit first returned fenced JSON; initially fail-closed, then accepted through the existing production JSON extractor. Unsupported clauses remained unresolved. No remote write. |
| `final-coverage` | Real multi-clause/negative/undecided-time case through the new independent audit and production planner. Complete response text is retained, not replaced by injected declarations. No remote write. |
| `generate` | Gemini `gemini-3.7-flash` authored all maps, NPC commands, stock, money and gates via real tools. Actual apply/store flush saved and independently reloaded the first revision. |
| `repair` | Gemini attempted a price repair after incorrect diagnostic feedback. It did not resolve the production pricing floor; failed tool calls and incomplete outcome are retained. |
| `repair-pricing` | Configured Codex `gpt-5.6-sol` read and changed the potion catalog price 50 -> 10. Its coverage audit hit the shared 20-second deadline and correctly stayed unresolved. Actual apply/save/reload succeeded; independent original functional criteria now pass. |

The original stock `priceOverride:10` was valid. `shopPrice.ts` clamps a listed
price to at least half the catalog price, so a 50-gold catalog potion costs at
least 25. The fix was **model-authored catalog pricing**, not an interpreter
exception, injected gold or altered acceptance expectations.

Known authoring limitation: the Codex item update also left optional `farmTool`
(`hoe`) and `captureProfile` (`multiplier=0.01`, `ballClass=poke`) fields on the
potion. No script removed them or certified record preservation. The scope here
proves purchasing and quantities, not potion-use behavior or perfect preservation
of every optional field. Existing map lint warnings are retained in tool traces.

Generation started before quote-gap enforcement landed. The independent checker
reparses its **captured actual audit response** through the final parser and adopts
only additional unresolved/unsupported checks into the canonical ledger. It is
labelled deterministic replay of recorded live expectations, **not** a fresh model
session or fabricated declaration. Original criterion values/IDs and source text
are retained. Scheduler-only tool-verdict history is not reconstructed or promoted
to a new full-session completion claim.

Readable session indexes omit repeated input context, repeated acceptance snapshots
and duplicate project blobs. Every returned model completion remains in the raw
transport files; original declaration/audit/planner inputs remain in session indexes.
The packaging script additionally preserves a local compressed full-generation
session, but that redundant archive/progress stream is not required for this handoff.

## Verification and reproduction

Passed: application typecheck; production app build (Rollup warnings retained);
153 assertions in 14 focused suites, **serial exit 0**; existing public browser
functional smoke; independent owned remote reload/identity verification; all three
functional checks and the combined 16-step scene. Logs are in `validation/`.

The earlier concurrent-build test run had 153 passing assertions but an unhandled
Vitest `onTaskUpdate` IPC timeout and **exit 1**. It is retained as failed evidence,
not counted as a successful run. Serial verification passed without changing or
suppressing assertions/timeouts. The new resume-audit test also caught a genuine
false `verified` result before its fix. Red logs are retained separately.

```sh
npm run typecheck:app
npm run build:app
npm test -- test/requestCoverage.test.ts test/fakeDomInsertBefore.test.ts \
  test/functionalAcceptanceSession.test.ts test/functionalClarification.test.ts \
  test/intentDeclarationClient.test.ts test/functionalAcceptance.test.ts \
  test/functionalPersistenceProof.test.ts test/functionalScenePurchase.test.ts \
  test/functionalWalkSuspension.test.ts test/functionalInterpreterResume.test.ts \
  test/npcRewardSession.test.ts test/assistantAcceptanceSession.test.ts \
  test/assistantAcceptance.test.ts test/agentBlueprintTurnEnd.test.ts --maxWorkers=1
node scripts/qa/functional-acceptance-smoke.mjs http://127.0.0.1:9860 \
  output/evidence/acceptance-live/scripted-regression-smoke.json
node scripts/qa/acceptance-live-check.mjs
node scripts/qa/acceptance-live-package.mjs
```

The scripted regression smoke is explicitly **mock-model evidence**, separate from
all live runs above. `acceptance-live.mjs ... final-coverage` is a real-model
read-only plan probe. Do **not** rerun `generate` against this now-existing project:
its collision guard rejects it. Repair modes require the exact previous receipt
hash and are authoring operations, not read-only verification.

Language interpretation remains model-owned. Exact quote coverage catches omitted
text, but cannot prove that a model-selected criterion semantically covers every
meaning of a quoted sentence. Unsupported checks remain unverified. The canonical
requirement ledger is session-local, not a new durable recovery/completion system.

## Review repair: coverage failure semantics

The R1 failed-NPC-repair and R2 malformed/empty-audit cache regressions are repaired
at the canonical parser/adapter boundaries. See
[`coverage-repair/README.md`](coverage-repair/README.md) for exact red/green cases,
commands, direct exit codes and the retained interrupted validation attempt.
Post-repair verification passed 184 tests in 17 serial suites, application
typecheck/build and the existing mock-model Firefox public-session smoke.
This did not rerun live authoring or change the owned saved project, canonical
handoff, model provenance or lead graphical-player comparison above. Final lead
checks, complete baseline/candidate gate comparison and reviewer approval remain
pending; the focused repair verification is not a full-gate approval claim.
