# Opening animatic authoring

## Ownership and format

`system.opening.scenes` accepts `kind: animatic` alongside existing text/image/video. `composition` is a strict, additive 2D timeline in `src/project/openingAnimatic.ts`; unknown fields and invalid times are rejected before mutation. Nested image/audio references participate in save/load validation. Disabled authored timelines survive normalization.

Times are shot-local integer milliseconds. Stage geometry is pixels; anchors are 0..1, rotation is degrees. Layers draw back to front. Camera and actor tracks hold endpoint values; destination key owns easing. Sprite-sheet frame keys select existing poses; automatic fps loops existing frames. These tools do not invent skeletal poses or generate 3D/FMV.

## Assistant surface

`src/editor/tools/openingAnimaticTools.ts` registers capabilities, research/reference vision, entry configuration, shot/layer creation and removal, property tracks, motion presets, camera tracks/shake, transitions/letterbox, timed audio cues, retiming, inspection, real frame previews, and actual independent layer generation. `get_animatic_capabilities` returns the complete nested contract with an example rather than bloating every tool declaration.

The real Pi runtime exposes this family for opening production. Generated layers use the real configured image provider: environment-only backgrounds; isolated actors/props/foreground use edge-connected magenta removal to produce PNG alpha. Failed removal is an error, not success. Existing transparent assets and crop/sheet poses are valid image layers. `preview_opening_reference` only loads bundled researched frames; those are research illustrations, not game resources. Provenance and observation limits live in [opening-reference-study.md](opening-reference-study.md).

Production evidence requires a plan, current final configuration review, and actual rendered time samples for every animatic after its final changes. Editing assets or a timeline invalidates prior preview evidence. A model-supplied completed flag cannot satisfy this. Native playback and canonical save/reload remain separate checks.

Research responses distinguish `conceptualRequirements` (study labels, never callable names) from `actualAuthoringTools` (registered tool names and field contracts). State approximations explicitly: seamless scrolling now exists as `region` loops (`scroll-x`/`scroll-y` with wrap, `palette-cycle`, `strip`) via `set_opening_region_loop`; older notes about duplicated-layer scrolling are historical. Native assistant dogfood revealed alias names being described as tools; the corrected response and a second actual UI query are recorded in `verify-shots/monster-opening-animatic-2026-10-03/`.

## Renderer and human editor

`src/player/openingAnimaticRenderer.ts` owns the shared absolute-time canvas draw function used in native sequence playback, model contact sheets, and the database scrubber. The editor supports silent play/pause, seek, layer selection, sampled property edits and key saving. Duration edits retime layer/camera/FX/audio times atomically; collapsed keys reject the change. Preview contact sheets preserve stage aspect and show actual timestamps.

Runtime starts its clock after images load. Sequence music remains outside shot DOM replacement. Shot cues use their own elements, synchronize metadata-delayed seeks against current elapsed time, and stop on next/Skip/abort/load error. Canvas state restores even when a crop fails. Reduced motion freezes positional/camera/particle/sprite motion and retains timing/opacity/narration. In the pixel-grid vocabulary it freezes region loops, dust drift, the glow pulse, the stride walk and the dither reveal, while caption/emote **visibility timing** still follows the clock. Cues and narration cannot be proved through a silent frame preview.

Entry transitions reveal from the stage background: cut/fade/wipe/iris/flash/dither. They are not a cross-dissolve of the previous shot. `dither` is an ordered 4×4 Bayer dissolve from the stage background (17 coverage steps, pixel-art vocabulary) — it still knocks the incoming shot out of the background, so it is *not* a blend with the previous shot; a true cross-dissolve remains unimplemented and is stated as such in `get_animatic_capabilities`. Particle presets are seeded rain/snow/sparks/dust/stars. No live map-session mutation is used to author a montage.

## Pixel-grid stage and alive-viewport primitives (2026-10-15)

`pixelGrid: {width, height}` on the composition (tool `set_opening_pixel_grid`) rasterizes the whole shot into one low-resolution buffer and upscales it by the **largest integer factor**, letterboxed to the canvas. Layer `x/y`, camera x/y and the letterbox bars snap to that grid, and image/shape sizes are rounded to it, so sprites, backgrounds, particles and light share one pixel size. `nearest` sampling is forced inside grid mode. Omitting `pixelGrid` renders the classic smooth stage — pre-existing animatics are **byte-identical** (proved against recorded golden hashes in the probe). Particles and the glow halo also sit on the grid in this mode.

The primitives added alongside it (all seeded, all pure functions of absolute time, all drawn by the shared renderer for playback/preview/scrubber):

| primitive | layer/field | contract |
|---|---|---|
| masked region loop | `kind:"image"` + `region:{x,y,width,height,mode}` | `scroll-x`/`scroll-y` move `pixels` (1..64) every `everyTicks` at `tickMs` (so "1 px every 4 frames at 60 fps" = `pixels:1, everyTicks:4, tickMs:16`), `palette-cycle` remaps listed `colors` one step at a time, `strip` replays a `frames` band. Only that window changes; region coords are layer-local, so with no crop they are source-image pixels. |
| light shaft + dust | `kind:"shaft"` + `shaft:{spread, softness, dust, pulse}` | Angled beam drawn as dithered cell columns with a solid core; dust motes exist **only inside the beam silhouette**; `pulse.pattern:"pulse"` breathes on a sine, `"flicker"` steps on hashed noise (torch, failing light). |
| glow | `kind:"glow"` + `glow:{inner, pulse}` | Radial light in the layer box; dithered cell field inside a `pixelGrid` shot, smooth gradient otherwise. |
| emote bubble | `kind:"emote"` + `emote:{preset, tail, popMs, outMs}` | Procedural pixel bubble (exclaim/question/ellipsis/heart/sweat) with pop-in → hold → pop-out; no external image, so no text-in-art problem. Position it above an actor with `targetLayerId`. |
| typed caption track | `kind:"caption"` + `caption:{cues, safeArea, fadeOutMs}` | Bottom bar caption: per-cue `text`/`color`/`typewriterMs`, cue holds until the next cue, only the last cue fades out at the layer/shot end. With `letterbox` set the line sits **inside the band** (reference framing) and is composed above the letterbox board; without a band it sits `safeArea` above the bottom edge. Cue text counts toward reading time. |
| walk preset | `walk:{stride, frames, holdFrame?, phase?}` | Sprite-sheet actor whose pose advances with **travelled distance** (the larger of the x/y travel, scaled), so the feet never slide; `apply_opening_walk` can author the travel track (`fromX`/`toX`/`fromY`/`toY`) in the same call. |
| charset actor | tool `place_opening_charset_actor` | Places a bundled 24×32 RM2000 chip (288×256 sheet, 4×2 characters × 4 directions × 3 patterns) at an integer scale and wires the stride-matched walk in one call, so no frame indices are counted by hand. The shared renderer keys the sheet's top-left colour for any 288×256 sheet before drawing (the map path always did; the animatic path did not until 2026-10-16). |
| full-stage background | tool `place_opening_background` | Writes `x:0, y:0, width/height = stage, anchorX/Y:0` so the picture covers the whole shot. Necessary because `x,y` positions the **anchor point**, whose default is the layer centre. |

The assistant surface is `place_opening_background`, `set_opening_pixel_grid`, `set_opening_region_loop`, `upsert_opening_light_fx` (kind `shaft`|`glow`), `upsert_opening_emote`, `set_opening_caption`, `apply_opening_walk` and `place_opening_charset_actor`; `get_animatic_capabilities` carries the full contract plus one compact example per primitive, and `review_opening` now checks caption reading time, a walk that ends mid-stride, and fractional sizes under a `pixelGrid`. Raw `upsert_opening_layer` still accepts the same fields directly — except that a `role:"background"` layer must be placed with `place_opening_background` (or `anchorX/Y:0`), because `x,y` is the anchor point's position, not the top-left corner.

Focused executable probe: `node scripts/qa/opening-animatic/probe.mjs <out-dir>` (`golden.mjs` records the legacy byte-identity baseline, `fixtures.ts` holds the synthetic compositions). Read `SUMMARY.md` first. It asserts integer-scaled grid output, region-local change, dust-inside-beam, same-time byte determinism, reduced-motion freeze, per-primitive schema rejection and legacy byte-identity, and writes PNG stills, a contact sheet and an mp4.

## New Game handoff to the start map (verified 2026-10-15)

The New Game path in `src/player/player.ts` already hands off correctly; the flow was not rewritten. Verified by reading the shell plus a boundary probe over the real `playCinematicSequence`:

- The real engine boots **during** the opening (`bootPlayGame(..., true)`), so the map is usually ready when the sequence ends.
- The sequence keeps playing with `holdMusicOnComplete: true` and its music element mounted on the shell host (`musicHost: main`), outside the shot DOM — it therefore survives every shot cut and the sequence's own teardown.
- On completion the shell paints a cover from the last published frame (`onFrame(url, fadeMs)`, `fadeMs` = the last scene's presentation `transition.exitMs`, 500 ms default), awaits the prepared map, then `releaseMusic(600)`, fades the cover out by `fadeMs`, and calls `scene.activateInitialPresentation()`. Skip and reduced motion use `fadeMs = 0`, i.e. a **hard cut**.
- So: hard cut = skip/reduced motion/`exitMs:0`; fade-to-map = `exitMs > 0`; the opening music continues **through** the handoff and then fades over 600 ms rather than being handed to the map's BGM. Dither at the *map* boundary is not expressed (the cover is an `<img>` fade) — a shot's own `transition.dither` covers the shot-entry reveal.
- Probe coverage: the shot canvas and music are present while playing, music survives the cut and completion with `holdMusicOnComplete`, `onFrame` publishes a finite fade, `releaseMusic` clears the track, and Escape yields `skipped` with the sequence DOM gone.

## Assistant authoring of a pixel opening (2026-10-15, phase 2)

`get_animatic_capabilities.data.pixelOpening` and `get_opening_direction.recipes[style:"pixel-animatic-opening"]`
are the two contracts the assistant reads before authoring this class of opening. They state the stage
(`create_opening_animatic_shot(width:384,height:216)` + `set_opening_pixel_grid(384,216)`), 7–8 shots over
~52–64 s, letterbox **0.15** (32 of 216 px — measured on the reference capture, `key_fullres_4x` top bar = 128/4 = 32 px)
with the caption inside the bar, which primitive does what (region scroll for water/cloud/road stripes, glow pulse for a
breathing crystal, shaft+dust for cathedral light, particles for stars, `place_opening_charset_actor` for bundled
24×32 walkers, `upsert_opening_emote` for crowd reactions), dither(600 ms) between places and flash(240 ms) on an
impact, one sequence music via `set_opening` that survives every cut and the handoff, and the rule that the logo shot
ends the sequence — no shot is authored for the start map. `OPENING_PRODUCTION_PROMPT` carries the same recipe as prose
and now states explicitly that a “새로하기 오프닝” request (without an explicit storybook/still-panel ask) must be a
grid **animatic** shot list, not a montage of still plates with a camera push.

### Root causes fixed after Iteration 2 (2026-10-16)

Iteration 2 (`opencodex/gpt-5.6-sol`, see the Argon note below) produced six `kind:"image"` plates with camera pan/zoom
and no animatic shot at all, so the reference's layered staging was absent. The runner-level defects that made the
gap worse, all fixed and re-proved by `bun scripts/qa/opening-pixel-regress.mts`:

| defect (measured) | fix |
|---|---|
| `prepareOpeningImageRequest` rejected `referenceResourceId: ""` (models fill every optional field) → run 2 spent 5 consecutive `generate_opening_image` calls on the error and generated nothing | `""`/whitespace/array holes are now “unset”, not invalid; non-string still rejects |
| `list_opening_media(kind:"charset", query:"기사 마을 사람")` returned 0 because the catalog names are English → the assistant concluded there were no character chips and reached for its own stick figures | a zero-match query now returns the first page plus `queryMatchedNothing:true` and a summary that says so |
| `configure_opening_entry({mode:"new-game", idleMs:500})` rejected the whole call even though `idleMs` only means anything for `attract` | idle arguments are validated and stored only for `attract`; other modes drop them |
| `direction.transition.kind` accepted only `cut/dissolve/fade/flash` while the player already renders `dither` | `dither` is accepted, so a still-plate opening can use the pixel dissolve vocabulary |
| image stills were pixelized to an arbitrary width (96-colour, `min(384, source.width)`) so palettes and pixel size drifted shot to shot | every backdrop is cover-cropped to **384×216** and reduced to a **40-colour** median-cut palette; isolated layers to 192 px / 24 colours |
| the completion check said “max 16” but fired above 14, so a legal 16px chapter title was reported as a defect | the comparison matches the message |
| `opening-pixel-record.mjs` crashed (`Cannot read properties of undefined`) on any opening whose scenes were not animatics | non-animatic scenes are drawn into the contact sheet from their decoded image + camera track, and `layers` defaults to `[]` |
| the QA runner could not render character-chip candidates (`그림 데이터를 찾을 수 없습니다: undefined`, `list_resources` failed 3×) | the browser bridge exposes `/toolimage` → `renderPiToolImage` and the runner routes `charsetCandidates` through it |

`PiOpeningProduction.inspect` additionally reports a story-driven opening that ends up with ≥3 still plates and **zero**
animatic shots, with the concrete tool sequence to fix it.

### Root causes fixed after Iteration 3 (2026-10-16)

Iteration 3 (`opencodex/gpt-5.6-sol`, 35 turns / 178 tool calls) did produce six 384×216 grid animatic shots with
letterbox 0.15, four to seven moving layers each, fourteen bundled 24×32 charset actors with stride-matched walk, and a
2×dither / 2×flash / 2×fade transition plan — but the render exposed three defects that only *looking at the frames*
reveals (a machine metric passed all three):

| defect (seen in the render) | root cause | fix |
|---|---|---|
| every charset actor wore a teal key-colour box | the shared renderer drew the raw 288×256 sheet; the runtime **map** path removes the sheet's top-left key colour, the animatic path did not | `keyedCharset()` in `openingAnimaticRenderer.ts` keys the sheet once per resource (alpha sheets pass through unchanged) and both the sprite draw and region loops use that source |
| all six backgrounds covered only the top-left quadrant, the rest fell back to the stage colour | layer `x,y` is the **anchor point's** position, the default anchor is 0.5/0.5, so the assistant's `x:0, y:0` put the background's *centre* at the corner | new `place_opening_background({shotId, layerId, resourceId})` places `x:0,y:0,width=384,height=216,anchorX/Y:0`, and `openingAnimaticMeasure` now reports the uncovered rect plus the exact numbers to correct |
| four of six backgrounds were **bundled stills** (`oprn-still-*`, `battle-scenery-*`, `title_art_*`), not dot art made for this opening | the assistant reused whatever `list_opening_media` returned instead of generating empty dot backdrops | the measure now flags a non-`pixel-art` background that sits under dot actors, and the recipe says backgrounds must come from `generate_opening_image(role:"backdrop", cast:"nobody")` |
| (worker only) generated art stayed a 861 KB JPEG — palettes and pixel sizes drifted again | `pixelizeOpeningImage` swallowed the error when `decodeImage` refused a JPEG in Node, returning the original bytes | it now transcodes by **magic bytes** (not the MIME label — one producer labelled JPEG data as `image/png`) through `jimp` and always lands on 384×216/40 colours, proved by `bun scripts/qa/opening-pixelize-probe.mts <file>` |

The layer-anchor semantics are now stated in `get_animatic_capabilities` (`layer.anchors`) and in the `pixelOpening.stage`
contract, and the measure probe for this class is `bun scripts/qa/opening-pixel-regress.mts`.

### Provider availability during Iterations 2–4 (2026-10-16)

- Chat: `google-antigravity/gemini-4-argon-high` is quota-exhausted until **2026-10-21T02:25Z** (Cloud Code Assist
  `429 QUOTA_EXHAUSTED`, also surfaced by the local `argonproxy` on 127.0.0.1:8318); `gemini-3.7-flash-tiered` via
  `cliproxy` reports `unknown provider`, `gpt-5.6-sol` via `cliproxy` reports an unparsable auth token, and
  `zcode/glm-5.3-flash` has no balance. `opencodex/gpt-5.6-sol` (127.0.0.1:10200) was the only working chat lane.
- Image: `google-antigravity/gemini-3.1-flash-image` generated fine through Iterations 2 and 3, then returned
  `429 … exhausted your capacity on this model. Your quota will reset after 2h22m18s` during Iteration 4, so that run
  could not generate new backgrounds. Runs 2 and 4 also ended early on upstream 500s (`stoppedEarly`), recorded in
  `SUMMARY.json` rather than hidden.

### Argon availability (2026-10-16)

`google-antigravity/gemini-4-argon-high` returned Cloud Code Assist `429 QUOTA_EXHAUSTED`
("Individual quota reached … Resets in 115h", `quotaResetTimeStamp 2026-10-21T02:25Z`) both directly and through the
local `argonproxy` (127.0.0.1:8318). The same runner was therefore driven with `opencodex/gpt-5.6-sol`
(local proxy 127.0.0.1:10200, `openai-completions`, vision input) while image generation stayed on
`google-antigravity/gemini-3.1-flash-image`. Mid-run the runner also hit an upstream 500 and stopped early
(`stoppedEarly`), which is recorded in `SUMMARY.json` rather than hidden.

### OAuth client drift (2026-10-16)

`scripts/lib/oauthClients.mjs` read the Antigravity OAuth client id/secret from
`@oh-my-pi/pi-ai/src/registry/oauth/google-antigravity.ts` (`const CLIENT_ID = decode("…")`). The installed pi-ai
(2026-10-12) moved those values into the compat rule file
`@oh-my-pi/pi-catalog/src/compat/rules/auth/google-antigravity.kdl` as base64 `client-id`/`client-secret`, so the
reader returned nothing and the headless runner died with `OPRN_ANTIGRAVITY_CLIENT_ID 가 설정되지 않았다` before the
first turn. The reader now checks both locations (values are still never written into this repository).

### Pixel-mode text sizing (defect fixed here)

With a `pixelGrid`, `typography.fontSize` and `caption` sizes are measured in **grid pixels**, not stage pixels
(`drawText`/`drawCaption` divide the size by the raster scale). Before this, a caption authored as "12" in a
384×216 grid inside a 960×540 stage measured 12 *stage* pixels = 4.8 grid pixels and smeared across the
nearest-neighbour upscale. Existing grid shots therefore read their captions at the intended size now; classic
(non-grid) shots are unchanged because the scale is 1. Author a shot at `width/height == pixelGrid` so every
number in the shot is already a grid pixel.

### Assistant completion checks added

`PiOpeningProduction.inspect` now also reports: grid-shot fractional geometry (existing), caption/text sizes
outside the readable band (7..24 grid px), a sprite drawn at a non-integer multiple of its 24 px cell, a grid
shot with nothing actually animating, and a pixel/dot opening request that produced no grid animatic shot at all.

`requestsInGameOpening` narrowed: "맵에서" now needs an on-map actor/scene context ("맵 위에서 걸어"/"그 맵에서
인물이 움직이는"). Previously the handoff sentence "끝나면 시작 맵에서 조작이 이어져야 해" classified an ordinary
pixel-animatic request as an in-game cutscene request and sent the assistant to `script_cutscene_staged` instead.

### Executable probes for this class

- `bun scripts/qa/opening-pixel-assistant-run.mts --out <dir> --project-json <copy> --task-file <txt> --browser-url http://127.0.0.1:9904` —
  real Pi assistant (default `google-antigravity/gemini-4-argon`), real image provider
  (`google-antigravity/gemini-3.1-flash-image`; the ChatGPT image route returns prose for the opening prompt builders,
  measured 2026-10-15), real dev-server render bridge for previews. Writes `activity.json`, `calls.log`,
  `project.json`, `SUMMARY.json` into a private directory; never saves canonically.
- `node scripts/qa/opening-pixel-measure.mjs <project.json> [out.json]` — objective axes for the same comparison
  the reference capture uses: shot count/length, simultaneously animated layers per shot, region/glow/shaft/walk/emote
  counts, caption characters and colours, sprite integer-scale violations, fractional geometry.
- `node scripts/qa/opening-pixel-record.mjs <project.json> <outDir> [--dev-url …]` — renders every shot through the
  real shared renderer at 12 fps into `contact-sheet.png` + `opening-animatic.mp4`, then drives the real
  `player.html` bundle (title → opening → start map handoff, with real arrow-key input) into `opening-player.webm`
  plus labelled step screenshots and `record.json`.
- `node scripts/qa/opening-pixel-viewer.mjs <outDir> <name>` — one self-contained HTML (contact sheet, both videos,
  shot table, handoff/issue record) written to `~/claude-viz/<name>.html` for a human to open.
- `bun scripts/qa/opening-pixel-fixture.mts --in <copy.json> --out <copy.json> [--render <png>]` — repaints the fixture's
  start map onto a bundled tileset (`beodeul_city`, window 78,13 of `tiledata/beodeul-city/map.json`) so the New Game
  handoff lands on a real map instead of the missing-texture grid the retired `easyrpg_chipset_combined_town` produced.
  Never writes to a live project.
- `bun scripts/qa/opening-pixel-regress.mts` — one probe for the runner defects fixed on 2026-10-16: the Korean charset
  query fallback, an empty `referenceResourceId`, `configure_opening_entry` with an `idleMs` outside `attract`,
  `direction.transition.dither`, the 384×216/40-colour pixelize output, `place_opening_background` coverage, and the
  review check that catches a quadrant-sized background.
- `bun scripts/qa/opening-pixelize-probe.mts <image>` — reports the real output MIME/size/palette of
  `pixelizeOpeningImage` for one file (also covers the JPEG-in-worker case).
- `node scripts/qa/opening-pixel-compare.mjs <name> --ref <dir> --run <label>=<outDir> …` — one self-contained page with
  the reference capture beside every iteration's contact sheet, both videos and shot table.

## Entry timing

`configure_opening_entry` sets one sequence location: `new-game` (default), `before-title` (first cold title visit after resume/test precedence), or `attract` (idle title demo with configurable initial/repeat wait). This is one authored sequence; it does not hold three independently authored tracks simultaneously. Non-New-Game modes do not replay on New Game. Any non-repeated key dismisses before-title/attract without activating the underlying title menu. Mouse input continues to follow the player's keyboard ownership contract.

Attract owns its timer/listeners through shell teardown, resets on title input, and waits while title confirmation/menus/document visibility prevent playback. Same requested title track keeps the existing audio identity/playhead. A different authored track stops title music and restarts it on handoff; no opaque pause/resume token currently exists, so different-track playhead preservation is not claimed.

## Functional verification

Use focused browser renderer probes, real Pi production and native exported `player.html` evidence. Do not run Vitest/gates/full typecheck without this session's explicit authorization. Inspect saved project via the existing host API, CAS save and fresh connection reload; never modify a live host SQLite directly.

## Older host storage compatibility

`projectWireView` encodes full timelines and entry settings in the versioned `meta.oprnCinematicTimelines` extension (`src/project/cinematicWire.ts`). The legacy scene field contains real first-layer image/text fallbacks, so an older host can validate and preserve the document. Current deserialization restores authored timelines before normal shape/resource validation. Restoration requires that the legacy sequence still equals the recorded fallback; intentional edits by an older client win. Unsupported metadata versions reject the load. The capsule also preserves authored monster campaign metadata through older normalizers.

This is a storage compatibility contract, not an older player's animatic renderer. Newly built player/editor bundles are required for motion. Raw API save helpers must encode first; raw API reload evidence must decode and compare the restored timeline as well as verify the persisted bytes. The campaign exporter prunes unused tileset catalogs and uploaded resources in the exported copy only, retaining dependencies transitively; canonical SQLite keeps the full editor catalogs.

## Narrative storybook recipe (2026-10-04)

`get_opening_direction` exposes storybook/cinematic/duel recipes without forcing
all games into a moving creature montage. A storybook uses an original world,
rupture, stakes, invitation and concrete handoff. Intentional still panels and
short narration are valid. Undertale is a reference for hierarchy, negative space
and memorable motifs; its text/art/melody are not game assets or quality proof.

`make_opening_storybook` validates4..8 uniquely named panels, actual images,
first-world/last-handoff roles and at least world/rupture/stakes/handoff. Lines are
at most80 characters/3rows. **Default progression is confirm:** image/text scenes
have durationMs:0 and motion:none; Enter advances one page, held repeats do not.
`meta.oprnOpeningBook` stores version1, exact ordered scene IDs and amber/ivory ink.
The shipping renderer uses it only for a matching all-confirm image/text sequence,
keeps the same illustration DOM node mounted across dialogue pages, and shows
Enter/Esc hints. Ordinary videos and other cinematic sequences keep their rules.

Explicit progression:auto retains timed960×720 animatics and minimum reading time
(nonspace characters/5 seconds +700ms,2.2..15seconds); it clears stale book metadata.
Repeated panel fades are not the narrative default. Existing entry/music persist.
Opening production fingerprints include book metadata, so editing pacing/presentation
invalidates old review evidence. Actual assistant dogfood made8 confirm pages from
4 inspected existing paintings without changing maps/database/session; playback
is verified separately in the exported player. Music: music-score-authoring.md.

## Drawn professor poses inside confirm pages (2026-10-04)

The Emerald professor introduction can author
`meta.oprnOpeningBook.portraitMotion` alongside its `portraitResourceId` still
fallback. This keeps the existing `durationMs:0` image/text storybook and Enter
pacing. It does not convert pages into timed animatics.

```
portraitMotion: {
  resourceId: "registered-horizontal-pose-strip",
  frameWidth: 64, frameHeight: 96, frameCount: 6,
  frames: [0,0,1,0,2,2,0,3,3,0,4,0], fps: 6,
  sceneFrames: { "existing-page-id": [0,4,4,0,5,5,0] }
}
```

This is a **single horizontal strip of actual drawn poses**, zero-based frame
indices. Width/height are integer1..256, count2..32, fps1..12, each order1..128
indices within count. Optional scene orders must name existing book pages.
Frame0 is the neutral reduced-motion pose. `openingPortraitMotion.ts` in project
owns strict shape validation; malformed authored metadata rejects load. Existing
project serialization preserves the nested record, including the older-host
cinematic wire metadata path. No schema/save-slot version change is needed.

`configure_opening_portrait_motion` validates the current Emerald confirm book,
registered still portrait and strip, then writes the same contract. It does not
generate artwork or change music, page durations, maps, or session. Updating the
book invalidates the existing opening review fingerprint. Export explicitly
retains the motion resource even when no scene directly references it.

`src/player/openingPortraitMotion.ts` decodes the actual image and requires exactly
`frameWidth*frameCount` by `frameHeight` before showing a native-resolution canvas.
The stationary canvas and one active-time clock survive Enter pages. Scene frame
orders change on the existing global phase; pages do not reset the clock or audio.
Legacy whole-portrait CSS bob is suppressed while drawn poses are active. The
still remains visible during load and on missing resource, unsafe runtime input,
decode failure, or dimension mismatch. No implicit fallback image generation.

Hidden document and OS reduced motion cancel the animation frame loop. Returning
to a visible document resumes without including hidden time. Reduced motion shows
neutral frame0. Completion, Skip, abort, shell removal and late decode all release
the canvas, RAF and visibility/media-query listeners. The module owns no keys,
timers for page advances, BGM or SFX. Continue still bypasses the whole opening.

Focused executable fixture probe:
`node scripts/qa/runtime/opening-portrait-motion.mjs /tmp/portrait-motion-probe`.
Read its `SUMMARY.md` first. It tests distinct actual canvas pixels, controller
and music-element identity across Enter, held keys/WASD, bounds/fallback, pause,
Skip/completion/abort and disposal. Synthetic colour poses and stubbed audio
methods verify mechanics only. Actual generated art, native shipping playback,
canonical save/reload and listening remain separate required evidence.

### Actual standalone export motion probe

After the final art and runtime are exported, the supervisor can run:

```bash
node scripts/qa/runtime/pokemon-native-motion.mjs \
  --export /absolute/path/to/standalone-game --port 19842 \
  --out /tmp/pokemon-native-motion \
  --canonical /absolute/path/to/canonical-reloaded.json
```

This is an actual compiled `player.html` probe. It serves only the supplied export
on its explicit private localhost port and fails if that port is occupied. It
never starts/restarts a public service, changes project/assets, or writes a save.
`--url` can instead target an existing private standalone player. The probe adds
only the existing `qaInstrumentation` boot flag in the served HTML; original
project, JS and HTML hashes are recorded. A supplied canonical snapshot is compared
read-only; this comparison does not replace a fresh canonical SQLite reload.

Normal New Game waits for the title sequence, then native Enter traverses all
eight confirm pages. Actual pose canvas pixels must yield at least four distinct
frames and a native-resolution WebM clip. Controller, still portrait and BGM
object/track/clock persist across pages. WASD and repeated held Enter must not
restart BGM/current voice. Real media events and playheads are observed without
stubbing playback. A separate browser context checks OS reduced motion, neutral
frame0 and Skip cleanup. Completion must stop the detached pose clock and reach
the original authored start map. Browser/resource errors fail the probe. Audio
listening and artistic approval remain human checks; absent authored narration
is explicitly reported instead of claiming voice playback was verified.

Walking uses clearly reported preparation: after native opening/startup dialogue,
private QA hooks teleport within original authored maps to event-free three-tile
lanes, inject direction into actual Input, and advance normal Phaser updates at
17ms. Collision, movement speed, gait state, sprite selection and project data
are not patched. Actual gait must contain `[0,1,2,1]`, idle must use pattern1, and
all four direction rows must have three distinct native pose pixel frames. Pose
geometry comes from the actual selected Phaser frame, including opaque bounds and
display scale; no 24px/16px sprite width is assumed. This measures runtime gait,
not Emerald source scale fidelity or natural campaign progress. The separately
registered art harness owns source-reference and palette/anchor quality gates.

Default lanes are chosen with the repository's pure collision authority and avoid
authored events. Dynamic NPCs can still block a lane; failures retain frame traces
and a screenshot. `--walk-map`, `--walk-x` and `--walk-y` select explicit original
map corridors. `--opening-only` skips walking and records that reduced scope.
Read `SUMMARY.md` first, then the named screenshots/WebM and `record.json`.

## Review includes authored layers

`review_opening` counts real illustration IDs in animatic layers, includes displayed text layers in reading-time hints, and validates their illustration/audio cue references. A six-panel book with four source paintings reports four paintings rather than zero. Native playback and listening remain separate evidence.

The real Pi dogfood runner decodes cinematicWire metadata before constructing its
model baseline, matching editor deserialization. A raw older-host document otherwise
hides the campaign and causes unrelated repair attempts in system tasks.


## 2026-10-16 ultrabrain 반려 후 수정
- 색 계약: 검증기가 받는 모든 CSS 색(hex 3/4/6/8·rgb[a]·hsl[a]·black/white/transparent)을 렌더러 `parseCssColor` 가 같이 읽는다(`withAlpha`·palette-cycle·캡션 대비). 읽지 못하는 값만 흰색/검정으로 떨어진다.
- `pixelizeOpeningImage` 는 실패 시 원본을 돌려주지 않고 `ImageGenerationError` 를 던진다(384×216·40색 자물쇠가 조용히 꺼지지 않는다).
- `place_opening_charset_actor` 는 번들 `easyrpg|wizarding/charset/*.png` 또는 업로드 kind:charset 만 받는다.
- 자동 리뷰: 정적 카메라 값은 움직임이 아니고 키가 실제로 변할 때만 «움직임»으로 센다. 전환(dither/flash/3종) 규칙은 `pixelGrid` 샷이 있는 4샷 이상 오프닝에만 적용. 대비를 잴 수 없는 자막 색은 지적한다.
- `scripts/build-electron.mjs`: OAuth 클라이언트 값은 `main.cjs` 에만 주입하고 preload·browser-bridge 에는 넣지 않으며, 그 번들에 값이 있으면 빌드가 실패한다.
- legacy golden 은 origin/agent/opening-assistant 렌더러로 재생성해 6/6 해시 동일을 확인했다.

## 2026-10-16 iteration 1: dedicated pixel opening contract

- Every pixel-grid opening backdrop must be generated for its own shot. The
  authoring guard rejects duplicate background resource IDs across animatic
  shots, and rejects bundled painted stills once independent subjects are
  present. Image-generation quota or provider failures are hard failures; the
  runner must stop and report instead of substituting an `oprn-still`,
  `battle-scenery`, or title still.
- Pixel-grid frames are quantized in the shared renderer to a fixed 4x4x4
  palette (64 RGB colours maximum), after the 384x216 low-resolution stage is
  drawn and before integer nearest-neighbour upscale. Shaft feathering and
  dust use the same grid cell and Bayer ordering as the dither transition.
- Composition review now checks background opacity >=0.90, actor bounds against
  the letterbox-safe area, and semantic `characterRole` tags. Cathedral actors
  require `knight`; village actors require `villager`. Story-critical layers
  named for crystal, eye, or sword cannot be low-opacity or flat shape layers.
- `set_opening_sprite_states` connects at least two named states to existing
  sprite-sheet/strip frames and writes `keys.frame` transitions. Use it for
  `normal/cracked`, `closed/open`, and `sheathed/drawn` instead of ellipse
  placeholders.
- The `pixel-animatic-opening` recipe calls for dedicated 384x216 shots,
  wide-to-close/crowd cuts within a beat, three concurrent moving regions
  including a subject/background change, and a pixel-image title resource
  rather than an anti-aliased system-font title.

## 2026-10-16 iteration 2: save-path and completion gates

- Backdrop uniqueness is enforced only when a mutation writes a background.
  Editing/removing another layer on a shot with a conflicting backdrop cannot
  deadlock the authoring session. Review still reports all duplicate backdrop
  hashes.
- `set_opening` accepts `composition: { shotId }` for an already-authored
  animatic. When any animatic is saved, stale storybook/zero-duration scenes
  are removed so the saved sequence remains the planned animatic set.
- `create_opening_animatic_shot` refuses to erase an existing shot's layers
  unless `clearLayers: true` is explicit. Image quota failures remain visible
  and include unused dedicated-upload candidates; they never silently fall
  back to bundled painted stills.
- Review locks now require a caption, an independent subject layer, real
  motion, and camera keys per pixel shot, plus dither and flash coverage
  across the opening. The shared renderer preserves frequent source colours
  and uses ordered Bayer palette selection before integer upscale.
- Run 6 verified six native animatic shots, six distinct backdrop hashes, no
  stale zero-duration scenes, and a real player handoff with input changing
  the start-map position. Detailed shots still need neighbour-equality and
  hue-error refinement before visual parity with the crimson-oath reference.

## Fallen Star cinematic cold open (2026-10-24)

`src/project/flagship/fallenStarOpening.ts` is the reference for a movie-like opening built only from animatic primitives: six shots, 39 s, cut on the opening theme's bars (`cc0-bgm-rtp-flt-002`, measured 80 BPM — beat 750 ms, first beat 0.05 s; the catalog says 84). Hits (crack, impact, bell) sit on beats; SFX are shot-local `audioCues`, so they stay locked to the picture even when a shot's image load delays its clock.

- **Parallax sky.** The OPRN night panorama layers (`oprn-pano-night`, `-stars-far`, `-stars-near`) are seamless tiles; `tiled()` lays just enough copies for the camera's whole travel at each depth (`x ∈ [(cmin−240)·p, 480+(cmax−240)·p]`). Ground layers are the existing opening art with only the sky cut out (`town-ground`, `fall-ground`, `scripts/content/fallen-star-opening-cutouts.py` — flood the navy sky from the top edge, keep what connects to the bottom edge; no new pixels).
- **Camera-value trap.** The renderer treats camera `x`/`y` with `|x| ≤ width/4` or `|y| ≤ height/4` as offsets from the centre and adds half the stage. A tween that passes through that band jumps by half a screen. Keep world coordinates away from it (the falling-star tilt runs y 230→500 over a ground layer placed at y 400).
- **Follow cam.** `follow()` converts a desired screen path into world keys by sampling the camera track at 125 ms, so the fireball stays framed while the camera tilts 270 px; trail glows are the same path delayed.
- **Hide the boot stall.** On New Game the real engine boots during the first shot; in the shipped player under swiftshader the first ~2.3 s of the opening freeze. The first shot therefore holds black (screen-space fill) until 2.6 s and is three bars long.
- **Skip by tap.** The sequence's skip hint is now a `button` (`data-testid="cinematic-skip"`, `data-play-input-owner="play-ui"` so `installPlayPointerBlocker` lets it through); `pointerup` finishes the sequence as `skipped`, same as Esc.
- **No black ground at handoff.** `PlayScene.update` returned early while `initialPresentationPending`, so the tile window (`syncRuntimeTileWindow` / `syncTileCulling`) was first built after the cover faded — sprites appeared over a black ground for ~0.6 s. The pending branch now builds the visible tile window (visual only; no time, events or input advance).
- **Evidence.** `node scripts/qa/runtime/fallen-opening.capture.mjs <play.json> <out> --skip-test` boots the shipped `player.html`, starts a new game and writes `opening.webm`/`opening.mp4` (1x, trimmed to the opening), `timeline.json` and frames; `--skip-test` taps the skip button in a second boot and checks the map is reached. Playwright video has no audio.
