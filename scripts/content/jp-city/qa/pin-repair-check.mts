// jp_city 칸 번호 복구 헤드리스 점검 — 프로젝트 JSON 을 로드 정규화(헤드리스)한 뒤 맵마다 후보 판을 보이고, 고른 판으로 옮겨 본다.
//   tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/pin-repair-check.mts <project.json> <out.json> mapId=eraId ...
// 확인: jp_city 아닌 맵·고르지 않은 맵은 한 칸도 안 바뀐다, 같은 맵을 두 번 옮기지 않는다(멱등), meta 에 기록이 남는다.
import fs from "node:fs";
import { normalizeHeadlessProject } from "../../../../src/headless/index.ts";
import { applyJpCityPinRepair, jpCityPinRepairCandidates, loadJpCityPinEras } from "../../../../src/project/defaults/jpCityPinRepair.ts";
import type { Project } from "../../../../src/project/types.ts";

const [inPath, outPath, ...picks] = process.argv.slice(2);
const project = JSON.parse(fs.readFileSync(inPath!, "utf8")) as Project;
normalizeHeadlessProject(project);
const table = await loadJpCityPinEras();
const layers = (p: Project, id: string) => JSON.stringify(["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"].map((k) => (p.maps[id] as unknown as Record<string, unknown>)[k] ?? null));
const before = Object.fromEntries(Object.keys(project.maps).map((id) => [id, layers(project, id)]));
for (const id of Object.keys(project.maps)) {
  const c = jpCityPinRepairCandidates(project, id, table);
  console.log(`${id} [${project.maps[id]!.tilesetId}] 후보: ${c.map((x) => `${x.era.id}(옮김 ${x.moved}, 없는 칸 ${x.lost})`).join(" · ") || "없음"}`);
}
const chosen = new Map(picks.map((s) => s.split("=") as [string, string]));
for (const [id, eraId] of chosen) {
  const era = table.eras.find((e) => e.id === eraId)!;
  const rec = applyJpCityPinRepair(project, id, era, "2026-10-20T00:00:00.000Z");
  console.log("적용", id, eraId, JSON.stringify(rec));
  const again = applyJpCityPinRepair(project, id, era, "2026-10-20T00:00:01.000Z");
  if (again !== null) throw new Error(`${id}: 두 번째 적용이 막히지 않았다`);
}
for (const id of Object.keys(project.maps)) {
  const same = before[id] === layers(project, id);
  if (!chosen.has(id) && !same) throw new Error(`${id}: 고르지 않은 맵이 바뀌었다`);
  console.log(`${id}: ${same ? "그대로" : "옮김"}`);
}
console.log("meta.oprnJpCityPinRepairs", (project.meta as { oprnJpCityPinRepairs?: unknown[] }).oprnJpCityPinRepairs?.length);
fs.writeFileSync(outPath!, JSON.stringify(project));
