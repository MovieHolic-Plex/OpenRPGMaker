# Shared main integration sweep

## Included work

- Shared main preserved local chipset commit `cab4b950`.
- Upstream PR615 and PR616 were merged as `0eb0a06c` and `6c9a3c4e`.
- PR618 integration handoff `a1d45784` was merged as `9257878b`.
- PR610 integration handoff `2069bcc3` was merged as `1b76ce6e`.
  PR619's older head is included through ancestry, not merged twice.
- The final remote check reported 20 commits ahead and zero behind before
  committing this evidence.

## Preserved local work

The five overlapping dirty paths were saved in stash
`1eff1c79542dcaebe158b8a15b0ac914ac5cea3c`, then applied after the merges.
Renderer conflicts retain both the narrow interior-fire predicate and the
existing world-animation predicate. Replayed changes remain uncommitted.
The other 21 dirty files retained their original hashes. Untracked user
content was not staged. Generated-index backup stashes remain available.

## Supervisor verification

- PR615: app typecheck and 48 assertions passed. Direct Firefox verified
  numeric-label focus without value mutation and modal Tab/Escape behavior.
- PR616 and final shared main: CSS budget/graph/live-class gates passed.
- Final shared `npm run build`: exit 0, editor/player/SDK/standalone included.
- Combined focused run: 193 assertions passed but exit 1 due to Vitest
  `onTaskUpdate` RPC timeout. This run is not green.
- Two subsequent single-worker batches, assertions unchanged:
  facility composition 76 passed; remaining nine files 117 passed.
  Both completed with exit 0.
- Command CSS authoring: actual editor drag order
  `cmd_skill, cmd_attack, cmd_item`, public serialization and player reload,
  CSS on command/target/item menus, keyboard attack and HP 220 -> 152.
  Four runtime beats passed, errors empty, exit 0.
- Compiled editor independently applied the requested color and 8px radius.
- Built-player Firefox facility run: 18 of 18 passed, no runtime errors.
- Built-player inn/fire run: start and four stair transfers passed with zero
  teleports; cold hearth stays on tile_463; lit hearth emits tile_124,
  tile_154, tile_184 and tile_214. No runtime errors, exit 0.
- Full supervisor `npm run gates` reached the 30-minute watcher limit.
  Its final whole-suite report was not obtained. This remains an explicit
  verification limit, not a pass or a claim of zero whole-suite regressions.

## QA corrections and limitations

Editor preparation deadlines were raised to 120 seconds after observed
cold-module navigation/toolbar timeouts on the shared host. No retry loop,
test assertion relaxation, source proxy or product fallback was added.

The inn harness initially used an invalid beat identifier, then omitted
the authored stair dialogue confirmation. Both failures were retained in
the session. The final run uses kebab-case IDs and observes page-ready
before confirming each authored dialogue. It does not bypass transfers.

No subjective pixel-quality approval is claimed: this model cannot receive
the screenshots. Actual DOM/style/interaction and runtime-frame checks are
the evidence.

## Artifacts

- `output/evidence/battle-command-css/result.json`
- `output/evidence/battle-command-css/compiled-editor.png`
- `output/evidence/facility-quality/shared-sweep/player-firefox/SUMMARY.md`
- `output/evidence/shared-sweep-player/result.json`
- `output/evidence/shared-sweep-player/inn/SUMMARY.md`
- `.omo/evidence/pr618-integration-0906.md` for isolated conflict history

## Pending work

PR608 remains under final validation. PR613 awaits owner approval.
PR614, PR617 and newly arrived PR621 remain Drafts. PR620 explicitly says
leave open and do not automatically merge. These are not claimed shipped.
