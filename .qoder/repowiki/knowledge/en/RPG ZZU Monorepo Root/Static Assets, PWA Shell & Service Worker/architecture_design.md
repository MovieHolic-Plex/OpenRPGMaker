Pure static-file directory served at `/` with no runtime code except two top-level files:
- `manifest.webmanifest` declares the PWA (standalone display, landscape-primary orientation, Korean language) and points to `/icons/pwa-{192,512}.png`.
- `sw.js` is a vanilla Cache API service worker implementing install/activate/fetch: it pre-caches an explicit `APP_SHELL_URLS` list on install, prunes old caches on activate, routes navigations via network-first (falling back to cached `/index.html`) and all other GETs under `/assets/` or matching font/image/manifest/script/style/worker destinations via cache-first.

Asset sub-packages are grouped by provenance and consumed by the editor/game rather than each other:
- `assets/easyrpg/` — official EasyRPG RTP tiles, charset, chipset, faceset, music/sound, system UI, title/backdrop images plus `rtp-manifest.json` for discovery.
- `assets/cc0/jetrel/` — item icon sheet (`items-sheet.png`, `items.png`) with generated `icon-ids.json` / `generated-icon-manifest.json` mapping IDs to tile positions; `cc0/mabaci-medieval-items/` adds crates/chests/coins.
- `assets/scarloxy/` — monster sprites, icons, battle animations, charset/chipset, and UI stat buttons.
- `assets/farming/` — crop and animal sprites.
- `assets/ui/`, `ui/rm2k3-toolbar/`, `market-harness-tiles/` — editor chrome and harness tiles.
- `assets/fonts/` — Galmuri11 woff2 fonts used by the game UI.
- `public/generated/` — build-time output placeholder.

Dependency direction is one-way: `sw.js` depends only on the static layout of `/assets/` and `/icons/`; nothing in `assets/` references `sw.js`. The module exposes no JS API — consumers load assets by path from these directories.