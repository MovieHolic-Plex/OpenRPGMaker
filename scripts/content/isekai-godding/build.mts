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
// 장면 다듬기 검사(편집기 「검사」와 같은 규칙) — 이동 뒤 명령·빈 대사 같은 실제 플레이 결함을 굽기 전에 본다.
const { lintScenePolish } = await import("@/project/lint/scenePolishLint");
const { lintSceneStaging } = await import("@/project/lint/sceneStagingLint");
const { lintStairEntrances } = await import("@/project/lint/stairEntranceLint");
for (const i of [...lintSceneStaging(p), ...lintStairEntrances(p)]) console.log("lint", i.severity, i.code, i.mapId ?? "", i.eventId ?? "", String(i.message).slice(0, 200));
