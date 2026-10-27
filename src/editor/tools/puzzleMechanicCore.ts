// src/editor/tools/puzzleMechanicCore.ts
// 품질 퍼즐 프리셋(2026-10-20 R2)의 공용 틀: 시공 문맥·결과 형, 풀이 모형(BFS 해 존재 증명), 실기 플레이 절차 형.
//
// 왜: 이전 16종 대부분은 「조사 → 선택지 0번 → 문 열림」이라 판단할 것이 없었다(적대 VQA 2026-10-20). 품질 프리셋은
// 저마다 상태 공간이 있는 순수 모형(model)을 같이 싣고, author_map_puzzle 이 시공할 때 BFS 로 ① 해가 있는지
// ② 최소 몇 수인지 ③ 되돌릴 수 없는 막다른 상태가 있는지를 재서 데이터로 돌려준다. 해가 없으면 시공을 거절한다.
// 최단 해는 그대로 실기 플레이 절차(playtest)가 되어 출하 플레이어 QA 가 진짜 걸음으로 같은 해를 밟는다.

import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import type { Cell } from "./jrpgVolumeTools";
import type { PuzzleRoom } from "./puzzleKit";

/** 실기 플레이 한 걸음. 좌표는 방 기준(0..19, 0..14). walk 의 moves 는 U/D/L/R 한 칸씩(밀기 포함). */
export type PuzzlePlayStep =
  | { readonly kind: "walk"; readonly moves: string }
  | { readonly kind: "goto"; readonly x: number; readonly y: number; readonly face?: "up" | "down" | "left" | "right" }
  | { readonly kind: "face"; readonly dir: "up" | "down" | "left" | "right" }
  | { readonly kind: "act"; readonly choose?: readonly number[]; readonly number?: number; readonly present?: readonly string[] }
  | { readonly kind: "wait"; readonly ms: number }
  | { readonly kind: "mark"; readonly label: string; readonly expectSolved?: boolean };

/** 상태 공간 모형. moves 의 label 은 사람이 읽는 수(手) 이름이자 playtest 로 바뀌는 열쇠다. */
export interface PuzzleModel<S> {
  readonly start: S;
  readonly key: (s: S) => string;
  readonly moves: (s: S) => ReadonlyArray<readonly [string, S]>;
  readonly goal: (s: S) => boolean;
}

export interface PuzzleAnalysis {
  readonly solvable: boolean;
  /** 최소 수(라벨 수). */
  readonly minMoves: number;
  readonly solution: readonly string[];
  readonly reachableStates: number;
  /** 시작에서 닿지만 거기서는 목표에 다시 닿을 수 없는 상태 수(리셋이 필요한 막다른 길). */
  readonly deadEndStates: number;
  /** 상한에 걸려 전수가 아닌지. */
  readonly truncated: boolean;
  /** 시작에서 가장 가까운 막다른 상태로 가는 수(오답 시연용). 없으면 빈 배열. */
  readonly deadEndPath: readonly string[];
}

export function analysePuzzleModel<S>(model: PuzzleModel<S>, cap = 250_000): PuzzleAnalysis {
  const startKey = model.key(model.start);
  const parent = new Map<string, { readonly from: string; readonly label: string } | null>([[startKey, null]]);
  const states = new Map<string, S>([[startKey, model.start]]);
  const edges = new Map<string, string[]>();
  const queue: string[] = [startKey];
  let goalKey: string | undefined;
  const goals: string[] = [];
  let truncated = false;
  for (let i = 0; i < queue.length; i += 1) {
    const k = queue[i]!;
    const s = states.get(k)!;
    if (model.goal(s)) {
      goals.push(k);
      goalKey ??= k;
      continue;
    }
    const out: string[] = [];
    for (const [label, next] of model.moves(s)) {
      const nk = model.key(next);
      out.push(nk);
      if (parent.has(nk)) continue;
      if (parent.size >= cap) {
        truncated = true;
        continue;
      }
      parent.set(nk, { from: k, label });
      states.set(nk, next);
      queue.push(nk);
    }
    edges.set(k, out);
  }
  const pathTo = (target: string | undefined): string[] => {
    const out: string[] = [];
    for (let k = target; k !== undefined; ) {
      const p = parent.get(k);
      if (!p) break;
      out.unshift(p.label);
      k = p.from;
    }
    return out;
  };
  const solution = pathTo(goalKey);
  // 거꾸로 닿음: 목표에서 거슬러 갈 수 있는 상태만 「살아 있다」.
  const reverse = new Map<string, string[]>();
  for (const [from, outs] of edges) {
    for (const to of outs) {
      const list = reverse.get(to);
      if (list) list.push(from);
      else reverse.set(to, [from]);
    }
  }
  const alive = new Set<string>(goals);
  const stack = [...goals];
  while (stack.length > 0) {
    const k = stack.pop()!;
    for (const from of reverse.get(k) ?? []) {
      if (alive.has(from)) continue;
      alive.add(from);
      stack.push(from);
    }
  }
  // BFS 순서라 처음 만나는 죽은 상태가 시작에서 가장 가깝다.
  const firstDead = truncated ? undefined : queue.find((k) => !alive.has(k));
  return {
    solvable: goalKey !== undefined,
    minMoves: solution.length,
    solution,
    reachableStates: parent.size,
    deadEndStates: truncated ? 0 : parent.size - alive.size,
    truncated,
    deadEndPath: pathTo(firstDead),
  };
}

export interface MechanicContext {
  readonly draft: Project;
  readonly map: GameMap;
  /** 방 창 왼쪽 위(맵 좌표). */
  readonly win: Cell;
  readonly baseId: string;
  readonly solveSwitchId: string;
  readonly rewardCommands: readonly Command[];
  readonly title?: string;
  readonly hint?: string;
  /**
   * 들켰을 때·실패했을 때의 벌(그 상태가 있는 프리셋만 — 지금은 stealth_guard_patrol). 생략 = 프리셋 기본(입구로 쫓겨남).
   * troopId = 먼저 그 적 그룹과 싸운다(도망 불가) · sendTo = 쫓겨나는 곳(다른 맵도 된다, 예: 감방) · text = 들킨 대사.
   */
  readonly failPenalty?: { readonly troopId?: string; readonly sendTo?: { readonly mapId: string; readonly x: number; readonly y: number }; readonly text?: string };
  /** puzzleId 에서 뽑은 고정 씨앗 — 같은 id 면 같은 문제, 다른 방이면 다른 배치. */
  readonly seed: number;
  /** 이름 붙은 스위치/변수를 만들고 id 를 돌려준다. */
  readonly sw: (suffix: string, label: string) => string;
  readonly v: (suffix: string, label: string) => string;
  readonly evId: (suffix: string) => string;
}

export interface MechanicResult<S = unknown> {
  readonly room: PuzzleRoom;
  readonly events: ReadonlyArray<{ readonly event: GameEvent; readonly role: string }>;
  /** 플레이어 시작 칸(방 기준). */
  readonly origin: Cell;
  readonly revealCommandCount: number;
  readonly solveSteps: readonly string[];
  readonly model: PuzzleModel<S>;
  /** 모형 해(라벨 목록) → 실기 플레이 절차. */
  readonly toPlaytest: (solution: readonly string[]) => PuzzlePlayStep[];
  /** 해 앞에 넣는 오답·리셋 시연(되돌림이 실제로 되는지 플레이 QA 가 확인한다). */
  readonly mistakeDemo?: (analysis: PuzzleAnalysis) => PuzzlePlayStep[];
  /**
   * 처음 지도에서는 닫힌 창살·심연 너머라 걸어서 못 닿고, 퍼즐을 풀어 가며 열리는 칸의 이벤트 id(레버 회랑 안쪽 레버, 과거에만 건너는 다리 너머
   * 모래시계). 정적 도달성 검사에서 빼는 대신 시공기가 상태 공간 모형에서 그 칸을 실제로 밟는 수를 둬야 한다(모형 BFS 가 도달을 증명한다).
   */
  readonly stagedReach?: readonly string[];
}

export interface MechanicDef {
  readonly build: (ctx: MechanicContext) => MechanicResult;
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 씨앗으로 고정 순열을 뽑는다(Fisher–Yates + LCG). */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const DIR_OF: Record<string, { readonly dx: number; readonly dy: number; readonly dir: "up" | "down" | "left" | "right" }> = {
  U: { dx: 0, dy: -1, dir: "up" },
  D: { dx: 0, dy: 1, dir: "down" },
  L: { dx: -1, dy: 0, dir: "left" },
  R: { dx: 1, dy: 0, dir: "right" },
};

/** 격자 위 최단 걸음(U/D/L/R 문자열). blocked 칸은 못 지난다. 닿지 못하면 undefined. */
export function gridPath(from: Cell, to: Cell, walkable: (x: number, y: number) => boolean): string | undefined {
  const key = (c: Cell): string => `${c.x},${c.y}`;
  const prev = new Map<string, { from: string; step: string } | null>([[key(from), null]]);
  const queue: Cell[] = [from];
  for (let i = 0; i < queue.length; i += 1) {
    const c = queue[i]!;
    if (c.x === to.x && c.y === to.y) break;
    for (const [step, d] of Object.entries(DIR_OF)) {
      const n = { x: c.x + d.dx, y: c.y + d.dy };
      if (prev.has(key(n)) || !walkable(n.x, n.y)) continue;
      prev.set(key(n), { from: key(c), step });
      queue.push(n);
    }
  }
  if (!prev.has(key(to))) return undefined;
  let out = "";
  for (let k = key(to); ; ) {
    const p = prev.get(k);
    if (!p) break;
    out = p.step + out;
    k = p.from;
  }
  return out;
}

/** 조사할 대상 칸 옆의 걸어갈 수 있는 칸(위·아래·왼·오 순)으로 가서 그 대상을 바라본다. */
export function approachAndFace(
  from: Cell,
  target: Cell,
  walkable: (x: number, y: number) => boolean,
  prefer: readonly ("D" | "U" | "L" | "R")[] = ["D", "L", "R", "U"],
): { readonly path: string; readonly stand: Cell; readonly face: "up" | "down" | "left" | "right" } {
  let best: { path: string; stand: Cell; face: "up" | "down" | "left" | "right" } | undefined;
  for (const side of prefer) {
    const d = DIR_OF[side]!;
    const stand = { x: target.x + d.dx, y: target.y + d.dy };
    if (!walkable(stand.x, stand.y)) continue;
    const path = gridPath(from, stand, walkable);
    if (path === undefined) continue;
    const face = ({ U: "down", D: "up", L: "right", R: "left" } as const)[side];
    if (!best || path.length < best.path.length) best = { path, stand, face };
  }
  if (!best) throw new Error(`(${target.x},${target.y}) 옆에 닿을 칸이 없습니다.`);
  return best;
}

/**
 * 모형 해를 실기 걸음으로 옮기는 도우미. 지금 선 칸을 기억하며 「X 를 조사(선택지 i)」「Y 를 밟기」를 걸음 + 바라보기 + 조사로 바꾼다.
 * walkable 은 방 기준 좌표의 걸을 수 있는 칸(벽·가구·막는 이벤트 제외).
 */
export class PlayPlanner {
  readonly steps: PuzzlePlayStep[] = [];
  constructor(
    private readonly walkable: (x: number, y: number) => boolean,
    private at: Cell,
  ) {}

  actOn(target: Cell, opts: { readonly choose?: readonly number[]; readonly number?: number; readonly present?: readonly string[] } = {}): this {
    const { path, stand, face } = approachAndFace(this.at, target, this.walkable);
    if (path) this.steps.push({ kind: "walk", moves: path });
    this.steps.push({ kind: "face", dir: face });
    this.steps.push({ kind: "act", ...opts });
    this.at = stand;
    return this;
  }

  stepOn(target: Cell, avoid: (x: number, y: number) => boolean = () => false): this {
    const path = gridPath(this.at, target, (x, y) => (x === target.x && y === target.y) || (this.walkable(x, y) && !avoid(x, y)));
    if (path === undefined) throw new Error(`(${target.x},${target.y}) 로 가는 길이 없습니다.`);
    if (path) this.steps.push({ kind: "walk", moves: path });
    this.at = target;
    return this;
  }

  teleported(to: Cell): this {
    this.at = to;
    return this;
  }

  push(step: PuzzlePlayStep): this {
    this.steps.push(step);
    return this;
  }

  done(): PuzzlePlayStep[] {
    return [...this.steps, { kind: "wait", ms: 600 }, { kind: "mark", label: "solved", expectSolved: true }];
  }
}

/** 방 기준 걷기 판정: 맵 통행 + 막는(priority same) 퍼즐 이벤트 칸 제외. */
export function roomWalkable(
  passable: (x: number, y: number) => boolean,
  win: Cell,
  solid: ReadonlyArray<Cell>,
): (x: number, y: number) => boolean {
  const blocked = new Set(solid.map((c) => `${c.x},${c.y}`));
  return (x, y) => x >= 0 && y >= 0 && x < 20 && y < 15 && !blocked.has(`${x},${y}`) && passable(win.x + x, win.y + y);
}
