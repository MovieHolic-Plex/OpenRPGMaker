// player/npcStroll.ts
// 페이지 자율 이동(사용자 지정 경로·무작위)의 「산책」 리듬 — 마을 사람이 사람처럼 걷게 한다.
//
// 실측(2026-10-23, 아스트라 다우닝 시티 0.2초 프레임): 주민이 한 칸 걷고 1.4~1.9초 서고, 또 한 칸 걷고 서기를
// 오른쪽 둘·왼쪽 둘로 되풀이했다. 세 사람이 같은 박자라 태엽 인형처럼 보였다(「NPC 걷는 게 자연스럽지 않다」).
// RPG Maker 도 이동 빈도만큼 걸음마다 서지만, 사람은 몇 걸음을 이어 걷고 멈춰 둘러본다.
//
// 규칙(페이지 movement.type 이 custom·random 인 NPC 만 — 명령 경로·시간표·생활 이동·추격 순찰은 그대로):
//  - 같은 방향 걸음이 이어지면 그 사이에 서지 않는다(한 번에 걸어 간다). 멈춤은 방향이 바뀔 때·`wait` 에서만.
//  - 멈춤 길이는 빈도 간격의 0.6~1.5배로 흔든다 — 여러 사람이 같은 박자로 서고 걷지 않는다.
//  - 무작위 이동은 「한 방향 1~3칸 걷기 → 멈춤」 묶음이다. 멈춘 자리에서 가끔 둘러보기만 하고, 막 걸어온 쪽으로
//    바로 되돌아가는 일(제자리 왔다 갔다)은 드물게, 막힌 쪽(벽·사람)은 고르지 않는다. 처음 자리에서 3칸 넘게
//    멀어지면 돌아오는 쪽을 고른다.
import type { Dir } from "@/player/input";
import type { AutonomousMover } from "@/player/playSceneTypes";
import type { MoveCommand } from "@/project/types";
import type { Rng } from "@/util/rng";

/** 무작위 산책이 처음 자리에서 벗어날 수 있는 거리(맨해튼, 칸). */
export const STROLL_LEASH_TILES = 3;
const DIRS: readonly Dir[] = ["up", "right", "down", "left"];
const OPPOSITE: Readonly<Record<Dir, Dir>> = { up: "down", down: "up", left: "right", right: "left" };
const DELTA: Readonly<Record<Dir, { readonly x: number; readonly y: number }>> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

/** 방금 끝난 걸음 다음 명령이 같은 방향 걸음인가 — 그러면 서지 않고 이어 걷는다. */
export function strollChainPending(mover: AutonomousMover): boolean {
  if (mover.naturalStroll !== true || !mover.lastStepDir) return false;
  if (mover.strategy === "random") return (mover.wanderRun?.left ?? 0) > 0 && mover.wanderRun?.dir === mover.lastStepDir;
  if (mover.strategy !== "sequence" || mover.moves.length === 0) return false;
  if (!mover.repeat && mover.step >= mover.moves.length) return false;
  const next = mover.moves[mover.step % mover.moves.length];
  return next?.kind === "move" && next.dir === mover.lastStepDir;
}

/** 멈춤 길이 배율(빈도 간격에 곱한다). */
export function strollPauseScale(rng: Rng): number {
  return 0.6 + rng() * 0.9;
}

/**
 * 무작위 산책의 다음 명령. `canStep(dir)` 은 그 방향 한 칸을 지금 걸을 수 있는가(지형·사람).
 * 걷기 묶음 중이면 같은 방향을 이어 준다(막혔으면 묶음을 끝내고 다시 고른다).
 */
export function wanderCommand(input: {
  readonly mover: AutonomousMover;
  readonly at: { readonly x: number; readonly y: number };
  readonly home: { readonly x: number; readonly y: number };
  readonly canStep: (dir: Dir) => boolean;
  readonly rng: Rng;
}): MoveCommand {
  const { mover, at, home, canStep, rng } = input;
  const run = mover.wanderRun;
  if (run && run.left > 0) {
    if (canStep(run.dir)) {
      mover.wanderRun = { dir: run.dir, left: run.left - 1 };
      return { kind: "move", dir: run.dir };
    }
    mover.wanderRun = undefined;
  }
  // 둘러보기: 서 있는 채로 다른 쪽을 본다.
  if (rng() < 0.3) {
    const look = DIRS.filter((dir) => dir !== mover.facing);
    return { kind: "turn", dir: look[Math.floor(rng() * look.length)] ?? mover.facing };
  }
  const away = Math.abs(at.x - home.x) + Math.abs(at.y - home.y);
  const weighted: { dir: Dir; weight: number }[] = [];
  for (const dir of DIRS) {
    if (!canStep(dir)) continue;
    let weight = 1;
    if (mover.lastStepDir && dir === OPPOSITE[mover.lastStepDir]) weight *= 0.25;
    const next = Math.abs(at.x + DELTA[dir].x - home.x) + Math.abs(at.y + DELTA[dir].y - home.y);
    if (next > STROLL_LEASH_TILES) weight *= 0.05;
    else if (away >= STROLL_LEASH_TILES - 1 && next < away) weight *= 3;
    weighted.push({ dir, weight });
  }
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    // 사방이 막혔다 — 둘러보기만 한다.
    return { kind: "turn", dir: DIRS[Math.floor(rng() * DIRS.length)] ?? mover.facing };
  }
  let pick = rng() * total;
  let dir = weighted[weighted.length - 1]!.dir;
  for (const entry of weighted) {
    pick -= entry.weight;
    if (pick <= 0) { dir = entry.dir; break; }
  }
  const roll = rng();
  const length = roll < 0.4 ? 1 : roll < 0.8 ? 2 : 3;
  mover.wanderRun = { dir, left: length - 1 };
  return { kind: "move", dir };
}
