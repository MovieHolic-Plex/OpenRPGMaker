// 노면전차 거리(tramstreet.map.json)를 시작 맵으로 하는 출하 플레이어 시험 프로젝트 — 탄 뒤 가는 동네 한 장·지하철 콘코스도 넣는다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/tram-fixture.mts --out <경로.json>
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serializePretty } from "@/project/io";
import { createJpCityTileset } from "@/project/defaults/jpCity";

let out: string | null = null;
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i] === "--out") out = process.argv[++i] ?? null;
if (!out) throw new Error("사용법: --out <경로.json>");
const project = deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
project.tilesets.jp_city = createJpCityTileset();
for (const f of ["tramstreet", "town", "school", "station-concourse"]) {
  const m = JSON.parse(readFileSync(`scripts/content/jp-city/maps/out/${f}.map.json`, "utf8"));
  if (f === "station-concourse") m.events = [];
  project.maps[m.id] = m;
  project.mapTree = { ...project.mapTree, children: [...(project.mapTree?.children ?? []), { mapId: m.id, children: [] }] } as typeof project.mapTree;
}
project.startMapId = "jp-city-tram-street";
project.startPos = { x: 20, y: 11 };
writeFileSync(out, serializePretty(project), "utf8");
console.log(`픽스처: ${out}`);
