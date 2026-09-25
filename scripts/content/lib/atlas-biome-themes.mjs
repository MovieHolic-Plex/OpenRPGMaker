// How each atlas biome is dressed after its layout (author-atlas-biomes.mjs): the hero pieces planted first as clumps,
// the fill (lib/outdoor-kit.mjs fill: trees = the biome's tree pieces, bushes / flowers / rocks = its 1×1 pieces), the
// leafless groves (badlands, tundra, blight), water / sky decorations, cliff vines and the blob grounds that close what
// is left of the emptiness gate. Tile numbers are resolved from the sheet manifest by piece id (tileOf).
import { tileOf } from "./atlas-biome-kit.mjs";

const T = (b, ...ids) => ids.map((id) => tileOf(b, id));
const P = (k, ...ids) => ids.map((id) => `${k}/${id}`);

export function theme(b) {
  const k = b.kind;
  switch (k) {
    case "jungle": return {
      canopy: { count: [3, 5], r: [4, 7] }, bigPatches: [0, 1],
      hero: { ids: ["giant-tree-1", "giant-tree-2"], count: [3, 5], per: [1, 3] },
      fill: { palette: { trees: 3.4, grass: 2.2, bushes: 1.6, flowers: 0.35 }, trees: P(k, "giant-tree-2", "jungle-tree", "jungle-tree", "broadleaf"), treeCount: [3, 5], bushes: T(b, "fern-1", "fern-2"), flowers: T(b, "orchid"), flowerCap: 6, bushSize: [4, 7], groves: 8, groveSq: 6, smallBushShare: 0 },
      vines: { ids: ["vine-1", "vine-2"], count: [3, 6] }, grounds: ["leaf-litter"], water: null,
    };
    case "swamp": return {
      canopy: { count: [1, 3], r: [4, 6] },
      hero: { ids: ["mangrove-2", "mangrove-1"], count: [3, 5], per: [2, 3], nearWater: 3 },
      fill: { palette: { trees: 2.4, grass: 2.6, bushes: 1.6, flowers: 0.7 }, trees: P(k, "mangrove-1", "mangrove-2", "mangrove-1"), bushes: T(b, "swamp-bush", "reeds-2"), shoreBushes: T(b, "reeds-1", "reeds-2"), shoreR: 2, flowers: T(b, "marsh-flower"), groves: 4, smallBushShare: 0 },
      water: { ids: ["lily-1", "lily-2"], count: [5, 9], reach: [1, 3] }, grounds: ["mud"],
    };
    case "mushroom": return {
      canopy: { count: [1, 2], r: [4, 6] },
      hero: { ids: ["mushroom-blue", "mushroom-red"], count: [3, 5], per: [1, 3] },
      fill: { palette: { trees: 3, grass: 1.2, bushes: 1.5, flowers: 1.3 }, trees: P(k, "mushroom-red", "mushroom-purple", "mushroom-gold", "mushroom-purple"), bushes: T(b, "shrooms-1", "shrooms-2"), flowers: T(b, "glow-caps", "glow-caps-2"), groves: 3, smallBushShare: 0 },
      landmark: { id: "fairy-ring" }, grounds: ["glow-moss"], water: null,
    };
    case "crystal": return {
      hero: { ids: ["giant-cyan", "spire-violet"], count: [2, 4], per: [1, 2] },
      fill: { palette: { trees: 2.6, grass: 0.8, bushes: 1.7, flowers: 1, rocks: 0.6 }, trees: P(k, "cluster-pink", "cluster-cyan", "spire-violet"), bushes: T(b, "crystal-violet", "crystal-cyan", "crystal-pink", "crystal-clear"), flowers: T(b, "shards", "shards-cyan"), rocks: T(b, "pale-rock"), groves: 0, smallBushShare: 0 },
      grounds: ["crystal-vein"], water: null,
    };
    case "badlands": return {
      hero: { ids: ["red-rock"], count: [3, 5], per: [1, 3] },
      fill: { palette: { stands: 2.2, bushes: 1.2, rocks: 1 }, bushes: T(b, "sagebrush-1", "sagebrush-2"), rocks: T(b, "red-boulder-1", "red-boulder-2"), rocksAnywhere: true, groves: 0, standsAsSpots: true, stands: ["마른나무"], standCount: [2, 4], spotCap: 26,
        fillGate: { maxSq: 8, screen: 0.66 }, smallBushShare: 0 },
      bare: true, grounds: ["cracked-red", "red-gravel"], noForest: true, noForestEdge: true, water: null,
    };
    case "savanna": return {
      hero: { ids: ["acacia-1", "baobab", "acacia-2", "kopje"], count: [3, 5], per: [1, 2] },
      fill: { palette: { trees: 0.7, grass: 3.8, bushes: 0.8 }, trees: P(k, "acacia-2", "acacia-1", "acacia-2"), treeCount: [1, 2], bushes: T(b, "dry-bush-1", "dry-bush-2"), groves: 0, smallBushShare: 0, growCap: 90 },
      grounds: ["dry-dust"], landmark: { id: "termite" }, noForest: true, water: null,
    };
    case "taiga": return {
      canopy: { count: [3, 5], r: [4, 7] },
      hero: { ids: ["spruce-2", "spruce-1"], count: [4, 6], per: [2, 3] },
      fill: { palette: { trees: 3.5, grass: 0.8, bushes: 0.9, rocks: 0.6 }, trees: P(k, "spruce-1", "spruce-2", "spruce-3"), bushes: T(b, "taiga-bush", "stump"), rocks: T(b, "snow-rock"), groves: 5, smallBushShare: 0 },
      grounds: ["snowdrift"], water: null, freeze: 0.5,
    };
    case "tundra": return {
      hero: { ids: ["frost-rock"], count: [2, 3], per: [1, 2] },
      fill: { palette: { stands: 1.3, bushes: 1.4, rocks: 0.45, grass: 1.4 }, bushes: T(b, "dwarf-shrub-1", "dwarf-shrub-2"), rocks: T(b, "lichen-rock-1", "lichen-rock-2"), rocksAnywhere: true, groves: 0, standsAsSpots: true, stands: ["마른나무"], standCount: [2, 3], spotCap: 16,
        fillGate: { maxSq: 7, screen: 0.6 }, smallBushShare: 0 },
      bare: true, grounds: ["permafrost", "snow-patch"], noForest: true, water: null, freeze: 0.95,
    };
    case "blight": return {
      canopy: { count: [2, 3], r: [4, 6] },
      hero: { ids: ["obelisk"], count: [1, 2], per: [1, 1] },
      fill: { palette: { stands: 2, bushes: 1.4, rocks: 0.8, grass: 0.7 }, bushes: T(b, "thorns-1", "rot-shrooms"), rocks: T(b, "dark-rock", "blood-crystal"), rocksAnywhere: true, groves: 2, standsAsSpots: true, stands: ["마른나무"], standCount: [2, 4], spotCap: 26,
        fillGate: { maxSq: 7, screen: 0.6 }, smallBushShare: 0 },
      bare: true, grounds: ["blight-veins"], pools: "poison-pool", water: null,
    };
    case "skyisle": return {
      canopy: { count: [0, 1], r: [3, 5] },
      hero: { ids: ["wind-crystal"], count: [1, 3], per: [1, 1] },
      fill: { palette: { trees: 3, grass: 1.8, bushes: 1.2, flowers: 1.5 }, trees: ["tree", "big-oak", "round-bush", "small-bush"], bushes: T(b, "sky-bush"), flowers: T(b, "wind-flower"), groves: 3, smallBushShare: 0.4 },
      water: { ids: ["cloud-1", "cloud-2", "cloud-3", "float-rock-1", "float-rock-2"], count: [6, 10], reach: [2, 12], per: [1, 2], group: 4 }, grounds: ["meadow"],
    };
    case "tropical": return {
      canopy: { count: [1, 2], r: [4, 6] },
      hero: { ids: ["palm-1", "palm-2"], count: [3, 5], per: [2, 3], nearWater: 5 },
      fill: { palette: { trees: 2.8, grass: 1.8, bushes: 1.4, flowers: 1 }, trees: [...P(k, "palm-1", "palm-2"), "tree", "round-bush"], bushes: T(b, "hibiscus", "tropic-bush"), flowers: [348], rocks: T(b, "beach-rock"), groves: 4, smallBushShare: 0.3 },
      water: { ids: ["coral-1", "coral-2", "coral-3", "reef"], count: [5, 9], reach: [2, 6] }, grounds: ["white-sand"], decals: T(b, "shell", "starfish"),
    };
  }
  throw new Error("No theme " + k);
}

// Border zone dressing: which neighbour pieces fill the zone (ids on this sheet, prefixed nb-).
export function zoneTheme(b) {
  const nb = Object.values(b.pieces).filter((p) => p.neighbour);
  const trees = nb.filter((p) => p.h > 1 && p.w > 1).map((p) => p.id);
  const smalls = nb.filter((p) => p.h === 1 && p.w === 1 && p.tiles[0] >= 0 && p.roles[0] === "S").map((p) => p.tiles[0]);
  const decals = nb.filter((p) => p.h === 1 && p.w === 1 && p.tiles[0] >= 0 && p.roles[0] === "W").map((p) => p.tiles[0]);
  return { trees, smalls, decals };
}
