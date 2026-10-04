# Emerald-reference monster production

User intent is a reusable editor assistant capability, with Starlight Islands as
the dogfood campaign. Read `docs/content/emerald-monster-production-contract.md`
for the full acceptance matrix. Applying a skin alone is insufficient.

`src/project/emeraldMonsterStyle.ts` owns the versioned authored metadata
`meta.oprnMonsterStyle`, the explicit configuration function and AI guidance.
Player code checks `isEmeraldMonsterStyle`, not `system.genre`. Existing wire enum
values remain host compatible. The authored viewport is 480x320 at cameraZoom2:
the 240x160 GBA view at exact2x, showing 15x10 16px map cells. This uses existing
supported settings rather than changing global resolution limits.

`src/project/emeraldMonsterOpening.ts` registers the shared original professor
sprite, authors Enter-confirm professor/monster dialogue, and leaves actual
starter choice to existing map events. It accepts explicit author-written pages.
`oprnOpeningBook.portraitResourceId` keeps the same professor image mounted while
the showcased monster/text changes. Continue does not replay a new-game opening.
The original generated PNG and provenance live in `public/assets/emerald-monster`.
Source scene resource IDs must include the portrait at least once so the normal
export asset closure retains it; the default intro satisfies this.

The professor PNG was generated with the built-in imagegen tool and visually
inspected. Requested logical sprite dimensions are prompt intent, not output
facts: actual original PNG is1122x1402 with alpha0..255. Runtime displays it as a
small pixel-style portrait without modifying the raster. Original species remain
editable database/resource records. Exact Emerald combat mechanics are distinct
from Emerald presentation and must not be inferred from a skin name.
## Original title key art

`configureEmeraldMonsterOpening` also applies `configureEmeraldMonsterTitle`,
which installs the shared original star-antlered stag illustration and compact
keyboard title menu. Existing title music, sounds, labels and saved-game
availability are retained. Painting-specific WebGL layers/entrance sequences are
cleared when this introduction is explicitly authored. Other projects keep their
current title renderer; the runtime skin opts in by the shared profile marker.

`public/assets/emerald-monster/title-prompt.txt` records the exact built-in
imagegen prompt. The untouched generated PNG is **1536×1024** (3:2), SHA
`86a627ab7fd3ebce0a7dfe49ff72258210b9263d91642f7d36de69b5e4df9f5d`.
The prompt requested GBA pixel composition; this asset is not falsely described
as a native 240×160 file. The runtime fits it into the authored 480×320 stage with
pixelated sampling. `title-provenance.json` records dimensions and generation.
## Field cast

`scripts/content/emerald-field-cast.py` owns reproducible original coordinate art:
16 roles, four directions and three independently drawn walking poses. Characters
have 16px silhouettes in the engine's mandatory 24×32 cells; the two transparent
288×256 sheets each contain 96 row-major frames. The catalog records native
bounds, frame order, role order, source and PNG SHA values. All uploaded resources
have kind `charset`, so the normal charset load/slicing/walking path is used.

`configureEmeraldMonsterCast` registers the shared seed for every campaign builder
and repair tool. Only known stock RTP/Scarloxy person graphics are replaced;
custom character resources, authored pages, commands, routes, collision, raster,
event IDs and live session overrides remain intact. Professor, rival, nurse,
merchant, company staff, captain and trainers use explicit role slots. These
assets are game characters, not chipset tiles or borrowed reference images.
## Existing authored animation compatibility

Existing published v25 retains `anim_px_*` animation records using seventeen
`pixel-fx-*` IDs. Their original 512×64 bytes are present in public assets; an
older source checkout lacked their resolver registration and rejected the entire
game at load. `legacyPixelEffectAssets.ts` preserves those IDs in the normal
builtin resource catalog, without replacing animation records or disabling
validation. The campaign exporter also collects actual battle animation resource
IDs and copies each resolved local file, rather than relying on a stale manifest.
