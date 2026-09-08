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
  EasyRPG, registered generated resources, project profiles and uploads. Search uses the effective
  project description alongside names, IDs and independent tags. The selected resource displays
  its description and source; preview playback remains available.
- **`searchResources("bgm", query)`** exposes the same catalog to AI tools (`list_resources`).
  Labels are `title — category (m:ss)`.
- **Default project**: map BGM, battle BGM, and title BGM all point at starter catalog tracks
  (`defaultSystem()`, `defaultTitleScreenSettings()`). `legacyAudioRepair.ts` also repairs
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
