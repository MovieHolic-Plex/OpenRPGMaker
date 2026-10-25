// 스타터 3종 × 라이벌·관장·신전·챔피언 모의전 표(마크다운). node scripts/qa/astra-horizon/balance-sim.mjs [n=30] [overrides.json]
// overrides.json: { "<enemyId>": { "level": 9, "skills": ["더듬이쏘기", "새싹치기"] } } — 탐색용, 정본은 emeraldCrown.ts.
import fs from "node:fs";
import { withTsModule } from "../../ontology-ts-loader.mjs";
const n = Number(process.argv[2] ?? 30);
const overrides = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : {};
await withTsModule("scripts/qa/astra-horizon/balanceSim.ts", "astra-sim.mjs", async (mod) => {
  const cells = mod.sweep(n, overrides);
  console.log(mod.table(cells));
  if (process.env.SIM_JSON) fs.writeFileSync(process.env.SIM_JSON, JSON.stringify(cells, null, 1));
});
