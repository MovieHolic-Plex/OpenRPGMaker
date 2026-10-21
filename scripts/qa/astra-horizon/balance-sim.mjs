// 스타터 3종 × 라이벌·도로·관장·신전·리그 모의전 표. node scripts/qa/astra-horizon/balance-sim.mjs [n]
import { withTsModule } from "../../ontology-ts-loader.mjs";
const n = Number(process.argv[2] ?? 60);
await withTsModule("scripts/qa/astra-horizon/balanceSim.ts", "astra-sim.mjs", async (mod) => {
  const fights = [
    { label: "rival Lv5 solo", troopId: "mx_troop_mx_map_lab_rival", level: 5 },
    { label: "meadow trainer_2 Lv7 solo", troopId: "mx_troop_mx_map_meadow_trainer_2", level: 7 },
    { label: "gym leader Lv7 solo (10-minute path)", troopId: "mx_troop_mx_map_grove_gym_leader", level: 7 },
    { label: "gym leader Lv8 + pipbug Lv5 (trial catch, no extra fights)", troopId: "mx_troop_mx_map_grove_gym_leader", level: 8, partner: ["mx_species_pipbug", 5] },
    { label: "gym leader Lv9 + pipbug Lv6 (journey)", troopId: "mx_troop_mx_map_grove_gym_leader", level: 9, partner: ["mx_species_pipbug", 6] },
    { label: "temple Lv10 + pipbug Lv8", troopId: "mx_troop_mx_map_observatory_boss", level: 10, partner: ["mx_species_pipbug", 8] },
    { label: "league Lv12 + pipbug Lv8", troopId: "mx_troop_mx_map_league_0_league_challenge", level: 12, partner: ["mx_species_pipbug", 8] },
  ];
  for (const line of mod.runTable(fights, n)) console.log(line);
});
