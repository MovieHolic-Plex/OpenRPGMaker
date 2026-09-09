# Task12 r4 fixture handoff

Status: **both core-preflighted, remotely saved/reloaded inputs ready for Grok**.
This is nonvisual data/geometry delivery, not native acceptance or Task12 approval.
No product/test/wiki/config/Git edits, browser, screenshot, UI suite or full build.
The existing 14 code/test and 3 wiki changes remain intact and uncommitted.

## Immutable fresh inputs

| Input | New owned Supabase project ID | Serialized remote reload |
|---|---|---|
| Decoration arena | `rpg-zzu-life-full-p4-t12-arena-st-01a07ba6` | `arena.reloaded.json` |
| Stationary last exit | `rpg-zzu-life-full-p4-t12-last-exit-st-01a07ba6` | `lastExit.reloaded.json` |

Arena SHA-256: `d8a44e6019cb015ca557bdedb551efd006975f1ba754bc2a3cd611b301b234f8`.
Last-exit SHA-256: `ca7bb0339b1472d602db720620e927bc5b81e93cfafa18a9f1ed20df07e24813`.
For each input the authored bytes, save-returned SHA, serialized reload, and remote
reload after model actions are equal. Both are Project inputs at PRE-ACTION state,
not mutated PlaySessions or game Saves. Use only the two `*.reloaded.json` files
as new-game inputs. The full initial/after sessions in `*.core-proof.json` are
MODEL evidence, never loader inputs.

Both use `map_blank_start`, 20x15, the unchanged r3 floor (lower tile240,
upper -1), existing chipset/art and `easyrpg-picture-cloud` catalog graphic.
Both retain authored player 3x3 / passRows1 after real public reload. Events are
empty; new-game plots/placeables are empty; no farmPlots field was authored.
Start inventory is item_potion8, item_hoe1; gold500. There are no new art assets.

## Arena native contract

Fresh foot `(8,8)`, facing down (the existing PlayScene initial facing).
Full body is x7..9/y6..8; passage is x7..9/y8. No starting buildings/decorations.

1. Spaces: `life-ledger-space-decoration-place-table`. Place Table at `(7,9)`,
   down, footprint2x1. Expected native owner `ledger:decoration:table:1`;
   potion8 ->7, gold500 unchanged, recoveryItem potion1.
2. Without walking, activate that owner's rotation entry. Orientation must
   change down ->left at the SAME `(7,9)`, now1x2, cells `(7,9),(7,10)`.
3. Close the menu and complete exactly one left step to foot `(7,8)`, facing
   left. Register/await the real completed-step signal, not a sleep. Core
   `canMoveFootprint` is true and `isSpatialPlacementBlocking` is false for
   destination passage x6..8/y8. There are no NPCs/placeables/chests to add walls.
4. Reopen Spaces and move that SAME owner to adjacent `(5,6)`, left1x2.
   New player full body x6..8/y6..8 does not overlap the target x5/y6..7.
   Rotation/movement keep the item recovery right and all other costs/owners.
   Save/read the real native slot to prove both orientation and changed coordinates.

Candidate coordinates were accepted without adjustment. The r3 record named
Table was actually1x1; this fresh QA input explicitly changes its data footprint
to2x1 and restricts its real orientation cycle to `[down,left]`. `blocksMovement`
is true. Public orientedFootprint, adjacentSpatialPosition, static/live preflight,
placeHomeDecoration, rotateHomeDecoration and moveHomeDecoration all pass.
Do not mistake `r4-probe-table` (model-only ID) for the native ledger-generated ID.

## Stationary last-exit native contract

Fresh foot `(1,2)`, facing down; **do not walk or turn before construction**.
Player full body x0..2/y0..2, passage x0..2/y2. Authored starting buildings:

- `r4-block-up`: shed1x1 at `(1,1)`, level1, down.
- `r4-block-right`: shed1x1 at `(3,2)`, level1, down.

These are legitimate `project.session.farmBuildingPlacements`, not invented plots
or injected runtime state. The upper blocker is deliberately under the player's
upper full-body extent, not its one-row starting passage. Authored starting
placements use static occupancy; full-body LIVE placement refusal remains intact.
The candidate is not overlapping that blocker or the player.

Existing public movement/placement APIs establish: up is blocked by the upper
shed; left is map-edge blocked; right is blocked by the right shed; only down
is open (destination passage x0..2/y3). Construct a new shed1x1 at adjacent
`(0,3)`, down. Expected result is `blocked`, with foot/facing unchanged,
gold500, potion8, hoe1, exactly the same two building owners and zero decorations.
Capture the full relevant domain and actual native slot/readonly state, not just a toast.

The shed data is explicitly changed from r3's2x1 to1x1. Its relevant cost is gold10
plus potion2. Direct proof isolates the cause:

- canOccupySpatialFootprint at `(0,3)`: true; floor passable.
- Same target/live reader with blocksMovement=false: true.
- Same target/live reader with blocksMovement=true: false.
- Separate static construction positive-control clone: succeeds, gold500 ->490,
  potion8 ->6. Thus invalid type or unaffordable cost cannot explain refusal.
- Actual live placeFarmBuilding: `{ok:false,reason:"blocked"}`; **entire session
  deep-equal before/after**, including inventory, all owners, rights and costs.

No candidate coordinate adjustment was needed. The boolean nonblocking control
is a call to the public preflight's actual blocksMovement parameter, not a fake
accepted mutation. The positive-control clone was never remotely saved.

## Execution and preservation

Cwd: `/home/main/z-project/rpg-zzu-life-full-p4`.
Actual recorded final invocation (environment and streams in command JSON):

```sh
TMPDIR=/dev/shm/st_01a07ba6 \
XDG_CACHE_HOME=/dev/shm/st_01a07ba6/xdg \
VITE_CACHE_DIR=/dev/shm/st_01a07ba6/vite \
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock \
  timeout --signal=TERM --kill-after=30s 600s \
  node node_modules/vite-node/vite-node.mjs --script \
  .omo/evidence/life-full-20260906/12/ui/fixtures-r4/fixture.mts -- probe-certified
```

The exact wrapper used was `python .omo/evidence/life-full-20260906/12/ui/fixtures-r4/run.py probe-certified`.
It creates/removes the owned scratch, captures direct streams/exits and hashes,
and refuses to overwrite an existing command receipt. This invocation documents
reproduction; preserve this frozen evidence rather than rerunning into it. Any
independent replay needs its own evidence destination/copy. Author mode also
refuses an existing remote ID; never reauthor these inputs after native setup.

| Execution | Exit | Evidence |
|---|---:|---|
| DB connection and both IDs absent, BEFORE authoring | 0 | connection.* / connection-proof.json |
| Public saveProjectToSupabase + loadProjectFromSupabase | 0 | author.* / *.save-receipt.json / *.reload-receipt.json |
| Initial model probe | 1 | probe.stderr / fixture.initial-probe.mts |
| Corrected model probe | 0 | probe-final.* |
| Initial configured owned-file diagnostics | 1 | diagnostics.stdout |
| Final configured owned-file diagnostics | 0 | diagnostics-final.* |
| Final frozen entry point, both REMOTELY RELOADED inputs | 0 | probe-certified.* / *.core-proof.json |

The initial probe failed on snapshot dictionary prototypes: actual inventory was
null-prototype `{item_hoe:1,item_potion:7}`, structuredClone snapshot was an ordinary
object with the same values. The evidence adapter now clones both comparison
sides, still checks every value and full state; no expectation or product was
weakened. Initial TypeScript diagnostics caught an unused type import and direct
access to a legacy extra wire `name` field. The final script removes the import
and builds the same inferred extended object without suppressions or casts.
Configured tsconfig.json syntactic/semantic diagnostics are empty on final bytes.
The generic LSP initially used an inferred project for this .omo file and could
not resolve @ aliases; configured diagnostics are the authoritative receipt.
Python wrapper and diagnostics.mjs final LSP checks report no diagnostics.

No native test was run or claimed. Model walking updates session coordinates
ONLY after public feasibility assertions. The authored Project serialization and
local fixture hash are checked unchanged, and a fresh actual remote load is
compared again after each probe. Every unmet assertion exits nonzero.

The initial evidence-file patch command had a malformed hunk and wrote no file;
it was corrected with a standard-patch wrapper because apply_patch was not on PATH.
After finding the original DAG's explicit Codex binary, all further patches used
its native `--codex-run-as-apply-patch` entry point. This affected owned evidence only.
Vite stderr retains three optional AI-proxy missing-key notices; credentials and
request headers are not published. No dependency/config change was made.

## Source identity, cleanup and publication

HEAD `ea6b2b358088cb6061783f6ffd162169764a07e9`, branch `agent/life-full-p4`.
`certification.json` and the before/after inventories compare12938 protected files
(all tracked files plus source/test/scripts/wiki files), unchanged from connection
through final probe and final certification. They include the current14 code/test
and3 wiki bytes. Index and the intentional dirty status remain unchanged. The
inventories are exact; they do not claim an exhaustive hash of ignored old evidence.
No older evidence was edited. Original r3, build-r3, verify-r3 and Task52 acceptance
remain the prerequisites; this node does not replace their native/build receipts.

All owned `/dev/shm/st_01a07ba6` scratch is absent after each command. Shared lock
is released and retained, not deleted. No browser, server, port, profile or shared
cache was created/removed. `author.requests.json` records actual project/map/tileset
POSTs and the save path's map/tileset replacement DELETEs, restricted to these new
owned IDs. Both remote projects are deliberately RETAINED, with no project deletion,
for Grok's native consumer; remote deletion now would destroy the deliverable.
No stardew-demo, WISH, old QA project, remote Git merge/push/PR or commit was touched.

`FIXTURE-HANDOFF.json` is the machine-readable contract; `PUBLIC-MANIFEST.json`
is the exact safe publication inventory of this directory excluding itself.
No PNG or private credential file is part of this handoff. Remaining work belongs
to Grok: actual player.html native closure of the three missing criteria, then the
parent's serial combined delivery/commit and independent acceptance gates.
