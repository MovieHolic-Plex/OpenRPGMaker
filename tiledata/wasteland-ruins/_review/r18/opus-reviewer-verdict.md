# Fresh Opus adversarial reviewer — r18 ground pieces (2026-10-23)

**Verdicts: 8 PASS, 3 FAIL.** The three failures are dirt-a, asphalt and track.

**1x dirt field:** I don't see a 64px grid or tile seams at 1x or 2x. The pebble clusters and blotches don't line up into a lattice. It reads as continuous ground.

1. **dirt-a: FAIL.** It nearly passes, but the light patches have ragged 1px edges. Across the top-left quadrant and most of the field this reads as fine static next to the calm Beodeul grass base. The small dark 2px "dash" marks also sit at a near-even spacing.
   - Fix: grow each light patch into a solid 2-4px body and keep at most one 1px edge pixel per patch. Thin the dash marks by about half and cluster them.
2. **dirt-b: PASS.** The damp hollows are soft, darker blotches that sit in the ground. They read as damp spots, not holes.
3. **dirt-c: PASS.** The gravel and rust clusters are well clumped. The rust red is a little hot but acceptable.
4. **dirt-d: PASS.** The dry-grass tufts read well. Minor: there is a stray, isolated dark-green 2px dash near the top right (about x280, y65 at 4x). Remove it.
5. **asphalt: FAIL.** The body is not calm. It is a high-contrast, blocky three-value mottle that reads as cobble or camouflage, not asphalt. In the right block a small dark "hook" speck repeats at the same spot in every 16px tile (two clear columns at the mid rows), so the 16px repeat shows. The two repair patches are also identical squares stacked one above the other. The broken lip is better, but it is a continuous dark 1px contour with even teeth all round, which is still an outline.
   - Fix: flatten the body to two close values with large soft variation. Keep the light aggregate in sparse 2px clusters at different positions per variant. Make the repair patches different sizes and offset them. Break the lip with gaps and a few detached chunks.
6. **track: FAIL.** The track is almost invisible. In the scene's bottom row under the stalls it can't be told apart from the dirt. In the sample its interior is a strict lattice of comma "footprints" (right block), which reads as wallpaper, not foot traffic. I see no wheel ruts.
   - Fix: raise the track one value step above the dirt and keep it calm. Add two faint parallel rut lines running along the path and only a few irregular footprints. Feather the edges with 2-3px broken lighter clumps.
7. **puddle: PASS.** The dark rim is only on the far edge, the wet-dirt halo is there, and there is no black outline. It reads as shallow water, not a hole. Polish: the top navy rim is a bit strong, and the highlight is broken dashes rather than one band. Also drop the single-pixel nub on the bottom edge.
8. **rubble-b: PASS.** It sits well on the new dirt.
9. **rubble-c: PASS.**
10. **weeds-a: PASS.**
11. **weeds-b: PASS.**
