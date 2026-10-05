# Pokémon native motion QA

Completed: true. Checks: 39. Pages: 8/8. Errors: 0.

Inspect first: opening-page-3.png, opening-native-poses.webm, walking-down-idle.png, opening-reduced-motion.png.

Actual compiled standalone player and original project/assets. Isolated browser storage. HTML injects only the existing qaInstrumentation boot capability; no JS/CSS/project replacement. Opening uses native keys and real media playback. Walking preparation is separately recorded.

After genuine native New Game/Enter opening and startup dialogue, private browser QA telemetry boot permits teleport to original authored map corridors. Each direction may use its own original event-free three-tile lane, listed in plannedRoutes. Direction is injected into the actual Input, and the existing Phaser QA frame controller advances normal engine updates at17ms. No map, collisions, walk speed, moveDurationMs, walkFrame, walkTimer, sprite selection, inventory, story flags or persisted save is patched. This isolates gait rendering; it is not a natural route/campaign-completion claim.

No narration voice is authored. Real BGM continuity is checked; continuous voice across pages is not claimed.

- PASS authored confirm opening and actual pose strip exist
- PASS supplied canonical snapshot preserves exact motion metadata
- PASS real decoded canvas has native authored dimensions and stationary pose
- PASS page 1 retains drawn controller, music track and progressing clock
- PASS WASD leaves page, BGM play event identity and current voice intact
- PASS page 2 retains drawn controller, music track and progressing clock
- PASS held Enter repeat advances exactly one page
- PASS held Enter repeat does not restart BGM or current voice
- PASS page 3 retains drawn controller, music track and progressing clock
- PASS page 4 retains drawn controller, music track and progressing clock
- PASS page 5 retains drawn controller, music track and progressing clock
- PASS page 6 retains drawn controller, music track and progressing clock
- PASS page 7 retains drawn controller, music track and progressing clock
- PASS page 8 retains drawn controller, music track and progressing clock
- PASS at least four distinct actual drawn pose pixel frames
- PASS actual drawn-pose canvas clip is recorded
- PASS completion cleans canvas and BGM; detached pose clock stops
- PASS New Game reaches authored start map
- PASS native startup dialogue clears before walking
- PASS walking up uses actual0/1/2/1 gait and idle1
- PASS walking up displays three distinct drawn native poses
- PASS walking up preserves native16x32 inside transparent24x32 adapter
- PASS walking up preserves authored camera zoom
- PASS walking right uses actual0/1/2/1 gait and idle1
- PASS walking right displays three distinct drawn native poses
- PASS walking right preserves native16x32 inside transparent24x32 adapter
- PASS walking right preserves authored camera zoom
- PASS walking down uses actual0/1/2/1 gait and idle1
- PASS walking down displays three distinct drawn native poses
- PASS walking down preserves native16x32 inside transparent24x32 adapter
- PASS walking down preserves authored camera zoom
- PASS walking left uses actual0/1/2/1 gait and idle1
- PASS walking left displays three distinct drawn native poses
- PASS walking left preserves native16x32 inside transparent24x32 adapter
- PASS walking left preserves authored camera zoom
- PASS actual twelve hero poses share at most15 opaque colors
- PASS OS reduced motion freezes native neutral pose across Enter
- PASS native Skip disposes reduced pose and opening music
- PASS native browser and resource errors absent
