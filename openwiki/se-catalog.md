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
| `scripts/se/decode-se-pcm.mjs` | Chromium `decodeAudioData` → `dist/se-staging/pcm/*.wav` (mono 22050 PCM16). |
| `scripts/se/analyze-se-audio.py` | PCM → spectrogram contact sheets + `audio-features.json`. `--blind` renders tile numbers only. |
| `scripts/se/cross-check-se.py` | My measurements vs two external sheet readings → `cross-check.json` + the audition page's priority list. |
| `scripts/se/run-reviewers.sh` + `reviewer-prompt.txt` | Sends every blind sheet to codex and agy, caching one file per sheet under `dist/se-staging/review/`. |
| `scripts/se/accepted-contours.json` | **Generated but tracked.** id → `상승`/`하강` for the 94 sounds whose direction survived the cross-check. `build-se-labels.py` reads it, so jingle titles stay reproducible from the repo alone after `dist/` is wiped. |
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

## Triple cross-check: which sounds actually need human ears

The labels below can be wrong about the real sound, and nobody will audition 456 files for fun. This
is how the list gets cut to something a human actually listens to.

Three independent readings of the same audio:

1. **My signal processing** — `analyze-se-audio.py` (autocorrelation f0 contour, spectral-flux onset
   count, spectral flatness).
2. **codex** (GPT family) reading the spectrogram sheets.
3. **agy** (Antigravity CLI, Gemini family) reading the same sheets.

The sheets handed to the reviewers are **blind** (`--blind`): each tile carries a two-digit number
and nothing else. The labeled sheets print my own measurements under every tile, so handing those
over lets a reviewer transcribe my answer instead of reading the picture — that is not an
independent check.

```sh
node scripts/se/decode-se-pcm.mjs
python scripts/se/analyze-se-audio.py --blind      # blind-sheet-*.png + blind-sheet-map.json
bash scripts/se/run-reviewers.sh 6                  # review/{codex,agy}-<n>.txt (재실행 가능)
python scripts/se/cross-check-se.py                # cross-check.json
python scripts/se/build-se-labels.py               # audition.html 맨 위에 우선 검수 섹션
```

### What it measured (2026-08-23, all 456, both reviewers covering all 16 sheets)

| Axis | My rule vs a reviewer | Reviewer vs reviewer |
| --- | --- | --- |
| Pitch direction | 61% | 82% |
| Onset count (±1) | 69% | 81% |
| Tonal vs noisy | 54% | 70% |

The two reviewers agree with each other far more than either agrees with me. That asymmetry is the
useful signal, and it exposed two real defects in my detector:

- **Onset count missed the first attack.** `np.diff` only sees frame-to-frame change, so a one-shot
  whose attack sits in frame 0 scored **0 events** — 87 of 456, and both reviewers saw ≥1 in every
  single one. Fixed by padding the flux with silence at both ends; exact agreement with the reviewer
  consensus went 24% → 43%.
- **Direction was claimed far too often.** The old rule called anything past ±1.5 semitones
  rising/falling, which put a direction on 282 of 456 — most of it invisible to either reviewer. A
  direction now needs **|drift| ≥ 3 semitones and voiced ratio ≥ 0.8**; smaller measured drifts
  become `미세상승`/`미세하강`. Agreement 48% → 65%, sign conflicts 36 → 20. The measured semitone
  value is unchanged — only the word it earns.

Tonal/noisy stayed at 54% and was **not** tuned. Spectral flatness and "does it look harmonic" are
not the same question, and fitting the threshold to two pairs of eyes would only launder a guess.

### The output

`cross-check.json` holds per-sound records (`mine` / `codex` / `agy`, `hard`, `soft`, `odd`,
`verdict`, `audition`) plus summary counts. `audition: true` — **75 of 456** — is the only field the
audition page consumes: the sounds where the direction claim is genuinely contested (sign flip
against a reviewer, or a large drift both reviewers say isn't there). Onset and timbre mismatches are
threshold calibration, not listening work, so they stay out of that list and appear as badges only.

`build-se-labels.py` picks the file up when it exists and puts a **우선 검수** section at the top of
`audition.html` with a "불일치만" filter. Without the file the page renders exactly as before — the
cross-check is an optional step, not a dependency.

### Traps

- **agy tries to run python on the PNG instead of looking at it.** Headless mode cannot prompt for
  the command permission, so the run dies with no output (6 of 16 sheets on the first pass). The
  prompt must forbid tool use outright; `run-reviewers.sh` does.- **codex prints the answer table twice.** Both copies were identical; the parser keeps the last
  occurrence per tile.
- Reviewer results are cached per file, so re-running `run-reviewers.sh` only fills gaps. Delete a
  `review/*.txt` to force that sheet to be re-read.

## The labels are provisional — and why

Labels were derived from **the original file name, the source pack's own folder taxonomy, and
measured values (duration, peak, RMS)**. Nothing else was available: the agent that built this
cannot hear audio, so no timbre adjectives were invented.

Two consequences:

- `kenney-jingles` file names are pure numbers (`jingles_NES00`). The folder gives the timbre
  (8-bit / hit / pizzicato / sax / steel), and the **pitch direction** now comes from the cross-check:
  33 of the 85 jingles carry `(상승)` or `(하강)` in the title plus `상승`/`올라가는` search tags. The
  other 52 stay bare — 18 because the readers contested the direction, 34 because there is no
  direction to claim. **Which jingle is victory vs. defeat vs. level-up still has to be assigned by
  ear**: a rising contour is a fact about the sound, not a decision about what it means in a game.
  Only jingles take the suffix — elsewhere the file name already carries the meaning (`door_open`,
  `coin`) and a direction would just lengthen the label.
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
