// 데모 빌더를 한 번 돌려 프로젝트 JSON 을 남긴다(굽기 전 빠른 확인). 출력: /tmp/ig-build.project.json
import { writeFileSync } from "node:fs";
import { createIsekaiGoddingFlagshipDemo } from "@/project/flagship/isekaiGodding";
const t0 = Date.now();
const r = createIsekaiGoddingFlagshipDemo();
writeFileSync(process.argv[2] ?? "/tmp/ig-build.project.json", r.serialized);
const p = r.project;
console.log(`built in ${Date.now() - t0}ms`);
for (const [id, m] of Object.entries(p.maps)) console.log(id, m.name, `${m.width}x${m.height}`, m.tilesetId, `events=${m.events.length}`);
console.log("endings", p.endings?.length, "entities", Object.keys((p as unknown as { world?: { entities?: object } }).world?.entities ?? {}).length);
