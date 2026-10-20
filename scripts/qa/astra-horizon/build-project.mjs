// 아스트라 호라이즌(emerald-crown) 대표 데모를 출하와 같은 생성 함수로 만들어 project.json 으로 쓰고 맵 요약을 찍는다.
//   node scripts/qa/astra-horizon/build-project.mjs <out.json>
import fs from "node:fs";
import { withTsModule } from "../../ontology-ts-loader.mjs";
const out = process.argv[2] ?? "/home/main/astra-qa/project.json";
await withTsModule("src/project/flagship/index.ts", "astra-build.mjs", async (mod) => {
  const built = mod.createEmeraldCrownFlagshipDemo();
  fs.writeFileSync(out, built.serialized);
  const p = built.project;
  console.log("title", p.meta.title, "start", p.startMapId, JSON.stringify(p.startPos));
  console.log("lock", JSON.stringify(mod.validateFlagshipStyleLock("emerald-crown", p)));
  for (const m of Object.values(p.maps)) {
    console.log(m.id.padEnd(30), `${m.width}x${m.height}`.padEnd(7), m.tilesetId.padEnd(18), "ev", String(m.events.length).padStart(3), m.name);
  }
});
