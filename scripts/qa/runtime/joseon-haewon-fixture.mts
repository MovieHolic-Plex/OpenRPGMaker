// 해원 데모 픽스처 — 등록 장소를 받고 빌더를 돌려 프로젝트 JSON 을 쓴다(등록 전 데모를 직접 부르는 길, 설계 6절).
// 실행: node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/joseon-haewon-fixture.mts [출력.json]
import { writeFileSync } from "node:fs";
import { createJoseonHaewonFlagshipDemo, preloadJoseonHaewon } from "@/project/flagship/joseonHaewon";

await preloadJoseonHaewon();
const { project, serialized } = createJoseonHaewonFlagshipDemo();
const out = process.argv[2] ?? "/tmp/jw/haewon.project.json";
writeFileSync(out, serialized);
const maps = Object.values(project.maps).map((m) => `${m.id}(${m.width}x${m.height}) ev=${m.events.length}`);
console.log(JSON.stringify({ out, bytes: serialized.length, maps, items: project.database.items.filter((i) => i.id.startsWith("item_mystery_c1")).map((i) => i.id),
  switches: project.switches.filter((s) => s.id.startsWith("sw_jw") || s.id.startsWith("sw_mystery")).map((s) => s.id) }, null, 1));
