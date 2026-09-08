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
changes. Install before `npm run build` or web export; rebuild an existing production bundle
after installing audio. Offline audio does not imply offline Supabase/AI.

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
  existing Release pack and restart dev/rebuild to expose more. No runtime IDs, saved
  references, generated catalogs, or project descriptions are deleted. Headless metadata
  tools without a deployment snapshot still enumerate the complete catalog. Legacy MIDI
  remains explicitly non-playable inspection metadata, not advertised playable audio.
- Upload sets `x-amz-acl: public-read` and `Cache-Control: immutable` (file names carry a content
  hash, so they are never rewritten in place).
- Credentials (`DO_SPACES_KEY/SECRET/BUCKET/REGION`) are non-`VITE` — they are never inlined into
  the client bundle. Keep them in `.env.local`.

## How authors reach the tracks

- **Map properties → BGM tab → 지정 곡.** This used to be a bare resource-id text field; with 281
  tracks that is unusable, so it now opens the shared resource picker. `resourcePickerControl`
  keeps a hidden text input on the original `map-bgm-resource` testid, so existing e2e paths still
  work.
- **Resource picker (`kind: "music"`)** lists the catalog first, then the older CC0 five, then
  EasyRPG, registered generated resources, project profiles and uploads. Search uses the effective
  project description alongside names, IDs and independent tags. The selected resource displays
  its description and source; preview playback remains available.
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

- BGM defaults reuse `BGM_CATALOG[].brief` unchanged, with source `catalog-brief`. These are
  creative briefs, not listening reports. Don't edit generated `src/assets/bgmCatalog.ts`
  to store project prose.
- `Project.audioDescriptions.music[rawId]` overrides the brief. No key means inherit; `""`
  means intentionally empty, with source `project`; reset removes the key. Even a value equal
  to the current brief remains an explicit override.
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
