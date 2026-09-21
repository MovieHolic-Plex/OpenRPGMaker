# Editor AI phase 2 evidence

- Date: 2026-08-24
- LegacyDb project: `oprn-97906517a7`
- Active in-editor provider: `OpenAI Codex` (OAuth)
- External controller: AGY 1.1.19 with enabled `rpgzzu-assistant` MCP; live `assistant_ping=true` and `assistant_status.ready=true`

## Browser evidence

- `authoring-entry-and-provider.png`: the now-retired statusbar `AI로 만들기` entry, current provider, and six authoring examples (historical capture; current entry is the glass assistant's persistent input/disclosure).
- `shop-example-prefill.png`: the shop example fills and focuses the composer without auto-sending.
- `live-composite-before.png`: remote project loaded before the live AI turn.
- `live-composite-applied-and-saved.png`: `get_event → set_shop_stock → get_event`, accepted proposal, and completed save.
- `live-composite-receipt.json`: provider label, tool sequence, page coverage, and save receipt.

## Remote/runtime result

`npx tsx scripts/verify-ai-editor-project.mts oprn-97906517a7 --save` reloaded the remote project, used the official save path, and reloaded it again with canonical equality. The project has 22 road autotiles, four NPC events, a shop command on both merchant pages, a 50G self-switch chest, and an enabled time system. Runtime boot, chest interaction, and shop-stock assertions passed. Final SHA-256: `65f82944de866c9cfb7b239b2b44ef1110d89e75e0cd6fc7df027a112e694f69`.

## Local validation

- 185 focused Vitest assertions passed.
- 2 stdio framing node tests passed.
- 6 Chromium E2E cases passed.
- `npm run typecheck:app`, `npm run openwiki:verify`, and `npm run build` passed.
- Full gates: typecheck 0 errors; 6,526/6,693 tests passed, with 163 pre-existing baseline failures and no baseline file for automated comparison (previous observed baseline was 168 failures).
