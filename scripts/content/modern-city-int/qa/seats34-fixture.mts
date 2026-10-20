// 앉는 기물 다시 굽기 런타임 확인용 프로젝트 — 예제 cafe(안락의자 포함) 평면을 조수 도구 그대로 지어 시작 맵으로 둔다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/seats34-fixture.mts --out /tmp/x.json [--example cafe]
import { readFileSync, writeFileSync } from "node:fs";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "@/editor/tools/handInteriorTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1]! : d; };
const id = arg("--example", "cafe");
const ex = JSON.parse(readFileSync(`tiledata/modern-city/interior/examples/${id}.json`, "utf8"));
const project = createEmptyToolProject("seats34");
const mapId = `mci-${id}`;
const r = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, { tileset: "modern_city", mapId, name: ex.name, plan: ex.plan, floor: ex.floor, wall: ex.wall, zones: ex.zones ?? [], objects: ex.objects ?? [], tables: ex.tables ?? [], goods: ex.goods ?? [], ...(ex.exitWidth ? { exitWidth: ex.exitWidth } : {}), start: [{ x: ex.start[0], y: ex.start[1] }], links: [] } as never);
// 조립기가 안락의자를 탁자 쪽으로 돌려(E/W) 남향 칸이 안 깔리므로, 확인할 남향 그림을 빈 바닥 칸에 그대로 찍는다(--stamp id@x,y).
const stamp = arg("--stamp", "");
if (stamp) {
  const [sid, xy] = stamp.split("@"); const [sx, sy] = xy!.split(",").map(Number);
  const spec = JSON.parse(readFileSync("src/assets/modernCityRoomSpec.json", "utf8")).objects[sid!];
  const m = project.maps[mapId]!;
  for (const [dx, dy, tid] of spec.cells as [number, number, number, number][]) m.upperTiles[(sy! + dy) * m.width + sx! + dx] = tid;
}
project.startMapId = mapId; project.startPos = { x: ex.start[0], y: ex.start[1] };
project.mapTree = { mapId, children: [] };
writeFileSync(arg("--out", "/tmp/seats34-fixture.json"), JSON.stringify(project));
console.log(JSON.stringify({ mapId, start: ex.start, warnings: r.warnings ?? [], size: [project.maps[mapId]!.width, project.maps[mapId]!.height] }));
