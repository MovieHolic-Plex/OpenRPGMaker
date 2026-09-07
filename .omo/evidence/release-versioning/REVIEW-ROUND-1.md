# Ultrabrain review round 1: REQUEST_CHANGES

Reviewed candidate: `67756b703ce147b20a0a7ffcef36de24ba128b4a`.
Reviewer task: `st_01a078ef`.
Confidence: high (0.98).
The reviewer made no edits, commits, database publications, or GitHub actions.
PR #677 remains Draft and must not merge until a fresh ultrabrain approval.

## P1: public identity bypasses community save isolation

Locations: `src/player/savePublication.ts:13-14`,
`src/player/saveSlots.ts:251-262`, and community upload ingress.

Publication Save6 keys use uploader-controlled `gameId` and
`saveCompatibilityId` before considering the host/listing namespace. A second
anonymous listing can keep those public IDs while changing project data and
using the same operator-approved executable.

The reviewer reproduced:

```json
{
  "copiedIdentityArchiveAccepted": true,
  "differentListingsShareManualAndAutoKeys": true,
  "victimSnapshotAcceptedByCopy": true,
  "victimGoldAfterOtherListingSave": 999,
  "originalBytesOverwritten": true
}
```

The original save had gold 41.

Required repair:

- Community-controlled isolation must apply to manual saves, autosaves, and
  predecessor import discovery/copying, not just to listing database updates.
- Compatibility metadata is not authority.
- Cross-listing copying must be an explicit player-selected operation, not an
  automatic effect of an uploader's accepted-lineage declaration.
- Old retained runtimes that lack this protection must be rejected for new
  shared-origin publication or isolated. Never rewrite immutable runtime bytes.
- Do not add an ownership/account platform.

Acceptance:

1. Publish two listings with identical game/lineage IDs on one browser origin.
2. Save and autosave in A; B cannot expose or overwrite either slot.
3. Exercise predecessor-import controls as well as ordinary load/save.
4. Prove A's original bytes remain unchanged.
5. Preserve standalone identity stability and explicit compatible copying.
6. Replace the host-namespace bypass assertion with the correct context split.

## P2: coherent project dependency omission is accepted

Location: `src/project/gameRelease.ts:108-124`.

Validation proves the trusted web files, fixed runtime-required assets and
declared inventory hashes, but does not prove that project-referenced assets
outside that fixed set are present.

The reviewer removed `assets/cc0/audio/bgm/field-of-dreams.mp3` from a real
candidate release, kept its `cc0-bgm-field` project reference, recomputed the
release inventory/digest, and passed it through `validateReleaseArchive()`.

```json
{
  "acceptedWithoutDependency": true,
  "runtimeRequired": false,
  "projectReferenceStillPresent": true
}
```

Required repair:

- Before persistence, resolve authored dependencies through a read-only
  dependency contract bound to the selected retained runtime/collector version.
- Require each resolved dependency to be embedded or in the verified inventory.
- Do not use current-editor normalization or a mutable asset fallback.

Acceptance:

1. Remove a used PNG and audio file outside `runtime.requiredAssets`, recompute
   the ZIP/manifest, and reject before inserting any listing/release.
2. Reject unresolved and external dependencies.
3. Accept a complete supported older-runtime release when current editor/assets
   differ or are unavailable.
4. Preserve exact original project bytes throughout validation.

## Repair sequencing

Both repairs affect runtime capability/provenance and upload trust contracts.
Implement the save-isolation capability first, then build dependency closure on
that committed contract. Only one coding agent edits the integration worktree at
a time. The lead owns integrated build, real-surface QA, PR updates, and the
fresh ultrabrain review; deep agents own the requested repairs.

The original broad gate timeout/cancellation and baseline surface failures
remain limits, not passing results. Existing successful gameplay evidence is
retained, but cannot prove these newly reproduced adversarial paths.
