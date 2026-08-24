# Editor Storage Chest Authoring

Storage chest tool and its distinction from treasure reward presets.

## Storage chest authoring


- Tool place_storage_chest places an action event with openChest.
- Distinct from place_chest treasure reward preset.
- The empty-event `보물상자` starter is a one-shot item reward: it authors `changeItem += 1` with an existing database item and refuses when no item exists.
- The `보관 상자` command edits `openChest`. Its form offers event-local or named shared storage, and its preview shows the two-way bag-to-storage interaction. Keep runtime keys such as `session.chests` out of author-facing copy.

