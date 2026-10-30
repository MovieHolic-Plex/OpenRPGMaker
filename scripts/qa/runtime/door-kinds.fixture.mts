/**
 * 문 종류 시험 판(door-kinds) — 실제 조수 도구로 문 셋을 짓고 플레이어용 JSON 으로 굽는다.
 *   node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/door-kinds.fixture.mts <out.json>
 *  1) jp_city 상점가(마왕 편의점 데모와 같은 compose_jp_city_street seed 3) — 편의점 유리 자동문(2칸)·맨션 로비 문, link_jp_city_interior.
 *  2) 버들항 통나무 집(bd-house-lodge) — 보통 여닫이 1×2 문, create_transfer_pair.
 *  3) 조선 대문(jb-gate_4) — 두 짝 나무 대문 2×2, create_transfer_pair.
 * 증거 영상은 door-kinds.clips.mjs.
 */
import { writeFileSync } from "node:fs";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { createModernCityTileset } from "@/project/defaults/modernCity";
import { createBeodeulCityTileset, BEODEUL_CITY_ID } from "@/project/defaults/beodeulCity";
import { createJoseonBaramTileset, JOSEON_BARAM_ID } from "@/project/defaults/joseonBaram";
import { prepareWebExport } from "@/project/webExport";
import type { Project } from "@/project/types";

type Cell = { x: number; y: number };
function exec(project: Project, name: string, args: Record<string, unknown>): { summary?: string; data?: unknown } {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[door-kinds] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  console.error(`[door-kinds] ${name}: ${(res.summary ?? "").slice(0, 300)}`);
  return { summary: res.summary, data: res.data };
}

const project = createBlankProject();
project.tilesets[JP_CITY_ID] = createJpCityTileset();
project.tilesets.modern_city ??= createModernCityTileset();
project.tilesets[BEODEUL_CITY_ID] ??= createBeodeulCityTileset();
project.tilesets[JOSEON_BARAM_ID] ??= createJoseonBaramTileset();
const addMap = (id: string, name: string, tilesetId: string, w: number, h: number, fill?: number): void => {
  const m = createStarterMap();
  m.id = id; m.name = name; m.tilesetId = tilesetId; m.width = w; m.height = h;
  m.lowerTiles = new Array(w * h).fill(fill ?? blankFillTileFor(tilesetId));
  m.upperTiles = new Array(w * h).fill(-1);
  m.events = [];
  project.maps[id] = m;
  project.mapTree.push?.({ id, children: [] } as never);
};

// 1) 상점가 — 마왕 편의점과 같은 거리.
addMap("dk_street", "문 시험 · 상점가", JP_CITY_ID, 40, 28);
exec(project, "compose_jp_city_street", { mapId: "dk_street", style: "shopping", seed: 3, shops: ["konbini", "apartment", "cafe", "izakaya"], replace: true });
exec(project, "build_hand_interior_room", { mapId: "dk_konbini", name: "편의점 안", tileset: "modern_city", replace: true, layout: { program: "mc_konbini_jp", seed: 1, furnish: true } });
exec(project, "build_hand_interior_room", { mapId: "dk_room", name: "원룸", tileset: "modern_city", replace: true, layout: { program: "mc_apartment", seed: 1, furnish: true } });
const street = project.maps.dk_street!;
const doorAt = (kind: string): Cell => {
  const loc = (street.locations ?? []).find((l) => (l.tags ?? []).includes("jp-building") && (l.tags ?? []).includes(kind) && !(l.note ?? "").includes("닿지 않음"));
  const m = loc ? /문 \((\d+),(\d+)\)/u.exec(loc.note ?? "") : null;
  if (!m) throw new Error(`no ${kind} door`);
  return { x: Number(m[1]), y: Number(m[2]) };
};
const WIDTH = process.env.DK_WIDTH ? { width: Number(process.env.DK_WIDTH) } : {};
const konbini = exec(project, "link_jp_city_interior", { mapId: "dk_street", door: doorAt("konbini"), interiorMapId: "dk_konbini", replace: true, ...WIDTH }).data as { fronts: Cell[] };
const apartment = exec(project, "link_jp_city_interior", { mapId: "dk_street", door: doorAt("apartment"), interiorMapId: "dk_room", replace: true, ...WIDTH }).data as { fronts: Cell[] };

// 2) 버들항 통나무 집 — 보통 여닫이 1×2.
const BD = project.tilesets[BEODEUL_CITY_ID]!;
const kitOf = (tilesetId: string, id: string) => (project.tilesets[tilesetId] as { structureKits?: { id: string; width: number; height: number; rows: { tiles?: number[]; upperTiles?: number[] }[] }[] }).structureKits!.find((k) => k.id === id)!;
void BD;
addMap("dk_bd", "문 시험 · 버들항 집", BEODEUL_CITY_ID, 14, 11);
addMap("dk_bd_in", "버들항 집 안", BEODEUL_CITY_ID, 10, 8);
const lodge = kitOf(BEODEUL_CITY_ID, "bd-house-lodge");
exec(project, "stamp_object", { objectId: `kit:${BEODEUL_CITY_ID}/bd-house-lodge`, mapId: "dk_bd", x: 5, y: 1 });
const lodgeDoorDx = lodge.rows[lodge.height - 1]!.upperTiles ? 1 : 1;
const bdDoor = { x: 5 + lodgeDoorDx, y: 1 + lodge.height - 1 };
exec(project, "create_transfer_pair", { a: { mapId: "dk_bd", x: bdDoor.x, y: bdDoor.y + 1, doorAt: bdDoor }, b: { mapId: "dk_bd_in", x: 5, y: 7 } });
// DK_SET_DOORS=1: 보통 집 문은 자동 기록 대상이 아니다(옛 외짝 연출이 맞는 문) — 조수가 문 그림 전체(1×2)로 열고 싶을 때 부르는 도구.
if (process.env.DK_SET_DOORS) console.log(exec(project, "set_map_door", { mapId: "dk_bd", x: bdDoor.x, y: bdDoor.y + 1, kind: "swing" }).summary);

// 3) 조선 대문 — 두 짝 2×2.
addMap("dk_jb", "문 시험 · 조선 대문", JOSEON_BARAM_ID, 16, 12);
addMap("dk_jb_in", "대문 안 마당", JOSEON_BARAM_ID, 10, 8);
exec(project, "stamp_object", { objectId: `kit:${JOSEON_BARAM_ID}/jb-gate_4`, mapId: "dk_jb", x: 5, y: 1 });
const jbDoor = { x: 7, y: 1 + 4 };
exec(project, "create_transfer_pair", { a: { mapId: "dk_jb", x: jbDoor.x, y: jbDoor.y + 1, doorAt: jbDoor }, b: { mapId: "dk_jb_in", x: 5, y: 7 } });

project.startMapId = "dk_street";
(project as { startPos?: unknown }).startPos = { x: konbini.fronts[0]!.x, y: konbini.fronts[0]!.y + 3 };
const out = process.argv[2] ?? "/tmp/doors/fixture.play.json";
writeFileSync(out, prepareWebExport(project).projectJson);
const doorsOf = (id: string) => JSON.stringify((project.maps[id] as { doors?: unknown }).doors ?? null);
console.log(JSON.stringify({ out, konbini: konbini.fronts, apartment: apartment.fronts, bdDoor, jbDoor, doors: { dk_street: doorsOf("dk_street"), dk_bd: doorsOf("dk_bd"), dk_jb: doorsOf("dk_jb") },
  events: Object.fromEntries(["dk_street", "dk_bd", "dk_jb"].map((id) => [id, project.maps[id]!.events.map((e) => `${e.id}@${e.x},${e.y}`)])) }));
