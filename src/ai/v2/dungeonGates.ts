// 바깥 맵 → 던전 문은 하나, 그 던전이 놓인 세계 방향 가장자리의 길 닿는 칸에(2026-10-30 dd1030 opus 「마을+동굴 둘」: 동쪽 동굴 문이
// 마을 북쪽 끝 길(19,0)과 마을 가운데 굴 입구(30,19) 두 곳, 북쪽 동굴 문은 북동쪽 높은 단(41,14)).
// 원인: author_dungeon 의 기본 바깥 출구(attachDefaultExit)는 시작점에서 가까운 갱구 자리를 고르고, 다시 짓기(edit_place)는 옛 문 자리에
// create_transfer_pair 로 다시 잇는데 그 짓기 자체도 기본 출구를 또 단다 — 문이 둘이 됐다. 세계 방향은 어디에서도 쓰지 않았다.
// 규칙: 던전 1층 입구가 맵의 어느 쪽 끝에 있는지(입구 쪽 = 플레이어가 들어오는 쪽)에서 던전이 바깥 맵의 어느 쪽에 있는지를 읽는다
// (입구 서 → 던전은 동쪽 → 바깥 문은 동쪽 가장자리). make_game 은 place.side 를 그대로 준다. 그 가장자리에서 길 칸(없으면 길에 가장 가까운
// 걸어 닿는 칸)을 골라 옛 문(양쪽)을 모두 걷고 link_world_entrance 하나로 다시 잇는다. 이미 그 가장자리에 문 하나뿐이면 그대로 둔다.
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { reachableCells } from "./eventReach";
import { roadCellSet } from "./people";
import type { BuildRun } from "./types";
import type { Side } from "./transferSpot";

const OPP: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };
const KO: Record<Side, string> = { north: "북", south: "남", east: "동", west: "서" };

function transferTargets(ev: GameEvent): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== "object") return;
    const o = n as { kind?: string; mapId?: string };
    if (o.kind === "transfer" && typeof o.mapId === "string") out.push(o.mapId);
    Object.values(n).forEach(walk);
  };
  walk(ev.pages ?? []); walk((ev as { commands?: unknown }).commands ?? []);
  return out;
}

const onEdge = (map: GameMap, c: { x: number; y: number }, side: Side) =>
  side === "north" ? c.y === 0 : side === "south" ? c.y === map.height - 1 : side === "west" ? c.x === 0 : c.x === map.width - 1;

/** 칸이 맵의 어느 쪽 끝에 가장 가까운가. */
export function nearestSide(map: GameMap, c: { x: number; y: number }): Side {
  const d: [Side, number][] = [["north", c.y / map.height], ["south", (map.height - 1 - c.y) / map.height], ["west", c.x / map.width], ["east", (map.width - 1 - c.x) / map.width]];
  return d.sort((a, b) => a[1] - b[1])[0]![0];
}

const edgeDist = (map: GameMap, c: { x: number; y: number }, side: Side) =>
  side === "north" ? c.y : side === "south" ? map.height - 1 - c.y : side === "west" ? c.x : map.width - 1 - c.x;

/**
 * side 쪽 가장자리의 걸어 닿는 칸 하나 — 가장자리에 가장 가까운 줄에서(그 줄이 맨 끝이 아니면 길이 끝까지 안 닿은 마을: terra 강가 마을 서쪽),
 * 길 칸 먼저, 없으면 길에서 가까운 칸, 같으면 가장자리 가운데. ignore 는 곧 걷을 문.
 */
export function worldSideGateSpot(project: Project, map: GameMap, side: Side, ignore: ReadonlySet<string> = new Set()): { x: number; y: number; road: boolean; edge: number } | undefined {
  const reach = reachableCells(project, map);
  if (!reach) return undefined;
  const w = map.width, h = map.height;
  const roads = roadCellSet(project, map);
  const roadPts = [...roads].map((i) => ({ x: i % w, y: Math.floor(i / w) }));
  const busy = (x: number, y: number) => (map.events ?? []).some((e) => !ignore.has(e.id) && Math.abs(e.x - x) + Math.abs(e.y - y) <= 1);
  let best: { x: number; y: number; road: boolean; edge: number; score: number } | undefined;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = edgeDist(map, { x, y }, side);
    if (best && edge > best.edge) continue;
    if (!reach[y * w + x] || !isPassable(project, map, x, y) || busy(x, y)) continue;
    const road = roads.has(y * w + x);
    const toRoad = road ? 0 : roadPts.reduce((m, r) => Math.min(m, Math.abs(r.x - x) + Math.abs(r.y - y)), 99);
    const mid = side === "north" || side === "south" ? Math.abs(x - w / 2) : Math.abs(y - h / 2);
    const score = edge * 100000 + toRoad * 100 + mid;
    if (!best || score < best.score) best = { x, y, road, edge, score };
  }
  return best ? { x: best.x, y: best.y, road: best.road, edge: best.edge } : undefined;
}

/**
 * 던전 floors(1층 먼저)로 들어오는 바깥 맵 문을 맵마다 하나, 세계 방향 가장자리에 둔다. side 를 주면(make_game place.side) 그것,
 * 아니면 1층의 돌아 나가는 문 자리(입구)에서 읽는다. 바깥 맵은 isOutside 가 참인 맵만(이번 실행에 지은 마을·거리 — 월드맵 장소 입구·실내는 건드리지 않는다).
 * 바꾼 것만 한국어 한 줄씩 돌려준다.
 */
export function settleDungeonGates(run: BuildRun, floors: readonly string[], isOutside: (mapId: string) => boolean, side?: Side): string[] {
  const notes: string[] = [];
  const first = floors[0];
  const floorSet = new Set(floors);
  if (!first || !run.ctx.project.maps[first]) return notes;
  for (const outsideId of Object.keys(run.ctx.project.maps)) {
    const p0 = run.ctx.project;
    const M = p0.maps[outsideId]!, D = p0.maps[first]!;
    if (floorSet.has(M.id) || M.mapRole === "dungeon" || !isOutside(M.id)) continue;
    const outs = (M.events ?? []).filter((e) => transferTargets(e).some((t) => floorSet.has(t)));
    if (!outs.length) continue;
    const backs = (D.events ?? []).filter((e) => transferTargets(e).includes(M.id));
    const entry = backs[0];
    const want: Side | undefined = side ?? (entry ? OPP[nearestSide(D, entry)] : undefined);
    if (!want) continue;
    const ignore = new Set(outs.map((e) => e.id));
    const spot = worldSideGateSpot(p0, M, want, ignore);
    if (outs.length === 1 && backs.length <= 1 && (onEdge(M, outs[0]!, want) || (spot && edgeDist(M, outs[0]!, want) <= spot.edge))) continue;
    if (!spot) { notes.push(`「${M.name}」→「${D.name}」: ${KO[want]}쪽 가장자리에 걸어 닿는 칸이 없어 문 ${outs.length}개를 그대로 두었다`); continue; }
    const backIds = new Set(backs.map((e) => e.id));
    const graph = (p0 as unknown as { worldGraph?: { edges?: { from?: { mapId?: string }; to?: { mapId?: string } }[] } }).worldGraph;
    const edges = graph?.edges?.filter((e) => !((e.from?.mapId === M.id && floorSet.has(String(e.to?.mapId))) || (floorSet.has(String(e.from?.mapId)) && e.to?.mapId === M.id)));
    run.ctx.project = {
      ...p0,
      ...(graph && edges ? { worldGraph: { ...graph, edges } } : {}),
      maps: { ...p0.maps, [M.id]: { ...M, events: M.events.filter((e) => !ignore.has(e.id)) }, [D.id]: { ...D, events: D.events.filter((e) => !backIds.has(e.id)) } },
    } as Project;
    const r = run.call("link_world_entrance", { worldMapId: M.id, links: [{ x: spot.x, y: spot.y, toMapId: first }] });
    if (!r.ok) { run.ctx.project = p0; notes.push(`「${M.name}」→「${D.name}」 문을 ${KO[want]}쪽 가장자리로 옮기지 못했다(${String(r.summary).slice(0, 100)}) — 그대로 두었다`); continue; }
    notes.push(`고침: 「${M.name}」에서 「${D.name}」로 가는 문을 ${KO[want]}쪽 가장자리${spot.edge ? `(끝에서 ${spot.edge}칸 — 길이 끝까지 닿지 않는다)` : ""} ${spot.road ? "길" : "길 가까운 칸"} (${spot.x},${spot.y}) 하나로 — 던전이 ${KO[want]}쪽에 있다(옛 문 ${outs.map((e) => `(${e.x},${e.y})`).join("·")} 걷음)`);
  }
  return notes;
}

const SIDE_WORD: Record<string, Side> = { north: "north", n: "north", 북: "north", 북쪽: "north", south: "south", s: "south", 남: "south", 남쪽: "south", east: "east", e: "east", 동: "east", 동쪽: "east", west: "west", w: "west", 서: "west", 서쪽: "west" };

/** 요청 글에서 들어가는 장소(동굴·던전·광산…) 낱말 — 그림 한 장(draw_object)이 아니라 make_place 로 지을 장소다. */
export const DUNGEON_PLACE_WORD = /동굴|동혈|굴\s*입구|던전|광산|갱도|미궁|지하\s*(?:묘지|감옥|수로)|cave|cavern|dungeon|\bmine\b/i;
const KO_SIDE: Record<string, Side> = { 동: "east", 서: "west", 남: "south", 북: "north" };
/** 「마을 서쪽 길 끝에 동굴」처럼 요청이 그 장소의 세계 방향을 말하면 그 쪽. 없으면 undefined(설계 입구 쪽을 쓴다). */
export function requestedDungeonSide(task: string): Side | undefined {
  const a = task.match(/(동|서|남|북)\s*쪽[^.!?\n]{0,16}?(?:동굴|동혈|굴|던전|광산|갱도|미궁)/);
  if (a) return KO_SIDE[a[1]!];
  const b = task.match(/(?:동굴|동혈|던전|광산|갱도|미궁)[^.!?\n]{0,8}?(동|서|남|북)\s*쪽/);
  if (b) return KO_SIDE[b[1]!];
  const c = task.match(/\b(north|south|east|west)(?:ern)?\b[^.!?\n]{0,24}?\b(?:cave|cavern|dungeon|mine)\b/i);
  return c ? (c[1]!.toLowerCase() as Side) : undefined;
}

/** 설계의 입구 쪽 — entrance 낱말, 없으면 입구 방 자리(at)에서 가장 가까운 맵 끝(designLayout.normalizeDesign 과 같은 규칙). */
export function entranceSideOf(design: { entrance?: unknown; rooms?: readonly { role?: unknown; at?: unknown }[] } | undefined): Side | undefined {
  if (!design) return undefined;
  const said = SIDE_WORD[String(design.entrance ?? "").trim().toLowerCase()];
  if (said) return said;
  const ent = (design.rooms ?? []).find((r) => /^entrance$|입구/u.test(String(r.role ?? "")));
  const at = ent?.at;
  if (typeof at === "string") {
    const w = SIDE_WORD[at.trim().toLowerCase()];
    if (w) return w;
    const m = /^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/u.exec(at);
    if (m) { const x = Number(m[1]), y = Number(m[2]); const d: [Side, number][] = [["south", 1 - y], ["north", y], ["west", x], ["east", 1 - x]]; return d.sort((a, b) => a[1] - b[1])[0]![0]; }
  }
  return undefined;
}

/** 짓기 전에 바깥 문 자리를 정한다: 던전이 놓인 쪽(side, 없으면 설계 입구 쪽의 반대)의 바깥 맵 가장자리 길 칸. */
export function gateFor(project: Project, outsideId: string, design: Parameters<typeof entranceSideOf>[0], side?: Side): { fromMapId: string; x: number; y: number } | undefined {
  const map = project.maps[outsideId];
  const ent = entranceSideOf(design);
  const want = side ?? (ent ? OPP[ent] : undefined);
  if (!map || !want) return undefined;
  const spot = worldSideGateSpot(project, map, want);
  return spot ? { fromMapId: outsideId, x: spot.x, y: spot.y } : undefined;
}
