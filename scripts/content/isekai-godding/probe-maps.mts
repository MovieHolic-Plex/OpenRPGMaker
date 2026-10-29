// 지도 후보 탐침 — 조수 도구로 맵을 짓고 결과 데이터·프로젝트를 덤프한다(데모 브랜치 전용).
import { writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { execTool } from "@/project/flagship/isekaiGoddingKit";

const p = createBlankProject();
const log: Record<string, unknown> = {};
const t = (name: string, args: Record<string, unknown>) => {
  const t0 = Date.now();
  try { const r = execTool(p, name, args); log[`${name}:${String(args.mapId ?? args.name ?? args.fromMapId ?? "")}`] = { ms: Date.now() - t0, summary: r.summary, data: r.data }; return r; }
  catch (e) { log[`${name}:${String(args.mapId ?? "")}:ERR`] = String(e).slice(0, 800); console.error(name, String(e).slice(0, 400)); return null; }
};
const parts = t("list_hand_interior_parts", { tileset: "atlas_biome_interior" });
writeFileSync("/tmp/ig-parts.json", JSON.stringify(parts?.data ?? null, null, 1));
t("author_beodeul_town", { id: "map_ig_capital", name: "왕도 루멘", width: 60, height: 44, seed: 11, roofs: "medieval", church: true, form: "plaza", water: "river", woods: "edge" });
t("build_hand_interior_room", { mapId: "map_ig_hall", name: "소환의 방", tileset: "atlas_biome_interior", replace: true, layout: { program: "throne", seed: 1, furnish: true } });
t("build_hand_interior_room", { mapId: "map_ig_guild", name: "모험가 길드", tileset: "atlas_biome_interior", replace: true, layout: { program: "tavern", seed: 1, furnish: true } });
t("build_hand_interior_room", { mapId: "map_ig_class", name: "2학년 3반 교실", tileset: "modern_campus", replace: true, layout: { program: "school-class-wing", seed: 1, furnish: true } });
t("author_forest_route", { fromMapId: "map_ig_capital", side: "north", count: 1, moods: ["normal"], seed: 4 });
t("author_beodeul_town", { id: "map_ig_goblin", name: "고블린 마을", seed: 5, houseCount: 3, form: "scatter", woods: "dense", roofs: "log", water: "none" });
t("author_beodeul_dungeon", { id: "map_ig_castle", name: "마왕성", type: "castle", floors: 2, size: "medium", seed: 3 });
writeFileSync("/tmp/ig-probe.log.json", JSON.stringify(log, null, 1));
writeFileSync("/tmp/ig-probe.project.json", serialize(p));
console.log(Object.keys(p.maps).map((id) => `${id} ${p.maps[id]!.width}x${p.maps[id]!.height} ${p.maps[id]!.tilesetId}`).join("\n"));
