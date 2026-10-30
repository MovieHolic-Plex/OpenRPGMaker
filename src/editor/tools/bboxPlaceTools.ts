// 모델이 칸 단위로 쓴 장소 배치를 그대로 까는 쓰기 도구(2026-10-31 조수 v2 bbox 장소). 함수는 검사하고 깔기만 한다.
//   lay_dungeon_layout — 던전 한 층(src/editor/dungeonKit/bboxFloor.ts). 다시 깔기(rebuild)는 같은 맵 자리에서: 바깥에서 들어오는 문은 새 입구 계단 앞으로,
//                        이 층의 바깥 문 이벤트는 새 입구 계단 칸으로 옮기고, 짓기 도구 밖에서 붙은 이벤트(사람·컷신)는 가장 가까운 걷는 칸으로 옮겨 싣는다.
//   lay_village_layout — 코드 지형 위 마을(src/editor/tools/bboxVillage.ts).
// 조수 v2 빌더(src/ai/v2/builders/placeLayoutBuild.ts)가 부른다. 레지스트리에는 있지만 v2 는 레지스트리 도구를 모델에게 보이지 않는다.
import { isPassable } from "@/project/collision";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { layBboxDungeon, type BboxDungeonLayout } from "../dungeonKit/bboxFloor";
import { assertMapIdAvailable } from "./mapHelpers";
import { MAP_TOOLS } from "./mapTools";
import { upsertEventIntoMap } from "./eventTools";
import { resolveGraphic } from "./eventCompile";
import { DUNGEON_ENTRANCE_TAG, linkEntranceInDraft } from "./dungeonLinkTools";
import { ToolError, type ToolDefinition } from "./types";
import { layBboxVillageInDraft, type BboxVillageLayout } from "./bboxVillage";

const createMapTool = MAP_TOOLS.find((tool) => tool.name === "create_map")!;
const resizeMapTool = MAP_TOOLS.find((tool) => tool.name === "resize_map")!;
/** 칸 배치로 지은 맵 표식(모델이 쓴 배치 요약 — 할 일 확인 placeLayoutChecks 가 읽는다). */
export const BBOX_DECL_TAG = "bbox-layout";

type Pt = { x: number; y: number };
function walkTransfers(node: unknown, visit: (cmd: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) { for (const n of node) walkTransfers(n, visit); return; }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (o.kind === "transfer" && typeof o.mapId === "string") visit(o);
  for (const v of Object.values(o)) if (v && typeof v === "object") walkTransfers(v, visit);
}
const transfersTo = (ev: GameEvent, mapId: string) => { let hit = false; walkTransfers(ev.pages ?? [], (c) => { if (c.mapId === mapId) hit = true; }); return hit; };
const transfersOut = (ev: GameEvent, self: string) => { let hit = false; walkTransfers(ev.pages ?? [], (c) => { if (c.mapId !== self) hit = true; }); return hit; };

function nearestFree(draft: Project, map: GameMap, want: Pt, taken: Set<string>): Pt | undefined {
  for (let r = 0; r < map.width + map.height; r += 1) for (let dx = -r; dx <= r; dx += 1) {
    const dy = r - Math.abs(dx);
    for (const sy of dy ? [-dy, dy] : [0]) {
      const x = want.x + dx, y = want.y + sy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || taken.has(`${x},${y}`) || !isPassable(draft, map, x, y)) continue;
      return { x, y };
    }
  }
  return undefined;
}

/** 배치 요약을 맵 이름표 하나에 싣는다(사람에게 보이는 장소 목록에는 «배치 선언»). */
export function writeLayoutDecl(map: GameMap, kind: "dungeon" | "village", decl: Record<string, unknown>): void {
  map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes(BBOX_DECL_TAG));
  addMapLocation(map, { name: kind === "dungeon" ? "배치 선언(던전)" : "배치 선언(마을)", x: 0, y: 0, w: 1, h: 1, note: JSON.stringify(decl), tags: [BBOX_DECL_TAG, "decl", kind, COMPOSED_LAYOUT_TAG] });
}
export function readLayoutDecl(map: GameMap): { kind: string; decl: Record<string, unknown> } | undefined {
  const l = (map.locations ?? []).find((q) => (q.tags ?? []).includes(BBOX_DECL_TAG));
  if (!l) return undefined;
  try { return { kind: (l.tags ?? []).includes("village") ? "village" : "dungeon", decl: JSON.parse(l.note ?? "{}") as Record<string, unknown> }; } catch { return undefined; }
}

/** 새 맵을 만들거나(이름) 있는 맵을 다시 깐다. 다시 까는 맵의 이벤트는 돌려준다(옮겨 싣기는 부른 쪽). */
function prepareMap(draft: Project, args: Record<string, unknown>, W: number, H: number, tilesetId: string, role: "dungeon" | "village"): { map: GameMap; old: GameEvent[] } {
  let mapId = typeof args.mapId === "string" && args.mapId ? args.mapId : "";
  let old: GameEvent[] = [];
  if (mapId) {
    const existing = draft.maps[mapId];
    if (!existing) throw new ToolError(`map ${mapId} does not exist.`, { code: "map-not-found", mapId });
    if (existing.tilesetId !== tilesetId) throw new ToolError(`map ${mapId} is not a ${tilesetId} map — leave mapId out to build a new map.`, { code: "tileset-family-mismatch", mapId });
    old = existing.events;
    existing.events = [];
    delete existing.lowerTileStacks; delete existing.upperTileStacks;
    if (existing.width !== W || existing.height !== H) resizeMapTool.run(draft, { mapId, width: W, height: H });
    if (typeof args.name === "string" && args.name.trim()) existing.name = args.name.trim();
  } else {
    mapId = typeof args.id === "string" && args.id.trim() ? args.id.trim() : "";
    if (mapId) assertMapIdAvailable(draft, mapId);
    const created = createMapTool.run(draft, { ...(mapId ? { id: mapId } : {}), name: typeof args.name === "string" && args.name.trim() ? args.name.trim() : role === "dungeon" ? "던전" : "마을", width: W, height: H, tilesetId, border: "none" });
    mapId = (created.data as { mapId?: string; id?: string } | undefined)?.mapId ?? (created.data as { id?: string } | undefined)?.id ?? mapId;
    if (!mapId || !draft.maps[mapId]) throw new ToolError("could not create the map.", { code: "create-map-failed" });
  }
  const map = draft.maps[mapId]!;
  for (const layer of ["lowerOverlayTiles", "upperOverlayTiles"] as const) if (map[layer]) map[layer] = new Array<number>(W * H).fill(-1);
  delete map.relief;
  return { map, old };
}

/** 다시 깐 맵: 바깥에서 들어오는 문 → 새 착지, 이 맵의 바깥 문 → 새 문 칸, 그 밖 손으로 붙인 이벤트 → 가까운 걷는 칸. */
function carryEvents(draft: Project, map: GameMap, old: readonly GameEvent[], gate: Pt | undefined, land: Pt, notes: string[]): void {
  const taken = new Set(map.events.map((e) => `${e.x},${e.y}`));
  const builder = `ev_${map.id}_`;
  for (const ev of old) {
    if (transfersOut(ev, map.id) && gate) {
      const moved = { ...structuredClone(ev), x: gate.x, y: gate.y } as GameEvent;
      upsertEventIntoMap(map, moved); taken.add(`${gate.x},${gate.y}`); continue;
    }
    if (ev.id.startsWith(builder)) continue;
    const at = isPassable(draft, map, ev.x, ev.y) && !taken.has(`${ev.x},${ev.y}`) ? { x: ev.x, y: ev.y } : nearestFree(draft, map, { x: Math.min(ev.x, map.width - 1), y: Math.min(ev.y, map.height - 1) }, taken);
    if (!at) { notes.push(`event "${ev.name ?? ev.id}" had no free cell on the relaid map and was dropped.`); continue; }
    upsertEventIntoMap(map, { ...structuredClone(ev), x: at.x, y: at.y } as GameEvent); taken.add(`${at.x},${at.y}`);
  }
  let retargeted = 0;
  for (const m of Object.values(draft.maps)) {
    if (m.id === map.id) continue;
    for (const ev of m.events) if (transfersTo(ev, map.id)) { walkTransfers(ev.pages ?? [], (c) => { if (c.mapId === map.id) { c.x = land.x; c.y = land.y; } }); retargeted += 1; }
  }
  if (retargeted) notes.push(`${retargeted} door(s) from other maps now arrive at the new entrance (${land.x},${land.y}).`);
}

const LAYOUT_ANY = { type: "object", description: "the model-written layout (see the v2 card)" } as const;

export const LAY_DUNGEON_LAYOUT_TOOL: ToolDefinition = {
  name: "lay_dungeon_layout",
  description: "Lays a model-written dungeon floor layout exactly (rooms, corridors, doors, hazards, pieces) on the beodeul dungeon chipset and checks it. Rejects with English problems and cell coordinates when the layout breaks the grid rules. Used by the v2 assistant path.",
  mode: "write",
  parameters: { type: "object", properties: { layout: LAYOUT_ANY, name: { type: "string" }, mapId: { type: "string" }, id: { type: "string" },
    entrance: { type: "object", properties: { fromMapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } } } }, required: ["layout"] },
  run(draft, args) {
    const tilesetId = "beodeul_city";
    const ts = draft.tilesets[tilesetId];
    if (!ts) throw new ToolError("the beodeul_city chipset is not in this project.", { code: "tileset-missing" });
    const L = args.layout as BboxDungeonLayout;
    const res = layBboxDungeon(ts, L);
    if (!res.ok || !res.out) throw new ToolError(`Rejected: ${res.errors.slice(0, 30).join(" | ")}`, { code: "layout-rejected" });
    const o = res.out;
    const notes: string[] = [...res.warnings];
    const { map, old } = prepareMap(draft, args, o.W, o.H, tilesetId, "dungeon");
    map.lowerTiles = o.lower.slice();
    map.upperTiles = o.upper.slice();
    map.mapRole = "dungeon";
    map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).some((t) => t === "dungeon-room" || t === DUNGEON_ENTRANCE_TAG || t === BBOX_DECL_TAG));
    const LABEL: Record<string, string> = { entrance: "입구", guard: "경비실", puzzle: "수수께끼 방", treasure: "보물 방", antechamber: "보스 앞방", boss: "보스방", other: "방" };
    for (const r of o.rooms) addMapLocation(map, { name: `${LABEL[r.purpose] ?? "방"} ${r.id}`, x: r.x, y: r.y, w: r.w, h: r.h, note: `${r.purpose} · ${r.cells.length} cells`, tags: ["dungeon-room", COMPOSED_LAYOUT_TAG, r.kind, r.purpose, "bbox-room"] });
    const gate = { x: o.stairsUp.x, y: o.stairsUp.y }, land = o.stairsUp.front;
    addMapLocation(map, { name: "던전 입구", x: gate.x, y: gate.y, w: 1, h: 1, note: `야외로 나가는 문 칸 (${gate.x},${gate.y}) · 도착 칸 (${land.x},${land.y})`, tags: [DUNGEON_ENTRANCE_TAG, COMPOSED_LAYOUT_TAG, `gate:${gate.x},${gate.y}`, `land:${land.x},${land.y}`] });
    writeLayoutDecl(map, "dungeon", {
      theme: o.type, rooms: o.rooms.map((r) => ({ id: r.id, purpose: r.purpose, x: r.x, y: r.y, w: r.w, h: r.h })),
      pieces: o.stamped.map((s) => [s.kitId, s.x, s.y, s.name]), stairsUp: { ...gate, front: land }, stairsDown: o.stairsDown,
      boss: o.boss ?? null, enemies: o.enemies, chests: o.chests, locked: o.locked,
    });
    // 잠긴 문 = 쇠창살(조사해도 열리지 않는 막힘 이벤트). 열쇠·레버는 조수가 add_event 로 붙인다.
    const bars = resolveGraphic({ textureKey: "tex_easyrpg_charset_object1", characterIndex: 5 } as never);
    o.locked.forEach((d, k) => upsertEventIntoMap(map, { id: `ev_${map.id}_locked${k + 1}`, name: "잠긴 문", x: d.x, y: d.y, trigger: { kind: "action" }, commands: [],
      pages: [{ id: `ev_${map.id}_locked${k + 1}_p1`, name: "잠긴 문", conditions: [], graphic: bars, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed" }, commands: [{ kind: "text", body: "굳게 잠긴 쇠창살이다." }] }] } as unknown as GameEvent));
    if (old.length) carryEvents(draft, map, old, gate, land, notes);
    const entrance = args.entrance as { fromMapId?: string; x?: number; y?: number } | undefined;
    if (!old.some((e) => transfersOut(e, map.id)) && entrance?.fromMapId && draft.maps[entrance.fromMapId] && Number.isInteger(entrance.x) && Number.isInteger(entrance.y)) {
      const link = linkEntranceInDraft(draft, { fromMapId: entrance.fromMapId, x: entrance.x, y: entrance.y, toMapId: map.id });
      notes.push(`linked ${entrance.fromMapId} (${link.fromGate.x},${link.fromGate.y}) <-> this dungeon's entrance stairs both ways.`, ...link.notes);
    }
    if (draft.startMapId === map.id && isPassable(draft, map, land.x, land.y)) draft.startPos = { ...draft.startPos, x: land.x, y: land.y };
    return {
      summary: `laid dungeon floor ${map.id} (${o.W}x${o.H}, ${o.rooms.length} rooms, ${o.stamped.length} pieces) exactly as written`,
      warnings: notes,
      data: { mapId: map.id, floors: [map.id], width: o.W, height: o.H, entrance: land, entryStair: { x: gate.x, y: gate.y, front: land },
        rooms: o.rooms.map((r) => ({ id: r.id, kind: r.kind, purpose: r.purpose, x: r.x, y: r.y, w: r.w, h: r.h })),
        anchors: { boss: o.rooms.find((r) => r.purpose === "boss")?.id, antechamber: o.rooms.find((r) => r.purpose === "antechamber")?.id },
        boss: o.boss ?? null, enemies: o.enemies, chests: o.chests, stats: o.stats },
    };
  },
};

export const LAY_VILLAGE_LAYOUT_TOOL: ToolDefinition = {
  name: "lay_village_layout",
  description: "Lays a model-written village layout exactly on a code terrain (roads, plazas, stairs, buildings, fields, fences, forests, trees, props) on the beodeul chipset and checks walking rules. Used by the v2 assistant path.",
  mode: "write",
  parameters: { type: "object", properties: { layout: LAYOUT_ANY, terrain: { type: "object" }, name: { type: "string" }, mapId: { type: "string" }, id: { type: "string" } }, required: ["layout", "terrain"] },
  run(draft, args) {
    let old: GameEvent[] = [];
    const res = layBboxVillageInDraft(draft, args.layout as BboxVillageLayout, args.terrain as never, { prepare: (W, H) => { const p = prepareMap(draft, args, W, H, "beodeul_city", "village"); old = p.old; return p; } });
    const data = res.data as { mapId: string; entrance: Pt | null; doors: unknown[]; stats: unknown };
    const map = draft.maps[data.mapId]!;
    map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes(BBOX_DECL_TAG));
    writeLayoutDecl(map, "village", { doors: data.doors, entrance: data.entrance, stats: data.stats });
    const notes = [...(res.warnings ?? [])];
    // 다시 깐 마을: 손으로 붙인 이벤트(사람·문)는 가까운 걷는 칸으로, 다른 맵에서 오는 문은 마을 입구로.
    if (old.length && data.entrance) carryEvents(draft, map, old, undefined, data.entrance, notes);
    return { ...res, warnings: notes };
  },
};

export const BBOX_PLACE_TOOLS: readonly ToolDefinition[] = [LAY_DUNGEON_LAYOUT_TOOL, LAY_VILLAGE_LAYOUT_TOOL];
export { carryEvents as carryRelaidEvents };
