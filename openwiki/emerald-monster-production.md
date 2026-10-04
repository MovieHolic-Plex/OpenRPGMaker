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
