# Native space canonical installation

`src/harnesses/super-harness/node/nativeProject.ts` exports
`saveNativeSpaceProject({project, projectDir, evidenceDir, libraryId, selections})`.
It is the persistence adapter for already authored native maps/events. It does not
draw artwork, assemble rooms, choose candidates, publish a library, or run a game.
The supervisor supplies current approved selection fingerprints and performs
independent art and runtime inspection.

## Pure project packet authoring

`src/harnesses/super-harness/node/nativeScene.ts` exports the synchronous function:

```ts
createNativeSceneProject({
  title: string,
  library: SharedContentLibrary,
  maps: GameMap[],
  startMapId: string,
  startPos: { x: number, y: number },
  switches?: SwitchDef[],
  playerSprite?: AssetRef,
}): Project
```

It starts from `createBlankProject`, replaces the maps/tree/start and native library
assets/tilesets/sprites, removes the default opening, and returns
`deserialize(serialize(project))`. Inputs are cloned and no filesystem, catalog
installation, publication, or canonical save is performed. Built-in sprite definitions
may remain; previously projected catalog uploads are removed so authored uploads
belong only to the supplied library.

The library must be `projectDefaults:true`. Maps have unique nonblank IDs, positive
integer dimensions, library-owned tilesets with matching cell sizes, exact layer
lengths, and tile IDs in `[-1,count)`. Optional shadow bits have one entry per cell
in `0..15`. Retired nonempty tile stacks are rejected. Events have nonblank unique
IDs within each map and integer coordinates inside that map. The start point must
lie inside its named map. Collision/route feasibility is a separate runtime check.

Switch definitions add or replace baseline slots and start false; duplicate supplied
IDs are rejected. `playerSprite` selects slot zero of a library-uploaded or built-in
walking CharSet for the baseline party leader; general action sprites cannot be a
walking player. An uploaded SpriteDef alias resolves its image ID; define its anchor
under that actual resource ID for the runtime player resolver. Omit playerSprite to
retain the built-in baseline player.

Explicit maps/events (including pages/footprints), SpriteDefs (including geometry
and anchors), images, tree and start must survive normalization unchanged, otherwise
the helper throws. The schema validator supplies command/reference shape validation;
this helper authors no events or scene artwork. Pass the returned packet to
`saveNativeSpaceProject` only after approved common publication and visual review.

## Frozen POTIONS runtime draft preparation

`src/harnesses/super-harness/native_runtime_prepare.py` has separate `freeze` and
`pack` commands. `freeze --artwork-root ROOT --recipes EXACT_RECIPE_DIR --contract
EXACT_SCENE_JSON --actors EXACT_RUNTIME_ASSETS_JSON --out NEW_MANIFEST_JSON` hashes
the four existing scene recipes, every native PNG they cite, scene contract/composer,
slot definitions, and the actor delivery receipt's full source list. It checks all
preexisting reference hashes. No active concept or native art is written.

`pack --manifest MANIFEST_JSON --out NEW_PACKET_DIR` reads only the frozen bytes and
rechecks all source files before writing. Changed source hashes fail. Output is
`authoring-input.json`, `library.json`, separate PNG assets, `preparation-proof.json`,
`input-manifest.json`, and `stair-binding.json`. A wall/vault refresh creates a new
manifest from an explicit recipe directory; it keeps authored actor/event identities
and does not read a moving latest pointer. Only unmasked crop/copy and transparent
padding are used. Native crop/source/output RGBA and PNG hashes are recorded.

Run `node src/harnesses/super-harness/node/nativeRuntimeDraft.mjs --packet PACKET_DIR`
to invoke `createNativeSceneProject` and write portable `project.oprn.json` plus
`draft-project-proof.json`. This authors and validates a packet; it never publishes,
saves SQLite, hosts a runtime, or claims quality. All uploaded assets belong to the
draft common library, which is an input for later approved common publication.

The classroom retains its23×14 ground collision diagram, all12student slots, native
floor/wall tiles, separate tall/offgrid sprites, and32px visual north headroom.
`visualTopOverhangPx` changes camera bounds only. Walking actor packs remain byte
identical with their original anchors. Per-instance frame copies use explicit
transparent padding/anchors to reconcile source contact pixels with cell-bottom
runtime pivots; no source SpriteDef is altered. Tabletop children share their bench
ground row for Y-depth. Same-priority nonblocking graphics and collision tiles/events
have separate responsibilities.

Teacher/student/assistant actions use their same delivered48-frame sheets and native
receipt durations: four poses, four directions, three ordered frames. Interactive
menus demonstrate every commissioned pose; per-actor parallel clocks loop the actual
classroom contact pose. The four original scene states also select door/light/pose
frames. Potion responses retain all36native frames at150ms; bottle holds frame6.
The rinse sequence uses four150ms frames then returns to idle. Door open/closed/locked
pages change only the authored one-cell threshold occupancy.

Stairs stay explicitly unresolved until the supervisor authors a real connected
landing. `pack(..., stair_destination={mapId,x,y,...})` is an optional Python adapter
for later composition with that map; `stair-binding.json` supplies the required
reciprocal return to classroom[8,12]. The CLI draft provides no pretend local teleport.
Stairs are not complete. Runtime Y-depth cannot directly represent all eight source
assembly bands, and exact hand/duct/player occlusion remains a visual QA requirement.
Current wall/vault review status and `runtimePassed:false`, `publicRegistered:false`,
`canonicalReload:false` remain explicit even after successful schema normalization.

## Preconditions and ownership

- `selections` must be nonempty; every value is a 64-hex fingerprint and every key
  is nonblank. The adapter checks shape, not approval authority or selection coverage.
- `libraryId` must identify an existing `projectDefaults` library in the host-user
  shared SQLite catalog. `OPRN_SHARED_CONTENT_SQLITE` controls that catalog path.
  The adapter uses `readSharedContentLibrary` and never publishes or edits a library.
- Every authored map uses a tileset owned by this library. Every supplied uploaded
  asset belongs to it and matches its published metadata and supplied byte/ref hash.
- Library image assets have `shared_` IDs and inline image data URLs. A catalog with
  only refs cannot supply bytes and is rejected. Sprite definitions are projected
  through the library's `sprites` field, including frame dimensions and ground anchors.
- Destination must be absent or a real, empty directory. Existing `project.sqlite`,
  other files, or a symlink destination are refused. A fresh evidence directory must
  have no `canonical-proof.json`. Never pass a running host's project folder.

## Save and reload

The adapter clones its input, installs only the selected library snapshot in the
process catalog, and calls `ensureSharedContent`. It preserves authored maps/events
and supplied sprite definitions exactly; conflicting definitions and schema
normalization that changes them are rejected. Supply a current-schema project.
The previous in-process shared catalog is restored when the call finishes.

After validation, an exclusive reservation file protects against a second adapter
using the same empty destination. `initLocalProjectStore` creates a new canonical
SQLite project. All library images pass through `putAsset`; their inline data URLs
are replaced by content-addressed refs. Sprite definitions remain separate.
The store is saved, closed and reopened through `openLocalProjectStore`.

Reload verifies project identity, revision and SHA, exact maps/events, sprite
definitions, upload metadata/refs, and every image's actual stored bytes. The library
revision must still match. Only then does it return and write `canonical-proof.json`
with projectId, absolute projectDir, map summaries, revision, sha256, selections,
libraryId/libraryRevision, canonicalReload/publicRegistered true and runtimePassed false.

## Caller and limitations

Headless callers can bundle the TypeScript entry through
`scripts/ontology-ts-loader.mjs:withTsModule`, following the parking project adapter.
Use this in a dedicated, serial installation process: shared catalog installation
is process-global. The adapter preserves array order and authored JSON values;
object insertion order and nonpersisted `undefined` properties are immaterial.

Saving is irreversible creation of a new project. A failed save/reload leaves its
new destination for inspection and does not emit a success proof; it does not erase
files or retry. An evidence write failure can follow a valid save. The reservation
coordinates this adapter, not unrelated host processes. The caller must own the
destination exclusively.

`publicRegistered` proves this library was present in the common catalog, not that
another host has it. `runtimePassed:false` remains false until separate runtime QA
has real evidence; collisions, doors, animation, visual fidelity, and playable
objectives remain the supervisor's checks. Serve the canonical folder through the
SQLite project host for editor preview; bridge-free previews do not resolve refs.

## Isolated wand shelf vacancy request

`src/harnesses/super-harness/wand_vacancy_prepare.py prepare --root <native-artwork-root> --out <new-scope>` freezes the existing shelf, original native walk/actions, scene recipe and native harness code. It queues one native candidate in scope-local content/data/picks, with all pixels locked except box5 sockets XYWH `[2,34,12,5]` and `[18,34,12,5]`. It preserves the source palette and all other shelf pixels. The source-specific paths/hashes are explicit in the entry; refreshed sources require an explicit new request.

`run --out <scope>` executes the copied native interior-props draw/independent-review path. `collect --out <scope>` validates changed pixels and source colors and creates lossless actual before/contact/lift comparisons from the frozen recipe and both delivered native actors, with exact anchors and 200ms lift poses. `review-context --out <scope>` requires native PASS, creates the comparisons, invokes the configured Codex reviewer and writes a hash-bound receipt. Each actor/side comparison isolates its subject and retains native scene placements; these images are review evidence, never a flattened runtime background.

The receipt is reviewed content awaiting selection. It does not select, publish, save a project or establish runtime success. Context PASS does not resolve the original full-room wall FAIL. A current hash-bound selection, current whole-scene review, runtime integration/QA and canonical save/reload remain the supervisor's responsibilities. Partial failed preparation directories are retained and must not be reused.

### Reviewed shelf pickup in playable drafts (2026-10-06)

`wand_runtime_prepare.py pack --vacancy-receipt <receipt.json>` accepts only native PASS plus four independently approved actor/side contexts bound to the exact candidate. `wand_shelf_runtime.py` verifies the receipt/evidence hashes and source pixels outside both box sockets, retains original native action crops/anchors, and authors contact → vacancy/held box → exact stock return plus actor return events. The opposite shelf stays occupied. Both facing the visible shelf and the floor interaction open the same menu. This requires actual runtime confirmation and does not approve the complete room or publish/save it.

Scene recipes may have different placement counts per state. Draft packing aligns native pieces by source/destination/size/occurrence; absent state pieces become transparent frames. Zero-based and one-based four-state filename sequences are accepted. Contract helpers resolve relative to the runtime contract, allowing an approved frozen layout file to live in `approved-previews/`.
