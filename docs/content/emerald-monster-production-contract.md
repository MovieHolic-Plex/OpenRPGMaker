# Emerald reference game production contract

The goal is an editor assistant that automatically creates coherent Emerald-like
monster games when requested. The existing Starlight Islands game is the first
dogfood result, not the reusable feature's only destination.

## Shared integration contract

- `meta.oprnMonsterStyle = {version:1, reference:'emerald'}` is optional authored
  metadata. `src/project/emeraldMonsterStyle.ts` owns its type, predicate, settings,
  tile family and authoring guidance. Existing hosts must retain this metadata.
- Runtime opts in through `isEmeraldMonsterStyle(project)`. Do not branch on the
  genre string. Retain the existing `collector`, `pokemon`, `handheld`, and
  `field-list` wire values for older hosts. New DOM surfaces expose
  `data-monster-style="emerald"` for CSS/observation.
- Do not fabricate session state, change existing save namespace, overwrite an
  independently authored campaign, or replace the whole project to apply a skin.
- Root owns metadata/schema, assets, opening, canonical content and integration.
  Isolated agents own their assigned runtime/assistant modules only. No shared
  project writes. Existing 72 maps/60 species remain the content scope.

## Required final evidence

| Requirement | Evidence required |
|---|---|
| Automatic Pokemon-like request handling | Real assistant run with an ordinary request, selected tools/profile and completed coherent content; existing-project repair must preserve session. |
| Reusable editor production | Native registered profile/build/read/review tools, welcome and assistant guidance, shareable assets/defaults; a separate fresh project also receives the profile and content. |
| Opening | Emerald-like pixel professor/monster introduction and Enter-confirm story/handoff; actual playback, held-key guard, continuous music, Continue skips new-game introduction. |
| Game play and maps | Connected playable campaign, matching tiles/characters, starter choice, grass encounter, battle/capture, medicine/healing, gym/badge and save/Continue. Actual native gameplay plus all-map data audit. |
| Shop | Entry Buy/Sell/Quit; buying shows left map view/right goods/bottom item information; quantity and yes/no are sequential; sale inventory works. Actual transactions/cancel at desktop and narrow sizes. |
| Monsters | All authored species have coherent pixel front/back resources, types/skills/PP/evolution/ecology/capture connections. Actual party/dex/battle/capture/learn/evolve flow plus complete resource audit. |
| Canonical storage and shipped game | Official host CAS save, fresh reload and asset-byte checks; exact tested player export published to the user's current address. |

Reference fidelity is established against actual Emerald screenshots and primary
source UI/window geometry, not against the names of local presets. Existing Gen1
battle rules must not be claimed as exact Emerald mechanics. Record unsupported
mechanics plainly and continue implementation where required by this goal.

Artwork quality is a separate gate from data/resource completeness. The former
coordinate-generated packs do not establish visual approval. Generate original
characters and monster sprites, inspect native pixels, and require human selection
through the monster species harness for production fronts/backs. New NPC artwork
must include consistent walking directions and trainer battle views; route signs
must remain objects. See `openwiki/emerald-monster-art-v2.md`.

No gates/Vitest/full typecheck/stash unless the user explicitly requests them.
Use builds, focused executable probes and actual shipping-player evidence.
