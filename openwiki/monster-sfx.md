# Monster-collection default sound set (원본 칩튠 효과음)

Added 2026-10-16. A 15-cue set of original chip-style sounds that becomes the **default** sound of a
monster-collection project (`system.monsterCollection`, `battleParty: "monsters"` or `monsterBattleParty`).
Other genres keep their RTP / silent sounds unchanged.

## How a sound is made

Argon (text model, `gemini-4-argon-high`) does **not** produce audio. It writes a *synthesiser patch* (JSON) in the
vocabulary of a 4-channel handheld chip; a deterministic renderer turns it into PCM. Same structure as the pixel
harnesses (the model places the grid, code renders it).

| Piece | File |
|---|---|
| Briefs (what each sound is for, length window, loudness target, comparison reference) | `scripts/content/monster-sfx/briefs.py` |
| Patch vocabulary + renderer (pulse 12.5/25/50/75 %, triangle, 32-entry 4-bit wave, 7/15-bit LFSR noise, pitch curves, arpeggio, vibrato, echo; 4x oversampled, 44.1 kHz) | `scripts/content/monster-sfx/synth.py` |
| Argon authoring loop (stream-only proxy, validate -> render -> gate -> up to 2 repairs) | `scripts/content/monster-sfx/argon_author.py` |
| Automatic gate and descriptors | `scripts/content/monster-sfx/qa.py` |
| Rank candidates, render OGG, write manifest | `scripts/content/monster-sfx/build.py` (`select`, `render`) |
| Listening page (old / reference / new side by side) | `scripts/content/monster-sfx/listen_page.py` |
| Optional listening check through `agy` | `scripts/content/monster-sfx/ear.py` |
| Winning patches + run records | `scripts/content/monster-sfx/final/` |
| Shipped files + manifest (patch, model, prompt hash, metrics, CC0) | `public/assets/monster-sfx/` |

Re-run: `export OPRN_LIVE_KEY=$(cat ~/.config/oprn/live-key)` (never write the key anywhere), then
`argon_author.py --ids <id> --cands 4`, `build.py select`, `build.py render`. Only `gemini-4-argon*` models are allowed on the
8318 proxy. The proxy answers **streaming** requests only and returns 429 often; `call_model` retries with backoff.

## Automatic gate (a failing sound is never bundled)

Mono 16-bit **44.1 kHz** (22 kHz output costs brightness, see `agy-ear-for-sfx` memory), zero clipped samples, peak
<= -1 dBFS, |DC| <= 0.003, leading silence <= 8 ms (12 ms after OGG decode), trailing silence per brief, no inner gap
> 140 ms, first sample and last 2 ms near zero (no clicks), duration window per brief. The gate is re-run on the
**decoded OGG** (what the player hears), not on the master. Loudness is levelled per sound by active-part RMS
(`briefs.py` `rms`) so UI blips sit around -24 dBFS and hits around -17 dBFS, similar to the RTP sounds they replace.
Originality guard: normalised peak cross-correlation against the comparison reference must stay below 0.55
(independent synthesis never gets near 1.0).

## Wiring (minimum)

- `src/assets/monsterSfxAssets.ts` — cue list, ids `cc0-sound-monster-<cue>`, genre test `usesMonsterSfxSet`, UI event map.
  Registered in `CC0_AUDIO_ASSETS` (so they resolve, show in the sound catalog and are `license: CC0-1.0`).
- `src/player/monsterSfx.ts` — `playMonsterSfx(project, cue)` (false for other genres / headless), `monsterBattleCue(event, tier)`, preload.
- `battleJuice.playBattleCue` — after the authored slots (system-audio override, authored result cue), before the RTP default:
  cursor / confirm / cancel, hit by tier (`BattleCueShape.tier`), critical -> hit-super, faint.
- `runtimeJuice.emitRuntimeJuice` — default menu / title sounds; `oprnMenuSounds`, title sounds and system overrides still win.
- `battleFieldDom.playCaptureCinematic` — ball throw, each shake, success, break.
- `battleDom` — level-up after the victory cue when a monster levelled (`rewards.monsterLevelUps`); the old second
  super-effective hit (`POKEMON_EFFECTIVENESS_SHAPE`) is skipped because the new hit-super already strikes twice.
- `playSceneBattle` — encounter transition sound (every battle entry of a monster project, trainers included).
- `interpreter/commandCatalog` `recoverAll` without an actor id (party-wide heal = Pokemon-centre style) — center-heal jingle.
- `webExportAssets.collectProjectStrings` — adds the 15 ids to the export only for monster projects.

## Comparison references

The listening page also plays Emerald-class reference sounds and the earlier picked GBA hit candidates. They live under
`~/claude-viz/battle-sfx-gba/` (outside the repository) and are **comparison only** - never copy them into the repo or a
bundle. `MONSTER_SFX_REF_DIR` overrides the folder. The source ROM-derived renderer
(`~/third-party-assets/pokeemerald`) was removed in the 2026-10-07 copyright clean-up.

## Not done / next

Dialogue letter tick (speaker setting), walking, status inflict, stat up/down, weather start, evolution (before/during/after),
item pickup, shop purchase (uses the new confirm), badge jingle, gym door / HM / door open, hit-heal / miss / defend / escape,
battle-start jingle. Listening check by `agy` Argon is unreliable (hears tone vs noise but mis-reports pitch); a human ear
decides. Tests (`test/monsterSfx.test.ts`) were written but not run in the authoring session.
