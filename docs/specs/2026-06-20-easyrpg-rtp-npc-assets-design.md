# EasyRPG RTP NPC Asset Import Design

## Goal

Bring in the EasyRPG/RTP replacement assets needed for richer NPC authoring, while keeping the first implementation focused and shippable. The first user-facing feature is a real NPC graphic picker backed by EasyRPG `CharSet` sheets. `FaceSet`, `Music`, and `Sound` are imported in the same pipeline so later dialogue, menu, audio, and event-command work can reference them without another asset migration.

## Scope

Import these EasyRPG/RTP folders from a pinned GitHub commit:

- `CharSet/*.png`
- `FaceSet/*.png`
- `Music/*.mid`
- `Sound/*.wav`
- `AUTHORS.md`
- `COPYING`

Do not import `Monster`, `BattleCharSet`, `Battle`, `Backdrop`, or full RTP folders in this step.

## Asset Sync

Add a local sync script, `scripts/sync-easyrpg-rtp-assets.mjs`, that downloads only the scoped folders from `https://github.com/EasyRPG/RTP` at a pinned commit hash. The script writes files under:

- `public/assets/easyrpg/charset/`
- `public/assets/easyrpg/faceset/`
- `public/assets/easyrpg/music/`
- `public/assets/easyrpg/sound/`
- `public/assets/easyrpg/AUTHORS.md`
- `public/assets/easyrpg/COPYING`

The script should also emit a generated manifest JSON with source path, local path, category, display name, media type, and the pinned commit. Existing handwritten asset lists should consume the generated manifest instead of duplicating every filename by hand.

## Attribution

Update `public/assets/ATTRIBUTION.md` to include EasyRPG/RTP, its GitHub URL, the pinned commit, and CC-BY-4.0 attribution guidance. Keep upstream `AUTHORS.md` and `COPYING` alongside the vendored files.

## CharSet Model

EasyRPG/RTP CharSet sheets use RPG Maker 2000/2003 layout: 288x256 images, eight characters per sheet, each character made of 3 columns by 4 directions, with 24x32 cells.

Represent an NPC graphic selection as:

- `sheetId`: the EasyRPG texture key
- `characterIndex`: 0 through 7
- `direction`: down, left, right, or up
- `pattern`: 0 through 2

For compatibility with the existing runtime, convert that selection into the current `EventPage.graphic.sprite.id` plus numeric `pattern` frame index. The runtime can keep rendering via `resolveEventSpriteTexture()`.

## Editor UX

Replace raw sprite-id entry for event page graphics with an NPC graphic picker:

- sheet selector grouped by `Actor`, `People`, `Animal`, `Monster`, `Object`, `Vehicle`, and `Template`
- 8-slot character grid for the selected sheet
- small direction/frame preview
- apply selection to the active event page immediately

Keep the old text input available as an advanced fallback for custom or uploaded sprite ids.

## Runtime

Load scoped EasyRPG CharSet images as Phaser spritesheets using 24x32 frames. Event sprite resolution should recognize EasyRPG texture keys from the generated manifest. Missing resources continue to surface through the existing runtime missing-resource overlay.

FaceSet, Music, and Sound are imported and manifest-addressable in this step, but they do not need full UI pickers yet. Existing `playAudio` commands can reference Music/Sound ids once a later command editor exposes an asset picker.

## Validation

Verification should cover:

- sync script writes the expected files and manifest
- attribution file mentions EasyRPG/RTP and the pinned commit
- all CharSet entries have 24x32 frame metadata
- event editor can choose a CharSet character without typing an id
- selected NPC renders in editor and play mode
- build/typecheck stays green

