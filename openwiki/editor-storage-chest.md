# Editor Storage Chest Authoring

Storage chest tool and its distinction from treasure reward presets.

## Storage chest authoring


- Tool place_storage_chest places an action event with openChest.
- Distinct from place_chest treasure reward preset.
- The empty-event `보물상자` starter is a one-shot item reward: it authors `changeItem += 1` with an existing database item and refuses when no item exists.
- The `보관 상자` command edits `openChest`. Its form offers event-local or named shared storage, and its preview shows the two-way bag-to-storage interaction. Keep runtime keys such as `session.chests` out of author-facing copy.
- Runtime storage is `PlaySession.chests`; it is save data, not authored project content. `parseChestsRecord` is shared by slot parsing, snapshot writing, and direct restore. It keeps structurally valid chest rows and only positive safe-integer inventory counts up to `ITEM_QUANTITY_MAX`, dropping corrupt item rows instead of exposing them to runtime.
- `depositToChest` and `withdrawFromChest` preflight both the player inventory and chest inventory before committing either side. Player-side changes use `changeItemsAtomically` so finite-use charge cursors stay coupled to player counts; full, `1e300`, or above-cap source/destination values leave both containers unchanged.

