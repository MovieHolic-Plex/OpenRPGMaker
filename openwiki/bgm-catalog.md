# CC0 BGM Catalog (281 tracks)

The editor's **default BGM set**. Read this before touching audio defaults, the music resource
picker, or anything that resolves a `cc0-bgm-*` resource id.

## Why this exists

Before 2026-08-21 the project had exactly five browser-playable BGM tracks
(`public/assets/cc0/audio/bgm/*`, OpenGameArt CC0). Everything else registered as "music" was
EasyRPG RTP `.mid`, which `HTMLAudioElement` cannot play — so those 30 entries were silent
placeholders. Five tracks across dozens of scene types forces the author to reuse the same cue
everywhere.

This catalog is 281 instrumental CC0 tracks (11h 32m) organised by *scene category*, so a
map/battle/menu can each get a fitting cue without the author sourcing music themselves.

## Facts an agent needs

- **License: CC0-1.0.** All tracks are vocal-free original compositions. Attribution is not
  required; it is recorded in `public/assets/ATTRIBUTION.md` so provenance stays re-verifiable.
- **The complete audio is distributed as a GitHub Release pack**, not in ordinary Git.
  The 281 files total 1,303,934,164 bytes (1.304 GB / 1.214 GiB). The private `bgm-v1`
  release and committed `assets/bgm-release-v1.json` pin the exact bytes. DigitalOcean
  remains the producer's source and an optional explicit streaming override.
- **Exception — three starter tracks are committed** (`public/assets/cc0/audio/catalog/`, ~10MB).
  The default map/battle BGM point at starter tracks. The title track is available to choose,
  but the default title is silent (`test/bgmCatalog.test.ts`, `test/titleScreenMusic.test.ts`).
  `.gitignore` ignores the catalog directory except those three files.
- 273 MP3 (962,377,084 bytes) + 8 WAV (341,557,080 bytes). Original audio bytes and codecs
  are preserved in the release; there is no transcoding.
- 266 tracks are seamless loop masters; 15 have fade-in/out and will show a seam when looped.
  `isSeamlessLoopTrack(resourceId)` answers this.

## Files and ownership

| File | Role |
| --- | --- |
| `src/assets/bgmCatalogRuntime.ts` | **Generated.** id → file name + loop flag. Runtime-only, so editor metadata does not leak into the player bundle. |
| `src/assets/bgmCatalog.ts` | **Generated.** Editor metadata: title, category, BPM, musical key, sha256, creative brief, search tags. |
| `src/assets/bgmCdn.ts` | Builds the playback URL. `VITE_BGM_CDN_BASE` + `rpg-zzu/bgm/v1/` prefix, else same-origin local fallback. |
| `src/assets/bgmCatalogResolver.ts` | id → URL glue used by the shared resource resolver. |
| `src/assets/bgmStarterTracks.ts` | Hand-written. The three ids whose files are committed. |
| `scripts/fetch-bgm-catalog.mjs` | Downloads the catalog + audio into a staging directory, verifies sha256. |
| `scripts/build-bgm-catalog.mjs` | Staging `catalog.raw.json` → the two generated TS files. |
| `scripts/upload-bgm-to-spaces.mjs` | Uploads staging audio to DigitalOcean Spaces (SigV4, no SDK). |
| `scripts/build-bgm-release.mts` | Maintainer command: verified CDN cache → deterministic tar, manifest and checksums. |
| `scripts/install-bgm.mjs` | Node 24 CLI: private-release/manual install and offline verification. |
| `scripts/lib/bgm-release.mjs` | Strict manifest, streaming hashes, safe archive installation and cancellation. |
| `assets/bgm-release-v1.json` | Committed installer trust manifest: archive identity and all 281 actual file hashes. |
| `test/bgmReleasePack.test.mjs` | Real tar/filesystem/HTTP tests: roundtrip, corruption, links, locks, cancellation and final verification. |
| `test/bgmCatalog.test.ts` | Guards track count, id uniqueness, URL rules, project-load safety, starter files. |

Do **not** hand-edit the two generated files. Re-run the scripts.

## Release pack installation (2026-09-07)

After `npm ci`, run `npm run bgm:install`, then `npm run bgm:verify`. The repository
`MovieHolic-Plex/rpg-zzu` is private: automatic installation invokes `gh release download`
using the user's existing `gh auth login` and repository permission. No token is passed in
arguments or exposed to the browser. Without gh, download `rpg-zzu-bgm-v1.tar` from
<https://github.com/MovieHolic-Plex/rpg-zzu/releases/tag/bgm-v1> and run:

```sh
npm run bgm:install -- --archive "/path/rpg-zzu-bgm-v1.tar"
```

The manual path needs no network after dependencies/archive are available. Optional
`--root "/path/checkout"` selects the destination; trust always comes from the installer's
own committed manifest, not the destination or an arbitrary CLI manifest. No install hook,
launcher download, credential setup change or runtime resolver change is involved.
Allow at least 5 GB free space. Node 24 is required; no system tar or Bun is needed by users.

All archive/file hashes are checked; only allowlisted regular files are accepted. Staging and
an exclusive lock sit next to `catalog/`; destination symlinks are refused. Existing matching
files and unrelated files are preserved. All staged files are checked before promotion, and
the complete destination is checked before success. Promotion is atomic **per file**, not a
whole-directory transaction: rerun after a late I/O failure to finish/repair the installation.
Ctrl-C/termination clean owned staging and locks. After forced termination, remove a stale
`.bgm-install.lock` only after confirming no installation is active.

An already verified complete installation returns without gh/network. To use the installed
audio, leave `VITE_BGM_CDN_BASE` unset: an explicit CDN still wins. Restart dev after env
changes. Install before `npm run build` or web export so portable/static output contains the
pack. Vite dev/preview can also discover and serve a later install without rebuilding (below).
Offline audio does not imply offline Supabase/AI.

## In-editor installation and live inventory (2026-09-09)

The shared music resource picker (`databaseResourcePickerDialog.ts`) mounts
`bgmInstallBanner.ts`. Sound/graphics pickers do not install this music-only pack. The banner
fetches `/api/bgm/status`; static hosts returning HTML/404 omit it. `bgmInstallPlugin`, wired
in `vite.config.ts`, mounts the same endpoint in dev and preview:

- `POST /api/bgm/install` reserves one job synchronously, before loading the trusted manifest,
  and returns 202. Concurrent POSTs return 409, including during that first manifest read.
  Every accepted job goes through the existing `installRelease` digest checks; a file count
  is never a reason to report a verified complete install or bypass repair. A verified rerun
  remains offline through the installer itself. Errors appear in status; DELETE aborts the
  reserved/running job without reporting cancellation as an install failure.
- Loopback addresses are allowed by default. Remote use requires server-only
  `OPRN_BGM_INSTALL_REMOTE=1` and a restart. The plugin uses Vite `loadEnv` with resolved
  mode/envDir, including preview; `.env.local` values are not automatically in `process.env`.
  Forwarded request headers cannot opt a client in. This is a host-wide permission, not user
  authentication; enable it only on a trusted editor network. Credentials stay in server gh.
- Status is lightweight nonempty-file inventory plus job/progress/error facts, not an offline
  digest audit (`npm run bgm:verify` owns that). The build-time installed filenames only seed
  `installedBgm.ts`. Both installation polling and the initial fetch on every picker opening
  apply live inventory. The initial fetch rebuilds the picker rows before removing a completed
  banner, so installation while the dialog was closed does not strand the old catalog.
- Preview's `audioDeliveryPlugin` serves catalog files missing from dist directly from public.
  The fallback is catalog-only, preserves GET/HEAD and byte/suffix ranges (206), emits 416 with
  `Content-Range: bytes */<size>` for unsatisfiable ranges, and keeps missing media out of SPA
  fallback. Other assets and normal dist delivery still use Vite's existing static handling.
  Pure static deployments/exports still need installation before build/export.

Focused regressions: `bgmInstallEndpoint`, `bgmInstallBanner`, `bgmInstallClient`,
`bgmCatalogDir`, `installedBgmRuntime`, `audioDeliveryHttp`, and `bgmReleasePack`. Endpoint
completion tests await the injected install promise's settlement; cold-manifest contention
uses explicit request/manifest gates, and picker refresh awaits a DOM mutation signal.
No fixed settling sleeps are needed. This workflow does not change project defaults,
resource IDs, saved references, Image2 routing, new-project allocation, or review contracts.

## Producing and publishing the pinned pack

```sh
npm run bgm:pack
```

The producer downloads at most four tracks concurrently to `artifacts/bgm-release/cache/`,
verifies catalog sizes and the 221 known upstream digests, and computes actual digests for
the 60 tracks without upstream hashes. These 60 are pinned observed bytes, not independently
upstream-verified content. It emits:

- `artifacts/bgm-release/rpg-zzu-bgm-v1.tar` (uncompressed, sorted entries, fixed metadata)
- `artifacts/bgm-release/bgm-release-v1.json` (identical to `assets/bgm-release-v1.json`)
- `artifacts/bgm-release/SHA256SUMS`

The committed manifest makes a different v1 rebuild fail. Keep original codecs/filenames and
do not overwrite a published v1. A changed catalog requires a new version and corresponding
installer manifest contract. The tar dependency is for cross-platform Node extraction, not
the browser bundle. `vite-node` runs the maintainer's TypeScript catalog imports.

After tests, real installation/playback and production build pass, commit source/manifest/docs,
push the verified commit, then create a **non-latest draft** release targeting that commit.
Upload all three assets, verify GitHub's uploaded asset digest/size, and publish the draft.
Download the published pack through the real private-access path and verify all 281 installed
files. Do not put the tar or downloaded audio in ordinary Git. CC0 provenance remains in
`public/assets/ATTRIBUTION.md` and the manifest.

## Regenerating

```sh
node scripts/fetch-bgm-catalog.mjs  --password <approval password> --out <staging>
node scripts/build-bgm-catalog.mjs  --staging <staging>
node scripts/upload-bgm-to-spaces.mjs --staging <staging>      # needs DO_SPACES_* credentials
```

`fetch` is re-runnable: existing files with a matching sha256 are skipped.

### sha256 caveat

221 tracks carry a real hash and were verified byte-for-byte. The other 60
(`expansion-eighty-five` / `completion-one-fifteen` releases) have the literal string
`"release-manifest"` in the upstream `sha256` field instead of a hash. `expectedSha256()` in the
fetch script treats any non-64-hex value as "no hash available" and records the locally computed
hash instead — otherwise 60 perfectly good files report as corrupt and the script exits 1.

## CDN wiring

```
VITE_BGM_CDN_BASE=https://cheapcdn.sgp1.cdn.digitaloceanspaces.com
```

- Live configuration: Space `cheapcdn`, region `sgp1`. Credentials live in the team Notion page
  「각종 환경 변수들 (DO, IP 등)」 and are mirrored into the gitignored `.env.local`. The script
  accepts either `DO_SPACES_KEY`/`DO_SPACES_SECRET` or the org's
  `DO_SPACES_ACCESS_KEY`/`DO_SPACES_SECRET_KEY` names.
- Object keys are `rpg-zzu/bgm/v1/<original file name>`. **The Space is shared** — the tiot image
  CDN uses `tiot/images/`, so the `rpg-zzu/` prefix is what keeps this project from writing over
  someone else's keys. `BGM_CDN_PREFIX` in `bgmCdn.ts` and `KEY_PREFIX` in the upload script must
  stay in sync — a mismatch 404s all 281 tracks.
- Unset (or a non-`http(s)` value) uses `/assets/cc0/audio/catalog/<file>`, including the
  installed release pack. `audioDeliveryPlugin` returns real missing-media 404s in Vite
  dev and preview before SPA fallback. Other deployment hosts must keep the same rule.
- Vite snapshots installed, nonempty pack filenames at startup/build into the existing
  shared editor catalog. Without a CDN, only installed pack entries are advertised in
  pickers/search; the three starters remain available on a normal checkout. Install the
  existing Release pack and reopen the music picker to refresh the live catalog in dev/preview;
  static deployments need a rebuild. No runtime IDs, saved references, generated catalogs,
  or project descriptions are deleted. Headless metadata
  tools without a deployment snapshot still enumerate the complete catalog. Legacy MIDI
  remains explicitly non-playable inspection metadata, not advertised playable audio.
- Upload sets `x-amz-acl: public-read` and `Cache-Control: immutable` (file names carry a content
  hash, so they are never rewritten in place).
- Credentials (`DO_SPACES_KEY/SECRET/BUCKET/REGION`) are non-`VITE` — they are never inlined into
  the client bundle. Keep them in `.env.local`.

## How authors reach the tracks

- **Map properties → BGM tab → 지정 곡.** This used to be a bare resource-id text field; with 281
  tracks that is unusable, so it now opens the shared resource picker through
  `map-bgm-resource-set`; `map-bgm-resource` displays the current resource name.
- **Resource picker (`kind: "music"`)** lists the catalog first, then the older CC0 five, then
  EasyRPG, registered generated resources, project profiles and uploads. Search uses the effective
  project description alongside names, IDs and independent tags. The selected resource displays
  its description and source; preview playback remains available.
- **Unsupported MIDI authoring (issue 693 R2):** shared music/sound picker rows and confirmation,
  the shared hidden ID input, and native/M2 event audio dropdowns reject MIDI using the existing
  `audioPlayback` resolver. Legacy rows/selected descriptions remain visible; opening, searching,
  or cancelling does not replace the saved ID. The command dialog can retain an unchanged legacy
  command, but cannot newly select MIDI. Supported audio and explicit clearing remain available.
  Catalog enumeration, resource IDs, load repair and persistence are unchanged. Regression:
  `test/unsupportedMidiAuthoring.test.ts`; native proof: `scripts/qa/issue693-midi-authoring.mjs`.
  From the assigned worktree, use separate terminals (no remote content writes):

  ```sh
  mkdir -p /dev/shm/rpg-zzu-issue693-audio-r2/{tmp,vite}
  TMPDIR=/dev/shm/rpg-zzu-issue693-audio-r2/tmp DEV_SERVER_PORT=38422 DEV_SERVER_NO_TLS=1 VITE_BGM_CDN_BASE='' VITE_CACHE_DIR=/dev/shm/rpg-zzu-issue693-audio-r2/vite node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 38422 --strictPort
  # Second terminal: native Firefox; JSON and screenshots stay in owned /dev/shm.
  TMPDIR=/dev/shm/rpg-zzu-issue693-audio-r2/tmp VITE_CACHE_DIR=/dev/shm/rpg-zzu-issue693-audio-r2/vite node scripts/qa/issue693-midi-authoring.mjs
  ```

- **`searchResources("bgm", query)`** exposes the same catalog to AI tools (`list_resources`).
  Labels are `title — category (m:ss)`.
- **Default project**: map and battle BGM point at starter catalog tracks; the default title is
  silent (`defaultSystem()`, `defaultTitleScreenSettings()`). `legacyAudioRepair.ts` also repairs
  unplayable `.mid` references to the starter tracks — it must only ever target starter ids,
  because a CDN-only replacement would leave CDN-less environments silent again.

## Project audio descriptions

`src/assets/audioResourceCatalog.ts` owns the shared editor metadata view through
`listAudioResources(kind, project)`. Each entry has a raw `id`, `kind`, `name`, `tags`,
`description` and `descriptionSource`. Built-ins come first, followed by registered generated
resources, profiles and uploads. Entries are deduplicated by kind/raw ID; an upload's explicit
kind and name take precedence over its matching profile.

- Shared defaults first use the editor-only AI draft overlay described below. Without an
  accepted draft, BGM reuses `BGM_CATALOG[].brief` unchanged with source `catalog-brief`:
  creative briefs, not listening reports. Don't edit generated `src/assets/bgmCatalog.ts`.
- `Project.audioDescriptions.music[rawId]` overrides the effective default. No key means inherit; `""`
  means intentionally empty, with source `project`; reset removes the key. Even a value equal
  to the current default remains an explicit override. Reset returns the AI draft if present,
  otherwise the original metadata; clearing never exposes a hidden draft in search.
- Other source values are `metadata-derived` and `missing`. Generated/uploaded entries without
  trusted description data start empty; their filenames aren't invented listening evidence.
- Search uses the effective description, not a hidden copy of an overridden or cleared brief.
  Independent catalog tags remain searchable. Reading the catalog doesn't backfill projects,
  register orphan IDs or make legacy MIDI playable.

The Resource Manager, shared music picker, audio test dialog, normal/M2 event audio forms,
command previews, AI resource search and event prompt projection share this metadata contract.
See `openwiki/editor-workflows-misc.md` for surface ownership and
`openwiki/editor-ai-tools.md` for tool pagination and prompt limits.
`test/audioResourceCatalog.test.ts` and `test/audioResourceSearchContract.test.ts` cover the
shared catalog and effective-description search.

This feature doesn't change asset bytes, codecs, URLs, licenses, resource IDs or automatic
scene BGM selection. Keep metadata out of the player dependency graph; runtime playback
continues to use `src/assets/bgmCatalogRuntime.ts`.

### Shared AI analysis drafts (2026-09-08)

`src/assets/audioAiDescriptions.ts` statically imports `audioAiDescriptions.json` inside
the editor metadata graph. `listAudioResources` stays synchronous: project own value (including
empty) > accepted AI draft > original metadata. The overlay changes only description/source,
not IDs, kind partitions, labels, tags, ordering, playback or project storage. Do not import
this provider or JSON from runtime/player or persistence modules, or introduce a public fetch
and loading race. Character count is not a UTF-8 byte-size measurement.

The source token is `ai-listening`; every shared UI source label says **AI 분석 초안**.
These are unverified model outputs, not verified acoustic facts. Instrument, vocal, timing,
frequency and other numeric claims are AI assertions, not independent measurements.
JSON entries retain model, review state and evidence reference; most are
`gemini-3.8-flash-high`, not Pro. Acceptance requires `status === "ok"`,
`result.audio_available === true` and a nonblank description of at most 4,000 UTF-16 units.
Missing audio flags are never success. Invalid/no-audio/failed/missing drafts leave metadata
alone. The provider looks up only already-enumerated IDs; it cannot register orphan IDs.

- Three vocal-claim BGM drafts remain withheld: `cc0-bgm-rtp-lft-001`,
  `cc0-bgm-rtp-rad-001`, `cc0-bgm-rtp-prx-006`. They retain creative briefs.
- Vanguard (`cc0-bgm-rtp-btl-001`) replaces the rejected Flash analysis with the supplied
  Gemini 3.1 Pro draft after human correction removing its voice claim. The user preferred
  this sound description; that does not independently verify every instrument. The original
  independent command used `gemini-3.1-pro-high` (confirmed by lead); no timestamp is invented.
- Slime8, carpet003 and ice9 replace original no-audio records with explicitly approved
  `gemini-3.1-pro-high` recovery drafts, still unverified.
- Interface1 restores the original successful Flash smoke description verbatim from
  `output/evidence/agy-interface-smoke-transcript.json`, because the prior phase deleted its
  temporary JSONL. Two later Pro attempts (repository and isolated cwd) reported no audio;
  neither is treated as a successful analysis. The restored record has no invented timestamp.
- Thirty MIDI failures retain metadata; no MIDI playback capability was added.

The shipped set contains 1,016 drafts: 278 catalog BGM, 635 catalog SE, 103 other audio.
The remaining 33 built-ins use fallback metadata (30 MIDI and the three withheld BGM).
The JSON records exclusions separately from accepted replacements. Input hashes, status
counts and failed recovery receipts are in `output/evidence/audio-ai-final/ingestion-report.json`.
Tests compare effective values with shipped data, never pin descriptive prose. The old
baseline-provider suites mock only the new provider to empty; the unmocked
`test/audioAiDescriptions.test.ts` proves actual integration, search, source DOM,
override/clear/reset, kind isolation, strict acceptance and absence from project serialization.

## Traps

- **Adding a track id without registering it breaks project loading, not just audio.**
  `collectResourceIds()` in `src/project/io/resourceReferenceValidation.ts` must include every
  catalog id; `validateOptionalResource` asserts on unknown ids, so a project referencing an
  unregistered track fails to deserialize entirely.
- **Do not put catalog metadata in the runtime module.** The 228KB metadata file reaches the player
  bundle through the resource resolver if the two are merged. The split exists for that reason.
- **Do not point defaults at non-starter tracks** without also committing the audio and updating
  `bgmStarterTracks.ts` — `test/bgmCatalog.test.ts` checks that every default id is a starter id
  whose file exists under `public/`.
- Tests must resolve local paths via `bgmTrackUrl(fileName, {})` (explicit empty env). Reading the
  ambient env makes the suite fail on any machine with `VITE_BGM_CDN_BASE` set.

OUT-002 playback/delivery regression (2026-09-08): Test Play unlocks the shared engine
synchronously in its shell-opening gesture, before persistence/paint awaits. Capture-phase
unlock listeners also work when runtime input stops bubbling. `NotAllowedError` retains
only live tracks for the next gesture; native media errors and other play rejections warn
with recovery guidance and release the failed track, permitting same-ID retries. Stopping
or replacing a track cannot resurrect it via an outstanding rejection. Supported saved
WAV MIME aliases (`x-wav`, `wave`, `vnd.wave`) and `audio/mp3` normalize at resolution,
without changing project data or payload bytes. The PWA v2 cache bypasses Range requests
entirely: the network owns 206/416 even after a full response is cached; partial responses
are never cached. Offline range playback is not promised.

Focused tests: `audioConnectivity`, `audioInventoryDelivery`, `audioDeliveryHttp`,
`testPlayRunControls`. Reproducible real-browser proof: with this worktree's strict-port
Vite running, `node scripts/qa/issue693-audio.mjs` (default origin `127.0.0.1:38422`,
`AUDIO_QA_URL`/`AUDIO_QA_OUT` overrides). Chromium tests cold/warm/suffix/416 SW ranges
and 404s; Firefox opens the actual local-only sample adventure, checks its first Test Play
click via native engine-owned `playing`, compares picker inventory, fetches and decodes
all advertised playable BGM, exercises native missing-media failure and a WAV MIME alias,
and captures 1440x900/1024x768. No media play/fetch mocking or remote content mutation.
