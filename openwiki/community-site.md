# Community site (community-site/)

Next.js 16 companion site for sharing OpenRPGMaker assets and games. Lives in `community-site/` inside this repo but is an independent app (own package.json, own tsconfig, port 3000).

## Data

- Tables `public.openrpg_assets` / `public.openrpg_games` / `public.openrpg_game_releases` on the shared dbserver Supabase (`dbserver:8100` PostgREST; Postgres via supavisor `dbserver:5433`, user `postgres.your-tenant-id`). Never use that shared service for automated release QA; the release integration test creates a private disposable PostgreSQL cluster.
- Migrations: `community-site/db/0001_openrpg_community.sql` (tables, read-only RLS for anon), `0002_lock_down_writes.sql` (writes revoked from anon/authenticated — only the site's server-side `pg` pool writes).
- Seed: `npx tsx community-site/db/seed-community.mts` (from repo root) — the seed game package is produced by the editor's own `createBlankProject` + `createProjectPackage`.
- The site never uses PostgREST for reads/writes; it connects server-side via `COMMUNITY_DATABASE_URL` (see `community-site/.env.local`).

## Interop contract (do not break)

- Asset download = editor `UploadedAsset` JSON `{id,name,kind,dataUrl,meta}` (`src/project/types/base.ts:324`); `?format=raw` serves the original file.
- Published game download = exact uploaded web release ZIP (`application/zip`), not an editor source package. The actual UploadForm accepts `.zip` and explains the distinction in English/Korean. New `.oprn` uploads are rejected; existing source records remain downloadable unchanged (`application/vnd.openrpg.project+zip`).
- Release validation uses the shared `src/project/gameRelease.ts` contract and **operator-controlled** runtime manifests. It never calls the current editor's `deserialize`, `readProjectPackage`, normalization or migration code. Never promote an uploaded runtime manifest/hash to operator trust.
- `scripts/validate-package.mts`, `lib/editorPackageCheck.ts` and `scripts/validate-interop.mts` describe the historical source-package path, not release ZIP publication. Keep subprocess invocation shell-free and errors value-free if those legacy tools are used for offline interop work.

## Immutable publication and playback (2026-09-06)

- Apply `db/0006_immutable_game_releases.sql` once after 0001-0005, using an operator-owned server database role. It adds exact `bytea` ZIP storage, JSONB manifests, SHA-256 checks, deferred bidirectional listing/release foreign keys, and UPDATE/DELETE/TRUNCATE protection. Games have either legacy `package_base64` or a `release_id`, never both. Payload identity/slug/association cannot change; title, tags, counters and moderation can.
- `lib/releaseUpload.ts` owns the bounded JSON/base64 ingress; `lib/releaseArchive.ts` strictly preflights the complete editor stored-ZIP format, then invokes `verifyGameRelease`. Duplicate/case-colliding paths, traversal, local/central disagreement, CRC mismatch, symlink attributes, compression, extra files and untrusted executable bytes are rejected before persistence.
- Trust root: `COMMUNITY_RUNTIME_ARCHIVE_ROOT`, default `../.runtime-archive` relative to the community process working directory. Each `<runtimeTarget>/runtime.json` must come from the operator's retained runtime build (`scripts/lib/runtimeArchive.ts`), never from an upload. The bounded reader uses the same `parseRuntimeManifest` contract and digest verification. Runtime manifests are limited to 8 MiB; run on Node.js 24 LTS.
- Every anonymous upload creates a new listing in one PostgreSQL transaction (`lib/releaseStore.ts`). An upload's `publication.gameId`, title, slug-like fields or author text confer no ownership and cannot update another listing. Publishing a new version means a new listing; identical releases may also be listed independently.
- `/play/<slug>/` redirects pinned listings to `/play/<slug>/releases/<releaseId>/player.html`. The qualified directory also redirects to that explicit entry, avoiding Next's slash stripping without changing the HTML. Every file request checks the visible listing's exact release association, including on cache hits. Missing files/wrong associations return 404; no `public/player-static`, `/assets`, `/generated` or current editor fallback is consulted.
- The route serves the retained HTML, project, runtime and assets byte-for-byte. `nosniff`, MIME types and a release-directory-scoped CSP prevent uploaded passive files from becoming same-origin executable code and block mutable root asset URLs. The producer must emit relative release URLs. CSP uses the validated public Host authority, not Next's internal localhost URL; reverse proxies must preserve public Host/protocol. SVG responses are sandboxed.
- `/api/games/<slug>/releases/<releaseId>/download` returns the exact ZIP. The old download URL redirects pinned records to this qualified URL; legacy source downloads remain source-only. Qualified bytes are publicly immutable-cacheable for one year. Moderation is checked at origin, but cannot revoke bytes already cached/downloaded; purge an external CDN when hiding content.
- Legacy `/play/<slug>/` returns a localized 503 explaining that no retained compatibility runtime is available. GET never converts or normalizes a legacy row. `lib/playRoute.ts` remains a historical tested helper, but the shipping Next adapter uses `lib/releaseRoutes.ts` exclusively.
- Limits: 96 MiB ZIP; 64 MiB individual file; 4096 entries; 1 MiB release manifest; JSON body capped at base64 ZIP size plus 4 MiB; 30-second body deadline; two concurrent uploads and two cold release loads. The LRU retains at most two ZIPs / 192 MiB, with entry views sharing the ZIP buffer. The existing IP rate limiter is single-instance abuse throttling, not ownership authorization.

### Release QA and migration commands

The supervisor supplies `COMMUNITY_DATABASE_URL` privately. Do not write it into source or evidence. After explicit coordination with that database owner:

```bash
psql "$COMMUNITY_DATABASE_URL" -v ON_ERROR_STOP=1 -f community-site/db/0006_immutable_game_releases.sql
```

Focused validation from the repository root:

```bash
npm test -- --run test/communityReleaseArchive.test.ts test/communityPlayRoute.test.ts
cd community-site
./node_modules/.bin/tsc --noEmit --incremental false
# Compile the community app for the production-HTTP test; supply a private DB URL.
./node_modules/.bin/next build --webpack
cd ..
npx tsx --test test/communityReleaseIntegration.test.mjs
```

The integration command requires PostgreSQL 16 binaries (`COMMUNITY_TEST_PG_BIN` may override `/usr/lib/postgresql/16/bin`) and installed Chrome. It starts its own socket-only cluster, applies 0001-0006, awaits PostgreSQL/Next readiness events (no sleeps), and exercises actual production UploadForm/Next routes with narrow fixtures. Screenshots at 375/768/1280px are written to the OS temporary directory as `community-release-upload-<width>.png`. No shared DB, authored game content or persistent QA URL is used.

The normal integrated release gate remains root `npm run build:community`; a direct Next build is app compilation, not proof of that gate. A snapshot worktree without producer outputs fails `prebuild` with `built-manifest-invalid`; Turbopack also rejects a root `node_modules` symlink pointing outside its inferred filesystem root. The webpack command above supports that isolated-worktree QA without weakening either gate.

Manual producer integration: retain the producer runtime under the operator trust root, export a web ZIP, publish through `/en/upload` or `/ko/upload`, open the listing and its qualified play URL, and compare the downloaded ZIP digest with the upload. Deploy a different current editor/runtime and repeat the old URL/download. Its project/runtime/assets must be unchanged. Also test another listing with the wrong release id and an existing legacy source record.

## Feature map (v2, 2026-07-21)

- i18n: `[lang]` segment (`/en` default, `/ko`), dictionaries in `lib/i18n.ts`, root `/` redirects to `/en`. Board posts are filtered by route lang.
- Board: `openrpg_posts` + `openrpg_comments` (comments also attach to assets/games), views, likes, reports.
- Engagement: likes (1 per IP per 6h per target), download counts deduped per IP per 24h, rate limits on all POST routes (in-memory `lib/rateLimit.ts` — single-instance only), honeypot fields on all forms.
- Licenses required on upload (`lib/kinds.ts` LICENSES), shown as badges. Reports table is server-only (anon select revoked, 0005).
- Migrations: 0001 base, 0002 write lockdown, 0003 board, 0004 license/likes/status/cover, 0005 report privacy. Apply via supavisor 5433.

## Historical in-browser play (v3, 2026-07-21; superseded)

The following records the old implementation and its fidelity repairs. It is not the current publication/playback contract; do not restore mutable fallback or normalization to release routes.

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
