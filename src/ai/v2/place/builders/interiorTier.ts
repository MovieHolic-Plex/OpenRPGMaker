// 크기 단(중형·대형·초대형 공간) — 문이 달린 집 킷의 `tier:` 태그가 단을 정하고, 칩셋의 구성 표(handInterior/tierPlan.ts)가 방 여럿·맵 여럿을 짠다.
// 요청 낱말·프롬프트 글은 보지 않는다: 단 = 킷 태그, 무엇의 집인가 = 그 장소의 방 종류(resolveKind) 다음 킷의 `interior:` 태그.
// 짓기는 있는 도구 그대로 — build_hand_interior_room 의 layout.placed(방 사각형 · 칸막이 문 · 방 견본 가구 · 사는 사람의 물건), 맵 사이는 links(계단 계약).
import { roomTemplates } from "@/editor/handInterior/templates";
import type { HandInteriorSpec } from "@/editor/handInterior/builder";
import { kitInteriorKinds, placeTierMap, tierProgramFor, tierTableOf, tierTemplatePicker, TierPlanError, type TierMapPlan, type TierProgram, type TierTable } from "@/editor/handInterior/tierPlan";
import { hashText, mixHash } from "@/editor/handInterior/vignettes";
import type { BuildRun, PlaceBuildResult, PlaceSpec } from "../../shared/types";
import { exteriorWall, type ExteriorLook } from "./interiorExterior";
import { argsFromRebuild, build, reachOk } from "./interiorFill";
import type { InteriorState, Rebuild } from "./interiorKind";

export interface TierState { readonly program: string; readonly shape: number; readonly maps: Readonly<Record<string, string>> }
interface BuiltMap { mapId: string; rb: Rebuild; base: Record<string, unknown>; entrance?: { x: number; y: number } }
export interface TierAsk {
  readonly tilesetId: string; readonly roomSpec: HandInteriorSpec; readonly outside: ExteriorLook | undefined;
  /** 그 장소의 방 종류(resolveKind) — 이름이 방 종류를 못 가리켰으면(named = false) 킷의 interior 태그가 먼저다. */
  readonly mainKind: string; readonly named: boolean;
  readonly varietyKey: string; readonly mapId: string | undefined; readonly prev?: TierState;
  /** 시험·그림용: 구성과 평면 벌을 못박는다. */
  readonly force?: { readonly program: string; readonly shape?: number };
}

/** 이 집이 크기 단 구성으로 지어지나 — 구성 id 와 구성. 한 방짜리(소형)·표 없는 칩셋·맞는 구성 없음이면 undefined. */
export function tierProgramOf(project: BuildRun["ctx"]["project"], ask: Pick<TierAsk, "tilesetId" | "outside" | "mainKind" | "named" | "varietyKey" | "prev" | "force">): { id: string; program: TierProgram; table: TierTable } | undefined {
  const table = tierTableOf(ask.tilesetId);
  if (!table) return undefined;
  const fixed = ask.force?.program ?? ask.prev?.program;
  if (fixed) return table.programs[fixed] ? { id: fixed, program: table.programs[fixed]!, table } : undefined;
  const o = ask.outside;
  if (!o?.tier || o.tier === "small" || o.tileset !== ask.tilesetId) return undefined;
  const tags = o.kit ? project.tilesets[o.tileset]?.structureKits?.find((k) => k.id === o.kit)?.ai?.tags ?? [] : [];
  const kit = kitInteriorKinds(table, tags);
  const got = tierProgramFor(table, o.tier, ask.named ? [ask.mainKind, ...kit] : [...kit, ask.mainKind], ask.varietyKey, o.cat);
  return got ? { ...got, table } : undefined;
}

/** 구성대로 짓는다. 못 지으면(견본이 안 맞음·도구 거절) undefined — 부르는 쪽이 한 방짜리 길로 짓는다. */
export function buildTier(run: BuildRun, spec: PlaceSpec, ask: TierAsk, notes: string[]): PlaceBuildResult | undefined {
  const found = tierProgramOf(run.ctx.project, ask);
  if (!found) return undefined;
  const { id: programId, program, table } = found;
  const S = ask.roomSpec, tid = ask.tilesetId;
  const templates = roomTemplates(tid).map((t) => ({ ...t, wall: exteriorWall(S, ask.outside?.tileset === tid ? ask.outside : undefined, t.wall) ?? t.wall }));
  const mainKind = templates.some((t) => t.kind === ask.mainKind) && program.serves.includes(ask.mainKind) ? ask.mainKind : program.serves[0]!;
  const personal = (rooms: readonly { id: string; kind: string }[], mapKey: string) => (S.personal
    ? { personal: Object.fromEntries(rooms.map((r) => [r.id, { key: `${ask.varietyKey}|${mapKey}|${r.id}`, text: `${spec.name} ${spec.theme ?? ""}`, ...(ask.outside?.cat ? { cat: ask.outside.cat } : {}) }])) } : {});
  /** 평면 한 장을 짓는다. 닿지 못하는 바닥이 남으면 실패. */
  const buildMap = (plan: TierMapPlan, mapId: string | undefined, name: string): BuiltMap | string => {
    let placed;
    try { placed = placeTierMap(plan, tierTemplatePicker(templates, mainKind, `${ask.varietyKey}|${plan.id}`), table.doors); }
    catch (e) { if (e instanceof TierPlanError) return e.message; throw e; }
    const base: Record<string, unknown> = { tileset: tid, mapId, name, replace: mapId && run.ctx.project.maps[mapId] ? true : undefined };
    const layout = { rooms: placed.rooms.map((r) => ({ id: r.id, kind: r.kind, template: r.template, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1, floor: r.floor, wall: r.wall })),
      placed: { rooms: placed.rooms, connect: placed.connect, exit: placed.exit }, ...personal(placed.rooms, plan.id) };
    let a = build(run, { ...base, layout });
    if (!a.ok && mapId) a = build(run, { ...base, mapId: undefined, replace: undefined, layout });
    if (!a.ok) return a.summary.slice(0, 240);
    if (!reachOk(a)) return `닿지 못하는 바닥 ${(a.data?.unreachedFloor as unknown[] | undefined)?.length ?? "?"}칸`;
    // 문 앞 발깔개는 바깥문 방에만 — 안쪽 방(칸막이 문으로 드나드는 방)의 남쪽 벽 앞 깔개는 걷는다.
    const rb0 = a.data?.rebuild as Rebuild;
    const exitRoom = placed.exit.width === 0 ? undefined : rb0.rooms.find((r) => r.id === placed.exit.room);
    const inExit = (o: { x: number; y: number }) => !!exitRoom && o.x >= exitRoom.x0 && o.x <= exitRoom.x1 && o.y >= exitRoom.y0 && o.y <= exitRoom.y1;
    const kept = rb0.objects.filter((o) => o.id !== "door mat" || inExit(o));
    let rb = rb0;
    if (kept.length < rb0.objects.length) {
      const again = build(run, argsFromRebuild({ ...base, mapId: String(a.data?.mapId), replace: true }, { ...rb0, objects: kept }));
      if (again.ok && reachOk(again)) rb = { ...rb0, objects: kept };
      else build(run, argsFromRebuild({ ...base, mapId: String(a.data?.mapId), replace: true }, rb0));
    }
    const entrance = Array.isArray(a.data?.entrance) ? (a.data!.entrance as { x: number; y: number }[])[0] : undefined;
    return { mapId: String(a.data?.mapId), rb, base: { ...base, mapId: String(a.data?.mapId), replace: true }, ...(entrance ? { entrance } : {}) };
  };
  const n = program.shapes.length;
  const first = ask.force?.shape ?? ask.prev?.shape ?? mixHash(hashText(`${ask.varietyKey}|shape|${programId}`)) % n;
  const order = ask.force?.shape !== undefined ? [first] : Array.from({ length: n }, (_, i) => (first + i) % n);
  let main: BuiltMap | undefined, shape = first;
  const why: string[] = [];
  for (const s of order) {
    const got = buildMap(program.shapes[s]!, ask.prev?.maps.main ?? ask.mapId, spec.name);
    if (typeof got === "string") { why.push(`${program.shapes[s]!.id}: ${got}`); continue; }
    main = got; shape = s; break;
  }
  if (!main) { notes.push(`크기 단 구성 「${program.ko}」으로 짓지 못해 한 방짜리로 지었다 — ${why.join(" / ")}`); return undefined; }
  // 딸린 맵(위층·지하·탑·별채): 이름은 «집 이름 · 그 맵», 남쪽 바깥문 없이 계단으로만 오간다.
  const built = new Map<string, BuiltMap>([["main", main]]);
  const missing: string[] = [];
  for (const m of program.maps ?? []) {
    const got = buildMap(m, ask.prev?.maps[m.id], `${spec.name} · ${m.ko}`);
    if (typeof got === "string") { missing.push(`${m.ko} — 짓지 못했다(${got})`); continue; }
    built.set(m.id, got);
  }
  // 맵 사이 길: 두 맵의 그 방에 놓인 그 계단끼리 — 이동은 계단 그림 칸에, 도착은 앞 칸(도구의 계단 계약이 맞춘다).
  const stairOf = (ref: string) => {
    const [mapKey, roomId, objId] = ref.split("/");
    const b = built.get(mapKey === program.shapes[shape]!.id ? "main" : mapKey ?? "");
    // 방 id 가 "*" 면 그 맵 어느 방에 있든(평면 벌마다 계단 방이 다를 때).
    const rooms = b ? b.rb.rooms.filter((r) => roomId === "*" || r.id === roomId) : [];
    const o = b ? b.rb.objects.find((q) => q.id === objId && rooms.some((room) => q.x >= room.x0 && q.x <= room.x1 && q.y >= room.y0 && q.y <= room.y1)) : undefined;
    return b && o ? { b, mapKey: mapKey!, x: o.x + Math.floor((S.objects[o.id]?.w ?? 1) / 2), y: o.y, dir: S.objects[o.id]?.stairs === "down" ? "down" : "up" } : undefined;
  };
  const links = new Map<string, Record<string, unknown>[]>();
  for (const l of program.links ?? []) {
    const a = stairOf(l.from), b = stairOf(l.to);
    if (!a || !b) { if (built.has(l.to.split("/")[0]!) || l.to.startsWith("main/")) missing.push(`계단 길 ${l.from} ↔ ${l.to} — 계단이 놓이지 않았다`); continue; }
    links.set(a.b.mapId, [...(links.get(a.b.mapId) ?? []), { x: a.x, y: a.y, toMapId: b.b.mapId, toX: b.x, toY: b.y + 1, direction: a.dir }]);
    links.set(b.b.mapId, [...(links.get(b.b.mapId) ?? []), { x: b.x, y: b.y, toMapId: a.b.mapId, toX: a.x, toY: a.y + 1, direction: b.dir }]);
  }
  let mainArgs: Record<string, unknown> = argsFromRebuild(main.base, main.rb);
  for (const [key, b] of built) {
    const ls = links.get(b.mapId);
    if (!ls?.length && key === "main") continue;
    const args = { ...argsFromRebuild(b.base, b.rb), ...(ls?.length ? { links: ls } : {}) };
    const again = build(run, args);
    if (!again.ok) missing.push(`${key} 맵 계단 잇기 — ${again.summary.slice(0, 160)}`);
    else if (key === "main") mainArgs = args;
  }
  const mapIds = [main.mapId, ...[...built].filter(([k]) => k !== "main").map(([, b]) => b.mapId)];
  const rooms = [...built.values()].reduce((c, b) => c + b.rb.rooms.length, 0);
  const tier: TierState = { program: programId, shape, maps: Object.fromEntries([...built].map(([k, b]) => [k, b.mapId])) };
  const state: InteriorState & { tier: TierState } = { tilesetId: tid, mapId: main.mapId, args: mainArgs, placed: [], tier };
  notes.push(`크기 단 ${program.tier} 「${program.ko}」 — 평면 ${program.shapes[shape]!.ko}, 방 ${rooms}개 · 맵 ${mapIds.length}장(문이 달린 집 킷 ${ask.outside?.kit ?? "?"} 의 tier 태그가 골랐다)`);
  return { ok: true, mapIds, ...(main.entrance ? { entrance: { mapId: main.mapId, ...main.entrance } } : {}), summary: `${spec.name}: ${program.ko}(${program.tier}) — ${program.shapes[shape]!.ko}, 방 ${rooms}개${mapIds.length > 1 ? `, 맵 ${mapIds.length}장(${(program.maps ?? []).filter((m) => built.has(m.id)).map((m) => m.ko).join("·")})` : ""}`,
    warnings: notes, missingArt: missing, calls: run.calls, state };
}
