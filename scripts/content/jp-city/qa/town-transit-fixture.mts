// 동네 한 장(town.map.json, 탈것 노선 포함)을 시작 맵으로 하는 출하 플레이어 시험 프로젝트.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/town-transit-fixture.mts --out <경로.json>
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serializePretty } from "@/project/io";
import { createJpCityTileset } from "@/project/defaults/jpCity";

let out: string | null = null;
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i] === "--out") out = process.argv[++i] ?? null;
if (!out) throw new Error("사용법: --out <경로.json>");
const project = deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
project.tilesets.jp_city = createJpCityTileset();
const town = JSON.parse(readFileSync("scripts/content/jp-city/maps/out/town.map.json", "utf8"));
project.maps[town.id] = town;
project.mapTree = { ...project.mapTree, children: [...(project.mapTree?.children ?? []), { mapId: town.id, children: [] }] } as typeof project.mapTree;
project.startMapId = town.id;
project.startPos = { x: 41, y: 12 };
writeFileSync(out, serializePretty(project), "utf8");
console.log(`픽스처: ${out} · 노선 ${town.transit?.routes?.length ?? 0}`);
