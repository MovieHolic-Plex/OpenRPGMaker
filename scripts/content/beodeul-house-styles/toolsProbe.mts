// 집을 킷으로 찾는 도구들이 집 양식 가족(bd-house-st-*)을 알아보는지 찍는다(모델 없음).
//   bun scripts/content/beodeul-house-styles/toolsProbe.mts [--style halftimber] [--seed 4242] [--png <폴더>]
// 같은 강가 마을 요청을 세 가족으로 짓는다 — 원래 가족(겉모습 없음) · 중세 무리(roofs medieval — 양식의 선례) · 양식 — 그리고 도구마다 줄 하나.
import fs from "node:fs";
import { houseStyleNames } from "../../../src/assets/houseStyles";
import { buildingEntrances, isEntranceArt, placeMarks } from "../../../src/ai/v2/place/entrances";
import { detectPlacedMapObjects } from "../../../src/editor/stampPlaceRunner";
import { runTool } from "../../../src/editor/tools";
import { harmonizeBeodeulDaylight } from "../../../src/editor/tools/beodeulLightTools";
import type { ToolContext } from "../../../src/editor/tools/types";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { layerTileAt } from "../../../src/project/mapLayers";
import { inferMapDoor } from "../../../src/project/mapDoorKinds";
import type { GameMap, Project } from "../../../src/project/types";
import { renderMapPng } from "../../qa-game/render.mts";

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] ?? fallback : fallback; };
const TS = "beodeul_city", seed = Number(arg("seed", "4242")), style = arg("style", houseStyleNames(TS)[0] ?? ""), png = arg("png", "");
type Door = { kit: string; x: number; y: number; reached: boolean };

function village(label: string, look: Record<string, string> | undefined, extra: Record<string, unknown>): void {
  const project = createBlankProject() as Project;
  if (look) project.tilesets[TS]!.look = { textureKey: "tex_beodeul_looks", ...look };
  const ctx = { project, currentMapId: project.startMapId } as ToolContext;
  const res = runTool(ctx, "author_beodeul_town", { theme: "river", seed, ...extra });
  if (!res.ok) { console.log(`${label}: 짓기 실패 — ${res.summary}`); return; }
  const data = res.data as { mapId: string; doors: Door[]; anchors: string[] };
  const p = ctx.project, map = p.maps[data.mapId]! as GameMap, ts = p.tilesets[TS]!;
  const family = (id: string) => (id.startsWith("bd-house-st-") ? "양식" : id.startsWith("bd-house-mk-") ? "중세" : id.startsWith("bd-house-") ? "원래" : "기타");
  const count = (ids: readonly string[]) => { const m = new Map<string, number>(); for (const id of ids) m.set(family(id), (m.get(family(id)) ?? 0) + 1); return [...m].map(([k, n]) => `${k} ${n}`).join(" · "); };
  console.log(`\n== ${label} — ${res.summary.split("\n")[0]!.slice(0, 110)}`);
  console.log(`  짓기: 문 ${data.doors.length}(못 닿음 ${data.doors.filter((d) => !d.reached).length}) · 가족 ${count(data.doors.map((d) => d.kit))}`);
  // 본체와 함께 놓이는 그림자(2층)·기초(4층)
  const tiles = (prefix: string) => new Set((ts.structureKits ?? []).filter((k) => k.id.startsWith(prefix)).flatMap((k) => k.rows.flatMap((r) => r.upperTiles ?? [])).filter((t) => t >= 0));
  const cells = (layer: 2 | 4, set: Set<number>) => { let n = 0; for (let i = 0; i < map.width * map.height; i += 1) if (set.has(layerTileAt(map, layer, i))) n += 1; return n; };
  console.log(`  함께 놓기: 그림자 칸(2층) 양식 ${cells(2, tiles("bd-st-shadow-"))} · 중세 ${cells(2, tiles("bd-mk-shadow-"))} / 기초 칸(4층) 양식 ${cells(4, tiles("bd-st-foundation-"))} · 중세 ${cells(4, tiles("bd-mk-foundation-"))}`);
  const seen = runTool({ project: p, currentMapId: map.id } as ToolContext, "look_at_houses", { mapId: map.id });
  const houses = seen.ok ? (seen.data as { houses: { kitId: string }[] }).houses : [];
  console.log(`  look_at_houses: ${seen.ok ? `집 ${houses.length} · 가족 ${count(houses.map((h) => h.kitId))}` : `실패 ${seen.summary}`}`);
  const entrances = buildingEntrances(p, map);
  const marks = placeMarks(p, map);
  const doorCells = new Set(data.doors.map((d) => `${d.x},${d.y}`));
  const frontHit = entrances.filter((e) => doorCells.has(`${e.x},${e.y + 1}`) || doorCells.has(`${e.x},${e.y}`)).length;
  console.log(`  v2 입구 찾기: buildingEntrances ${entrances.length}(짓기가 보고한 문과 맞는 것 ${frontHit}/${data.doors.length}) · placeMarks 건물 칸 ${Array.from(marks.buildings).filter(Boolean).length} · isEntranceArt ${entrances.filter((e) => isEntranceArt(p, map, e.x, e.y)).length}/${entrances.length}`);
  const kinds = new Map<string, number>();
  for (const e of entrances) { const kind = inferMapDoor(p, map, { x: e.x, y: e.y })?.kind ?? "없음"; kinds.set(kind, (kinds.get(kind) ?? 0) + 1); }
  console.log(`  문 낱말 판독(inferMapDoor): ${[...kinds].map(([k, n]) => `${k} ${n}`).join(" · ")}`);
  const placed = detectPlacedMapObjects(map, ts).filter((o) => String((o as { kitId?: string }).kitId ?? "").startsWith("bd-house-"));
  console.log(`  놓인 물체 찾기(detectPlacedMapObjects): 집 ${placed.length} · 가족 ${count(placed.map((o) => String((o as { kitId?: string }).kitId)))}`);
  try {
    const lit = harmonizeBeodeulDaylight(structuredClone(p), map.id, { roads: false, meadow: false }).data as { anchors?: unknown[]; alreadyApplied?: boolean; changes?: number };
    console.log(`  낮 빛 맞춤(다시): 앵커 ${lit.anchors?.length ?? "-"} · 이미 적용 ${lit.alreadyApplied ?? false}`);
  } catch (error) { console.log(`  낮 빛 맞춤: 오류 ${(error as Error).message.slice(0, 120)}`); }
  const dress = runTool({ project: structuredClone(p), currentMapId: map.id } as ToolContext, "dress_beodeul_ground", { mapId: map.id });
  console.log(`  바닥 꾸밈(다시): ${dress.ok ? JSON.stringify({ ...(dress.data as object), placements: ((dress.data as { placements?: unknown[] }).placements ?? []).length }).slice(0, 160) : `실패 ${dress.summary.slice(0, 120)}`}`);
  // 문 열림: 첫 집 문 앞에 출입 이벤트를 두고 도구를 부른다 — 양식 집 문은 까닭을 말하며 거절해야 한다
  const first = data.doors[0]!;
  const next = structuredClone(p), inside = structuredClone(next.maps[map.id]!); inside.id = "inside"; inside.events = []; next.maps.inside = inside;
  next.maps[map.id]!.events.push({ id: "ev_door", x: first.x, y: first.y, trigger: { kind: "playerTouch" }, commands: [], pages: [{ id: "p1", name: "문", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapping: false, commands: [{ kind: "transfer", mapId: "inside", x: 1, y: 1 }] }] } as never);
  const door = runTool({ project: next, currentMapId: map.id } as ToolContext, "apply_beodeul_door_animation", { mapId: map.id, eventId: "ev_door" });
  console.log(`  문 열림 도구(${first.kit.replace("bd-house-", "")}): ${door.ok ? "적용" : `거절 ${JSON.stringify(door.issues ?? []).match(/"code":"([^"]+)"/)?.[1] ?? door.summary.slice(0, 80)}`}`);
  if (png) { fs.mkdirSync(png, { recursive: true }); fs.writeFileSync(`${png}/${label.replace(/[^a-z0-9가-힣]+/gi, "-")}.png`, renderMapPng(p, map).png); }
}

village("원래 가족", undefined, {});
village("중세 무리(roofs medieval)", undefined, { roofs: "medieval" });
if (style) village(`양식 ${style}`, { houseStyle: style }, {});
if (style) village(`양식 ${style} + 지붕을 말한 요청(roofs slate)`, { houseStyle: style }, { roofs: "slate" });
