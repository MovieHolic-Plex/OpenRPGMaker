// locked-entrance.scenario.mjs 의 픽스처 — 사막 오아시스 마을(건물 입구 16)을 깔고 마감 단계 locked-house-doors 를 돌린 프로젝트.
// 시작 칸은 첫 건물 입구의 문 앞 칸. 그 문의 「들어갈 수 없다」 이벤트가 무엇에 답하는지(부딪힘 · 조사 키)를 옆 JSON 에 적는다.
//
//   bun scripts/qa/runtime/locked-entrance-fixture.mts --out /tmp/locked-entrance/project.json
//   RUNTIME_QA_POINTS=/tmp/locked-entrance/project.json.points.json \
//     npm run qa:runtime -- --scenario locked-entrance --project /tmp/locked-entrance/project.json --out verify-shots/locked-entrance
import fs from "node:fs";
import { runTool } from "../../../src/editor/tools/index.ts";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { serializePretty } from "../../../src/project/io.ts";
import type { Project } from "../../../src/project/types.ts";
import { buildingEntrances } from "../../../src/ai/v2/place/entrances.ts";
import { lockBareHouseDoors } from "../../../src/ai/v2/place/lockedDoors.ts";
import type { BuildRun } from "../../../src/ai/v2/shared/types.ts";

const oi = process.argv.indexOf("--out");
const OUT = oi >= 0 ? process.argv[oi + 1]! : "/tmp/locked-entrance/project.json";
const ctx = { project: createBlankProject() as Project };
const call = (tool: string, args: Record<string, unknown>) => { const r = runTool(ctx, tool, args); if (!r.ok) throw new Error(`${tool}: ${r.summary}`); return r; };
call("create_map", { id: "map_oasis", name: "오아시스 마을", width: 44, height: 36, tilesetId: "desert_east" });
call("compose_desert_east_map", { mapId: "map_oasis", kind: "oasis", seed: 1 });
const door = buildingEntrances(ctx.project, ctx.project.maps.map_oasis!)[0];
if (!door) throw new Error("건물 입구가 없다");
ctx.project = { ...ctx.project, startMapId: "map_oasis", startPos: { ...door.front } };
lockBareHouseDoors({ ctx, calls: [], call } as unknown as BuildRun, "map_oasis", "outdoor");
const project = ctx.project;
const lock = project.maps.map_oasis!.events.find((e) => e.x === door.x && e.y === door.y);
if (!lock) throw new Error("문 칸에 이벤트가 서지 않았다");
if (project.system.opening) project.system.opening.enabled = false;
for (const id of Object.keys(project.maps)) if (id !== "map_oasis") delete project.maps[id];
for (const id of Object.keys(project.tilesets)) if (id !== "desert_east") delete project.tilesets[id];
for (const t of Object.values(project.tilesets)) delete (t as { referenceDocuments?: unknown }).referenceDocuments;
fs.mkdirSync(OUT.replace(/\/[^/]+$/u, ""), { recursive: true });
fs.writeFileSync(OUT, serializePretty(project));
const page = lock.pages?.[0];
fs.writeFileSync(`${OUT}.points.json`, JSON.stringify({ mapId: "map_oasis", front: door.front, door: { x: door.x, y: door.y }, trigger: page?.trigger.kind, line: (page?.commands?.[0] as { body?: string } | undefined)?.body }, null, 1));
console.log(`${OUT}: 문 (${door.x},${door.y}) 앞 (${door.front.x},${door.front.y}), 답하는 것 = ${page?.trigger.kind}`);
