// Fill settings of the outdoor maps: emptiness gates and the natural cover per sheet / theme.
// Emptiness gate (/tmp/oprn-qa/FILL-RULES.md): town/scene ≤4 & ≤40%, field ≤5 & ≤50%; aim a little under.
export const GATES = { town: { maxSq: 4, screen: 0.34, treeCount: [3, 6] }, field: { maxSq: 5, screen: 0.44, treeCount: [3, 7] } };
// Plain ground for the checker: grass 240 + textures, paving bodies (cobble 190, stone 307, gravel 310, dirt 421, sand 424,
// snow 67). Tall grass E/F/G (243–335, 1124–1190) is fill.
export const PLAIN_IDS = "240,1140-1147,190,307,310,421,424,67";
// Natural cover per sheet / theme: weights of cluster kinds and the pieces they use. Tall grass only on the green forest
// sheet (the autumn copy is dark brown and reads as mud; sand, snow and ash have none)
// No undergrowth, dark bush or one-per-tile flowers (FILL-RULES 금지 재료); rocks only at a
// cliff, shore or forest edge.
export const THEME_FILL = {
  forest_harmony: { palette: { grass: 2.5, trees: 3, bushes: 1.2, flowers: 1.4, rocks: 0.3 } },
  forest_harmony_autumn: { palette: { trees: 3.5, stands: 0.5, bushes: 1.4, flowers: 0.8, rocks: 0.4 }, bushSize: [3, 4], smallBushShare: 0.85, stands: ["마른나무"] },
  // Desert and ash (user 2026-09-25): no leafy tree stamps (960–1123) or canopy. Fill reserves 1×2 spots, bareGroves turns
  // them into leafless-tree groves (lib/bare-trees.mjs). The fill places no rock or cactus clumps (「돌·선인장이
  // 너무 많다」) and stops at the loose `fillGate`, and `ground` closes the real gate with the climate ground (OutdoorMap.climateGround:
  // dunes / ripples / cracked earth, lava plates / cracks) instead of more rocks and cacti.
  forest_harmony_desert: { palette: { stands: 2.6, flowers: 0.8 }, flowersNearWater: 7, bushes: [769], shoreBushes: [770], bushSize: [3, 5], rocks: [537, 29], rockSize: [3, 4], groves: 0, standsAsSpots: true, stands: ["마른나무"], standCount: [1, 3],
    fillGate: { maxSq: 8, screen: 0.66 }, ground: "desert", groundOpts: { duneSeas: 1, duneShare: 0.6 }, groveRockChance: 0.3 },
  forest_harmony_snow: { palette: { trees: 3.5, stands: 1.2, bushes: 0.8, rocks: 0.5 }, bushes: [289], rocks: [537, 29], rockSize: [3, 5], stands: ["침엽수"], trees: ["tree", "round-bush", "small-bush"] },
  // Ash: no dry-twig clumps (740 read as evenly strewn debris), no rock scree (「화산도 돌이랑 풀을 너무 많이」) — copses of
  // bare-tree spots from the fill, then lava plates, cracks and a lava pool from `ground`.
  forest_harmony_volcano: { palette: { stands: 3 }, rocks: [537, 29], rockSize: [3, 4], groves: 0, standsAsSpots: true, stands: ["마른나무"], standCount: [3, 5], spotCap: 70,
    fillGate: { maxSq: 8, screen: 0.66 }, ground: "volcano", groveRockChance: 0.3 },
  swamp: { palette: { grass: 3.5, trees: 2.5, bushes: 1.5, flowers: 0.5 }, trees: ["round-bush", "small-bush", "tree"] },
  ruins: { palette: { grass: 3, trees: 2.2, bushes: 1.5, flowers: 0.5, rocks: 1 }, rocks: [29, 537] },
  battlefield: { palette: { trees: 3, stands: 1.6, bushes: 1.4, rocks: 0.6 }, bushSize: [3, 4], smallBushShare: 0.85, rocks: [29, 537], rockSize: [3, 5], stands: ["마른나무"], standCount: [3, 5] },
  graves: { palette: { grass: 2.5, trees: 2.5, bushes: 1.5, flowers: 0.4, rocks: 0.6 }, trees: ["tree", "round-bush", "small-bush"] },
  meadow: { palette: { grass: 2, trees: 2, bushes: 1, flowers: 2.2 } },
};
