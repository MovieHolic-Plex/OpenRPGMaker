// 실내 장소의 덧붙는 판 — 장소 견본으로 짓기(buildVenue), 뒷문(addBackDoor), 위층(buildUpperFloor).
import { HAND_INTERIOR_TILESET_ID, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { roomTemplates } from "@/editor/handInterior/templates";
import { INTERIOR_BARE_FLOOR_LIMIT } from "@/editor/handInterior/bareFloor";
import type { BuildRun, PlaceBuildResult, PlaceSpec } from "../../shared/types";
import { type InteriorVenue, type VenueStamp } from "./interiorVenues";
import { type DesignRoomReport } from "@/editor/handInterior/designRoom";
import { Obj, Room, Rebuild, InteriorState, resolveKind, findPart } from "./interiorKind";
import { occupancy, argsFromRebuild, clean, Attempt, build, reachOk, openingColumns, footprint, placeAnchor, fillBare } from "./interiorFill";
import { designedRoom } from "./interiorCosy";

/** 평면(plan) 견본 위에 물건 하나 — '.' 칸 중 비어 있고 앞 한 줄이 빈 자리(출구 줄·출구 열은 피한다), 도달 검사를 통과하는 첫 자리. */
function placeInPlan(run: BuildRun, spec: HandInteriorSpec, args: Record<string, unknown>, part: NonNullable<ReturnType<typeof findPart>>): Record<string, unknown> | undefined {
  const plan = args.plan as string[];
  const used = occupancy(spec, { rooms: [], objects: (args.objects as Obj[]) ?? [], tables: args.tables as Rebuild["tables"] });
  const floorAt = (x: number, y: number) => plan[y]?.[x] === ".";
  const exitXs = new Set<number>(); plan[plan.length - 1]!.split("").forEach((c, x) => { if (c === ".") exitXs.add(x); });
  const h = Math.max(1, part.h);
  const cands: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < plan.length - 2; y++) for (let x = 0; x < plan[0]!.length; x++) {
    let ok = true;
    for (let j = 0; j < h + (part.kind === "flat" ? 0 : 1) && ok; j++) for (let i = 0; i < part.w && ok; i++) {
      const X = x + i, Y = y + j;
      if (!floorAt(X, Y) || used.has(`${X},${Y}`) || exitXs.has(X) && Y >= plan.length - 4) ok = false;
    }
    if (!ok) continue;
    const wallAbove = !floorAt(x, y - 1) || !floorAt(x + part.w - 1, y - 1);
    cands.push({ x, y, d: (wallAbove ? 0 : 3) + Math.abs(x - plan[0]!.length / 2) * 0.05 });
  }
  cands.sort((a, b) => a.d - b.d);
  for (const at of cands.slice(0, 14)) {
    const next = { ...args, objects: [...((args.objects as Obj[]) ?? []), { id: part.id, x: at.x, y: at.y }] };
    if (reachOk(build(run, next))) return next;
  }
  return undefined;
}

/** 장소 견본 위에 물건 하나 — 평면 견본은 평면 빈 자리, 방 사각형 견본은 첫 방의 빈 자리. */
export function placeInVenue(run: BuildRun, spec: HandInteriorSpec, args: Record<string, unknown>, part: NonNullable<ReturnType<typeof findPart>>): Record<string, unknown> | undefined {
  if (Array.isArray(args.plan)) return placeInPlan(run, spec, args, part);
  const rooms = args.rooms as Room[] | undefined;
  if (!rooms?.length) return undefined;
  const rb: Rebuild = { rooms, connect: args.connect as unknown[], exit: args.exit, objects: [...((args.objects as Obj[]) ?? [])], tables: args.tables as Rebuild["tables"], goods: args.goods as Obj[], lines: args.lines as unknown[], daises: args.daises as unknown[] };
  return placeAnchor(run, spec, args, rb, rooms[0]!.id, part, undefined, false)?.args;
}

/** 견본 위에 덧찍는 그림(둥근 지붕·관측 틈) — 짓기마다 다시 찍는다(짓기가 맵을 새로 그린다). */
export function applyStamps(run: BuildRun, tilesetId: string, mapId: string, stamps: readonly VenueStamp[] | undefined): void {
  for (const s of stamps ?? []) run.call("stamp_object", { objectId: `kit:${tilesetId}/hand-interior:${s.part}`, mapId, x: s.x, y: s.y });
}

/** 장소 견본(천문대 등)으로 짓기. 요청 앵커 중 견본이 갖춘 것은 그대로, 없는 것은 평면 빈 자리에 더한다. */
export function buildVenue(run: BuildRun, spec: PlaceSpec, venue: InteriorVenue, roomSpec: HandInteriorSpec, tilesetId: string, mapId: string | undefined, prev: InteriorState | undefined): PlaceBuildResult | undefined {
  const variant = typeof spec.hints?.variant === "number" ? spec.hints.variant : (spec.salt ?? 0) % 4;
  const words = (spec.zones ?? []).flatMap((z) => z.anchors ?? []);
  const withStairs = !!venue.stairs && ((spec.floors ?? 1) >= 2 || words.some((w) => /계단|stair|2층|위층/iu.test(w)) || (spec.zones ?? []).some((z) => z.floor === 2));
  const vb = venue.build(variant, withStairs);
  let args: Record<string, unknown> = { tileset: tilesetId, mapId: prev?.mapId ?? mapId, name: spec.name, replace: (prev?.mapId ?? mapId) ? true : undefined, ...vb.args };
  let res = build(run, args);
  if (!res.ok) { args = { ...args, mapId: undefined, replace: undefined }; res = build(run, args); }
  if (!res.ok) return undefined;
  const builtMapId = String(res.data?.mapId ?? mapId);
  args = { ...args, mapId: builtMapId, replace: true };
  const placed: { zone: string; what: string; id: string }[] = [];
  const missing: string[] = [];
  for (const zone of (spec.zones ?? []).filter((z) => (z.floor ?? 1) === 1)) for (const what of zone.anchors ?? []) {
    if (venue.provides.some((re) => re.test(what))) { placed.push({ zone: venue.id, what, id: `(견본) ${what}` }); continue; }
    const part = findPart(roomSpec, what);
    if (!part) { missing.push(`${what} — 부품 사전에 없다`); continue; }
    const next = placeInVenue(run, roomSpec, args, part);
    if (next) { args = next; placed.push({ zone: venue.id, what, id: part.id }); } else missing.push(`${what} — 놓을 빈 자리가 없다`);
  }
  // 계단이 든 견본이면 위층을 짓고 잇는다(어디로도 안 가는 계단은 그리지 않는다).
  const mapIds = [builtMapId];
  let upperMapId: string | undefined, upperArgs: Record<string, unknown> | undefined;
  const notes: string[] = [];
  if (vb.stairs) {
    const up = buildUpperFloor(run, roomSpec, tilesetId, spec, builtMapId, vb.stairs, prev?.upperMapId, missing, notes, placed);
    if (up.lowerLink && up.upperMapId) { args = { ...args, links: [up.lowerLink] }; upperMapId = up.upperMapId; upperArgs = up.upperArgs; mapIds.push(up.upperMapId); }
  }
  const final = build(run, args);
  if (!final.ok) return undefined;
  applyStamps(run, tilesetId, builtMapId, vb.stamps);
  // 이 맵이 장소 견본으로 지어졌다는 표시 — 같은 게임의 다음 여관·선술집은 이 견본을 되풀이하지 않고 방 견본 변형으로 짓는다(rotateTemplate).
  const bm = run.ctx.project.maps[builtMapId];
  if (bm && !(bm.locations ?? []).some((l) => (l.tags ?? []).includes(`template:venue-${venue.id}`)))
    run.call("create_map_location", { mapId: builtMapId, name: `장소 견본 ${venue.id}`, x: 1, y: 2, w: Math.max(1, bm.width - 2), h: Math.max(1, bm.height - 3), note: "조수 실내 빌더가 장소 견본으로 지은 방(같은 게임 반복 금지 표시)", tags: [`template:venue-${venue.id}`] });
  const entrance = Array.isArray(final.data?.entrance) ? (final.data!.entrance as { x: number; y: number }[])[0] : undefined;
  if (spec.exits?.some((e) => e !== "south")) missing.push(`${spec.exits.filter((e) => e !== "south").join("·")} 출구 — 이 장소 견본은 남쪽 출구 하나다`);
  const state: InteriorState = { tilesetId, mapId: builtMapId, args, placed, stamps: vb.stamps, venue: venue.id, ...(upperMapId ? { upperMapId } : {}), ...(upperArgs ? { upperArgs } : {}) };
  return { ok: true, mapIds, ...(entrance ? { entrance: { mapId: builtMapId, ...entrance } } : {}),
    summary: `${spec.name}: 장소 견본 「${venue.id}」(검증된 제작자 구성${variant % 2 ? ", 좌우 뒤집음" : ""})으로 지었다 — 주인공 물건 ${placed.map((p) => p.what).join("·") || "없음"} — ${final.summary.slice(0, 160)}`,
    warnings: [...notes, ...((final.data?.warnings as string[] | undefined) ?? []).filter((w) => !/허공|천장 띠|ㅁ자/u.test(w)).slice(0, 4)], missingArt: missing, calls: run.calls, state };
}

/** 북쪽 뒷문: 맨 북쪽 바깥 벽 방의 벽면에 아치 문틀을 걸고, 그 아래 칸을 작은 뒷방 맵으로 잇는다(뒷방 남쪽 출구는 다시 이 문 앞으로).
 *  칩셋에 북벽 «문» 그림이 없어서 아치 문틀(round arch, 3칸)을 쓴다 — 계단·문 계약처럼 문 그림 + 그 아래 이동 칸 한 쌍이다. */
export function addBackDoor(run: BuildRun, roomSpec: HandInteriorSpec, tilesetId: string, args: Record<string, unknown>, rb: Rebuild, mapId: string, name: string, prevBack: InteriorState["backDoor"], prefer: RegExp): { args: Record<string, unknown>; backDoor?: NonNullable<InteriorState["backDoor"]>; note: string } {
  // 문 그림: 벽 발치에 서는 나무 문(locked door, 쇠띠 두른 나무 문 1칸) > 아치 문틀. 1배 견본 비교(2026-10-23): 둥근 문은 술통 뚜껑으로, 아치는 벽 속 장식으로 읽혔다.
  const arch = roomSpec.objects["locked door"] ? "locked door" : roomSpec.objects["round arch"] ? "round arch" : undefined;
  if (!arch) return { args, note: "북쪽 뒷문 — 칩셋에 벽에 거는 문·아치 그림이 없다" };
  const standing = roomSpec.objects[arch]!.kind !== "hang";
  const part = { id: arch, kind: roomSpec.objects[arch]!.kind, w: roomSpec.objects[arch]!.w, h: roomSpec.objects[arch]!.h };
  const top = Math.min(...rb.rooms.map((r) => r.y0));
  const hosts = rb.rooms.filter((r) => r.y0 === top).sort((a, b) => Number(prefer.test(b.id)) - Number(prefer.test(a.id)) || (b.x1 - b.x0) - (a.x1 - a.x0));
  const hangUsed = new Set<string>();
  for (const o of rb.objects) { const d = roomSpec.objects[o.id.split(":")[0]!]; if (d?.kind === "hang") for (let i = 0; i < d.w; i++) hangUsed.add(`${o.x + i},${o.y}`); }
  // 뒷방(작은 창고) — 남쪽 출구가 이 문으로 돌아온다.
  const back = build(run, { tileset: tilesetId, ...(prevBack ? { mapId: prevBack.mapId, replace: true } : {}), name: `${name} 뒷방`, layout: { rooms: [{ kind: "storeroom", w: 7, h: 6 }] } });
  if (!back.ok) return { args, note: `북쪽 뒷문 — 뒷방을 짓지 못했다: ${back.summary.slice(0, 100)}` };
  const backId = String(back.data?.mapId);
  const backEnt = Array.isArray(back.data?.entrance) ? (back.data!.entrance as { x: number; y: number }[])[0] : undefined;
  if (!backEnt) return { args, note: "북쪽 뒷문 — 뒷방 출입구를 찾지 못했다" };
  for (const room of hosts) {
    const cx = Math.floor((room.x0 + room.x1) / 2);
    const xs = Array.from({ length: room.x1 - room.x0 - part.w + 2 }, (_, i) => room.x0 + i);
    // 문 앞 두 칸(문 아래 바닥 첫 줄·둘째 줄)을 막는 가구는 비켜 낸다(벽 가구 하나 정도) — 덜 비키는 자리, 가운데 가까운 자리부터.
    const ranked = xs.map((x) => {
      const doorX = x + Math.floor(part.w / 2), doorY = room.y0 + 2 + (standing ? 1 : 0);
      const blocks = new Set([`${doorX},${room.y0 + 2}`, `${doorX},${room.y0 + 3}`, `${doorX},${room.y0 + 4}`]);
      const victims = rb.objects.filter((o) => footprint(roomSpec, o).some((c) => blocks.has(c)) || (roomSpec.objects[o.id.split(":")[0]!]?.kind === "hang" && o.y === room.y0 && o.x <= x + part.w - 1 && x <= o.x + (roomSpec.objects[o.id.split(":")[0]!]?.w ?? 1) - 1));
      return { x, doorX, doorY, victims, cost: victims.length * 10 + Math.abs(doorX - cx) };
    }).filter((r) => !r.victims.some((v) => /stairs|stairwell/u.test(v.id))).sort((a, b) => a.cost - b.cost);
    void hangUsed;
    for (const { x, doorX, doorY, victims } of ranked.slice(0, 6)) {
      const gone = new Set(victims.map((v) => `${v.id}@${v.x},${v.y}`));
      const kept = ((args.objects as Obj[]) ?? []).filter((o) => !gone.has(`${o.id}@${o.x},${o.y}`));
      const links = [...((args.links as unknown[]) ?? []).filter((l) => (l as { toMapId?: string }).toMapId !== backId),
        { x: doorX, y: doorY, toMapId: backId, toX: backEnt.x, toY: backEnt.y - 1, direction: "up" }];
      // 서 있는 문은 바닥에 선 벽장처럼 읽혔다(눈가림 2차) — 벽면에 아치 문틀을 같이 걸어 「벽에 난 문」으로 읽히게(문틀이 안 들어가면 문만).
      const framed = standing && roomSpec.objects["round arch"] && x - 1 >= room.x0 ? [{ id: "round arch", x: x - 1, y: room.y0 }] : [];
      let next = { ...args, objects: [...kept.filter((o) => !(roomSpec.objects[o.id.split(":")[0]!]?.kind === "hang" && o.y === room.y0 && o.x <= x + 1 && o.x + (roomSpec.objects[o.id.split(":")[0]!]?.w ?? 1) - 1 >= x - 1) || !framed.length), ...framed, { id: arch, x, y: standing ? room.y0 + 2 : room.y0 }], links };
      let tryBuild = build(run, next);
      if (framed.length && !reachOk(tryBuild)) { next = { ...args, objects: [...kept, { id: arch, x, y: standing ? room.y0 + 2 : room.y0 }], links }; tryBuild = build(run, next); }
      if (!reachOk(tryBuild)) continue;
      let backArgs: Record<string, unknown> = { ...argsFromRebuild({ tileset: tilesetId, mapId: backId, name: `${name} 뒷방` }, back.data?.rebuild as Rebuild), links: [{ x: backEnt.x, y: backEnt.y, toMapId: mapId, toX: doorX, toY: doorY + 1, direction: "down" }] };
      const backFinal = build(run, backArgs);
      if (!backFinal.ok) continue;
      // 뒷방이 휑하지 않게 창고 쓰임 한 벌로 채운다.
      const backRb = { ...(back.data?.rebuild as Rebuild), objects: backArgs.objects as Obj[] };
      backArgs = fillBare(run, roomSpec, backArgs, backRb, new Map(backRb.rooms.map((r) => [r.id, "storeroom"] as const)), INTERIOR_BARE_FLOOR_LIMIT).args;
      build(run, next);
      return { args: next, backDoor: { mapId: backId, args: backArgs }, note: `북쪽 뒷문: ${room.id} 북벽 발치 (${x},${standing ? room.y0 + 2 : room.y0})에 ${arch}, 문 앞 (${doorX},${doorY})에서 뒷방 ${backId} 로 잇는다(뒷방 남쪽 출구로 돌아온다)` };
    }
  }
  return { args, note: "북쪽 뒷문 — 맨 북쪽 방 북벽에 문을 낼 자리가 없다" };
}

/** 위층 맵 이름 — 「저택 1층」이면 「저택 2층」(「저택 1층 2층」이 되지 않게). */
function upperName(name: string): string {
  return /\s*(1층|일층|1F|1st floor)\s*$/iu.test(name) ? name.replace(/\s*(1층|일층|1F|1st floor)\s*$/iu, " 2층") : `${name} 2층`;
}

/** 위층: 올라가는 계단이 놓인 아래층(builtMapId)에 위층을 짓고 계단끼리 잇는다. 아래층에 붙일 이동(lowerLink)을 돌려준다. */
export function buildUpperFloor(run: BuildRun, roomSpec: HandInteriorSpec, tilesetId: string, spec: PlaceSpec, builtMapId: string, stairsUp: { id: string; x: number; y: number; w: number }, prevUpper: string | undefined, missing: string[], notes: string[], placed: { zone: string; what: string; id: string }[]): { upperMapId?: string; upperArgs?: Record<string, unknown>; lowerLink?: Record<string, unknown> } {
  // 이전 차례 상태가 없어도 앞서 이 아래층에 지어 둔 위층(같은 이름, 이 아래층으로 내려가는 계단 링크가 있는 맵)을 다시 쓴다 — 2026-10-29 vm3 argon 추리:
  // 「여관 1층」을 차례마다 다시 짓자 「여관 2층」 15×15 가 셋 생겨 둘이 고아(unreachable-map)로 남았다.
  const sameName = (a: string | undefined, b: string) => (a ?? "").replace(/\s+/gu, "") === b.replace(/\s+/gu, "");
  let upperMapId = prevUpper ?? Object.values(run.ctx.project.maps).find((m) => m.id !== builtMapId && sameName(m.name, upperName(spec.name))
    && (m.events ?? []).some((e) => e.id.startsWith(`${m.id}-link-`) && JSON.stringify(e.pages ?? []).includes(`"mapId":"${builtMapId}"`)))?.id;
  let upperArgs: Record<string, unknown> | undefined;
  let lowerLink: Record<string, unknown> | undefined;
    const upperZones = (spec.zones ?? []).filter((z) => z.floor === 2);
    const known = (k: string) => roomTemplates(tilesetId).some((t) => t.kind === k);
    let upKinds = upperZones.length ? upperZones.map((z) => resolveKind(tilesetId, z, notes, spec.name)) : ["inn_room", "inn_room", "corridor"].filter(known);
    // 위층에는 계단통을 놓을 복도·홀이 있어야 한다 — 방 하나(객실)만 달라고 해도 복도를 붙인다(2026-10-23 실조수: 객실 하나뿐이라 내려가는 계단 자리가 없었다).
    if (!upKinds.some((k) => /corridor|hall|landing/u.test(k)) && known("corridor")) {
      // 방 하나 + 복도면 견본이 2칸 폭 복도를 골라 계단통이 안 들어간다 — 방을 둘 이상으로 채워 넓은 복도 견본을 받는다.
      while (upKinds.length < 2) upKinds = [...upKinds, upKinds[0] ?? "inn_room"];
      upKinds = [...upKinds, "corridor"];
    }
    const upBase: Record<string, unknown> = { tileset: tilesetId, ...(upperMapId ? { mapId: upperMapId, replace: true } : {}), name: upperName(spec.name),
      // 복도는 방 수에 맞춘 작은 계단참(방마다 4칸 + 1, 높이 5) — 견본 크기 그대로면 38칸짜리 빈 홀이 됐다.
      layout: { rooms: (upKinds.length ? upKinds : ["bedroom"]).map((kind, i, all) => ({ id: `${kind}${i + 1}`, kind, ...(/corridor/u.test(kind) ? { w: Math.max(9, 4 * (all.length - 1) + 1), h: 5 } : {}) })) } };
    // 위층은 배치 후보 넷 중 맵 틀 안 검은 바깥이 가장 적은 것(방 넓이 ÷ 맵 넓이 최대) — 객실 둘 + 긴 복도가 ㄱ자로 앉아 왼쪽 위가 통째로 검었다(비평 major).
    // 위층 방도 모델 설계(zone.design)면 설계대로 — 객실 견본 둘 + 복도를 깔지 않는다(2026-10-29 «위층까지 모델이 설계»). 계단통을 놓을 복도·홀이 설계에 없으면 계단참 하나만 함수가 붙인다.
    const designedUp = tilesetId === HAND_INTERIOR_TILESET_ID && upperZones.some((z) => z.design && typeof z.design === "object");
    if (designedUp) {
      const usedK = new Map<string, number>();
      const droom = upperZones.map((z) => {
        const kind = resolveKind(tilesetId, z, notes, spec.name);
        const n = (usedK.get(kind) ?? 0) + 1; usedK.set(kind, n);
        return z.design && typeof z.design === "object" ? designedRoom(z, kind, n, z.design, roomSpec, notes) : { id: z.id ?? (n > 1 ? `${kind}${n}` : kind), kind, design: undefined };
      });
      // 계단통(3칸 폭)은 설계 방 가운데 넓은 방에 선다 — 설계 방이 모두 좁을 때만(바닥 24칸 미만) 계단참 복도를 붙인다(빈 복도가 맨바닥 덩이가 됐다).
      const hub = droom.some((r) => /corridor|hall|landing/u.test(r.kind) || ((r as { w?: number }).w ?? 0) * (((r as { h?: number }).h ?? 2) - 2) >= 24);
      const roomsUp = [...droom.map((r) => clean({ id: r.id, kind: r.kind, w: (r as { w?: number }).w, h: (r as { h?: number }).h, floor: (r as { floor?: string }).floor, wall: (r as { wall?: string }).wall, notches: (r as { notches?: unknown }).notches })),
        ...(hub || !known("corridor") ? [] : [{ id: "corridor", kind: "corridor", w: Math.max(9, 4 * droom.length + 1), h: 5 }])];
      const designsUp = Object.fromEntries(droom.filter((r) => r.design).map((r) => [r.id, r.design!] as const));
      (upBase as { layout: unknown }).layout = { rooms: roomsUp, designs: designsUp };
    }
    let up = build(run, upBase);
    if (designedUp && up.ok) {
      for (const r of ((up.data?.layout as { rooms?: { id: string; design?: DesignRoomReport }[] } | undefined)?.rooms ?? [])) if (r.design) {
        notes.push(`설계 방(위층) ${r.id}: 묶음 ${r.design.placed.length}개·기물 ${r.design.items}점을 설계대로 놓았다(막힌 바닥 ${Math.round(r.design.blockedShare * 100)}%)${r.design.fixes.length ? ` — 함수가 고친 것 ${r.design.fixes.length}건` : " — 함수가 고친 것 없음"}`);
        for (const f of r.design.fixes) notes.push(`고침(위층): ${f}`);
      }
    }
    const fill = (a: Attempt) => {
      const rr = (a.data?.rebuild as Rebuild | undefined)?.rooms ?? [];
      const m = run.ctx.project.maps[String(a.data?.mapId)];
      return m ? rr.reduce((n, r) => n + (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 3), 0) / (m.width * m.height) : 0;
    };
    // 검은 바깥(공허 칸) 수가 먼저, 같으면 방 넓이 비율. 복도 폭도 ±2 로 바꿔 본다 — 객실 줄이 복도보다 두 칸 좁아 위층 맵 귀퉁이에
    // 2×7 공허 덩이가 늘 남았다(2026-10-29 standin 마법학교 「별빛 기숙사」 13×16: 배치 후보 넷 모두 같은 귀퉁이가 검었다).
    const voidCells = (a: Attempt) => {
      const m = run.ctx.project.maps[String(a.data?.mapId)];
      return m ? (m.lowerTiles as readonly number[]).reduce((n, t) => n + (t === roomSpec.void ? 1 : 0), 0) : Number.POSITIVE_INFINITY;
    };
    if (up.ok && !designedUp) {
      const rooms0 = (upBase.layout as { rooms: { id: string; kind: string; w?: number; h?: number }[] }).rooms;
      const corridorW = rooms0.find((r) => typeof r.w === "number")?.w;
      const widths = corridorW === undefined ? [undefined] : [...new Set([corridorW, corridorW - 2, corridorW - 1, corridorW + 1, corridorW + 2])].filter((w) => w >= 7);
      const layoutFor = (w: number | undefined, v: number) => ({ rooms: rooms0.map((r) => (w !== undefined && typeof r.w === "number" ? { ...r, w } : r)), ...(v ? { variant: v } : {}) });
      let best = { w: corridorW, v: 0, z: voidCells(up), f: fill(up) };
      for (const w of widths) for (let v = 0; v <= 3; v++) {
        if (w === corridorW && v === 0) continue;
        const alt = build(run, { ...upBase, mapId: String(up.data?.mapId), replace: true, layout: layoutFor(w, v) });
        if (!alt.ok) continue;
        const z = voidCells(alt), f = fill(alt);
        if (z < best.z || (z === best.z && f > best.f + 0.02)) best = { w, v, z, f };
      }
      up = build(run, { ...upBase, mapId: String(up.data?.mapId), replace: true, layout: layoutFor(best.w, best.v) });
    }
    if (up.ok) {
      upperMapId = String(up.data?.mapId);
      let urb = up.data?.rebuild as Rebuild;
      // 위층은 바깥으로 나가는 남쪽 문이 없다(계단으로만 오간다).
      let uargs: Record<string, unknown> = { ...argsFromRebuild({ tileset: tilesetId, mapId: upperMapId, name: upperName(spec.name) }, urb), exitWidth: 0, exit: { ...(urb.exit as object), width: 0 } };
      urb = { ...urb, exit: uargs.exit, objects: urb.objects.filter((o) => !/doormat|door mat/u.test(o.id)) };
      uargs = { ...uargs, objects: urb.objects };
      const down = findPart(roomSpec, "stairwell down");
      const hubs = [...urb.rooms].sort((a, b) => Number(/corridor|hall/u.test(b.id)) - Number(/corridor|hall/u.test(a.id)) || (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
      let placedDown: ReturnType<typeof placeAnchor> | undefined;
      for (const hub of hubs) { placedDown = down ? placeAnchor(run, roomSpec, uargs, urb, hub.id, down, undefined, true, new Set(), openingColumns(urb, up.data)) : undefined; if (placedDown) break; }
      if (placedDown) {
        uargs = placedDown.args; urb = placedDown.rb;
        const d = urb.objects[urb.objects.length - 1]!;
        // 계단통 바로 둘레(위 한 줄·양옆)의 견본 의자·벤치는 치운다 — 「계단 앞을 벤치가 막고 있다」(눈가림 2차).
        const near = (o: Obj) => o !== d && o.x >= d.x - 1 && o.x <= d.x + 3 && o.y >= d.y - 1 && o.y <= d.y + 2 && /bench|chair|stool/u.test(o.id);
        if (urb.objects.some(near)) { urb = { ...urb, objects: urb.objects.filter((o) => !near(o)) }; uargs = { ...uargs, objects: urb.objects }; }
        // 위층 계단통 → 아래층 계단 앞, 아래층 계단 → 위층 계단통 앞. 칸은 도구의 계단 계약(fitStairTransfers)이 맞춘다.
        uargs = { ...uargs, links: [{ x: d.x + 1, y: d.y, toMapId: builtMapId, toX: stairsUp.x + 1, toY: stairsUp.y + 1, direction: "down" }] };
        // 위층 구역의 주인공 물건(침대·옷장…) — 계단 낱말은 이미 계단통으로 놓았다.
        for (const zone of upperZones) for (const what of zone.anchors ?? []) {
          if (/계단|stair/iu.test(what)) continue;
          const part = findPart(roomSpec, what);
          if (!part) { missing.push(`${what}(위층) — 부품 사전에 없다`); continue; }
          const host = urb.rooms.find((r) => r.id.startsWith(resolveKind(tilesetId, zone, [], spec.name))) ?? urb.rooms[0]!;
          const done = placeAnchor(run, roomSpec, uargs, urb, host.id, part, undefined, true, new Set(), openingColumns(urb, up.data));
          if (done) { uargs = done.args; urb = done.rb; placed.push({ zone: `2층 ${host.id}`, what, id: part.id }); }
          else missing.push(`${what}(위층 ${host.id}) — 놓을 빈 자리가 없다`);
        }
        build(run, uargs);
        // 위층은 기준보다 낮게(8%) 메운다 — 객실 벽면이 분모를 키워 15% 안이어도 계단참 아래 절반이 비어 보였다.
        // 설계 위층은 함수가 고른 물건으로 빈 바닥을 메우지 않는다(맨바닥은 모델이 설계를 고쳐 줄인다).
        if (!designedUp) {
          const ufill = fillBare(run, roomSpec, uargs, urb, new Map(urb.rooms.map((r) => [r.id, r.id.replace(/\d+$/u, "")] as const)), 8, spec.name);
          uargs = ufill.args; urb = ufill.rb;
        }
        const upFinal = build(run, uargs);
        if (upFinal.ok) {
          lowerLink = { x: stairsUp.x + 1, y: stairsUp.y, toMapId: upperMapId, toX: d.x + 1, toY: d.y + 2, direction: "up" };
          upperArgs = uargs;
          
        } else missing.push(`위층 계단 잇기 실패: ${upFinal.summary.slice(0, 120)}`);
      } else missing.push("위층 내려가는 계단통 자리를 못 찾았다");
    } else missing.push(`위층을 짓지 못했다: ${up.summary.slice(0, 120)}`);
  return { ...(lowerLink ? { upperMapId, upperArgs, lowerLink } : {}) };
}
