# Original symbolic music authoring

The assistant can compose actual PCM WAV, rather than merely choose a catalog
track. `src/project/musicScore.ts` validates and renders an original score:
quarter-note beat offsets, note lengths, MIDI pitch, velocity, gain and stereo
pan. Ten voices include pulse/triangle/flute/pad/bell and synthetic percussion.
This is local instrumental synthesis, not studio orchestration or vocal synthesis.

Tools in `musicAuthoringTools.ts`: `get_music_composer`, `compose_music`,
`get_music_score`, `set_game_audio`. IDs use `composed_music_` to avoid packaged
resolver precedence. Replacement requires explicit `replace:true`. WAV is stereo
PCM16/22050Hz, peak normalized to0.78. Stored score metadata includes actual WAV
SHA256; reads reject stale bytes. Generic resource replacement/deletion invalidates
score provenance. Bounds: 8 tracks,2048 notes,24 simultaneous voices including
release tails,90 seconds,32 scores and48MB total generated WAV bytes. Silent
tracks/notes are skipped. Percussion has onset/end envelopes. Loop release tails
wrap; reported joinStep is a measurement, not a promise of seamless browser loops.

Bindings validate kind, resolver, supported audio MIME/header, targets and role
before mutation. MIDI, empty uploads and orphan profiles are rejected. Actual
remote media/network playback still needs native audition. Supported roles:
title/opening/field-default/battle-default/victory/defeat/cursor/confirm/cancel/maps.
Menu cues live in `meta.oprnMenuSounds`; runtimeJuice resolves them with existing
session override precedence. Existing trainer-event/M2 battle cues override the
battle default and require their own authored changes.

Pi tool replies contain the score and numeric measurements, not audible model
input. The assistant must never claim to have heard a score. Humans audition
registered WAVs in the editor picker or exported player. Native audio decode,
playhead continuity, loop behavior and listening are separate evidence.
