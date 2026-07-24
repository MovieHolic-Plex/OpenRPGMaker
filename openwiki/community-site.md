# Community site (community-site/)

Next.js 16 companion site for sharing OpenRPGMaker assets and games. Lives in `community-site/` inside this repo but is an independent app (own package.json, own tsconfig, port 3000).

## Data

- Tables `public.openrpg_assets` / `public.openrpg_games` on the shared dbserver Supabase (`dbserver:8100` PostgREST; Postgres via supavisor `dbserver:5433`, user `postgres.your-tenant-id`).
- Migrations: `community-site/db/0001_openrpg_community.sql` (tables, read-only RLS for anon), `0002_lock_down_writes.sql` (writes revoked from anon/authenticated — only the site's server-side `pg` pool writes).
- Seed: `npx tsx community-site/db/seed-community.mts` (from repo root) — the seed game package is produced by the editor's own `createBlankProject` + `createProjectPackage`.
- The site never uses PostgREST for reads/writes; it connects server-side via `COMMUNITY_DATABASE_URL` (see `community-site/.env.local`).

## Interop contract (do not break)

- Asset download = editor `UploadedAsset` JSON `{id,name,kind,dataUrl,meta}` (`src/project/types/base.ts:324`); `?format=raw` serves the original file.
- Game download = `.oprn` package (stored zip, MIME `application/vnd.openrpg.project+zip`). Editor exports `.oprn` and imports both `.oprn` and legacy `.rpgzzu` (`src/project/package.ts` RPGZZU_* / LEGACY_RPGZZU_* constants).
- Game upload validation runs the editor's own `readProjectPackage` via `npx tsx community-site/scripts/validate-package.mts` as a subprocess (`community-site/lib/editorPackageCheck.ts`). Do not replace this with a hand-rolled mirror — the mirror drifted twice in review. The subprocess approach exists because importing `@/project/io` into Next drags the whole editor graph into Next's typecheck program.
- The validator subprocess uses an `.oprn` temporary filename, an executable-plus-argument array with `shell:false`, and stable value-free boundary errors. Do not interpolate upload paths into a shell command or expose child stderr to clients.
- Interop proof: `npx tsx community-site/scripts/validate-interop.mts` (from repo root, dev server on :3000) — opens the site's downloads with the editor's own reader.

## Feature map (v2, 2026-07-21)

- i18n: `[lang]` segment (`/en` default, `/ko`), dictionaries in `lib/i18n.ts`, root `/` redirects to `/en`. Board posts are filtered by route lang.
- Board: `openrpg_posts` + `openrpg_comments` (comments also attach to assets/games), views, likes, reports.
- Engagement: likes (1 per IP per 6h per target), download counts deduped per IP per 24h, rate limits on all POST routes (in-memory `lib/rateLimit.ts` — single-instance only), honeypot fields on all forms.
- Licenses required on upload (`lib/kinds.ts` LICENSES), shown as badges. Reports table is server-only (anon select revoked, 0005).
- Migrations: 0001 base, 0002 write lockdown, 0003 board, 0004 license/likes/status/cover, 0005 report privacy. Apply via supavisor 5433.

## In-browser play (v3, 2026-07-21)

- `/play/<slug>/` serves the editor's Vite player bundle from `community-site/public/player-static` with an injected `<base>` + fetch shim (Next strips the trailing slash; the shim rewrites the boot `project.json` fetch).
- The play route is split into a thin Next adapter (`app/play/[slug]/[[...path]]/route.ts`) and injected pure boundary (`lib/playRoute.ts`). The boundary checks game visibility/existence, package readability, and the real editor project schema before returning a shell; framework route params are treated as already decoded, while every generated path component is encoded exactly once.
- `lib/playerBootConfig.ts` owns the typed host contract (`projectUrl`, stable `saveNamespace`, localized `returnUrl`, declared `exit`/`fullscreen` features), safe inline-script serialization, and validation. Language resolution prefers `?lang`, then a valid localized games referer, then `Accept-Language`.
- Route failures are deterministic and value-free: unsafe resource paths return 400, missing/invisible games or files return 404, and corrupt packages or adapter failures return 500. Shell failures use a self-contained localized HTML error surface; resource failures use JSON. Never return DB/package/parser causes or host paths.
- `/play/<slug>/project.json` extracts project.json from the stored `.oprn`.
- Player code references absolute `/assets/*` and `/generated/*` paths → root catch-alls `app/assets/[...path]` and `app/generated/[...path]` serve files straight from the EDITOR's `public/` dir (`lib/staticFile.ts`, path-traversal guarded). Keep those two prefixes reserved.
- Release the player with root `npm run build:community`. The command is intentionally ordered as current-source `build:player` → community `sync:player` → `verify:player` → community `build`. `sync:player` refuses a stale source/runtime/deployment digest, rejects symlink/junction traversal, takes an ownership-token guard, stages the exact manifest set beside the target, rehashes it, then replaces target + lock with filesystem-state rollback. A later run removes a dead-process guard and restores an unambiguous interrupted backup before staging. `verify:player` is read-only and hashes the installed exact set plus the full lock contract. Community `prebuild` runs verification only; it never repairs an invalid install.
- `community-site/player-artifact.lock.json` binds artifact contract/schema/version/digest, current source digest, runtime-asset digest, deployment digest, revision, and installation time. An old partial lock is invalid even when `artifactVersion` happens to match.
- Game uploads are stored NORMALIZED: the editor validator subprocess (`scripts/validate-package.mts`) runs `readProjectPackage` (migrate v1/v2→v3, normalize, repair refs) and the site stores `createProjectPackage(project)` output, not the raw upload. Legacy packages therefore boot in the export shim, which accepts only schema v3.
- Export player fidelity (2026-07-21): verified identical to editor play on dew-village (16 maps) and rm2k3 fixtures. Editor-side fixes that made this work: `player.css` play-viewport/play-stage sizing (export never imported core.part-2.css — stage was unscaled), `.player-layout.system-shell` 100vh, `exportTilesetImageShim` replaced with the real `tilesetImage.ts` (uploaded tilesets map to TEX_TILESET + frame registration, dungeon quarter composition), save-slot namespace includes `/play/<slug>`.
- 2026-07-21 second repair: export bundle now uses the editor's REAL modules — `vite.player.config.ts` aliases only `@/app/mode` and `@/project/store` (the only genuine editor-coupled deps); io (migrations+normalization), resourceReferenceValidation, cutscene compiler, m2Catalog, and tilesetImage are no longer shimmed (shim files deleted; the tileGrafts shim-parity assertion was removed as obsolete). `player.css` also imports `database/tabs-b-title-screen.css` (the rich title layout rules live there, not in runtime/title.css). Verified: dew village identical to editor, battle scene live (backdrop/battlers/commands), title screen pixel-identical.

## Ops notes

- Serve with `npm run start` (production). In this environment `next dev` (turbopack AND webpack) serves pages but client hydration never attaches (verified 2026-07-21 with clean .next); production build hydrates correctly. Verify client interactivity (toggle, like) in prod before blaming app code.

## Gotchas learned

- Turbopack dev hands page `params` percent-encoded while route handlers get them decoded; detail pages call `decodeURIComponent` defensively.
- `Content-Disposition` with Korean filenames 500s; use RFC 5987 `filename*=UTF-8''...`.
- Slugify must use NFKC, not NFKD — NFKD decomposes Hangul syllables into jamo outside the `가-힣` range.
- `dbserver:5432` is a different Postgres cluster (app DBs, `postgres`/`postgres`) — NOT the Supabase one. The Supabase data is only reachable via `:8100` (REST) or `:5433` (supavisor).
- As of 2026-07-21, the editor's own tables (`public.projects` etc.) do not exist on this Supabase instance; editor saves would fail until `supabase/migrations` are applied there.
