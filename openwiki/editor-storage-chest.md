# Editor Storage Chest Authoring

Storage chest tool and its distinction from treasure reward presets.

## Storage chest authoring


- Tool `place_storage_chest` places an action event with `openChest`.
- Distinct from `place_chest` treasure reward preset.
- The empty-event `보물상자` starter is a one-shot item reward: it authors `changeItem += 1` with an existing database item and refuses when no item exists.
- The `보관 상자` command edits `openChest`. Authors can set display name, template (`farm` / `warehouse` / `vault`), window layout (`center` / `bottom` / `wide`), icons, stack capacity, bulk/sort/category tabs, gold vault, switch or item lock, and allowed item types. The form still offers event-local or named shared storage. Preview shows the two-way bag-to-storage interaction plus the authored title. Keep runtime keys such as `session.chests` out of author-facing copy.
- New commands from the picker default to the farm template. Legacy commands **without** `template` stay unlimited capacity and open the nicer center window.
- Runtime storage is `PlaySession.chests`; it is save data, not authored project content. `parseChestsRecord` is shared by slot parsing, snapshot writing, and direct restore. It keeps structurally valid chest rows, optional non-negative `gold` up to `GOLD_MAX`, and only positive safe-integer inventory counts up to `ITEM_QUANTITY_MAX`, dropping corrupt item rows instead of exposing them to runtime.
- `depositToChest` and `withdrawFromChest` preflight both the player inventory and chest inventory before committing either side. `depositToChest` also preflights optional `capacity` (distinct item stacks) and `allowedItemTypes`. Player-side changes use `changeItemsAtomically` so finite-use charge cursors stay coupled to player counts; full, `1e300`, or above-cap source/destination values leave both containers unchanged.
- Play UI lives in `src/player/playSceneChest.ts`, uses the project windowskin, item icons and quantities, and does not duplicate the overlay title in the status line.
- Helpers: `src/project/storageChest.ts` (`resolveStorageChest`, lock, gold transfer, tabs). Types `StorageChestTemplate` / `StorageChestLayout` live in `src/project/types/events.ts` so events do not import the helper module.
