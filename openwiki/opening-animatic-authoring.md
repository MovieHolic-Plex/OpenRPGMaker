# Opening animatic authoring

## Ownership and format

`system.opening.scenes` accepts `kind: animatic` alongside existing text/image/video. `composition` is a strict, additive 2D timeline in `src/project/openingAnimatic.ts`; unknown fields and invalid times are rejected before mutation. Nested image/audio references participate in save/load validation. Disabled authored timelines survive normalization.

Times are shot-local integer milliseconds. Stage geometry is pixels; anchors are 0..1, rotation is degrees. Layers draw back to front. Camera and actor tracks hold endpoint values; destination key owns easing. Sprite-sheet frame keys select existing poses; automatic fps loops existing frames. These tools do not invent skeletal poses or generate 3D/FMV.

## Assistant surface

`src/editor/tools/openingAnimaticTools.ts` registers capabilities, research/reference vision, entry configuration, shot/layer creation and removal, property tracks, motion presets, camera tracks/shake, transitions/letterbox, timed audio cues, retiming, inspection, real frame previews, and actual independent layer generation. `get_animatic_capabilities` returns the complete nested contract with an example rather than bloating every tool declaration.

The real Pi runtime exposes this family for opening production. Generated layers use the real configured image provider: environment-only backgrounds; isolated actors/props/foreground use edge-connected magenta removal to produce PNG alpha. Failed removal is an error, not success. Existing transparent assets and crop/sheet poses are valid image layers. `preview_opening_reference` only loads bundled researched frames; those are research illustrations, not game resources. Provenance and observation limits live in [opening-reference-study.md](opening-reference-study.md).

Production evidence requires a plan, current final configuration review, and actual rendered time samples for every animatic after its final changes. Editing assets or a timeline invalidates prior preview evidence. A model-supplied completed flag cannot satisfy this. Native playback and canonical save/reload remain separate checks.

## Renderer and human editor

`src/player/openingAnimaticRenderer.ts` owns the shared absolute-time canvas draw function used in native sequence playback, model contact sheets, and the database scrubber. The editor supports silent play/pause, seek, layer selection, sampled property edits and key saving. Duration edits retime layer/camera/FX/audio times atomically; collapsed keys reject the change. Preview contact sheets preserve stage aspect and show actual timestamps.

Runtime starts its clock after images load. Sequence music remains outside shot DOM replacement. Shot cues use their own elements, synchronize metadata-delayed seeks against current elapsed time, and stop on next/Skip/abort/load error. Canvas state restores even when a crop fails. Reduced motion freezes positional/camera/particle/sprite motion and retains timing/opacity/narration. Cues and narration cannot be proved through a silent frame preview.

Entry transitions reveal from the stage background: cut/fade/wipe/iris/flash. They are not a cross-dissolve of the previous shot. Particle presets are seeded rain/snow/sparks/dust/stars. No live map-session mutation is used to author a montage.

## Entry timing

`configure_opening_entry` sets one sequence location: `new-game` (default), `before-title` (first cold title visit after resume/test precedence), or `attract` (idle title demo with configurable initial/repeat wait). This is one authored sequence; it does not hold three independently authored tracks simultaneously. Non-New-Game modes do not replay on New Game. Any non-repeated key dismisses before-title/attract without activating the underlying title menu. Mouse input continues to follow the player's keyboard ownership contract.

Attract owns its timer/listeners through shell teardown, resets on title input, and waits while title confirmation/menus/document visibility prevent playback. Same requested title track keeps the existing audio identity/playhead. A different authored track stops title music and restarts it on handoff; no opaque pause/resume token currently exists, so different-track playhead preservation is not claimed.

## Functional verification

Use focused browser renderer probes, real Pi production and native exported `player.html` evidence. Do not run Vitest/gates/full typecheck without this session's explicit authorization. Inspect saved project via the existing host API, CAS save and fresh connection reload; never modify a live host SQLite directly.
