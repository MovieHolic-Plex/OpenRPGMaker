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
- **The audio is not in this repo.** 1.21GB cannot live in git. The source of truth is a CDN
  (DigitalOcean Spaces); the repo holds only the catalog (file name, duration, BPM, key, sha256,
  tags).
- **Exception — three starter tracks are committed** (`public/assets/cc0/audio/catalog/`, ~10MB).
  The default project's map/battle/title BGM point at these, so a fresh clone with no CDN
  configured still makes sound. `.gitignore` ignores that directory except those three files.
- **The default title screen now has music** (`cc0-bgm-rtp-ttl-001`). This replaced an older
  "silent title" default. Because `normalizeTitleScreenSettings` uses `defaultTitleScreenSettings()`
  as its backfill source, an absent `musicResourceId` is filled with that default — so silence is
  expressed by an **empty string**, not by omitting the key. `hasExplicitSilence()` in
  `src/project/databaseRecordModel.ts` draws that line; without it, adding a default would have
  made a silent title impossible to author at all.
- 273 mp3 (918MB) + 8 wav loop masters (326MB). The wav masters are ~40MB each — there is no
  ffmpeg in this environment, so they were uploaded as-is rather than transcoded. Prefer an mp3
  track for anything that must stream quickly.
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
| `test/bgmCatalog.test.ts` | Guards track count, id uniqueness, URL rules, project-load safety, starter files. |

Do **not** hand-edit the two generated files. Re-run the scripts.

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
- Unset (or a non-`http(s)` value) falls back to `/assets/cc0/audio/catalog/<file>`. That is
  deliberate: emitting an absolute URL against a wrong origin would fire 281 cross-origin requests
  that are hard to diagnose. Same-origin 404s are obvious.
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
  EasyRPG. Options carry `searchTerms` (category, emotions, instruments, English title, track code,
  creative brief) which the picker's search box matches but does not display — that is what lets
  "던전", "비 오는 실내", or `RTP-BTL-002` all find a track. Preview playback works in the dialog.
- **`searchResources("bgm", query)`** exposes the same catalog to AI tools (`list_resources`).
  Labels are `title — category (m:ss)`.
- **Default project**: map BGM, battle BGM, and title BGM all point at starter catalog tracks
  (`defaultSystem()`, `defaultTitleScreenSettings()`). `legacyAudioRepair.ts` also repairs
  unplayable `.mid` references to the starter tracks — it must only ever target starter ids,
  because a CDN-only replacement would leave CDN-less environments silent again.

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
