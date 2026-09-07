# Task12 r5 nonblocking rug input

Status: remotely saved/reloaded input with strict public-core passage and relocation preconditions PASS. Nonvisual model evidence only; no native, Task12, or whole-goal approval.

## Immutable consumed input

- Supabase project: `rpg-zzu-life-full-p4-t12-rug-st-01a07be4` (new owned ID; absent before authoring).
- Load only `rug.reloaded.json`, mode0444, SHA256 `265f600a710025ee451361b70746b50ca2bf9165e6815d4ce0aa582e7eca520b`.
- Actual `saveProjectToSupabase` returned saved; subsequent `loadProjectFromSupabase` serialization equals authored bytes and save SHA. Public remote reads after probing still equal this input.
- Source arena was read remotely and compared byte-for-byte with fixtures-r4/arena.reloaded.json before authoring. Its project and files remain unchanged.
- Project4 authored start, NOT a mutated PlaySession or game Save. No invented Project farmPlots. Native initial facing down is the existing scene contract, not a new authored facing field.
- Open passable20x15 `map_blank_start`, existing floor/art, player3x3/passRows1, foot8,8; events empty, runtime plots/placeables empty, chests omitted.
- Real rug type `rug`:2x1, blocksMovement=false, orientations down/left, existing `easyrpg-picture-cloud`, item_potion cost1.
- Legitimate authored shed `r5-retained-shed`: type shed, level1, down,12,6,1x1. No inferred payment receipt. Its complete owner survives all model actions unchanged.
- Initial gold500, potion8, hoe1. No initial decoration.

## Native contract for G (NOT executed here)

Use actual player.html/new-game input and isolated slots. Preserve this project; never resave model probe states as authoring data. Prearm exact completed-step, menu/state, or storage observations before keyboard actions, with bounded timeouts and no sleep/polling.

1. From foot8,8 facing down, use `life-ledger-space-decoration-place-rug`. Native candidate is7,9/down; expected native owner `ledger:decoration:rug:1` (the `r5-probe-rug` ID in core-proof is MODEL ONLY). Assert actual owner, cells7,9 and8,9, recoveryItem potion1, potion8->7 and gold500.
2. Close menu; walk exactly one DOWN step to foot8,9. Assert actual origin passage x7..9/y8 has no rug intersection; destination passage x7..9/y9 intersects BOTH actual rug cells. Upper full-body overlap alone is insufficient.
3. Save slot1 while standing on the rug. Read actual slot1: foot8,9; rug7,9/down with recoveryItem; retained shed12,6; gold500/potion7/hoe1.
4. Walk exactly one DOWN off the rug to foot8,10. Move the SAME rug through the native Spaces action to adjacent7,11/down. Assert live divergent foot8,10/rug7,11 and no additional cost or changed recovery right/shed.
5. Load slot1 through the native menu. Assert ACTUAL LIVE foot8,9 and SAME rug restored to7,9/down, both owner kinds and gold500/potion7/hoe1 retained. Merely rereading unchanged slot1 does not prove Load.
6. Save the loaded state to slot2. Compare actual slot2 against slot1 for foot, complete building/decor owners, recovery rights, inventory and gold. G must bind these comparisons to live values and newly written slot2, not only old slot1. Separate legitimate unrelated runtime timing from the asserted domain.

## Public-core evidence

`core-proof.json` contains exact initial, after-place, standing-on-rug, after-walk-off and divergent sessions; targets, body/passage rectangles, actual rug cells/intersections, all mutation results and input hashes. `canOccupySpatialFootprint` and live `canPlaceSpatialFootprint` accept native candidate7,9. `placeHomeDecoration` succeeds and freezes potion1. `canMoveFootprint` accepts both DOWN steps; `isSpatialPlacementBlocking` is false despite the first destination's actual rug-cell overlap. The second step has no rug intersection. Live adjacent relocation7,11 and `moveHomeDecoration` succeed. Full-session comparison permits only foot and same rug coordinates after placement, proving no further costs/owner changes.

Model coordinates are assigned ONLY AFTER public movement feasibility assertions. Those assignments are explicitly not native movement, Save or Load proof. This node does not execute game Save APIs or fabricate native slot results. All assertions fail nonzero. Project serialize/local immutable bytes/fresh remote reload equality holds after probes.

## Direct commands and failures

Every invocation has separate complete stdout/stderr, direct exit, argv/cwd, private environment, input hashes, protected before/after inventories and cleanup under its prefix. Reproduction wrapper: `python .omo/evidence/life-full-20260906/12/ui/fixtures-r5/run.py <mode>`; frozen receipt names cannot be overwritten. Replay requires a new evidence destination, and author refuses an existing ID.

| Mode | Exit | Meaning |
| --- | ---: | --- |
| connection | 0 | DB available/new ID absent; original r4 remote bytes equal |
| author | 0 | public remote save/reload; immutable input |
| probe | 1 | evidence assertion expected empty chests object; actual optional chests is undefined |
| diagnostics | 1 | evidence expected-state adapter assigned readonly placement y |
| diagnostics-final | 0 | configured tsconfig syntactic/semantic diagnostics empty |
| probe-final | 0 | final frozen public-core passage/relocation and input invariance assertions |

Both failed versions are preserved as fixture.initial-probe.mts and fixture.pre-diagnostics.mts. Corrections only match actual omitted chests and replace an expected owner object instead of mutating its readonly property; no product/type suppression or geometry weakening. Python wrapper and diagnostics.mjs LSP returned no diagnostics. Optional missing AI proxy key notices remain in stderr; DB credentials are neither printed nor published.

## Preservation and cleanup

HEAD remains `ea6b2b358088cb6061783f6ffd162169764a07e9`, branch agent/life-full-p4. Per-command inventories cover all tracked files plus source/test/scripts/wiki and all fixtures-r4/build-r4 files. Exact source14 and three existing wiki dirty bytes, status and index remain unchanged. No source/test/wiki/config/Git change, browser/image/UI/full build/core-suite run occurred. Older projects, WISH and stardew-demo are untouched; remote write guards restrict POST row project_id and DELETE project filters to this one fresh owned ID. Save-path replacement DELETEs affect only this project's maps/tilesets, not project deletion.

Shared QA flock `/tmp/rpg-zzu-life-full-qa-01a0727b.lock` is bounded900s; each command bounded600s plus kill-after30s. Owned `/dev/shm/st_01a07be4` is absent after each command. Shared lock retained and released; no server/browser/port/profile/shared-cache cleanup. Remote project deliberately RETAINED for native consumer. `certification.json`, `final-cleanup.json`, and `PUBLIC-MANIFEST.json` bind final identities and publication. Manifest lists this owned directory only, excluding itself. No native acceptance is implied.
