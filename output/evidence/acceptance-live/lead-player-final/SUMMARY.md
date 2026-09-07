# Live AI project: independent graphical-player comparison

Read this summary before any PNG. This is functional execution evidence, not a
visual-design approval.

- Result: PASS, direct Node process exit 0, eight checkpoints, zero page errors.
- Surface: shipping `player.html` with export store shim; Firefox, 1280x900.
- Project: `oprn-qa-functional-48c68b5f-2d4`.
- Remote SHA-256: `b03e73c068b972a35221b3e84447f296f54986552da1743997a1f32e452ce30c`.
- Canonical file SHA-256: `ce9695ca460f438ffa130798d8f887257de4eba1a792a50dc91fce2c7a3380c4`.
- Product source: `cffe7bc5be9a03bea5a6d7c55210834ae8d29e04`.
- Executed QA script Git blob: `60c1611b297d4caeb1b666ed8f7c64386656153c`.
- Command: `node scripts/qa/acceptance-live-player.mjs output/evidence/acceptance-live/lead-player-final`.
- Inputs: direction/action QA hooks and native keyboard dialogue/shop controls.
  No teleport, gold assignment, inventory injection, or authored-content changes.

| Checkpoint | Actual state | Result |
| --- | --- | --- |
| Start | Cedar Village (10,8), 100 gold, no potion/antidote | PASS |
| Open Mira's shop | 100 gold, no potion/antidote | PASS |
| Buy two potions | 80 gold, potion 2, antidote 0 | PASS |
| First Rowan interaction | (12,8), 80 gold, potion 2, antidote 1 | PASS |
| Repeat Rowan interaction | Same quantities and money | PASS |
| Outgoing gate | Meadow (2,8), quantities and money retained | PASS |
| Return gate | Cedar Village (17,8) | PASS |
| Walk back to original start | Cedar Village (10,8), 80 gold, potion 2, antidote 1 | PASS |

The three handled action receipts have sequences 1, 2 and 3; the repeated reward
check is not merely an unchanged snapshot without interaction.

All states agree with the independent real-interpreter scenario. The broader
request's unsupported/unquoted clauses remain unverified in the acceptance
ledger; this player run does not waive those obligations.

Evidence: `player-comparison.json`. PNGs are supporting captures only; no PNG is
required to establish these numeric/behavioral verdicts.
