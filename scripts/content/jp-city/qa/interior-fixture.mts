// 일본 집 실내(interior.mjs 가 지은 맵)를 시작 맵으로 하는 출하 플레이어 시험 프로젝트 — 2층 단독주택 1층(현관)에서 시작.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/interior-fixture.mts --out <경로.json>
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serializePretty } from "@/project/io";
import { createJpCityTileset } from "@/project/defaults/jpCity";

let out: string | null = null;
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i] === "--out") out = process.argv[++i] ?? null;
if (!out) throw new Error("사용법: --out <경로.json>");
const project = deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
project.tilesets.jp_city = createJpCityTileset();
for (const f of ["interior-house-1f", "interior-house-2f", "interior-apartment-1k"]) {
  const m = JSON.parse(readFileSync(`scripts/content/jp-city/maps/out/${f}.map.json`, "utf8"));
  project.maps[m.id] = m;
  project.mapTree = { ...project.mapTree, children: [...(project.mapTree?.children ?? []), { mapId: m.id, children: [] }] } as typeof project.mapTree;
}
project.startMapId = "jp-city-house-1f";
project.startPos = { x: 9, y: 13 };
writeFileSync(out, serializePretty(project), "utf8");
console.log(`픽스처: ${out}`);
