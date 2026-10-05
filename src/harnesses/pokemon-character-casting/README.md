# Pokémon character casting

Reusable native NPC candidates with a human Allow/Deny screen and durable decisions.

```sh
npm run harness -- pokemon-character-casting prepare
npm run harness -- pokemon-character-casting serve --host 0.0.0.0 --port 18316
npm run harness -- pokemon-character-casting status
npm run harness -- pokemon-character-casting build --id <user-allowed-id> --out /absolute/local-result
```

Open http://mdc-server:18316/. Inspect1×/4× GIFs, twelve native poses and placement mockups. Allow requires four observation checkboxes; Deny requires a correction note. Choices survive restart in `~/.local/share/oprn/pokemon-character-casting/casting.sqlite`. No automatic approvals or game mutations. Changed packages need a new decision. Download/build and shared registration reject pending,denied,stale or superseded choices.

Three first-wave roles have two variants each. They derive original Brendan body/gait pixels with explicit native head and palette edits; source/provenance remains truthful. Original game artwork: Nintendo/Game Freak/Creatures. Native16×32,48×128 atlas,15opaque colors, exact24×32 padding-only editor adapter. Mockups are scale comparisons, not runtime-play proof. Battle portraits remain outside this approval scope.

[Workflow and shipping contract](../../../openwiki/harnesses/pokemon-character-casting.md). Focused isolated verification: `node node/verify.mjs --out /absolute/evidence` from this directory, or use the repo-relative path from the repo root. No agent may record real user votes.
