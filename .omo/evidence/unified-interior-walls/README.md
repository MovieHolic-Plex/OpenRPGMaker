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
