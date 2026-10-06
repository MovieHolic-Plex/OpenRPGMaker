# Native space canonical installation

`src/harnesses/super-harness/node/nativeProject.ts` exports
`saveNativeSpaceProject({project, projectDir, evidenceDir, libraryId, selections})`.
It is the persistence adapter for already authored native maps/events. It does not
draw artwork, assemble rooms, choose candidates, publish a library, or run a game.
The supervisor supplies current approved selection fingerprints and performs
independent art and runtime inspection.

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
