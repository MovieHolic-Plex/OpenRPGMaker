// 쓰지 않는 빈 시작 맵 치우기(2026-10-28 mt3 flash escape): 새 프로젝트의 빈 시작 맵(잔디 한 장, «빈 맵»)이 청사진 장소(밀실)가 생긴 뒤에도
// 남아 시작 맵 노릇을 했다 — 장소 자동 짓기가 빈 맵 가장자리와 밀실을 이동 칸으로 이었고, 화면 검수·check(visual-flat)가 «빈 플레이스홀더 맵»을 잡았다.
// → 청사진 장소 맵이 하나라도 있으면: 내용이 빈 맵(바닥 한 가지·위층 없음·이벤트는 이동뿐)을 지우고, 그 맵이 시작이었으면 시작을 청사진 첫 장소의
//   걸어 닿는 칸으로 옮긴다. 다른 맵에서 그 빈 맵으로 가던 이동 이벤트도 지운다(남는 막다른 틈은 exitDress 가 문 그림으로 마감한다).
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { blueprintMapFor } from "./blueprintPath";
import type { BuildRun } from "./types";

type Transfer = { mapId: string; x: number; y: number };

function transfersOf(node: unknown, out: Transfer[] = []): Transfer[] {
  if (Array.isArray(node)) { for (const n of node) transfersOf(n, out); return out; }
  if (!node || typeof node !== "object") return out;
  const r = node as Record<string, unknown>;
  if (r.kind === "transfer" && typeof r.mapId === "string" && typeof r.x === "number" && typeof r.y === "number") out.push({ mapId: r.mapId, x: r.x, y: r.y });
  for (const v of Object.values(r)) if (v && typeof v === "object") transfersOf(v, out);
  return out;
}

const commandKinds = (e: GameEvent): string[] => (e.pages ?? []).flatMap((p) => (p.commands ?? []).map((c) => String((c as { kind?: string }).kind)));

/** 바닥 한 가지·위층/겹 없음·이벤트는 이동만(사람 그림·대사 없음). */
export function isPlaceholderMap(map: GameMap): boolean {
  if (Object.keys(map.lowerTileStacks ?? {}).length || Object.keys(map.upperTileStacks ?? {}).length) return false;
  if (map.upperTiles.some((t) => t >= 0)) return false;
  for (const key of ["lowerOverlayTiles", "upperOverlayTiles"] as const) {
    const layer = (map as unknown as Record<string, number[] | undefined>)[key];
    if (layer?.some((t) => t >= 0)) return false;
  }
  const first = map.lowerTiles[0];
  if (!map.lowerTiles.every((t) => t === first)) return false;
  return map.events.every((e) => { const kinds = commandKinds(e); return kinds.length > 0 && kinds.every((k) => k === "transfer"); });
}

/** 시작으로 쓸 칸: 들어오던 착지 칸(또는 문 칸) 둘레에서 BFS 로 가장 가까운, 이벤트가 없고 남쪽 바깥 줄이 아닌 걷는 칸. */
function startCell(project: Project, map: GameMap, from: { x: number; y: number }): { x: number; y: number } | undefined {
  const w = map.width, h = map.height;
  const taken = new Set(map.events.map((e) => e.y * w + e.x));
  const seen = new Uint8Array(w * h);
  const q: [number, number][] = [[Math.min(w - 1, Math.max(0, from.x)), Math.min(h - 1, Math.max(0, from.y))]];
  seen[q[0]![1] * w + q[0]![0]] = 1;
  while (q.length) {
    const [x, y] = q.shift()!;
    const ok = isPassable(project, map, x, y);
    if (ok && !taken.has(y * w + x) && y < h - 1) return { x, y };
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx]) continue;
      // 걷는 칸을 따라 퍼진다(벽 너머로 넘어가지 않게). 시작 칸이 벽(문 칸)이면 첫 걸음만 허용.
      if (!isPassable(project, map, nx, ny) && !(x === from.x && y === from.y)) continue;
      seen[ny * w + nx] = 1;
      q.push([nx, ny]);
    }
  }
  return undefined;
}

/** 청사진이 있고 그 장소 맵이 하나라도 지어졌으면 빈 자리표시 맵을 치운다. 메모 목록. */
export function retireBlankStart(run: BuildRun): string[] {
  const notes: string[] = [];
  const project = run.ctx.project;
  const bp = project.gameBlueprint;
  if (!bp) return notes;
  const placeMaps = bp.steps.map((s) => blueprintMapFor(project, s.place)).filter((m): m is GameMap => Boolean(m));
  const placeIds = new Set(placeMaps.map((m) => m.id));
  const first = placeMaps[0];
  if (!first) return notes;
  for (const blank of Object.values(project.maps)) {
    const cur = run.ctx.project;
    if (placeIds.has(blank.id) || !isPlaceholderMap(blank)) continue;
    if (Object.keys(cur.maps).length < 2) break;
    // 다른 맵에서 이 빈 맵으로 가던 이동 이벤트 — 새 시작 칸 후보(그 문 칸)를 먼저 적어 둔다.
    const inbound: { mapId: string; event: GameEvent }[] = [];
    for (const m of Object.values(cur.maps)) if (m.id !== blank.id) for (const e of m.events) if (transfersOf(e.pages).some((t) => t.mapId === blank.id)) inbound.push({ mapId: m.id, event: e });
    if (cur.startMapId === blank.id) {
      const target = cur.maps[first.id]!;
      const landing = blank.events.flatMap((e) => transfersOf(e.pages)).find((t) => t.mapId === target.id);
      const door = inbound.find((i) => i.mapId === target.id)?.event;
      const from = landing ?? (door ? { x: door.x, y: door.y } : { x: Math.floor(target.width / 2), y: Math.floor(target.height / 2) });
      const at = startCell(cur, target, from);
      if (!at) { notes.push(`빈 시작 맵 「${blank.name}」: 「${target.name}」에 시작할 걷는 칸이 없어 그대로 둠`); continue; }
      const moved = run.call("set_start_position", { mapId: target.id, x: at.x, y: at.y });
      if (!moved.ok) { notes.push(`빈 시작 맵 「${blank.name}」: 시작 옮기기 실패(${String(moved.summary).slice(0, 100)})`); continue; }
      notes.push(`시작 위치를 빈 맵 「${blank.name}」에서 청사진 첫 장소 「${target.name}」(${at.x},${at.y})로 옮김`);
    }
    for (const { mapId, event } of inbound) {
      const r = run.call("remove_event", { mapId, eventId: event.id });
      if (r.ok) notes.push(`「${run.ctx.project.maps[mapId]?.name ?? mapId}」의 빈 맵 쪽 이동 「${event.name ?? event.id}」(${event.x},${event.y}) 지움`);
    }
    const removed = run.call("remove_map", { mapId: blank.id });
    notes.push(removed.ok ? `쓰지 않는 빈 맵 「${blank.name}」(${blank.id}) 지움` : `빈 맵 「${blank.name}」 지우기 실패(${String(removed.summary).slice(0, 120)})`);
  }
  return notes;
}

/**
 * 이벤트도 들어오는 이동도 없는 빈 껍데기 맵(게임 점검 orphan-empty-map)을 지운다 — 같은 이름의 쓰는 맵이 따로 있거나(장소를 두 번 지은 흔적),
 * 청사진 장소가 아닌 맵(방탈출 봉인으로 끊긴 「밀실 뒷방」)만. 청사진 장소인데 그 이름의 맵이 이것뿐이면 지우지 않는다(장소 짓기 몫).
 * 왜(2026-10-29 vm1 재생): argon/jrpg 「시작 마을」·「마왕의 방」, flash/mystery 「2층 객실」은 같은 이름 맵을 한 번 더 지은 빈 사본이었고,
 * argon/escape 「밀실 뒷방」은 탈출 봉인이 들어오는 이동을 지워 고아가 됐다 — 엔딩까지는 가지만 점검 막힘으로 남았다.
 */
export function retireOrphanMaps(run: BuildRun): string[] {
  const notes: string[] = [];
  const norm = (s: string | undefined) => (s ?? "").replace(/\s+/gu, "").toLowerCase();
  const inboundOf = (project: Project): Set<string> => {
    const into = new Set<string>();
    for (const m of Object.values(project.maps)) for (const e of m.events ?? []) for (const t of transfersOf(e.pages ?? (e as { commands?: unknown }).commands)) if (t.mapId !== m.id) into.add(t.mapId);
    for (const ce of (project.commonEvents ?? []) as unknown as { commands?: unknown }[]) for (const t of transfersOf(ce.commands)) into.add(t.mapId);
    return into;
  };
  const project0 = run.ctx.project;
  const into = inboundOf(project0);
  const orphan = (m: GameMap) => m.id !== project0.startMapId && !(m.events ?? []).length && !into.has(m.id);
  const places = new Set((project0.gameBlueprint?.steps ?? []).map((s) => norm(s.place)));
  for (const map of Object.values(project0.maps)) {
    if (!orphan(map)) continue;
    const twin = Object.values(project0.maps).find((m) => m.id !== map.id && norm(m.name) === norm(map.name) && !orphan(m));
    if (!twin && places.has(norm(map.name))) continue;
    const removed = run.call("remove_map", { mapId: map.id });
    notes.push(removed.ok ? `빈 껍데기 맵 「${map.name}」(${map.id}) 지움(${twin ? `같은 이름 「${twin.name}」(${twin.id})을 쓴다` : "청사진 장소가 아니고 들어오는 길이 없다"})` : `빈 껍데기 맵 「${map.name}」 지우기 실패(${String(removed.summary).slice(0, 120)})`);
  }
  return notes;
}
