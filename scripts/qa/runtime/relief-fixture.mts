// relief.scenario.mjs 가 쓰는 픽스처 — 판타지 500장 중 한 장(정글 벼랑 계단식)을 데모 프로젝트에 얹는다.
// 맵은 tiledata/fantasy-500/catalog.json 의 정본 사본(relief 단·경사로·벽면 장식 포함)을 그대로 쓴다.
//
// 카탈로그(15MB 콘텐츠 사본)는 저장소 main 에 없다. 로컬 브랜치 agent/r3-relief-stairs 에서 꺼내 RELIEF_CATALOG 로 가리킨다:
//   git show agent/r3-relief-stairs:tiledata/fantasy-500/catalog.json > .omo/runtime-qa/fantasy-500-catalog.json
//   RELIEF_CATALOG=.omo/runtime-qa/fantasy-500-catalog.json node_modules/.bin/vite-node --script scripts/qa/runtime/relief-fixture.mts --out .omo/runtime-qa/relief.json
//   npm run qa:runtime -- --scenario relief --project .omo/runtime-qa/relief.json
//
// 비트 좌표(scripts/qa/runtime/relief.scenario.mjs):
//  - (18, 24) 경사로 발치(0단) → 북쪽으로 경사로(18~19, 18~23)를 올라 (18, 17) 5단 대지 위.
//  - (37, 28) 0단 — 바로 남쪽 줄 29~ 은 둔덕(1단, 가운데 2단: 31~40 × 29~40). 남쪽으로 한 칸 가면 막힌다.
//  - NPC 를 (35, 28) 에 세워 둔덕 윗면 뒤(북쪽)에 가려지는지 본다.
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serialize, serializePretty } from "@/project/io";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";

const SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
const MAP_ID = "f5-jungle-cliffTerrace-1";

let out: string | null = null;
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i] === "--out") out = process.argv[i + 1] ?? null;
if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/relief-fixture.mts --out <경로.json>");

const catalogPath = process.env.RELIEF_CATALOG ?? "tiledata/fantasy-500/catalog.json";
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const source = catalog.maps[MAP_ID];
if (!source?.relief) throw new Error(`${MAP_ID} 에 relief 가 없다`);
const base = deserialize(readFileSync(SOURCE, "utf8"));
const demoMap = base.maps[base.startMapId]!;
const npc = structuredClone(demoMap.events.find((event) => event.pages?.[0]?.graphic?.sprite)!);
npc.id = "ev_relief_npc";
npc.x = 35;
npc.y = 28;
for (const page of npc.pages ?? []) page.movement = { type: "fixed", speed: 2, frequency: 3 };

const raw = JSON.parse(serialize(base));
raw.maps[MAP_ID] = { ...source, events: [npc] };
raw.startMapId = MAP_ID;
raw.startPos = { x: 18, y: 24 };
ensureBundledTilesets(raw);
const project = deserialize(JSON.stringify(raw));
if (!project.tilesets[source.tilesetId]) throw new Error(`타일셋 ${source.tilesetId} 이 프로젝트에 없다`);
const map = project.maps[MAP_ID]!;
if (!map.relief?.ramps?.some((v) => v > 0) || !map.relief.wallDecor?.length) throw new Error("relief 경사로·벽면 장식이 불러오기에서 사라졌다");
// 비트 좌표가 지형과 어긋나면(맵을 다시 생성해 단이 바뀌면) 여기서 멈춘다.
const lv = (x: number, y: number) => map.relief!.levels[y * map.width + x] ?? 0;
const need: [string, boolean][] = [
  ["경사로 발치 (18,24) 0단", lv(18, 24) === 0], ["대지 위 (18,16) 5단", lv(18, 16) === 5],
  ["벼랑 끝 (21,18) 5단 / 아래 (21,19) 0단", lv(21, 18) === 5 && lv(21, 19) === 0], ["벼랑 발치 (24,19) 0단 / 위 (24,18) 5단", lv(24, 19) === 0 && lv(24, 18) === 5],
  ["둔덕 앞 (37,28) 0단 / 남쪽 (37,29) 1단+", lv(37, 28) === 0 && lv(37, 29) >= 1], ["NPC (35,28) 0단 / 남쪽 둔덕", lv(35, 28) === 0 && lv(35, 29) >= 1],
];
const bad = need.filter(([, ok]) => !ok).map(([k]) => k);
if (bad.length) throw new Error("relief 비트 좌표가 지형과 맞지 않는다: " + bad.join(", "));
writeFileSync(out, serializePretty(project));
console.log(`relief fixture: ${MAP_ID} ${map.width}x${map.height}, ramps=${map.relief.ramps.filter((v) => v > 0).length}, wallDecor=${map.relief.wallDecor.length} -> ${out}`);
