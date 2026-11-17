// 목표 화살표를 따라 걷는 두 플레이어(모델 없음 · 맵을 모른다) — objectiveArrowProbe.mts 가 쓰고, 명세 은행의 «화살표대로 걸어 못 닿음» 이 여기서 나온다.
//   followArrowWalk: 화살표를 칸마다 다시 읽는다(사람은 걷는 동안 화살표가 꺾이는 것을 본다). 2026-11-15 부터 은행의 그 칸.
//   holdArrowWalk: 화살표를 읽고 그 방향키를 N칸 누른 뒤 다시 읽는다(옛 자 — 견줌용). 한 칸 폭 문간·모퉁이를 지나쳤다 되돌아오기를 되풀이해
//     안내가 멀쩡한 자리도 못 닿음으로 셌다(main 5a2a130dc 의 탐침으로 잰 저장본 여덟 게임 1350 출발에서 못 닿음 347 이 모두 120번 상한 — 막혀서 멈춘 것은 0).
// 두 플레이어가 걷는 데 쓰는 것은 화살표(없으면 화면 안 대상 쪽)와 «그 칸이 막혔다» 뿐이다. 실제 남은 걸음(left)은 «닿았나» 와 못 닿은 까닭을 가르는 데만 쓴다.

export type Cell = { x: number; y: number };
/** 그 칸에서 플레이어가 보는 것. visible=false 면 화살표가 없다(대상이 화면 안) — angle 은 눈에 보이는 대상 쪽. */
export type ArrowRead = { visible: boolean; angle: number; kind?: string };
export type ArrowWorld = {
  /** from 에서 옆 칸 to 로 한 걸음 걸을 수 있나(맵 밖 · 타일 통행 · 막는 이벤트). */
  canStep(from: Cell, to: Cell): boolean;
  arrowAt(cell: Cell): ArrowRead;
  /** 실제 걷기 규칙으로 대상까지 남은 걸음. 0 = 대상 칸, 1 = 대상 옆(닿음), 음수 = 길 없음. */
  left(cell: Cell): number;
};

export const DIR8 = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
export const dir8 = (angle: number): number => (((Math.round(angle / (Math.PI / 4))) % 8) + 8) % 8;

/** 화살표가 더 기운 축의 방향키(main)와 다른 축(other). 곧은 화살표의 other 는 아래·오른쪽 — main 이 막혔을 때만 누른다. */
function keysOf(angle: number): { main: Cell; other: Cell; diagonal: boolean; k: number } {
  const cos = Math.cos(angle), sin = Math.sin(angle), ax = Math.abs(cos), ay = Math.abs(sin);
  const k = dir8(angle);
  return ax >= ay
    ? { main: { x: Math.sign(cos), y: 0 }, other: { x: 0, y: Math.sign(sin) || 1 }, diagonal: k % 2 === 1, k }
    : { main: { x: 0, y: Math.sign(sin) }, other: { x: Math.sign(cos) || 1, y: 0 }, diagonal: k % 2 === 1, k };
}
const add = (c: Cell, v: Cell): Cell => ({ x: c.x + v.x, y: c.y + v.y });

export type FollowEnd = "막힘" | "맴돎" | "길 없는 칸";
export type FollowCause = "안내 틀림" | "걷는 이 한계" | "화살표 없음";
export type FollowResult = {
  reached: boolean; steps: number; swaps: number;
  /** 못 닿았을 때: 어떻게 끝났나. 막힘 = 화살표 쪽도 다른 축도 못 걷는다 · 맴돎 = 밟은 칸에 돌아왔는데 더 눌러 볼 키가 없다 · 길 없는 칸 = 대상에 못 가는 칸에 들어섰다. */
  end?: FollowEnd;
  /** 못 닿았을 때: 처음 어긋난 칸(대상에 가까워지지 않은 첫 걸음, 없으면 멈춘 칸)에서 화살표가 어땠나.
   *  안내 틀림 = 화살표 쪽(대각선이면 두 축 모두)에 가까워지는 걸음이 없다 · 걷는 이 한계 = 대각선 화살표의 한 축은 맞았는데 다른 축을 눌렀다 · 화살표 없음 = 숨은 칸에서 대상 쪽으로 곧장 걷다 어긋났다. */
  cause?: FollowCause;
  /** 처음 어긋난 칸과 거기서 본 것. */
  firstBad?: { cell: Cell; arrow: string; kind: string; pressed: string; left: number };
  at: Cell; left: number; trace: string[];
};

/**
 * 화살표를 칸마다 다시 읽으며 걷는다.
 *   한 칸: 화살표가 더 기운 축의 방향키. 그 칸이 막혔으면 다른 축.
 *   이미 밟은 칸에 다시 섰으면: 그 칸의 화살표가 대각선이고 다른 축을 아직 안 눌러 봤으면 그쪽으로(swaps), 아니면 맴돎으로 끝낸다 — 칸마다 두 번까지라 반드시 끝난다.
 * 판정을 느슨하게 하지 않는다: 닿음은 «대상 옆 칸에 섰다» 뿐이고, 걷는 이는 길을 찾지 않는다(벽을 따라 돌지 않고 되돌아오면 끝).
 */
export function followArrowWalk(world: ArrowWorld, start: Cell): FollowResult {
  const tried = new Map<string, number>(); // 칸 → 그 칸에서 이미 눌러 본 키 수
  const trace: string[] = [];
  let here = start, steps = 0, swaps = 0;
  let firstBad: FollowResult["firstBad"]; let cause: FollowCause | undefined;
  const good = (from: Cell, v: Cell): boolean => { const n = add(from, v); return world.canStep(from, n) && world.left(n) >= 0 && world.left(n) === world.left(from) - 1; };
  const note = (arrow: ArrowRead, keys: Cell[], k: number, pressed: string): void => {
    if (firstBad) return;
    firstBad = { cell: here, arrow: arrow.visible ? DIR8[k]! : "없음", kind: arrow.visible ? arrow.kind ?? "" : "hidden", pressed, left: world.left(here) };
    cause = !arrow.visible ? "화살표 없음" : keys.some((v) => good(here, v)) ? "걷는 이 한계" : "안내 틀림";
  };
  const fail = (end: FollowEnd): FollowResult => ({ reached: false, steps, swaps, end, cause: cause ?? "안내 틀림", firstBad, at: here, left: world.left(here), trace });
  for (;;) {
    const d = world.left(here);
    if (d < 0) return fail("길 없는 칸"); // 닿음은 «대상 옆 칸에 섰다» 뿐이다 — 길 없는 칸은 닿은 것이 아니다
    if (d <= 1) break;
    const arrow = world.arrowAt(here);
    const { main, other, diagonal, k } = keysOf(arrow.angle);
    const keys = diagonal ? [main, other] : [main]; // 화살표가 가리키는 쪽의 키
    const id = `${here.x},${here.y}`, used = tried.get(id) ?? 0;
    const mark = `(${here.x},${here.y})${arrow.visible ? DIR8[k] : "·"}`;
    if (used >= keys.length) { trace.push(`${mark}↺`); note(arrow, keys, k, "돌아옴"); return fail("맴돎"); }
    let v: Cell | undefined; let pressed = "";
    if (used === 0) {
      if (world.canStep(here, add(here, main))) { v = main; pressed = "기운 축"; tried.set(id, 1); }
      else if (world.canStep(here, add(here, other))) { v = other; pressed = "막혀서 다른 축"; tried.set(id, keys.length); } // 이 칸에서 더 눌러 볼 것이 없다
    } else { tried.set(id, keys.length); if (world.canStep(here, add(here, other))) { v = other; pressed = "되돌아와 다른 축"; swaps++; } }
    if (!v) { trace.push(`${mark}✗`); note(arrow, keys, k, "두 쪽 다 막힘"); return fail("막힘"); }
    const next = add(here, v);
    if (!(world.left(next) >= 0 && world.left(next) < world.left(here))) note(arrow, keys, k, pressed);
    trace.push(mark);
    here = next; steps++;
  }
  return { reached: true, steps, swaps, at: here, left: world.left(here), trace };
}

export type HoldResult = { reached: boolean; holds: number; overshoots: number; bumps: number; turns: number; trace: string[] };
/**
 * 옛 자(견줌용) — 눈가림 판정자처럼 걷는 플레이어: 화살표를 읽고(8방 → 크게 기운 축의 방향키) 막힐 때까지(최대 hold 칸) 누른 뒤 다시 읽는다. 120번까지.
 * 화살표가 없으면(대상이 화면 안) 대상 쪽으로 곧장 누른다. 지나침 = 누르는 동안 대상에 가장 가까웠던 칸을 지나 더 멀어진 채 멈춤.
 */
export function holdArrowWalk(world: ArrowWorld, start: Cell, hold: number): HoldResult {
  let here = start, holds = 0, overshoots = 0, bumps = 0, turns = 0, prev = -1; const trace: string[] = [];
  const walk = (c: Cell, v: Cell): Cell | null => { const n = add(c, v); return world.canStep(c, n) ? n : null; };
  while (holds < 120 && world.left(here) > 1) {
    const arrow = world.arrowAt(here);
    const { main, other, k } = keysOf(arrow.angle);
    if (arrow.visible) { if (prev >= 0 && prev !== k) turns++; prev = k; }
    let cur = here, best = world.left(here), moved = 0;
    const press = (v: Cell): void => { for (let i = 0; i < hold; i++) { const n = walk(cur, v); if (!n) break; cur = n; moved++; const d = world.left(cur); if (d >= 0 && d < best) best = d; if (d <= 1) break; } };
    press(main);
    holds++;
    if (!moved) { bumps++; press(other); // 막힌 쪽이면 다른 축을 누른다(사람도 그렇게 한다)
      if (!moved) { trace.push(`(${here.x},${here.y})${DIR8[k]}✗`); break; } }
    if (world.left(cur) > best + 1) overshoots++;
    trace.push(`(${here.x},${here.y})${arrow.visible ? DIR8[k] : "·"}`);
    here = cur;
  }
  return { reached: world.left(here) <= 1, holds, overshoots, bumps, turns, trace };
}
