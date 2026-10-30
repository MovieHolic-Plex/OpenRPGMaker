// img-room-test 3단계: 표→맵 반영률. 조수가 마지막으로 낸 piece_table(턴 기록 toolArgs)을 지은 맵(after.json)과 맞댄다.
//   bun scripts/experiments/img-room/coverage.mts <run dir>   → <run>/room/table.json
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { loadHeadlessProject } from "../../../src/headless/index";
import { compareTableToMap, findPlacedPieces, specWithWorkshop, validatePieceTable } from "../../../src/ai/v2/experiment/pieceTable";
const G = process.argv[2]!;
const turns = readdirSync(`${G}/session/turns`).filter((f) => f.endsWith(".json")).sort();
let last: Record<string, unknown> | undefined; let calls = 0;
for (const f of turns) for (const a of JSON.parse(readFileSync(`${G}/session/turns/${f}`, "utf8")).toolArgs ?? []) if (a.name === "piece_table") { calls++; last = a.args; }
const project = loadHeadlessProject(readFileSync(`${G}/after.json`, "utf8")) as any;
const m = JSON.parse(readFileSync(`${G}/room/measure.json`, "utf8"));
const out: Record<string, unknown> = { calls };
if (last) {
  const { table, problems } = validatePieceTable(project, last);
  out.problems = problems;
  if (table) {
    const c = compareTableToMap(project, m.mapId, table);
    Object.assign(out, { table, coverage: c?.coverage, offset: c?.offset, verdicts: c?.verdicts.map((v) => ({ name: v.group.name, id: v.group.id, count: v.group.count, x: v.group.x, y: v.group.y, near: v.near, covered: v.covered })) });
  }
}
// 조건 O: object-gen 으로 만들어 구운 조각 중 지은 맵에 실제로 놓인 것
if (existsSync(`${G}/baked.json`)) {
  const baked = JSON.parse(readFileSync(`${G}/baked.json`, "utf8")).objects.map((o: any) => o.id as string);
  const map = project.maps[m.mapId]; const S = map && specWithWorkshop(project.tilesets[map.tilesetId]);
  const found = map && S ? findPlacedPieces(map, S, new Set(baked)) : [];
  const used = [...new Set(found.map((f) => f.id))];
  Object.assign(out, { generated: { made: baked.length, placed: used.length, placedIds: used, instances: found.length } });
}
writeFileSync(`${G}/room/table.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ calls, coverage: out.coverage, groups: (out.table as any)?.groups?.length, generated: (out.generated as any) ? `${(out.generated as any).placed}/${(out.generated as any).made}` : undefined }));
process.exit(0);
