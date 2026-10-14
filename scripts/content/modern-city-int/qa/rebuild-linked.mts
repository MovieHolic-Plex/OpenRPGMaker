// 거리와 이은 modern_city 실내를 크기를 바꿔 다시 지어도(replace:true) 들어오는 이동·출구가 새 평면에 맞춰지는가.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/rebuild-linked.mts
// 2026-10-14 실조수: 병동을 이은 뒤 작게 다시 지으려다 커밋이 「transfer 목적지가 맵 경계 밖 / 통행 불가」로 거부됐다.
import { COMPOSE_MODERN_CITY_STREET_TOOL, LINK_MODERN_CITY_INTERIOR_TOOL } from "@/editor/tools/modernCityTools";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "@/editor/tools/handInteriorTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createModernCityTileset } from "@/project/defaults/modernCity";
import { projectLint as lintProject } from "@/project/lint/projectLint";

const p = createEmptyToolProject("mcr");
p.tilesets.modern_city = createModernCityTileset();
const walk = p.tilesets.modern_city.tileGroups!.find((g) => g.id === "mc:sidewalk")!.tileIds[0]!;
p.maps.street = { id: "street", name: "거리", width: 60, height: 48, tilesetId: "modern_city", tileSize: 16, lowerTiles: new Array(60 * 48).fill(walk), upperTiles: new Array(60 * 48).fill(-1), events: [] } as never;
const st = COMPOSE_MODERN_CITY_STREET_TOOL.run(p, { mapId: "street", seed: 1 });
const ward = (st.data as { buildings: { program: string | null; doors: { x: number; y: number }[] }[] }).buildings.find((b) => b.program === "hospital-ward")!;
const base = { tileset: "modern_city", mapId: "ward", name: "병동", floor: "mci-vinyl-hospital", wall: "mci-wall-hospital" };
BUILD_HAND_INTERIOR_ROOM_TOOL.run(p, { ...base, layout: { program: "hospital-ward" } });
LINK_MODERN_CITY_INTERIOR_TOOL.run(p, { mapId: "street", door: ward.doors[0], interiorMapId: "ward" });
const before = { w: p.maps.ward!.width, h: p.maps.ward!.height };
const r = BUILD_HAND_INTERIOR_ROOM_TOOL.run(p, { ...base, replace: true, layout: { rooms: [{ kind: "ward", w: 8, h: 5 }, { kind: "waiting_room", w: 8, h: 3 }], entrance: "waiting_room" } });
const errs = lintProject(p as never).filter((i: { severity: string }) => i.severity === "error");
console.log(`병동 ${before.w}×${before.h} → ${p.maps.ward!.width}×${p.maps.ward!.height}`);
console.log((r.warnings ?? []).filter((w: string) => w.startsWith("자동 맞춤")).join("\n") || "(맞춤 없음)");
for (const e of errs) console.log("ERR", (e as { message: string }).message);
process.exitCode = errs.length ? 1 : 0;
console.log(errs.length ? "FAIL" : "OK");
