// 지은 실내를 다시 짓는 길 — 그대로 받아들이기(adoptExactInterior), 인자에서 고침 읽기(interiorEditFromArgs), 앵커 더하기(interiorAddAnchors), 기물 옮기기(interiorMoveObjects).
import { roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import type { BuildRun, PlaceBuildResult, PlaceRecord, PlaceSpec } from "../../shared/types";
import { Obj, Room, Rebuild, InteriorState, FILL_BARE_PCT, findPart } from "./interiorKind";
import { argsFromRebuild, build, placeAnchor, fillBare } from "./interiorFill";
import { cosyFor, dressEmptyRooms } from "./interiorCosy";
import { placeInVenue, applyStamps, addBackDoor } from "./interiorFloors";

/**
 * 이미 지어진 layout 방을 «똑같이» 다시 지을 인자를 찾는다 — 같은 방 구성(종류만 / 종류+크기)으로 지어 네 층 타일이 원래와 같으면 그 인자를 쓴다.
 * 찾으면 고치기가 원래 그림에서 출발한다(견본 가구 비키기·뒷문 자리 만들기가 된다). 못 찾으면 undefined(덧찍기로 고친다). 맵은 원래대로 둔다.
 */
export function adoptExactInterior(run: BuildRun, mapId: string): { tilesetId: string; args: Record<string, unknown>; rooms: { id: string; kind: string }[] } | undefined {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map) return undefined;
  const locs = (map.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room"));
  if (!locs.length) return undefined;
  const sig = (m: typeof map) => JSON.stringify([m.width, m.height, m.lowerTiles, m.lowerOverlayTiles ?? [], m.upperTiles, m.upperOverlayTiles ?? []]);
  const want = sig(map);
  const tries = [locs.map((l) => ({ kind: l.name })), locs.map((l) => ({ kind: l.name, w: l.w, h: l.h }))];
  try {
    for (const rooms of tries) {
      const res = build(run, { tileset: map.tilesetId, mapId, name: map.name, replace: true, layout: { rooms } });
      const now = run.ctx.project.maps[mapId];
      if (!res.ok || !now || sig(now) !== want) { run.ctx.project = project; continue; }
      const rb = res.data?.rebuild as Rebuild | undefined;
      if (!rb) { run.ctx.project = project; continue; }
      const args = argsFromRebuild({ tileset: map.tilesetId, mapId, name: map.name }, rb);
      const again = build(run, args);
      const ok = again.ok && sig(run.ctx.project.maps[mapId]!) === want;
      run.ctx.project = project;
      if (ok) return { tilesetId: map.tilesetId, args, rooms: rb.rooms.map((r, i) => ({ id: r.id, kind: locs[i]?.name ?? r.id })) };
    }
  } catch { run.ctx.project = project; }
  run.ctx.project = project;
  return undefined;
}

/** 똑같이 다시 지은 인자에서 고치기 — 아늑하게(빈 자리 소품·빈 바닥 한 벌), 주인공 물건 더하기, 북쪽 뒷문. 방 배치는 그대로. */
export function interiorEditFromArgs(run: BuildRun, spec: PlaceSpec, base: { tilesetId: string; args: Record<string, unknown>; rooms: readonly { id: string; kind: string }[] }, req: { dressing: number; adds: readonly { zone?: string; what: string; near?: { x: number; y: number } }[]; north: boolean }, prev?: InteriorState): PlaceBuildResult {
  const roomSpec = roomSpecOf(run.ctx.project.tilesets[base.tilesetId])!;
  let args = prev?.args ?? base.args;
  const mapId = String(args.mapId);
  let rb: Rebuild = { rooms: args.rooms as Room[], connect: args.connect as unknown[], exit: args.exit, objects: [...(args.objects as Obj[])], tables: args.tables as Rebuild["tables"], goods: args.goods as Obj[], lines: args.lines as unknown[], daises: args.daises as unknown[] };
  const notes: string[] = [];
  const missing: string[] = [];
  const placed = [...(prev?.placed ?? [])];
  for (const add of req.adds) {
    const part = findPart(roomSpec, add.what);
    if (!part) { missing.push(`${add.what} — 부품 사전에 없다`); continue; }
    const room = rb.rooms.find((r) => r.id === add.zone || r.id.startsWith(add.zone ?? "\u0000")) ?? (add.near ? rb.rooms.find((r) => add.near!.x >= r.x0 && add.near!.x <= r.x1 && add.near!.y >= r.y0 && add.near!.y <= r.y1) : undefined) ?? rb.rooms[0]!;
    const done = placeAnchor(run, roomSpec, args, rb, room.id, part, add.near, true);
    if (!done) { missing.push(`${add.what}(${room.id}) — 놓을 빈 자리가 없다`); continue; }
    args = done.args; rb = done.rb; placed.push({ zone: room.id, what: add.what, id: part.id });
  }
  if (req.dressing > 0) {
    let added = 0;
    const kindOf = new Map(base.rooms.map((r) => [r.id, r.kind] as const));
    for (const room of [...rb.rooms].sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))) for (const word of cosyFor(kindOf.get(room.id) ?? room.id, base.rooms.length === 1 ? spec.name : "")) {
      if (added >= req.dressing * 3) break;
      const part = roomSpec.objects[word] ? { id: word, kind: roomSpec.objects[word]!.kind, w: roomSpec.objects[word]!.w, h: roomSpec.objects[word]!.h } : findPart(roomSpec, word);
      if (!part) continue;
      const done = placeAnchor(run, roomSpec, args, rb, room.id, part, undefined, false);
      if (done) { args = done.args; rb = done.rb; added++; }
    }
    const kinds = new Map(base.rooms.map((r) => [r.id, r.kind] as const));
    build(run, args);
    const filled = fillBare(run, roomSpec, args, rb, kinds, FILL_BARE_PCT, spec.name);
    args = filled.args; rb = filled.rb;
    notes.push(`원래 방 배치·바닥은 그대로 두고 아늑한 소품 ${added}점${filled.filled ? `, 빈 바닥 ${filled.filled}곳에 쓰임 한 벌` : ""}을 더했다`);
  }
  let backDoor = prev?.backDoor;
  const mapIds = [mapId];
  if (req.north && !backDoor) {
    const door = addBackDoor(run, roomSpec, base.tilesetId, args, rb, mapId, spec.name, undefined, /kitchen|storeroom|pantry|cellar|corridor|hall/u);
    args = door.args; notes.push(door.note);
    if (door.backDoor) backDoor = door.backDoor; else missing.push(door.note);
  }
  if (backDoor) mapIds.push(backDoor.mapId);
  const final = build(run, args);
  const entrance = Array.isArray(final.data?.entrance) ? (final.data!.entrance as { x: number; y: number }[])[0] : undefined;
  const state: InteriorState = { tilesetId: base.tilesetId, mapId, args, placed, ...(backDoor ? { backDoor } : {}), adopted: base };
  return { ok: final.ok, mapIds, ...(entrance ? { entrance: { mapId, ...entrance } } : {}), summary: `${spec.name}: 원래 방을 똑같이 다시 짓고 고쳤다 — ${notes.join(" / ") || "바꾼 것 없음"} — ${final.summary.slice(0, 160)}`,
    warnings: [...notes, ...((final.data?.warnings as string[] | undefined) ?? []).slice(0, 3)], missingArt: missing, calls: run.calls, state };
}

export function interiorAddAnchors(run: BuildRun, record: PlaceRecord, adds: readonly { zone?: string; what: string; near?: { x: number; y: number } }[]): PlaceBuildResult {
  const state = record.result.state as InteriorState;
  const roomSpec = roomSpecOf(run.ctx.project.tilesets[state.tilesetId])!;
  let args = state.args;
  if (state.venue) {
    // 장소 견본(평면) 위에 더하기 — 방 사각형이 없으니 평면 빈 자리에.
    const missingV: string[] = [];
    const placedV = [...state.placed];
    for (const add of adds) {
      const part = findPart(roomSpec, add.what);
      if (!part) { missingV.push(`${add.what} — 부품 사전에 없다`); continue; }
      const next = placeInVenue(run, roomSpec, args, part);
      if (next) { args = next; placedV.push({ zone: state.venue, what: add.what, id: part.id }); } else missingV.push(`${add.what} — 놓을 빈 자리가 없다`);
    }
    const fin = build(run, args);
    applyStamps(run, state.tilesetId, state.mapId, state.stamps);
    return { ok: fin.ok, mapIds: record.result.mapIds, ...(record.result.entrance ? { entrance: record.result.entrance } : {}),
      summary: `${record.spec.name}: 더한 물건 ${placedV.slice(state.placed.length).map((p) => p.id).join(", ") || "없음"} — ${fin.summary.slice(0, 160)}`,
      warnings: [], missingArt: missingV, calls: run.calls, state: { ...state, args, placed: placedV } };
  }
  let rb: Rebuild = { rooms: args.rooms as Room[], connect: args.connect as unknown[], exit: args.exit, objects: [...(args.objects as Obj[])], tables: args.tables as Rebuild["tables"], goods: args.goods as Obj[], lines: args.lines as unknown[], daises: args.daises as unknown[] };
  const missing: string[] = [];
  const placed = [...state.placed];
  for (const add of adds) {
    const part = findPart(roomSpec, add.what);
    if (!part) { missing.push(`${add.what} — 부품 사전에 없다`); continue; }
    const room = rb.rooms.find((r) => r.id === add.zone || r.id.startsWith(add.zone ?? "\u0000")) ?? (add.near ? rb.rooms.find((r) => add.near!.x >= r.x0 && add.near!.x <= r.x1 && add.near!.y >= r.y0 && add.near!.y <= r.y1) : undefined) ?? rb.rooms[0]!;
    const done = placeAnchor(run, roomSpec, args, rb, room.id, part, add.near, true);
    if (!done) { missing.push(`${add.what}(${room.id}) — 놓을 빈 자리가 없다`); continue; }
    args = done.args; rb = done.rb; placed.push({ zone: room.id, what: add.what, id: part.id });
  }
  const final = build(run, args);
  const dressNotes: string[] = [];
  if (final.ok) dressEmptyRooms(run, state.mapId, (record.spec.zones ?? []).map((z) => ({ kind: String(z.kind ?? ""), id: String(z.id ?? z.kind ?? ""), purpose: z.purpose })), dressNotes);
  return { ok: final.ok, mapIds: record.result.mapIds, ...(record.result.entrance ? { entrance: record.result.entrance } : {}),
    summary: `${record.spec.name}: 더한 물건 ${placed.slice(state.placed.length).map((p) => p.id).join(", ") || "없음"} — ${final.summary.slice(0, 160)}`,
    warnings: dressNotes, missingArt: missing, calls: run.calls, state: { ...state, args, placed } };
}

// ───── 놓인 가구 하나 옮기기·돌리기·빼기(move_object) ─────
// 비평(VQA)이 「침대가 문을 막는다」「의자가 벽을 본다」를 짚어도 고칠 길이 다시 짓기뿐이었다 — 다시 지으면 견본 가구가 다시 나와
// 같은 결함이 남았다(2026-10-25 빌더 보고: VQA 결함 6건이 끝까지 그대로). 마지막 도구 인자(args.objects)에서 그 물건만 바꿔 다시 짓는다.

export interface ObjectEdit {
  /** 그 물건이 덮는 칸 하나(비평이 짚은 칸). */
  readonly at: { readonly x: number; readonly y: number };
  /** 옮길 칸 — at 이 가리킨 칸이 이 칸으로 가게 통째로 민다. */
  readonly to?: { readonly x: number; readonly y: number };
  /** 바라보는 쪽 — 같은 물건의 다른 방향 그림으로 바꾼다(그림이 있을 때만). */
  readonly face?: "N" | "S" | "E" | "W";
  readonly remove?: boolean;
}

const FACE_WORD = /\s+(?:N|S|E|W|north|south|east|west)$/iu;

/** 그 칸을 덮는 물건(원점이 같으면 그것, 아니면 몸체가 덮는 것). */
function objectAt(spec: HandInteriorSpec, objects: readonly Obj[], at: { x: number; y: number }): number {
  const exact = objects.findIndex((o) => o.x === at.x && o.y === at.y);
  if (exact >= 0) return exact;
  return objects.findIndex((o) => {
    const def = spec.objects[o.id.split(":")[0]!];
    const w = Math.max(1, def?.w ?? 1), h = Math.max(1, def?.h ?? 1);
    return at.x >= o.x && at.x < o.x + w && at.y >= o.y && at.y < o.y + h;
  });
}

/** 같은 물건의 다른 방향 그림 id(「chair S」 → 「chair E」). 없으면 undefined. */
function facedPart(spec: HandInteriorSpec, id: string, face: string): string | undefined {
  const [base, ...rest] = id.split(":");
  const family = base!.replace(FACE_WORD, "");
  const hit = Object.keys(spec.objects).find((k) => k !== base && k.replace(FACE_WORD, "") === family && (spec.objects[k] as { facing?: string }).facing === face);
  return hit ? [hit, ...rest].join(":") : undefined;
}

export function interiorMoveObjects(run: BuildRun, spec: PlaceSpec, base: { tilesetId: string; args: Record<string, unknown> }, edits: readonly ObjectEdit[], prev?: InteriorState): PlaceBuildResult {
  const roomSpec = roomSpecOf(run.ctx.project.tilesets[base.tilesetId]);
  const mapId = String(base.args.mapId ?? spec.mapId ?? "");
  const fail = (summary: string): PlaceBuildResult => ({ ok: false, mapIds: [mapId], summary, warnings: [], missingArt: [], calls: run.calls });
  if (!roomSpec) return fail("이 맵의 칩셋에는 손 도트 실내 부품 사전이 없다 — 가구 옮기기는 손 도트 실내만 된다");
  const objects: Obj[] = [...((base.args.objects as Obj[] | undefined) ?? [])];
  const done: string[] = [];
  const problems: string[] = [];
  for (const edit of edits) {
    const i = objectAt(roomSpec, objects, edit.at);
    if (i < 0) {
      const near = objects.filter((o) => Math.abs(o.x - edit.at.x) <= 3 && Math.abs(o.y - edit.at.y) <= 3).slice(0, 6).map((o) => `${o.id}(${o.x},${o.y})`);
      problems.push(`(${edit.at.x},${edit.at.y}) 에 놓인 가구가 없다${near.length ? ` — 가까운 가구: ${near.join(", ")}` : ""}(탁자·상품·단상은 이 동사로 못 옮긴다)`);
      continue;
    }
    const o = objects[i]!;
    const name = `${roomSpec.objects[o.id.split(":")[0]!]?.ko ?? o.id}(${o.x},${o.y})`;
    if (edit.remove) { objects.splice(i, 1); done.push(`${name} 뺌`); continue; }
    let next: Obj = o;
    if (edit.face) {
      const turned = facedPart(roomSpec, o.id, edit.face);
      if (turned) next = { ...next, id: turned };
      else problems.push(`${name} — ${edit.face} 쪽을 보는 그림이 없다(그대로 둠)`);
    }
    if (edit.to) next = { ...next, x: o.x + edit.to.x - edit.at.x, y: o.y + edit.to.y - edit.at.y };
    if (next !== o) { objects[i] = next; done.push(`${name} → ${next.id === o.id ? "" : `${next.id} `}(${next.x},${next.y})`); }
  }
  if (!done.length) return fail(`바꾼 가구가 없다: ${problems.join(" · ")}`);
  const args = { ...base.args, objects };
  const attempt = build(run, args);
  const revert = () => { build(run, base.args); if (prev?.stamps) applyStamps(run, base.tilesetId, mapId, prev.stamps); };
  if (!attempt.ok) { revert(); return fail(`그렇게 놓으면 방을 지을 수 없어 되돌렸다(${attempt.summary.slice(0, 160)}) — 다른 칸으로`); }
  if (Array.isArray(attempt.data?.unreachedFloor) && (attempt.data!.unreachedFloor as unknown[]).length > 0) {
    revert();
    return fail(`그렇게 놓으면 바닥 ${(attempt.data!.unreachedFloor as unknown[]).length}칸에 갈 수 없게 돼 되돌렸다 — 길을 막지 않는 칸으로`);
  }
  if (prev?.stamps) applyStamps(run, base.tilesetId, mapId, prev.stamps);
  const placed = prev?.placed ?? [];
  const state: InteriorState = { ...(prev ?? {}), tilesetId: base.tilesetId, mapId, args, placed };
  return { ok: true, mapIds: [mapId], summary: `${spec.name ?? mapId}: ${done.join(" · ")}`, warnings: problems, missingArt: [], calls: run.calls, state };
}
