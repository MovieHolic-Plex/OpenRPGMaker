// r16 런타임 확인용 프로젝트: 실조수가 지은 modern_city 실내 프로젝트(JSON)에 예제 평면 9장을 조수 도구 그대로 더 짓는다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/r16/qa_project.mts BASE.json OUT.json
// 결과의 maps 목록·크기는 OUT.json 옆 qa-maps.json 에 적는다(시나리오가 읽는다).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "@/editor/tools/handInteriorTools";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
const [base, out] = process.argv.slice(2);
const project = JSON.parse(readFileSync(base!, "utf8"));
// 저장본의 타일셋은 {$blob} 참조라 헤드리스에서 풀 수 없다 — 번들 정의로 다시 심는다(그림은 public 시트를 그대로 읽는다).
for (const [k, t] of Object.entries(project.tilesets as Record<string, unknown>)) if (t && typeof t === "object" && "$blob" in t) delete project.tilesets[k];
ensureBundledTilesets(project);
const EX = "tiledata/modern-city/interior/examples";
for (const f of readdirSync(EX).filter((x) => x.endsWith(".json")).sort()) {
  const ex = JSON.parse(readFileSync(`${EX}/${f}`, "utf8"));
  const mapId = `r16-${f.replace(/\.json$/, "")}`;
  BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, { tileset: "modern_city", mapId, name: ex.name, plan: ex.plan, floor: ex.floor, wall: ex.wall, zones: ex.zones ?? [], objects: ex.objects ?? [], tables: ex.tables ?? [], goods: ex.goods ?? [], ...(ex.exitWidth ? { exitWidth: ex.exitWidth } : {}), start: [{ x: ex.start[0], y: ex.start[1] }], links: [] } as never);
}
const maps = Object.values(project.maps as Record<string, { id: string; tilesetId: string; width: number; height: number }>)
  .filter((m) => m.tilesetId === "modern_city").map((m) => ({ id: m.id, w: m.width, h: m.height }));
writeFileSync(out!, JSON.stringify(project));
writeFileSync(join(dirname(out!), "qa-maps.json"), JSON.stringify(maps));
console.log(maps.map((m) => `${m.id} ${m.w}x${m.h}`).join("\n"));
