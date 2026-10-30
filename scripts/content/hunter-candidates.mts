// 사냥꾼 계약 설계 문서용 후보 렌더 — 실제 도구로 후보 맵을 짓고 원본 해상도 PNG 로 쏟는다. 정본 저장·굽기 없음.
//   node --max-old-space-size=12000 node_modules/.bin/vite-node scripts/content/hunter-candidates.mts <outDir> [name ...]
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../src/project/defaults";
import { runTool } from "../../src/editor/tools/toolRunner";
import "../../src/editor/tools/toolRegistry";
import { renderMapPng } from "../qa-game/render.mts";
import type { Project } from "../../src/project/types";

const out = process.argv[2] ?? "/tmp/hunter-probe";
const only = new Set(process.argv.slice(3));
fs.mkdirSync(out, { recursive: true });
const project: Project = createBlankProject();
function exec(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`${name}: ${res.summary} ${JSON.stringify(res.issues ?? []).slice(0, 400)}`);
  Object.assign(project, ctx.project);
  return ((res as { data?: unknown }).data ?? {}) as Record<string, unknown>;
}
const jobs: [string, string, Record<string, unknown>][] = [
  ["swamp-village", "author_beodeul_town", { id: "hc_swamp", name: "갈대늪", theme: "swamp", seed: 7, width: 56, height: 44 }],
  ["harbor-city", "author_beodeul_town", { id: "hc_harbor", name: "버들항", theme: "coast", seed: 11, width: 64, height: 48, walls: true, roofs: "medieval" }],
  ["mountain-village", "author_beodeul_town", { id: "hc_hill", name: "잿빛고개", theme: "river", seed: 5, terrain: "highland", roofs: "log", houseCount: 5, woods: "dense" }],
  ["castle-ruin", "author_dungeon", { id: "hc_castle", name: "폐성 하층", type: "castle", adapter: "beodeul", genre: "rpg", seed: 3, size: "medium", populate: false }],
  ["catacomb", "author_dungeon", { id: "hc_crypt", name: "성 아래 납골당", type: "catacomb", adapter: "beodeul", genre: "rpg", seed: 9, size: "medium", populate: false }],
  ["swamp-lair", "author_dungeon", { id: "hc_lair", name: "가라앉은 둔덕", type: "swamp", adapter: "beodeul", genre: "rpg", seed: 4, size: "medium", populate: false }],
  ["sewer", "author_dungeon", { id: "hc_sewer", name: "버들항 하수도", type: "sewer", adapter: "beodeul", genre: "rpg", seed: 6, size: "medium", populate: false }],
  ["cave", "author_dungeon", { id: "hc_cave", name: "늑대 굴", type: "cave", adapter: "beodeul", genre: "rpg", seed: 2, size: "small", populate: false, lair: true }],
  ["harbor-city2", "author_beodeul_town", { id: "hc_harbor2", name: "버들항 도심", theme: "city", seed: 11, width: 72, height: 56 }],
  ["castle-town", "author_beodeul_town", { id: "hc_ct", name: "회색봉 성채 마을", theme: "river", seed: 9, terrain: "terraces", roofs: "slate", walls: true, houseCount: 7, water: "none" }],
  ["inn", "build_hand_interior_room", { mapId: "hc_inn", name: "젖은 닻 여관", layout: { program: "inn", seed: 3 } }],
  ["smithy", "build_hand_interior_room", { mapId: "hc_smithy", name: "대장간", layout: { program: "smithy", seed: 2 } }],
  ["hall", "build_hand_interior_room", { mapId: "hc_hall", name: "성채 대전", layout: { program: "throne", seed: 1 } }],
];
jobs.push(["castle-town-ruin", "derive_map_variant", { sourceMapId: "hc_ct", variants: [{ id: "hc_ct_ruin", name: "무너진 회색봉", look: "ruin" }] }]);
for (const [name, tool, args] of jobs) {
  if (only.size && !only.has(name)) continue;
  const t0 = Date.now();
  try {
    const before = new Set(Object.keys(project.maps));
    const data = exec(tool, args);
    const ids = Object.keys(project.maps).filter((id) => !before.has(id));
    const mapId = tool === "derive_map_variant" ? "hc_ct_ruin" : (data.mapId as string) ?? (args.id as string) ?? (args.mapId as string) ?? ids[0];
    const map = project.maps[mapId] ?? project.maps[ids[0]!];
    if (!map) throw new Error(`no map (${ids.join(",")})`);
    fs.writeFileSync(path.join(out, `${name}.png`), renderMapPng(project, map).png);
    console.log(name, map.id, `${map.width}x${map.height}`, map.tilesetId, `${Date.now() - t0}ms`);
  } catch (e) { console.log(name, "ERROR", (e as Error).message.slice(0, 500)); }
}
