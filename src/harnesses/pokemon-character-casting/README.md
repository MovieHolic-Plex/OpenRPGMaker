# Pokémon character casting

Reusable walking-character preparation, original/template comparison, GIF review and persistent human Allow/Deny.

```sh
npm run harness -- pokemon-character-casting prepare-cast
npm run harness -- pokemon-character-casting serve --host 0.0.0.0 --port 18316
npm run harness -- pokemon-character-casting status
npm run harness -- pokemon-character-casting build --id <user-allowed-id> --out /absolute/local-result
```

Current collection: [전체 캐릭터 · 16역할](http://mdc-server:18316/?wave=full-cast-v1). It contains fifteen new role-specific template derivatives and the existing Naru v2 explorer, all sixteen walking roles /192 poses. Choose a role, compare original / edited / changed pixels, watch the native1×/4× GIF and twelve-pose sheet, then Allow or Deny. Five observations are required before Allow; Deny requires a correction note. Structural checks never approve the artwork.

Original-game characters are body/gait templates. Codex authored explicit head/clothing pixel edits and palette changes, recorded in `harness-data/pokemon-character-casting/templates/full-cast-v1/`. This is Nintendo/Game Freak/Creatures original-derived art, not independent from-scratch art. `template.py` replays pinned originals and edits; `render-template.py` exports exact native assets and comparisons. Declared and verified shared templates produce similarity warnings; undeclared clones and identical renamed artwork are blocked.

`prepare-cast` is repeatable: same inputs reuse the same immutable candidate IDs, preserve all human decisions and atomically publish the16-role collection after every candidate is valid. Store: `~/.local/share/oprn/pokemon-character-casting/casting.sqlite`, packages: `candidates/`, collections: `waves/`. The old `prepare` stage reproduces the historical six original-adoption references. It preserves separately authored collections.

Native16×32,48×128 atlas,≤15 opaque colors. No sprite shrinking. Approved builds use the exact24×32 padding-only adapter. Changed packages require new decisions. Download/build/shared registration recheck current Allow. Agents must never write synthetic production votes. Game application and battle portraits remain separate from walking approval; placement images are mockups.

Standalone source tools: `render-authored.py` for full explicit grids; `render-template.py` for original-template derivatives. `queue --bundle <folder>` imports a prepared bundle. `/?candidate=<id>` links a character; `/?wave=full-cast-v1` selects this collection.

[Workflow and shipping contract](../../../openwiki/harnesses/pokemon-character-casting.md). Current focused verification: `node src/harnesses/pokemon-character-casting/node/verify-cast-wave.mjs --out /absolute/evidence`. Read `verify-shots/pokemon-character-casting-full-cast/SUMMARY.md` first. Earlier verification scripts/evidence describe their historical six-candidate or single-character snapshots.
