// 조수 v2 — 이미 지어진 손 도트 실내를 «다시 짓지 않고» 고친다(덧찍기).
//
// 왜(2026-10-23 v1 비교 「이 방을 아늑하게 + 북쪽 뒷문」): v2 는 기록 없는 방을 같은 방 구성으로 다시 지은 뒤 고쳤는데,
// 다시 짓기가 견본 가구·바닥을 바꿔(널마루 → 돌바닥) 오히려 덜 아늑해졌다(눈가림 v1 7.5 · v2 3.5).
// 그래서 원래 그림은 그대로 두고, 빈 바닥 덩이에 방 쓰임 한 벌을 덧찍고(stamp_object kit:…/hand-interior:<id>),
// 뒷문은 북벽 발치에 문 그림을 찍고 작은 뒷방을 새로 지어 create_transfer_pair 로 잇는다. 덧찍을 때마다 도달 검사를 다시 하고
// 길을 막으면 그 한 벌을 되돌린다.
import { roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { measureInteriorBareFloor } from "@/editor/handInterior/bareFloor";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { runMachineChecks } from "../checks";
import { findPart, roomSetsFor } from "./interior";
import type { BuildRun, PlaceBuildResult, PlaceSpec } from "../types";

const HAND_LAYOUT_ROOM_TAG = "hand-layout-room";
type Rect = { id: string; x0: number; y0: number; x1: number; y1: number };

export interface StampEditRequest {
  readonly dressing: number;
  readonly adds: readonly { readonly zone?: string; readonly what: string; readonly near?: { readonly x: number; readonly y: number } }[];
  readonly north: boolean;
}

export interface StampEditState { readonly stampEdit: true; readonly mapId: string; readonly tilesetId: string; readonly backMapId?: string }

function roomsOf(map: GameMap): Rect[] {
  return (map.locations ?? []).filter((l) => (l.tags ?? []).includes(HAND_LAYOUT_ROOM_TAG)).map((l) => ({ id: l.name, x0: l.x, y0: l.y, x1: l.x + l.w - 1, y1: l.y + l.h - 1 }));
}

/** 이 칸이 가구 없는 걸을 수 있는 바닥인가(덮개 층이 비고 통행 가능). */
function freeFloor(project: Project, map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const i = y * map.width + x;
  return isPassable(project, map, x, y) && (map.lowerOverlayTiles?.[i] ?? -1) < 0 && (map.upperTiles[i] ?? -1) < 0 && !(map.events ?? []).some((e) => e.x === x && e.y === y);
}

const reachOk = (project: Project, mapId: string): boolean => runMachineChecks(project, [mapId]).every((c) => c.id !== "reach" || c.ok);

/** 부품 하나를 발밑 왼쪽 위 (x,y) 에 덧찍는다 — 그림 맨 위 칸으로 바꿔 stamp_object 를 부른다. */
function stampPart(run: BuildRun, spec: HandInteriorSpec, tilesetId: string, mapId: string, id: string, x: number, y: number): boolean {
  const def = spec.objects[id];
  if (!def) return false;
  const minDx = Math.min(...def.cells.map((c) => c[0])), minDy = Math.min(...def.cells.map((c) => c[1]));
  const res = run.call("stamp_object", { objectId: `kit:${tilesetId}/hand-interior:${id}`, mapId, x: x + minDx, y: y + minDy });
  return res.ok;
}

/** 부품 발밑(+ 막는 가구면 앞 한 줄)이 모두 빈 바닥인가. */
function fits(project: Project, map: GameMap, spec: HandInteriorSpec, id: string, x: number, y: number): boolean {
  const def = spec.objects[id];
  if (!def) return false;
  const rows = Math.max(1, def.h) + (def.kind === "flat" ? 0 : 1);
  for (let j = 0; j < rows; j++) for (let i = 0; i < def.w; i++) if (!freeFloor(project, map, x + i, y + j)) return false;
  return true;
}

export function interiorStampEdit(run: BuildRun, spec: PlaceSpec, mapId: string, req: StampEditRequest, prev?: StampEditState): PlaceBuildResult {
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  const roomSpec = map0 ? roomSpecOf(project0.tilesets[map0.tilesetId]) : undefined;
  if (!map0 || !roomSpec) return { ok: false, mapIds: [], summary: `${mapId} 는 손 도트 실내가 아니다`, warnings: [], missingArt: [], calls: run.calls };
  const tilesetId = map0.tilesetId;
  const rooms = roomsOf(map0);
  const notes: string[] = [];
  const missing: string[] = [];
  const mapIds = [mapId];
  const map = () => run.ctx.project.maps[mapId]!;
  const roomAt = (x: number, y: number) => rooms.find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);

  /** 한 벌을 찍고 길을 막으면 되돌린다. */
  const tryStampSet = (set: readonly { id: string; x: number; y: number }[], ox: number, oy: number): boolean => {
    const snapshot = run.ctx.project;
    if (!set.every((o) => fits(run.ctx.project, map(), roomSpec, o.id, ox + o.x, oy + o.y))) return false;
    for (const o of set) if (!stampPart(run, roomSpec, tilesetId, mapId, o.id, ox + o.x, oy + o.y)) { run.ctx.project = snapshot; return false; }
    if (!reachOk(run.ctx.project, mapId)) { run.ctx.project = snapshot; return false; }
    return true;
  };

  // 1) 아늑하게: 빈 바닥 덩이(큰 것부터)에 그 방 쓰임 한 벌을 덧찍는다.
  let sets = 0;
  const want = req.dressing > 0 ? Math.max(2, req.dressing * 2) : 0;
  const tried = new Set<string>();
  for (let round = 0; round < want + 6 && sets < want; round++) {
    const bare = measureInteriorBareFloor(run.ctx.project, map());
    const region = [...(bare?.regions ?? [])].filter((r) => !tried.has(`${r.x},${r.y}`) && r.w >= 2 && r.h >= 2).sort((a, b) => b.w * b.h - a.w * a.h)[0];
    if (!region) break;
    tried.add(`${region.x},${region.y}`);
    const room = roomAt(region.x + Math.floor(region.w / 2), region.y + Math.floor(region.h / 2));
    const options = roomSetsFor(room?.id ?? "living");
    let done = false;
    for (let k = 0; k < options.length && !done; k++) {
      const set = options[(sets + k) % options.length]!.filter((o) => roomSpec.objects[o.id]);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]] as const) {
        if (tryStampSet(set, region.x + Math.floor(region.w / 2) - 1 + dx, region.y + Math.floor(region.h / 2) - 1 + dy)) { done = true; break; }
      }
    }
    if (done) sets++;
  }
  if (want) notes.push(sets ? `원래 그림은 그대로 두고 빈 바닥 ${sets}곳에 방 쓰임 한 벌을 덧찍었다` : "덧찍을 빈 바닥이 없었다");

  // 2) 주인공 물건 더하기.
  for (const add of req.adds) {
    const part = findPart(roomSpec, add.what);
    if (!part) { missing.push(`${add.what} — 부품 사전에 없다`); continue; }
    const room = rooms.find((r) => r.id === add.zone || (add.zone && r.id.startsWith(add.zone))) ?? (add.near ? roomAt(add.near.x, add.near.y) : undefined) ?? rooms[0];
    const cands: { x: number; y: number; d: number }[] = [];
    const box = room ?? { x0: 0, y0: 0, x1: map().width - 1, y1: map().height - 1 };
    for (let y = box.y0 + 2; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
      if (!fits(run.ctx.project, map(), roomSpec, part.id, x, y)) continue;
      const d = add.near ? Math.abs(x - add.near.x) + Math.abs(y - add.near.y) : part.kind === "wall" ? y - box.y0 : Math.abs(x - (box.x0 + box.x1) / 2) * 0.2;
      cands.push({ x, y, d });
    }
    cands.sort((a, b) => a.d - b.d);
    if (!cands.slice(0, 12).some((c) => tryStampSet([{ id: part.id, x: 0, y: 0 }], c.x, c.y))) missing.push(`${add.what}(${room?.id ?? "방"}) — 놓을 빈 자리가 없다`);
  }

  // 3) 북쪽 뒷문: 맨 북쪽 방 북벽 발치에 문 그림 + 작은 뒷방 + 양방향 이동.
  let backMapId = prev?.backMapId;
  if (req.north) {
    const door = roomSpec.objects["locked door"] ? "locked door" : roomSpec.objects["round arch"] ? "round arch" : undefined;
    const top = Math.min(...rooms.map((r) => r.y0));
    const hosts = rooms.filter((r) => r.y0 === top).sort((a, b) => Number(/kitchen|storeroom|pantry|cellar|corridor/u.test(b.id)) - Number(/kitchen|storeroom|pantry|cellar|corridor/u.test(a.id)));
    let made = false;
    if (door && !backMapId) {
      const back = run.call("build_hand_interior_room", { tileset: tilesetId, name: `${spec.name} 뒷방`, layout: { rooms: [{ kind: "storeroom", w: 7, h: 6 }] } });
      if (back.ok) backMapId = String((back.data as { mapId?: string } | undefined)?.mapId);
    }
    for (const room of hosts) {
      if (!door || !backMapId || made) break;
      const cx = Math.floor((room.x0 + room.x1) / 2);
      const xs = Array.from({ length: room.x1 - room.x0 + 1 }, (_, i) => room.x0 + i).sort((a, b) => Math.abs(a - cx) - Math.abs(b - cx));
      for (const x of xs) {
        const y = room.y0 + 2;
        if (![0, 1, 2].every((j) => freeFloor(run.ctx.project, map(), x, y + j))) continue;
        const snapshot = run.ctx.project;
        if (!stampPart(run, roomSpec, tilesetId, mapId, door, x, y)) { run.ctx.project = snapshot; continue; }
        const backMap = run.ctx.project.maps[backMapId];
        const ent = backMap ? (() => { for (let yy = backMap.height - 1; yy >= 0; yy--) for (let xx = 0; xx < backMap.width; xx++) if (isPassable(run.ctx.project, backMap, xx, yy)) return { x: xx, y: yy }; return undefined; })() : undefined;
        if (!ent) { run.ctx.project = snapshot; break; }
        const pair = run.call("create_transfer_pair", { a: { mapId, x, y, doorAt: { x, y } }, b: { mapId: backMapId, x: ent.x, y: ent.y } });
        if (!pair.ok || !reachOk(run.ctx.project, mapId)) { run.ctx.project = snapshot; notes.push(`뒷문 잇기 실패: ${String(pair.summary).slice(0, 100)}`); continue; }
        made = true;
        notes.push(`북쪽 뒷문: ${room.id} 북벽 발치 (${x},${y})에 ${door}, 뒷방 ${backMapId} 와 양방향으로 이었다`);
        mapIds.push(backMapId);
        break;
      }
    }
    if (!made) missing.push(door ? "북쪽 뒷문 — 맨 북쪽 방 북벽 발치에 빈 자리가 없다" : "북쪽 뒷문 — 칩셋에 문 그림이 없다");
  }
  const state: StampEditState = { stampEdit: true, mapId, tilesetId, ...(backMapId ? { backMapId } : {}) };
  const entrance = (() => { const m = map(); for (let y = m.height - 1; y >= 0; y--) for (let x = 0; x < m.width; x++) if (isPassable(run.ctx.project, m, x, y)) return { mapId, x, y }; return undefined; })();
  return { ok: true, mapIds, ...(entrance ? { entrance } : {}), summary: `${spec.name}: 원래 방을 그대로 두고 덧찍어 고쳤다 — ${notes.join(" / ") || "바꾼 것 없음"}`, warnings: notes, missingArt: missing, calls: run.calls, state };
}
