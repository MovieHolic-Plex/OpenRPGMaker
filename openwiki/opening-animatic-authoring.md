# Opening animatic authoring

## Ownership and format

`system.opening.scenes` accepts `kind: animatic` alongside existing text/image/video. `composition` is a strict, additive 2D timeline in `src/project/openingAnimatic.ts`; unknown fields and invalid times are rejected before mutation. Nested image/audio references participate in save/load validation. Disabled authored timelines survive normalization.

Times are shot-local integer milliseconds. Stage geometry is pixels; anchors are 0..1, rotation is degrees. Layers draw back to front. Camera and actor tracks hold endpoint values; destination key owns easing. Sprite-sheet frame keys select existing poses; automatic fps loops existing frames. These tools do not invent skeletal poses or generate 3D/FMV.

## Assistant surface

`src/editor/tools/openingAnimaticTools.ts` registers capabilities, research/reference vision, entry configuration, shot/layer creation and removal, property tracks, motion presets, camera tracks/shake, transitions/letterbox, timed audio cues, retiming, inspection, real frame previews, and actual independent layer generation. `get_animatic_capabilities` returns the complete nested contract with an example rather than bloating every tool declaration.

The real Pi runtime exposes this family for opening production. Generated layers use the real configured image provider: environment-only backgrounds; isolated actors/props/foreground use edge-connected magenta removal to produce PNG alpha. Failed removal is an error, not success. Existing transparent assets and crop/sheet poses are valid image layers. `preview_opening_reference` only loads bundled researched frames; those are research illustrations, not game resources. Provenance and observation limits live in [opening-reference-study.md](opening-reference-study.md).

Production evidence requires a plan, current final configuration review, and actual rendered time samples for every animatic after its final changes. Editing assets or a timeline invalidates prior preview evidence. A model-supplied completed flag cannot satisfy this. Native playback and canonical save/reload remain separate checks.

Research responses distinguish `conceptualRequirements` (study labels, never callable names) from `actualAuthoringTools` (registered tool names and field contracts). State approximations explicitly: there is no dedicated seamless scrolling layer; repeated scrolling uses authored tracks and duplicated layers. Native assistant dogfood revealed alias names being described as tools; the corrected response and a second actual UI query are recorded in `verify-shots/monster-opening-animatic-2026-10-03/`.

## Renderer and human editor

`src/player/openingAnimaticRenderer.ts` owns the shared absolute-time canvas draw function used in native sequence playback, model contact sheets, and the database scrubber. The editor supports silent play/pause, seek, layer selection, sampled property edits and key saving. Duration edits retime layer/camera/FX/audio times atomically; collapsed keys reject the change. Preview contact sheets preserve stage aspect and show actual timestamps.

Runtime starts its clock after images load. Sequence music remains outside shot DOM replacement. Shot cues use their own elements, synchronize metadata-delayed seeks against current elapsed time, and stop on next/Skip/abort/load error. Canvas state restores even when a crop fails. Reduced motion freezes positional/camera/particle/sprite motion and retains timing/opacity/narration. Cues and narration cannot be proved through a silent frame preview.

Entry transitions reveal from the stage background: cut/fade/wipe/iris/flash. They are not a cross-dissolve of the previous shot. Particle presets are seeded rain/snow/sparks/dust/stars. No live map-session mutation is used to author a montage.

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
