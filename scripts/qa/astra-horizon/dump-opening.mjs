// 아스트라 오프닝 애니메틱 구성(컷별 레이어·카메라)을 JSON 으로 쓴다 — 저장본은 컷을 그림 장면으로 접어 두므로 생성 함수에서 직접 뽑는다.
//   node scripts/qa/astra-horizon/dump-opening.mjs <out.json>
import fs from "node:fs";
import { withTsModule } from "../../ontology-ts-loader.mjs";
const out = process.argv[2] ?? "/tmp/astra-opening.json";
await withTsModule("src/project/flagship/index.ts", "astra-opening.mjs", async (mod) => {
  const built = mod.createEmeraldCrownFlagshipDemo();
  const opening = built.project.system.opening;
  fs.writeFileSync(out, JSON.stringify({ assets: built.project.assets, system: { opening } }));
  console.log(opening.scenes.map((s) => `${s.id}:${s.kind}`).join(" "));
});
