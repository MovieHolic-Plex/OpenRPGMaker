// transit.probe.mjs 가 쓰는 픽스처 — 小学校 예제 맵(jp_city)에 **조수 도구 set_map_transit** 로 차 흐름·버스를 깐다.
//
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/transit-fixture.mts --out /tmp/transit.json
//
// 왜 도구를 직접 부르는가: 검증 대상은 조수가 깔아 주는 실물이다. 손으로 transit JSON 을 적으면 도구가 바뀌어도
// QA 는 옛 모양을 계속 통과시킨다. 기준 프로젝트는 editor-authored-demo-v3(주인공 캐릭셋 정상), 여기에 번들 jp_city
// 타일셋과 scripts/content/jp-city/maps/out/school.map.json 을 넣고 시작 맵으로 삼는다.
import { readFileSync, writeFileSync } from "node:fs";
import { getTool } from "@/editor/tools/toolRegistry";
import { deserialize, serializePretty } from "@/project/io";
import { createJpCityTileset } from "@/project/defaults/jpCity";

export const TRANSIT_FIXTURE_SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
export const SCHOOL_MAP = "scripts/content/jp-city/maps/out/school.map.json";
/** 정문 안 진입로(포장) — 길(y 44~47) 바로 북쪽 담 안. */
export const START = { x: 35, y: 41 } as const;
/** 동쪽행 버스 머리가 서는 칸 — 몸 x 32~40 이 정문(33~36) 앞을 덮는다. */
export const BUS_STOP = { x: 40, y: 44 } as const;
export const BOARD = { mapId: "map_lantern_village", x: 14, y: 18 } as const;

let out: string | null = null;
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i] === "--out") out = process.argv[++i] ?? null;
if (!out) throw new Error("사용법: tsx scripts/qa/runtime/transit-fixture.mts --out <경로.json>");

const project = deserialize(readFileSync(TRANSIT_FIXTURE_SOURCE, "utf8"));
const school = JSON.parse(readFileSync(SCHOOL_MAP, "utf8"));
project.tilesets.jp_city = createJpCityTileset();
school.events = [];
project.maps[school.id] = school;
project.mapTree = { ...project.mapTree, children: [...(project.mapTree?.children ?? []), { mapId: school.id, children: [] }] } as typeof project.mapTree;
project.startMapId = school.id;
project.startPos = { ...START };

const tool = getTool("set_map_transit");
if (!tool) throw new Error("set_map_transit 도구가 등록되어 있지 않다");
const result = tool.run(project, {
  mapId: school.id,
  auto: { headwaySec: 5, busHeadwaySec: 14, busStops: [{ ...BUS_STOP, name: "学校前", waitSec: 8, board: { ...BOARD } }] },
});
writeFileSync(out, serializePretty(project), "utf8");
console.log(`픽스처: ${out}`);
console.log(`  ${result.summary}`);
if (result.warnings?.length) console.log(`  경고: ${result.warnings.join(" / ")}`);
console.log(JSON.stringify((result.data as { routes: unknown[] }).routes));
