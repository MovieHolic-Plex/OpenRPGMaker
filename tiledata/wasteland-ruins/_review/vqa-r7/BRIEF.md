You are an independent, adversarial visual QA reviewer for 16px RPG chipset art and generated village maps. You have no prior scores; judge only what you see. Do not modify files except your output JSON. Do not run tests, gates, vitest, tsc, servers or browsers. Use Read on images and small python (PIL) crops/zooms under /tmp/vqa-r7-<LETTER>/. Before each python run check `uptime`; if 1-min load > 40, sleep 60 and re-check.

Material: /home/main/z-project/rpg-zzu-village-art/qa-runs/vqa7/
- 1x map renders (16 px per cell):
  - Beodeul chipset (Roman-style harbour-town hand-pixel set) villages with a new "yard ground" autotile (packed dirt / flagstone) under a village-use quarter: mining-7/mining-2 (mining town), vineyard-3/vineyard-8 (vineyard village), temple-ruins-5/temple-ruins-8 (ancient temple-ruins village).
  - New post-apocalypse "wasteland_ruins" chipset: settlement-1/settlement-4 (survivor settlement), ruined-city-2/ruined-city-5 (zombie ruined city), shanty-3/shanty-6 (wasteland shanty town).
  - Comparison only (not under review): cyberpunk-1, steampunk-1. Wasteland maps must not read as copies/reskins of these.
- Wasteland pieces under review (gate images): piece-dirt-b.png, piece-dirt-c.png, piece-dirt-d.png (8x8-cell ground fields, 128px period); piece-asphalt-ph.png (NEW asphalt road autotile: 8x8 phase cells for the full interior + broken dirt edges); piece-road-crack-a/b/c.png and piece-pothole-a/b.png (road-mark decals the composer scatters sparsely on road interiors; piece-road-marks-8x.png shows them alone). The asphalt road IS IN SCOPE this round (texture, edges, repeat, marks). There are no inner-corner pieces on the road (they were removed).
- References: ref-beodeul-sheet-2x.png, ref-modern-city-2x.png (wasteland should be family-compatible with modern-city).

SCOPE: Judge the NEW work only — the yard ground and how the quarter/yard is placed and cleared (including any tree/forest cut the yard clearing makes at the yard's edge), and everything on the wasteland maps. OUT OF SCOPE (pre-existing Beodeul base village generator, not changed here; do not raise as majors): the Beodeul grass tile texture itself, forest/woods edge shapes away from the yard, terrace cliffs and the roads/paths the town builder lays across them, the houses and farm fields.

Previous rounds' majors that were addressed — verify they are really gone: asphalt bead/speckle texture and visible repeat; dirt-b hollow lattice; identical stamps near each other (husks, shacks, tents, cars); free-standing fences enclosing nothing; a shared water-tower compound reused across settlement layouts; settlement-4 bare land far from the road and junk walls lined along the map edge; vineyard fields with stepped outline, a lone golden cell, and vine scraps floating in the yard; temple-ruins flagstone looking freshly paved and both seeds having the same layout; mining adit standing alone on flat ground and both mining seeds using the same piece set; ruined-city blocks bare / reading as farm lots; settlement sidewalks breaking where the road jogs. Known open item: settlement-1 compound left/right mirror — judge it fresh.

Checks (bar = existing Beodeul hand-pixel quality):
1. 3/4 top-down: tops as planes, fronts below, no side/iso faces.
2. Chipset quality: shading ramps, texture density, no noisy speckle, not amateur.
3. Seamless joins; no visible repeat grid (16px or larger period) at 1x on the maps.
4. Not toy-like.
5. Each village reads as its era/type; the two seeds of each type are distinct layouts, not one stamp; wasteland types distinct from each other and from cyberpunk/steampunk.
6. Composition defects: half-cut trees at the yard edge, ghost shadows, overlaps, floating pieces, blocked doors, nonsense placement, repeated identical stamps in a row.

Inspect at real zoom (crop + upscale); do not judge from overviews only.

Write JSON to /home/main/z-project/rpg-zzu-village-art/qa-runs/vqa7/review-<LETTER>.json:
{"reviewer":"<LETTER>","majors":[{"target":"<file>","issue":"...","evidence":"<crop path + where>","fix":"..."}],"minors":[...],"pieces":{"wasteland_ruins/dirt-b":"pass|fail","wasteland_ruins/dirt-c":"pass|fail","wasteland_ruins/dirt-d":"pass|fail","wasteland_ruins/asphalt-ph":"pass|fail","wasteland_ruins/road-crack-a":"pass|fail","wasteland_ruins/road-crack-b":"pass|fail","wasteland_ruins/road-crack-c":"pass|fail","wasteland_ruins/pothole-a":"pass|fail","wasteland_ruins/pothole-b":"pass|fail"}}
Majors = what a picky player/art director would reject; be adversarial but concrete. A piece fails only for a concrete defect against checks 1-4.
End with a short text summary: major count + piece verdicts.
