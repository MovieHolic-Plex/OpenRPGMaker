// 조수 v2 — 그림 없는 조사 칸이 «빈 바닥 위 보이지 않는 벽»이 되지 않게 한다.
//
// 왜(2026-10-29 mt3 flash 방탈출): 퍼즐 사슬이 「조사 시작」(5,3)·「비밀번호 입력」(6,4)을 그림 없는(투명) 같은 높이 이벤트로
// 빈 바닥 칸에 세웠다. 화면에는 반짝이만 있는데 그 칸으로 걸어 들어가면 막혀 돌아서기만 했다 — 판정자 둘이 「방향키가 가끔 안 먹힌다」로 적었다.
// 순서(앞이 먼저):
//  1) 바로 옆(위 → 좌우 → 아래)에 가구 칸이 있으면 이벤트를 그 가구 칸으로 붙인다 — 플레이어는 지금 칸에 서서 가구를 조사한다.
//     이름·문맥 낱말에 맞는 가구(금고·책상…)가 먼저, 책상 윗면은 「쪽지·일기」 같은 탁상 물건 이름에 먼저. 가구가 없으면 북벽 칸.
//  2) 그래도 맨바닥이면 이름(없으면 문맥 낱말: 단계 역할·대사)에 맞는 기존 소품을 세운다(examineArt.showExaminedThing).
//  3) 그래도 맨바닥이면 발밑(below)으로 내린다 — 지나갈 수 있고, 앞에 서서도 발밑에서도 조사된다(런타임 정면 조회는 높이를 가리지 않는다).
// 어느 단계도 다른 이벤트를 못 닿게 만들지 않는다(eventReach.unreachableEvents 로 전/후 비교, 나빠지면 되돌린다).
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap } from "@/project/types";
import { eventBlocks, isDoorName, unreachableEvents } from "./eventReach";
import { showExaminedThing } from "./examineArt";
import { objectAt, tileLabel } from "./people";
import type { BuildRun } from "./types";

type Cell = { x: number; y: number };
const WALL_LABEL = /벽|wall/iu;
const NOT_FURNITURE = /바닥|깔개|러그|그림자|공허|천장|floor|rug|shadow|ceiling|void/iu;
/** 탁상 물건 이름(쪽지·일기…) — 책상 윗면에 붙이는 게 먼저. */
const SMALL_THING = /일기|일지|수첩|노트|쪽지|메모|편지|종이|서류|문서|기록|책|열쇠|사진|diary|journal|note|memo|letter|paper|book|key/iu;
const SURFACE_LABEL = /책상|탁자|식탁|테이블|카운터|협탁|desk|table|counter/iu;

function invisible(ev: GameEvent): boolean {
  return (ev.pages ?? []).every((p) => {
    const g = (p.graphic ?? {}) as { sprite?: unknown; appearanceId?: unknown; transparent?: boolean; tileId?: number };
    return g.transparent === true || (!g.sprite && !g.appearanceId && !(typeof g.tileId === "number" && g.tileId > 0));
  });
}
const triggerOf = (p: { trigger?: unknown }) => String(typeof p.trigger === "string" ? p.trigger : (p.trigger as { kind?: string } | undefined)?.kind ?? "action");
/** 조사(액션)만 하는 이벤트 — 접촉·자동 페이지가 있으면(문 이동·자동 컷신) 건드리지 않는다. */
const examineOnly = (ev: GameEvent) => (ev.pages ?? []).length > 0 && (ev.pages ?? []).every((p) => triggerOf(p as { trigger?: unknown }) === "action");

const labelsAt = (run: BuildRun, map: GameMap, c: Cell, upperOnly = false): string[] => {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const i = c.y * map.width + c.x;
  return (upperOnly ? ["upperOverlayTiles", "upperTiles"] : ["upperOverlayTiles", "upperTiles", "lowerOverlayTiles", "lowerTiles"]).map((k) => tileLabel(run.ctx.project, map, m[k]?.[i])).filter(Boolean);
};

/** 맨바닥에 선 막는 투명 조사 칸인가. */
function blankFloorBlocker(run: BuildRun, map: GameMap, ev: GameEvent): boolean {
  // 잠긴 문·막힌 틈은 일부러 막는 칸이다 — 건드리지 않는다.
  if (ev.id.startsWith("ev_chain_seal_") || isDoorName(String((ev as { name?: string }).name ?? ""))) return false;
  return invisible(ev) && examineOnly(ev) && eventBlocks(ev) && !objectAt(map, ev) && isPassable(run.ctx.project, map, ev.x, ev.y);
}

/** 문맥 낱말 — 이름에 물건이 없을 때(「조사 시작」「비밀번호 입력」) 단계 역할이 가리키는 사물. */
export function examineHint(role: string | undefined, extra: readonly (string | undefined)[] = []): string {
  const base = role === "code" ? "금고 자물쇠" : role === "pickup" ? "상자" : role === "clue" ? "쪽지" : "";
  return [...extra.filter(Boolean), base].join(" ");
}

/** 1) 옆 가구(없으면 북벽) 칸으로 붙인다. 옮겼으면 설명 한 줄. */
function attachToNeighbor(run: BuildRun, mapId: string, ev: GameEvent, words: string): string | undefined {
  const map = run.ctx.project.maps[mapId]!;
  const taken = new Set(map.events.filter((e) => e.id !== ev.id).map((e) => e.y * map.width + e.x));
  const name = String((ev as { name?: string }).name ?? "");
  const hintWords = words.split(/\s+/u).filter((w) => w.length >= 2);
  const small = SMALL_THING.test(name) || SMALL_THING.test(words);
  const cands: { c: Cell; s: number; what: string }[] = [];
  for (const [dx, dy, dirScore] of [[0, -1, 0], [-1, 0, 1], [1, 0, 1], [0, 1, 2]] as const) {
    const c = { x: ev.x + dx, y: ev.y + dy };
    if (c.x < 0 || c.y < 0 || c.x >= map.width || c.y >= map.height || taken.has(c.y * map.width + c.x)) continue;
    if (isPassable(run.ctx.project, map, c.x, c.y)) continue;
    const labels = labelsAt(run, map, c);
    // 가구 판정은 윗층 이름표만 본다 — 바닥층 「나무 바닥」 이름표 때문에 실내 가구가 모두 «가구 아님»이 되어 붙이지 못했다(2026-10-29 vm3 terra 식탁).
    const upperLabels = labelsAt(run, map, c, true);
    const furniture = objectAt(map, c) && !upperLabels.some((l) => NOT_FURNITURE.test(l) && !SURFACE_LABEL.test(l));
    const wall = !furniture && dy === -1 && labels.some((l) => WALL_LABEL.test(l));
    if (!furniture && !wall) continue;
    const named = labels.some((l) => hintWords.some((w) => l.includes(w)) || (name && l.includes(name)));
    const surface = labels.some((l) => SURFACE_LABEL.test(l));
    const s = (furniture ? 0 : 20) + (named ? 0 : 6) + (small && surface ? 0 : small ? 3 : 0) + dirScore;
    cands.push({ c, s, what: labels[0] ?? (wall ? "벽" : "가구") });
  }
  cands.sort((a, b) => a.s - b.s);
  const before = new Set(unreachableEvents(run.ctx.project, mapId));
  for (const { c, what } of cands) {
    const snapshot = run.ctx.project;
    const res = run.call("move_event", { mapId, eventId: ev.id, x: c.x, y: c.y });
    const after = res.ok ? unreachableEvents(run.ctx.project, mapId) : [ev.id];
    if (res.ok && !after.includes(ev.id) && after.every((id) => before.has(id))) return `「${name || ev.id}」 (${ev.x},${ev.y}) 빈 바닥 → 옆 ${what} 칸 (${c.x},${c.y})`;
    run.ctx.project = snapshot;
  }
  return undefined;
}

/** 3) 발밑으로 — 같은 높이 조사 페이지를 below 로 내린다. */
function lowerToFloor(run: BuildRun, mapId: string, ev: GameEvent): string | undefined {
  let changed = false;
  for (const [pageIndex, page] of (ev.pages ?? []).entries()) {
    if ((page.priority ?? "same") !== "same") continue;
    const res = run.call("patch_event_page", { mapId, eventId: ev.id, pageIndex, set: { priority: "below" } });
    changed = changed || res.ok;
  }
  return changed ? `「${String((ev as { name?: string }).name ?? ev.id)}」 (${ev.x},${ev.y}) 빈 바닥의 그림 없는 조사 칸을 발밑(below)으로 — 지나갈 수 있게` : undefined;
}

/**
 * 그림 없는 조사 칸 하나를 «보이는 것을 조사하는 자리»로 고친다. hint 는 이름에 물건이 없을 때 쓸 문맥 낱말(examineHint).
 * 바꾼 것을 줄로 돌려준다(없으면 빈 배열).
 */
export function settleExamineSpot(run: BuildRun, mapId: string, eventId: string, hint = ""): string[] {
  const find = () => run.ctx.project.maps[mapId]?.events.find((e) => e.id === eventId);
  const ev0 = find();
  const map0 = run.ctx.project.maps[mapId];
  if (!ev0 || !map0 || !blankFloorBlocker(run, map0, ev0)) return [];
  const notes: string[] = [];
  const attached = attachToNeighbor(run, mapId, ev0, hint);
  if (attached) notes.push(attached);
  const shown = showExaminedThing(run, mapId, eventId, hint);
  if (shown) notes.push(shown);
  const ev = find();
  const map = run.ctx.project.maps[mapId];
  if (ev && map && blankFloorBlocker(run, map, ev)) {
    const lowered = lowerToFloor(run, mapId, ev);
    if (lowered) notes.push(lowered);
  }
  return notes;
}

/** 맵의 모든 그림 없는 조사 칸을 고친다(청사진 경로 다시 고치기용). */
export function settleExamineSpots(run: BuildRun, mapId: string, eventIds: readonly string[]): string[] {
  return eventIds.flatMap((id) => settleExamineSpot(run, mapId, id));
}

// ── 끝맺음: 그림 없는 조사 칸을 가구에 앉히고, 가구 위 조사는 가구 전체에서 받는다 ─────────────────────────
// 왜(2026-10-29 vm3 terra escape 판정 major): 「책상 정면에서는 반응이 없고 특정 칸에서만 쪽지가 나온다」 — 2칸 책상의 왼쪽 칸에만
// 이벤트가 있어 오른쪽 칸 앞에서 누르면 아무 일도 없었다. 「잠긴 보관함」은 식탁 옆 맨바닥의 발밑(below) 투명 칸이라 위 settleExamineSpot
// (막는 칸만 고친다)이 건드리지 않았다.
//  a) 맨바닥의 투명 조사 칸은 높이와 상관없이 옆 가구로 붙이고(attachToNeighbor), 그래도 맨바닥이면 칩셋의 맞는 소품을 세운다(showExaminedThing).
//  b) 가구 칸 위의 투명 조사 이벤트는 그 가구(같은 이름표의 이어진 직사각형, 4×4 까지) 전체를 몸 사각(page.footprint)으로 —
//     런타임 조사 히트는 몸 사각이라 가구의 어느 칸 앞에서 눌러도 반응한다. 사각 안에 다른 이벤트가 있으면 건드리지 않는다.
/** 문·출구 이름(자물쇠가 붙어도) — 맨바닥 문 이벤트를 옆 가구로 붙이지 않는다(vm2 argon 「locked_door」가 벽난로에 붙었다). */
const DOORISH = /문|door|출구|현관|exit|gate/iu;
const baseOf = (label: string) => label.replace(/\s*\((?:-?\d+,\s*-?\d+)\)\s*$/u, "").trim();

function furnitureRect(run: BuildRun, map: GameMap, c: Cell): { left: number; top: number; right: number; bottom: number } | undefined {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const w = map.width;
  // 벽 걸이(벽시계·그림)가 윗층을 차지하고 가구가 겹층에 있는 칸도 있다 — 두 층 이름 중 하나가 같으면 같은 가구.
  const basesAt = (x: number, y: number): string[] => x < 0 || y < 0 || x >= w || y >= map.height ? []
    : [m.upperTiles?.[y * w + x], m.upperOverlayTiles?.[y * w + x]].map((t) => baseOf(tileLabel(run.ctx.project, map, t))).filter(Boolean);
  const base = basesAt(c.x, c.y).find((b) => !NOT_FURNITURE.test(b) && !WALL_LABEL.test(b) && !/탁상 물건/u.test(b));
  if (!base) return undefined;
  const baseAt = (x: number, y: number) => basesAt(x, y).includes(base) ? base : "";
  const seen = new Set([c.y * w + c.x]);
  const q = [c];
  let left = c.x, right = c.x, top = c.y, bottom = c.y;
  while (q.length) {
    const p = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.x + dx, y = p.y + dy;
      if (seen.has(y * w + x) || baseAt(x, y) !== base) continue;
      seen.add(y * w + x); q.push({ x, y });
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  const bw = right - left + 1, bh = bottom - top + 1;
  if (seen.size < 2 || seen.size !== bw * bh || bw > 4 || bh > 4) return undefined;
  return { left, top, right, bottom };
}

export function settleFurnitureSpots(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  const ids = (run.ctx.project.maps[mapId]?.events ?? []).filter((e) => invisible(e) && examineOnly(e) && !e.id.startsWith("ev_chain_seal_") && !isDoorName(String((e as { name?: string }).name ?? ""))).map((e) => e.id);
  for (const id of ids) {
    const find = () => run.ctx.project.maps[mapId]?.events.find((e) => e.id === id);
    const ev0 = find(), map0 = run.ctx.project.maps[mapId];
    if (!ev0 || !map0) continue;
    // a) 맨바닥 → 옆 가구, 그래도 맨바닥이면 소품. 쪽지·일기 같은 탁상 물건은 옆이 탁자·책상일 때만 붙이고, 아니면 칩셋의 맞는
    //    소품(일기장 받침·책 더미…)을 그 칸에 먼저 세운다 — 「번호 쪽지」가 화분에 붙었다(vm3 flash escape 재생).
    const name0 = String((ev0 as { name?: string }).name ?? "");
    if (!DOORISH.test(name0) && !objectAt(map0, ev0) && isPassable(run.ctx.project, map0, ev0.x, ev0.y)) {
      const small = SMALL_THING.test(name0);
      const surfaceNext = [[0, -1], [-1, 0], [1, 0], [0, 1]].some(([dx, dy]) => {
        const c = { x: ev0.x + dx!, y: ev0.y + dy! };
        return c.x >= 0 && c.y >= 0 && c.x < map0.width && c.y < map0.height && !isPassable(run.ctx.project, map0, c.x, c.y) && labelsAt(run, map0, c, true).some((l) => SURFACE_LABEL.test(l));
      });
      const shownFirst = small && !surfaceNext ? showExaminedThing(run, mapId, id) : undefined;
      if (shownFirst) notes.push(shownFirst);
      else {
        const attached = attachToNeighbor(run, mapId, ev0, "");
        if (attached) notes.push(attached);
        else { const shown = showExaminedThing(run, mapId, id); if (shown) notes.push(shown); }
      }
    }
    // b) 가구 위 → 가구 전체가 몸.
    const ev = find(), map = run.ctx.project.maps[mapId];
    if (!ev || !map || !objectAt(map, ev) || isPassable(run.ctx.project, map, ev.x, ev.y)) continue;
    if ((ev.pages ?? []).some((p) => { const f = (p as { footprint?: { width?: number; height?: number } }).footprint; return (f?.width ?? 1) > 1 || (f?.height ?? 1) > 1; })) continue;
    const rect = furnitureRect(run, map, ev);
    if (!rect) continue;
    const bw = rect.right - rect.left + 1, bh = rect.bottom - rect.top + 1;
    const inRect = (x: number, y: number) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (map.events.some((e) => e.id !== id && inRect(e.x, e.y))) continue;
    const ax = rect.left + Math.floor((bw - 1) / 2), ay = rect.bottom;
    const footprint = { width: bw, height: bh };
    const events = map.events.map((e) => e.id !== id ? e : { ...e, x: ax, y: ay, pages: (e.pages ?? []).map((p) => ({ ...p, footprint })) });
    const snapshot = run.ctx.project;
    const before = new Set(unreachableEvents(snapshot, mapId));
    run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: { ...map, events } } };
    // 앵커(몸 사각 맨 아래 줄 왼쪽 치우침)가 바뀌어 앵커 앞에 설 칸이 없어지면 되돌린다 — 데이터 걷기·자동 플레이는 앵커로 닿는다.
    if (unreachableEvents(run.ctx.project, mapId).some((x) => !before.has(x))) { run.ctx.project = snapshot; continue; }
    const label = baseOf(tileLabel(run.ctx.project, map, (map as unknown as Record<string, ArrayLike<number>>).upperTiles?.[ev.y * map.width + ev.x]));
    notes.push(`「${String((ev as { name?: string }).name ?? id)}」 ${label} ${bw}×${bh} 전체에서 조사되게(${ev.x},${ev.y}→${ax},${ay})`);
  }
  return notes;
}
