# 작은 등대, 첫 친구 — original prologue score

Created 2026-10-03 specifically for the monster expedition opening. All melody,
harmony, bass, arpeggios and rhythms are newly composed. No recordings, borrowed
melodies, sample packs, external music or network downloads were used.

## Authorship and license

Composition and synthesis source: OPRN/Codex campaign content authoring session.
The composition, generated recording and accompanying source are dedicated to
the public domain under CC0-1.0, consistent with the existing campaign score.

Mathematical instrument algorithms adapt the project's original campaign
composer, read without modification:
`/home/main/z-project/rpg-zzu-tileset-harness/scripts/content/monster-expedition-music.py`
SHA-256: `117b678a5f52fee3a342a73b9c07436155d24f226cbd087de14604428638f53f`.
Its bell FM/decay, vibrato, band-limited triangle/pulse and small synthesized
kick provide the same timbre family. The standalone source includes all helpers
and requires no imported project module or runtime dependency.

## Composition / timing

120 BPM, D major, 18 seconds of scene score plus 0.3 seconds of boundary slack.

| Time | Scene | Score |
| --- | --- | --- |
| 0–4 s | Warm small bell and sparkles | New D–F#–A / E–F#–D bell theme over Dadd9 then Gmaj7/D, triangle bass; no loud percussion. |
| 4–9 s | Lighthouse dims | Rhythmic breathing spaces, restrained B minor colour, then quiet A7 suspension; hollow/bell notes, soft bass; no drums or surprise hit. |
| 9–18 s | Laboratory / starter invitation | New flute answer F#–E–D / A–F#–G / B–A–F# over Dadd9 → Gmaj7 → Bm7 → A7 → Dadd9, light pulse arpeggios and subdued kick. |
| 18–18.3 s | Boundary allowance | Silent slack after the score fades to zero at 18 s; provides a short breath before the opening D phrase repeats if input is delayed. |

The last Dadd9 cadence starts at 17 s, with a smooth cosine-squared fade from
17.5 to 18 s. Normal teardown at 18 s therefore falls after the fade. If the
single HTMLAudio remains in loop mode, D major at both ends and the short breath
connect the restart; it intentionally repeats the complete three-scene cue.

## Files / integration

- `prologue.ogg`: Vorbis, 22,050 Hz mono, 18.3 seconds, encoded with installed ffmpeg.
- `payload.json`: standalone uploaded asset payload, id `mx_audio_prologue`, kind `music`, actual `data:audio/ogg;base64,...` bytes.
- `compose-prologue.py`: complete deterministic score and renderer; run `python3 compose-prologue.py` from this folder.
- `inspection.json`: actual ffmpeg decode, ffprobe duration, measured scene RMS/peaks, nonsilence intervals, clipping and boundary values.
- `first-generation.json` / `second-generation.json`: consecutive complete generation measurements; identical OGG hash proves byte-stable regeneration in this environment.

The payload uses `kind: "music"`, matching existing campaign uploaded assets
and the root author's confirmed integration contract. The recording's data URL
is already self-contained for portable export.

## Verification scope

The encoded file was generated and decoded twice using installed numpy 2.4.4
and `/usr/bin/ffmpeg`; both outputs had identical hashes. Decoded samples match
the source duration exactly. Clipping and first/last sample discontinuity were
measured offline; this task does not claim subjective listening, in-player
mixing, or full opening video verification. Root owns the shipped integration
and video QA. No source files, original fourteen tracks, canonical project
store, tests, gates or git state were changed.
