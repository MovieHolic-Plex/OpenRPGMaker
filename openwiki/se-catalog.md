# CC0 SE Catalog (456 sounds)

The editor's **default sound-effect set**. Read this before touching SE defaults, the sound resource
picker, or anything that resolves a `cc0-se-*` resource id.

## Why this exists

Before 2026-08-21 the only sound effects were the 96 EasyRPG RTP wavs
(`public/assets/easyrpg/sound/*.wav`). Unlike the BGM situation, those **do play** — they are real
wav files, not `.mid`. Three other things were wrong:

- **License.** EasyRPG RTP is CC-BY 4.0 (`public/assets/easyrpg/COPYING`), so shipping a game built
  in this editor carried an attribution obligation the author never asked for.
- **Coverage.** 96 sounds is the RM2K battle standard set — plenty of `Attack1`/`Barrier`/`Buzzer`,
  nothing for UI confirm/cancel, doors, chests, footsteps, or general foley.
- **Findability.** Labels were bare English file names (`EasyRPG RTP Absorb1 Sound`). The BGM
  catalog had already established that an author needs to search in Korean by scene; SE had none of
  that.

This catalog is 456 CC0 sounds across 12 slot categories with Korean titles and search tags.

## Facts an agent needs

- **License: CC0-1.0** for all 456. Attribution is not required; provenance is recorded in
  `public/assets/ATTRIBUTION.md` so it stays re-verifiable.
- **The files ARE in this repo** (`public/assets/se/`, 21.7MB). This is the opposite of the BGM
  catalog and it removes a whole class of problems: no CDN module, no starter-track exception, no
  `legacyAudioRepair` equivalent, no "silent without CDN" failure mode.
- **Files sit in per-pack subdirectories, not flat.** `metal_01` exists in *two* source packs; a flat
  layout would silently overwrite one. `test/seCatalog.test.ts` guards path uniqueness.
- 5 packs are Ogg Vorbis; the artisticdude pack is WAV PCM16/24 and accounts for 15.3MB of the
  21.7MB. There is no ffmpeg in this environment, so originals were committed byte-for-byte rather
  than transcoded — same call as the BGM wav loop masters.
- **EasyRPG RTP SE stays.** The picker lists the catalog first, RTP after (same ordering as BGM), so
  existing `easyrpg-sound-*` references keep resolving and no migration is needed.

## Files and ownership

| File | Role |
| --- | --- |
| `src/assets/seCatalogRuntime.ts` | **Generated.** id → `assets/se/...` path. Runtime-only, so editor metadata does not leak into the player bundle. |
| `src/assets/seCatalog.ts` | **Generated.** Editor metadata: Korean title, category, base name, variant, duration, sha256, source, search tags. |
| `src/assets/seCatalogResolver.ts` | Hand-written. id → URL glue for the shared resource resolver. No CDN — always a same-origin absolute path. |
| `scripts/se/fetch-se-packs.py` | Downloads the 6 source zips, extracts, writes `inventory.json` (duration/channels/peak/RMS/sha256). |
| `scripts/se/place-se-assets.py` | Staging → `public/assets/se/`, applies the exclusion rules, writes `placed.json`. |
| `scripts/se/build-se-labels.py` | `placed.json` → `labels.json` + the audition page. |
| `scripts/se/build-se-catalog.py` | `labels.json` → the two generated TS files. |
| `test/seCatalog.test.ts` | Guards count, id/path uniqueness, file existence, resolver output, id registration, category order, Korean search. |

Do **not** hand-edit the two generated files. Re-run the scripts.

## Regenerating

```sh
python scripts/se/fetch-se-packs.py     # --staging defaults to dist/se-staging
python scripts/se/place-se-assets.py
python scripts/se/build-se-labels.py
python scripts/se/build-se-catalog.py
```

Every step is re-runnable: zips are skipped by size, assets by sha256. A full re-run leaves
`public/assets/se/` byte-identical (verified — `git status` stays clean).

### Why these are python, not `.mjs`

The rest of `scripts/` is Node. These are python because (1) the source packs are zips and Node has
no built-in unzip, (2) WAV duration/peak needs header parsing (`wave`), (3) there is no ffmpeg and no
appetite for new npm deps. Everything needed is in the python standard library. Note `audioop` was
removed in Python 3.13, so peak/RMS is computed by hand in `fetch-se-packs.py`.

### Kenney download URLs rotate

Kenney zip links carry a hash path (`.../interface-sounds/fa43c1dd4d-1677589452/...zip`). The fetch
script scrapes the pack page for the current link instead of hardcoding it — a pinned URL would 404
eventually.

## Categories

Catalog order **is** picker group order; `build-se-labels.py` sorts by `CAT_ORDER` before writing.
If that sort is removed, group headers appear in file order and repeat.

| Category | Count |
| --- | --- |
| UI · 커서 · 선택 | 35 |
| UI · 결정 · 취소 | 8 |
| UI · 창 · 토글 | 44 |
| UI · 경고 · 알림 | 18 |
| UI · 질감 | 21 |
| 전투 · 타격 | 21 |
| 전투 · 마법 | 11 |
| 몬스터 · 음성 | 76 |
| 아이템 · 인벤토리 | 39 |
| 문 · 자물쇠 · 상자 | 14 |
| 환경 · 폴리 | 84 |
| 징글 (ME) | 85 |

## The labels are provisional — and why

Labels were derived from **the original file name, the source pack's own folder taxonomy, and
measured values (duration, peak, RMS)**. Nothing else was available: the agent that built this
cannot hear audio, so no timbre adjectives were invented.

Two consequences:

- `kenney-jingles` file names are pure numbers (`jingles_NES00`). The folder gives the timbre
  (8-bit / hit / pizzicato / sax / steel) and that is all the label claims. **Which jingle is
  victory vs. defeat vs. level-up has to be assigned by ear.**
- Any label may be wrong about the actual sound.

`build-se-labels.py` therefore also writes `dist/se-staging/audition.html` — all 456 playable in one
page grouped by proposed category, with a per-row memo field and a "copy corrections as JSON"
button. It uses relative paths so it opens over `file://` with no server. Corrections go back into
the `RULES` table in `build-se-labels.py`, then re-run the last two scripts.

## How authors reach the sounds

- **Resource picker (`kind: "sound"`)** lists the catalog first, then the old single CC0 tone, then
  EasyRPG RTP. Labels are `title — category (s)`. Options carry `searchTerms` (tags + category +
  base name) so "결정", "동전", or "포효" all hit.
- **Preview playback** in the picker calls the same `playAudioCommand()` the runtime uses — there is
  no separate editor preview path, so if it plays in the dialog it plays in the game.
- **`searchResources("se", query)`** exposes the catalog to AI tools (`list_resources`), catalog
  before RTP.

## Traps

- **Adding an id without registering it breaks project loading, not just audio.**
  `collectResourceIds()` in `src/project/io/resourceReferenceValidation.ts` must include every
  catalog id; `validateOptionalResource` asserts on unknown ids.
- **`matchesKind` needs the `cc0-se-` prefix.** Without it the picker treats a selected catalog
  sound as a kind mismatch and shows "(없음)" when reopened.
- **Do not put catalog metadata in the runtime module.** `seCatalog.ts` is 250KB; merged, it reaches
  the player bundle through the resource resolver.
- **Deployment needs nothing extra.** `app/assets/[...path]/route.ts` on the community site serves
  the editor's `public/` directly and `lib/staticFile.ts` already maps `.ogg`/`.wav`/`.mp3`.
  `src/player/runtimeAssets.json` is a release **integrity contract**, not a serving allowlist —
  audio has never been in it (nor have the CC0 BGM five or the RTP 96). Adding 456 paths there would
  grow it 18→474 and make every release rehash them, with `runtime-assets-stale` failing the release
  on any drift.
