# Connected structural interior walls

Project: `rpg-zzu-house-template-gallery` (호수 마을).
Space: `house-catalog:room:single`; place: `house-catalog:place:cottage`.
Occurrence: `compact-interior:example:cottage`.

The 8×6 floor now describes two structural room rectangles and one doorway.
The native room harness generates the exterior wall and partition in one pass,
including ceiling shaping and the two-row cream face above the opening. The
north partition now joins the northern ceiling; the south arm joins the southern
shell with matching borders. Eight furniture placements remain; standalone
partition objects are no longer placed.

- `interior-4x.png`: native editor render, pixelated 4× enlargement.
- `supabase-proof.json`: CAS save and exact project reload.
- `walkthroughs.json`: all 29 passable floor cells connected, only one doorway
  connects the two rooms, and the northern ceiling is continuous.
- `focused-tests.json`: 47 tests passed, including serialization/recompilation,
  old single-room compatibility, shaped ceiling and blocked-door separation.

The earlier disconnected partition rendering remains in
`../partitioned-interior/interior-4x.png` for comparison.

Firefox editor QA loaded the remote project and confirmed that the authored space
and saved map matched; no page errors or writes. Dedicated player QA passed 10/10
walking beats with no runtime errors. `final-remote-check.json` independently
verified the saved maps and source definitions with the same project revision.

`ai-tool-tests.json`: 33 tests passed, including actual registered
`upsert_spatial_design` accepting `interiorLayout`, followed by the regular
canonical tool suite. The optional JSON schema field documents floor coordinates,
shared partition ownership and doorway semantics for the AI author.

A later independent read (`latest-remote-check.json`) observed a different whole
project revision while both authored maps, source definitions and the interior
tileset still matched. Other project work was not overwritten.


Full gates completed with exit 1: app types, CSS and surface passed; all 77 tests
in the changed layout/space/place/tool suites passed. Overall Vitest reported
23,210 passed / 509 failed. Compared with the immediately preceding run, the AI
recovery test and geography browser test differed. The AI recovery file passed
all six tests on recheck. `spatialGeographyRaster.browser.test.ts` retained a
30-second `html[data-ready='1']` timeout (initial page in the full run, fault page
in the first recheck) and still failed alone. This also occurred in the earlier
integrated compact-interior gate evidence; no geography code was changed here.
The unresolved geography browser failure is reported, not counted as a pass.
See `gates.json`, `gates-comparison.json`, `gates-recheck.json`, `browser-recheck.json`.
A final app typecheck after adding AI schema support also exited 0.
