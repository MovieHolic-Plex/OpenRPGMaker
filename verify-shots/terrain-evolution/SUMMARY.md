# Terrain evolution evidence

All six additions were exercised through editor controls or the exported player. These are isolated QA maps, not a replacement of the user's project.

- Native geometry selection, point dragging and height/road/water options: editor-2x.mp4, 01-reedit.png.
- Successive heights and narrow road ramps: 02-ramps.png, observations.json (`multi.reachable`).
- Erosion, smoothing, corner finishing, depth colors and south-facing waterfall: 03-waterfall.png, 04-finish.png.
- An impassable wall with one door: closed=false, switch-open=true, body 3×3=false, NPC=false, ignoring event occupancy=true. route-state-2x.mp4, 13/14/15-route-*.png. The earlier large demo has alternate paths and only illustrates the inspection controls.
- Real tileset thumbnail, file import and reuse in a second blank project: 06-library.png, 11-library-other-project.png, observations.json (`reuse`). The library is shared across projects in the same browser; files move stamps across devices with compatible tilesets.
- Author toggles and editor preview: 07-vision-on.png, 08-vision-off.png.
- Shipped player.html and export store shim: runtime-2x.mp4. Read RUNTIME-SUMMARY.md first; inspect 09-runtime-vision.png and 12-runtime-high-ground.png. Real skill projectile stopped at elevated terrain; page errors=0.
- SQLite save, close and reload: sqlite-roundtrip.json. Project 9b0e46c6-758f-44f7-afa2-5603d5c44996, revision 2, geometry/options/water/ramps/gameplay/stamp equivalence verified.

Validation: production editor/player/Electron builds and syntax diagnostics. No vitest, gates, full typecheck or stash were run, per AGENTS.md. Contract test source is included for the supervisor.

Capture commands are in scripts/capture/capture-terrain-evolution*.mjs, capture-terrain-route-state.mjs, capture-terrain-library-reuse.mjs and save-terrain-evolution-fixture.mjs. The final MP4 concatenates the three genuine recordings at 2× speed.
