# Task12 remaining native rug evidence

Build-r4 found a real coverage gap, not a demonstrated product defect.
The old saved rug is at `(3,1)`, down, 2x1, nonblocking. Its cells are `(3,1)`
and `(4,1)`. The step labeled walk-onto-rug ends at foot `(2,3)` with a
3x3/passRows1 player: its movement passage is x1..3/y3. The upper body overlaps
the rug, but the movement passage does not. The label is not traversal proof.

Producer-r4's accepted rotation, distinct-coordinate movement and last-exit
refusal remain valid scoped evidence. Preserve them and all previous failures.
No source fix or repeated full UI implementation follows from this gap.

## One fresh scenario closes traversal and actual restoration

The candidate below is assigned to Astra for core preflight and a NEW isolated
Supabase input under `fixtures-r5/`. It is not yet a native result.

- Retain the open arena, player3x3/passRows1, initial foot `(8,8)` facing down.
- Author a real nonblocking rug2x1 and a distant legitimate starting building,
  so the saved state contains both building and decoration owner kinds.
- Place the rug at `(7,9)`.
- Natively complete one DOWN step to `(8,9)`. Assert that the actual destination
  passage x7..9/y9 intersects the actual rug cells, unlike the origin passage.
  Do not substitute full sprite/body overlap for this assertion.
- Save slot1 while standing on the rug. Preserve its raw owner/cost/foot state.
- Complete another DOWN step to `(8,10)` and move the rug to the clear adjacent
  target `(7,11)`. Assert this is a real divergent owner state before Load.
- Load slot1. Assert the player is back at `(8,9)` and the rug is back at `(7,9)`,
  with both owner kinds and the original recovery right retained.
- Save the loaded state to a DIFFERENT slot2 and compare its relevant owner,
  cost and position state with slot1. Merely rereading slot1 cannot prove Load.

Confirm every proposed coordinate against the actual reloaded input and core
preflight before native execution. Model session setup is not native proof and
must never become the authored fresh-game input.

Native observations must use the current document/state after Load, including
element replacement. Subscribe before keys, await exact movement/menu/load state
changes, retain failures and exit nonzero for unmet assertions. Use an owned
fresh browser profile without clearing saved data on later document reloads.
No post-action injection, DOM.click, new debug API, timing-luck retry or product
change is authorized by this correction.

The full independent UI/native acceptance still follows the real combined
commit. Source equality permits reuse of already passing producer and CLI
receipts; it does not turn this missing traversal into an earlier pass.

## Execution interruption

The previous verifier failed before doing work because `xai/grok-4.6` returned
HTTP403 for exhausted credits/subscription. The original DAG is settled, and
its detached result wait completed. Do not retry that unchanged route in a loop.
Existing authenticated alternate GROK routes may be tested without changing the
user's model-family policy. Astra's nonvisual input preparation can proceed.
