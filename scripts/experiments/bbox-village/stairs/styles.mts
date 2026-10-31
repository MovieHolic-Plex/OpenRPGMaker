// relief style -> the beodeul ground/road kits its maps use (beodeulVillage.ts THEMES, dungeonKit reliefPlan.ts)
// kit ids are 3x3 beodeul ground kits (centre tile tiled); grass-steps uses the beodeul materials through fill_region instead.
export const STYLE_GROUND: Record<string, { ground: string; road: string; stairRoad?: string; material?: true }> = {
  "grass-steps": { ground: "버들항 풀밭", road: "버들항 모랫길", stairRoad: "버들항 길 포석", material: true },
  "sand-steps": { ground: "bd-pick-desert-oasis-ground-sand", road: "bd-pick-desert-oasis-ground-road" },
  "snow-steps": { ground: "bd-pick-snowfield-ground-snow", road: "bd-pick-snowfield-ground-road" },
  "peat-steps": { ground: "bd-pick-swamp-stilt-ground-mud", road: "bd-pick-swamp-stilt-ground-path" },
  "cave-steps": { ground: "bd-pick-mining-valley-ground-road", road: "bd-pick-mining-valley-ground-road" },   // the cave dungeon floor (dungeonKit beodeul/profiles.ts cave.floor.base); a cave climb starts from the floor itself
};
