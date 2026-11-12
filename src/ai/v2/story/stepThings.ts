// 단계가 쓰게 하는 물건(조사·퍼즐·단서)을 그 장소에 «그려진 물건» 에 앉힌다 — 맨바닥의 반짝임·발밑 칸이 아니라 그림을 마주 보고 누른다.
// 고르는 차례: ① 모델이 고른 그림(steps[].on) ② 이벤트 이름의 물건 낱말이 이름표·키트 꼬리표에 있는 그림(맵에 있는 것 → 칩셋 키트를 새로 찍은 것)
// ③ 낱말이 키트 이름의 부품 설명에만 있는 그림. 맞는 그림이 없으면 사슬을 지은 뒤 가장 가까운 그림에 붙이고 «없는 그림» 한 줄을 남긴다(settleStepThing).
// 왜·증거는 openwiki/assistant-v2.md 「이야기의 물건은 그 장소의 그림이다」.
import { artGapLine } from "@/project/artGap";
import { isPassable } from "@/project/collision";
import { pageHasGraphic } from "@/project/eventSight";
import { isDoorName, unreachableEvents } from "../judge/eventReach";
import { drawnThings, hangNamedThing, onDrawnThing, stampCopyNear, stampNamedThing, thingMatch, thingSeat, type DrawnThing } from "../place/fixtures";
import type { BuildRun } from "../shared/types";

type Cell = { x: number; y: number };
/** 걸음 수로 받은 제 자리에서 이 안에 놓인 물건에만 옮겨 앉는다 — 더 멀면 단계가 문 앞으로 끌려가 걷는 길이 짧아진다(명세 은행 fun-v2: 26칸 밖의 뿌리로 갔다). */
const NEAR_THING = 8;
/** 곁에 하나 더 찍어도 어색하지 않은 물건의 칸 수(상자·통·바위) — 우물·분수를 둘 세우지 않는다. */
const COPY_CELLS = 4;

interface ThingHost {
  /** 이벤트가 앉을 칸 — 그 그림의 한 칸. */
  readonly cell: Cell;
  readonly label: string;
}

/** 이름이 가리키는 그림(세기 min 이상) 가운데 서서 쓸 자리가 있는 것 — 세기 높은 것, near 에 가까운 것 먼저. */
function seatOnMap(run: BuildRun, mapId: string, name: string, near: Cell, min: number, claimed: readonly Cell[]): ThingHost | undefined {
  const map = run.ctx.project.maps[mapId];
  if (!map) return undefined;
  const dist = (t: DrawnThing) => Math.min(...t.cells.map((c) => Math.abs(c.x - near.x) + Math.abs(c.y - near.y)));
  const scored = drawnThings(run.ctx.project, map).map((t) => ({ t, score: thingMatch(name, t) })).filter((s) => s.score >= min)
    .sort((a, b) => b.score - a.score || dist(a.t) - dist(b.t));
  for (const { t } of scored) {
    const seat = thingSeat(run.ctx.project, map, t, near, claimed);
    if (seat) return { cell: seat.cell, label: t.label };
  }
  return undefined;
}

function seatStamped(run: BuildRun, mapId: string, name: string, near: Cell, min: number, claimed: readonly Cell[]): ThingHost | undefined {
  // 바닥에 세우는 그림 먼저, 없으면 벽에 거는 그림(맵에 걸린 것은 아래에 설 자리가 없었다).
  const made = stampNamedThing(run, mapId, name, near, min, claimed) ?? hangNamedThing(run, mapId, name, near, min, claimed);
  const map = run.ctx.project.maps[mapId];
  const seat = made && map ? thingSeat(run.ctx.project, map, made, near, claimed) : undefined;
  return made && seat ? { cell: seat.cell, label: made.label } : undefined;
}

/** 새로 세울 단계 물건의 자리 — 그 장소의 그림 한 칸. 맞는 그림이 없으면 undefined(부르는 쪽이 예전 자리에 세우고 settleStepThing 이 마무리한다). */
export function hostStepThing(run: BuildRun, mapId: string, name: string, near: Cell, on?: string, claimed: readonly Cell[] = []): ThingHost | undefined {
  const want = on?.trim();
  // near 는 이 단계가 걸음 수로 받은 제 자리다 — 남의 자리(claimed)에서 뺀다.
  const others = claimed.filter((c) => c.x !== near.x || c.y !== near.y);
  if (want) {
    const named = seatOnMap(run, mapId, want, near, 1, others) ?? seatStamped(run, mapId, want, near, 1, others);
    if (named) return named;
  }
  return seatOnMap(run, mapId, name, near, 2, others) ?? seatStamped(run, mapId, name, near, 2, others) ?? seatOnMap(run, mapId, name, near, 1, others) ?? seatStamped(run, mapId, name, near, 1, others);
}

/**
 * 사슬이 세운 단계 물건의 마무리 — 그림 없는 이벤트가 맨바닥에 남았으면 가장 가까운 그려진 물건에 앉히고(마주 보고 누르는 높이로),
 * 앉은 그림이 그 이름의 물건이 아니면 «없는 그림» 줄을 돌려준다. 제 그림(칩)이 있는 이벤트는 건드리지 않는다.
 */
export function settleStepThing(run: BuildRun, mapId: string, eventId: string): { readonly note?: string; readonly gap?: string } {
  const map0 = run.ctx.project.maps[mapId];
  const ev0 = map0?.events.find((e) => e.id === eventId);
  if (!map0 || !ev0 || (ev0.pages ?? []).some((p) => pageHasGraphic(p))) return {};
  const name = String((ev0 as { name?: string }).name ?? ev0.id);
  // 문 이름 조사 칸은 문 그림 칸이 제자리다(닿게 옮기기가 앉힌다) — 여기서 옮기면 다음 고치기가 도로 문으로 데려가 서로 싸운다.
  if (isDoorName(name)) return {};
  const gapFor = (standIn: string) => artGapLine({ chipset: map0.tilesetId, want: "step-thing", wanted: "단계가 쓰게 하는 물건의 그림", where: `${map0.name ?? mapId} ${ev0.x},${ev0.y}`, standIn, by: "build_blueprint_path", note: `「${name}」` });
  const under = onDrawnThing(run.ctx.project, map0, ev0);
  // 가구 윗면에 얹은 탁상 물건(examineArt 가 그린 일기장·편지)이 있으면 그 물건이 보이는 것이다 — 가구 이름과 달라도 없는 그림이 아니다.
  const at = ev0.y * map0.width + ev0.x;
  const laidOn = (map0.upperTiles[at] ?? -1) >= 0 && (map0.upperOverlayTiles?.[at] ?? -1) >= 0;
  if (under) return thingMatch(name, under) || laidOn ? {} : { gap: gapFor(under.label) };
  // 건물 벽 한 칸·바닥 덧그림 위(옆 가구 붙이기가 벽으로 올린 것)는 물건이 아니다 — 아래에서 가까운 물건으로 옮긴다.
  const tall = (t: DrawnThing) => t.cells.some((c) => isPassable(run.ctx.project, map0, c.x, c.y));
  const far = (t: DrawnThing) => Math.min(...t.cells.map((c) => Math.abs(c.x - ev0.x) + Math.abs(c.y - ev0.y)));
  const before = new Set(unreachableEvents(run.ctx.project, mapId));
  /** 그 물건 칸으로 옮기고 마주 보는 높이로 — 닿던 것이 끊기면 false(부르는 쪽이 되돌린다). */
  const sit = (thing: DrawnThing): Cell | undefined => {
    const seat = thingSeat(run.ctx.project, run.ctx.project.maps[mapId]!, thing, ev0);
    const res = seat ? run.call("move_event", { mapId, eventId, x: seat.cell.x, y: seat.cell.y }) : undefined;
    const after = res?.ok ? unreachableEvents(run.ctx.project, mapId) : [eventId];
    if (!seat || after.includes(eventId) || !after.every((id) => before.has(id))) return undefined;
    // 발밑으로 내려 둔 페이지(lowerToFloor)는 다시 마주 보는 높이로 — 그림을 밟고 누르지 않는다.
    const ev = run.ctx.project.maps[mapId]!.events.find((e) => e.id === eventId)!;
    for (const [pageIndex, page] of (ev.pages ?? []).entries()) if ((page.priority ?? "same") !== "same") run.call("patch_event_page", { mapId, eventId, pageIndex, set: { priority: "same" } });
    return seat.cell;
  };
  const things = drawnThings(run.ctx.project, map0);
  // 작은 물건(여섯 칸까지)이 먼저 — 기차 한 량·큰 기계의 한 칸은 어느 칸인지 읽히지 않는다. 그 가운데서도 통째로 막힌 낮은 물건(상자·통·벤치)이
  // 윗줄을 뒤로 지나가는 키 큰 것(나무·가로등)보다 먼저다 — 무엇을 «올려 둘» 수 있는 쪽.
  const order = (a: DrawnThing, b: DrawnThing) => Number(a.cells.length > 6) - Number(b.cells.length > 6) || Number(tall(a)) - Number(tall(b)) || far(a) - far(b) || a.cells[0]!.y - b.cells[0]!.y || a.cells[0]!.x - b.cells[0]!.x;
  for (const t of things.filter((th) => far(th) <= NEAR_THING).sort(order).slice(0, 6)) {
    const snapshot = run.ctx.project;
    const cell = sit(t);
    if (cell) return { note: `「${name}」 (${ev0.x},${ev0.y}) 맨바닥 → 가까운 그림 「${t.label}」 칸 (${cell.x},${cell.y})`, gap: gapFor(t.label) };
    run.ctx.project = snapshot;
  }
  // 가까이에 놓인 물건이 없다 — 이 맵에 놓인 작은 물건과 같은 그림을 곁에 하나 더 찍는다(걸음 수로 받은 자리를 지킨다).
  for (const like of things.filter((th) => th.kitId && th.cells.length <= COPY_CELLS && !tall(th)).sort(order).filter((th, i, all) => all.findIndex((o) => o.kitId === th.kitId) === i).slice(0, 3)) {
    const snapshot = run.ctx.project;
    const made = stampCopyNear(run, mapId, like, ev0);
    const cell = made ? sit(made) : undefined;
    if (made && cell) return { note: `「${name}」 (${ev0.x},${ev0.y}) 맨바닥 → 이 장소의 그림 「${made.label}」을 곁에 하나 더 놓고 그 칸 (${cell.x},${cell.y})`, gap: gapFor(made.label) };
    run.ctx.project = snapshot;
  }
  return { gap: gapFor("none") };
}
