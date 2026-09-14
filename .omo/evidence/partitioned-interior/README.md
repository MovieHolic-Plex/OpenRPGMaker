# Compact divided house

Project: `rpg-zzu-house-template-gallery` (호수 마을).
Source space: `house-catalog:room:single`; place: `house-catalog:place:cottage`.
Example occurrence: `compact-interior:example:cottage`.

The 8×6 footprint remains unchanged. A five-cell solid partition separates the
living room/kitchen from the bedroom, leaving one doorway at local (4,3).
The entry moves to (3,5), and the table moves west. Eight furniture assemblies
and two partition arms are stored in the source design for subsequent AI builds.

- `interior-4x.png`: native tile render, pixelated 4× enlargement.
- `walkthroughs.json`: all 29 walkable cells connected; blocking the internal
  doorway disconnects the two rooms; real movement routes to all four areas.
- `supabase-proof.json`: CAS save and exact project reload.
- `final-remote-check.json`: independent remote read of maps and source definitions.
- `focused-tests.json`: 15 compiler/preservation tests, including stale interior
  plan metadata replacement after compilation.

The previous open-plan image is retained at `../compact-interior/interior-4x.png`.
Other project maps and the project start location are preserved.

Browser QA used Firefox after Chromium failed to load modules with
`ERR_NETWORK_CHANGED`. Editor verification passed with no page errors or writes.
Runtime QA passed 10/10 with no runtime errors. Its initial held-direction input
overshot by one cell; finite movement routes remove that automation race without
changing the game map, movement engine, or expected destinations.

A later independent read (`latest-remote-check.json`) observed another project
revision, while both authored maps, all four source objects, the space/place and
the complete interior tileset still matched exactly. No unrelated project changes
were overwritten.

`npm run gates -- --json` exited 0: app types/CSS/surface passed and checked-in
baseline regressions were empty. Vitest reported 23,207 passed / 508 failed
(existing baseline 557 failures). Compared to the immediately preceding run,
two assertions newly failed inside already-failing files; unchanged focused
recheck passed all 21 tests. The modified compiler suites passed all 15 tests
in both the focused run and the full gate. See `gates*.json`.
