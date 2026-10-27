// src/editor/tools/puzzleMechanicsClassic.ts
// 옛 「끼워 넣기」 프리셋 넷을 품질 방으로 다시 지은 것(2026-10-20 r4): 레버 통로(떨어지는 창살 회랑), 얼음 미끄럼(빙판 동굴),
// 시간의 문(과거↔현재 모래시계 신전), 경비병(초소 잠입).
//
// 왜: 이 넷은 맵 아무 데나 끼워 넣는 옛 방식이라 빈 맵 시험에서 방이 없었다(끝없는 마루 위에 기물 덩이만 떠 있었다,
// 적대 검수 r3). 이제 다른 16종처럼 20×15 한 화면 방 전체를 퍼즐을 중심으로 짓고, 상태 공간 모형(BFS)으로 해·최소 수·
// 막다른 상태를 시공 때 잰다. 모형은 지은 맵의 통행(isPassable)·미끄럼 규칙(slideTiles)에서 바로 읽어 엔진과 같다.

import { isPassable } from "@/project/collision";
import { slideRuleAt } from "@/project/slideTiles";
import type { Command, EventPageGraphic, GameEvent } from "@/project/types";
import { HAND_INTERIOR_SPEC, type HandInteriorObject } from "@/editor/handInterior/builder";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { resolveGraphic } from "./eventCompile";
import type { Cell } from "./jrpgVolumeTools";
import {
  DIR_OF,
  PlayPlanner,
  roomWalkable,
  type MechanicContext,
  type MechanicDef,
  type MechanicResult,
  type PuzzleModel,
  type PuzzlePlayStep,
} from "./puzzleMechanicCore";
import {
  ifSw,
  m2,
  makePage,
  obj,
  particles,
  PuzzleRoom,
  puzzleEvent,
  rect,
  revealInWaves,
  se,
  setSw,
  sfx,
  shake,
  textCmd,
  tintPulse,
  TRANSPARENT,
  wait,
  type PropState,
  type PuzzleRoomSpec,
  type RevealTheme,
} from "./puzzleKit";

interface Built {
  readonly room: PuzzleRoom;
  readonly at: (c: Cell) => Cell;
  readonly walk: (x: number, y: number) => boolean;
}

function buildRoom(ctx: MechanicContext, spec: PuzzleRoomSpec, label: string, solid: readonly Cell[]): Built {
  const room = new PuzzleRoom(ctx.draft, ctx.map, ctx.win, spec, label);
  room.paint();
  return {
    room,
    at: (c) => room.at(c.x, c.y),
    walk: roomWalkable((x, y) => isPassable(ctx.draft, ctx.map, x, y), ctx.win, solid),
  };
}

const solvedCond = (ctx: MechanicContext) => [{ kind: "switch" as const, switchId: ctx.solveSwitchId, value: true }];

function actEvent(ctx: MechanicContext, b: Built, suffix: string, name: string, cell: Cell, commands: readonly Command[], afterText?: string): GameEvent {
  const id = ctx.evId(suffix);
  return puzzleEvent(id, name, b.at(cell), [
    makePage({ id: `${id}_live`, name, graphic: TRANSPARENT, commands }),
    ...(afterText ? [makePage({ id: `${id}_done`, name: `${name}(해결 뒤)`, conditions: solvedCond(ctx), graphic: TRANSPARENT, commands: [textCmd(afterText)] })] : []),
  ]);
}

const hasObject = (id: string): boolean => Boolean(HAND_INTERIOR_SPEC.objects[id]);
const toggle = (swId: string, b: Built, prop: string, on: readonly Command[] = [], off: readonly Command[] = []): Command =>
  ifSw(swId, true, [setSw(swId, false), ...b.room.set(prop, 0), ...off], [setSw(swId, true), ...b.room.set(prop, 1), ...on]);

const goldTheme: RevealTheme = { flash: "white", pulse: "255,236,170", waves: ["dust", "magic", "sparkle"] };
const iceTheme: RevealTheme = { flash: "white", pulse: "190,225,255", waves: ["splash", "dust", "sparkle"] };
const timeTheme: RevealTheme = { flash: "white", pulse: "220,200,255", waves: ["magic", "dust", "sparkle"] };

// ---------------------------------------------------------------------------
// 1. 레버 통로 (lever_secret_passage) — 쇠창살 칸막이 셋, 지나가면 등 뒤에서 떨어지는 창살
// ---------------------------------------------------------------------------

/** 서→동 네 칸(경비실 · 감방 · 감방 · 보물고) 사이 쇠창살 칸막이 x. 문은 y=9 한 칸. */
const LC_GATE_X = [5, 10, 15] as const;
const LC_GATE_Y = 9;
/** 칸마다 북벽 레버 x (칸 0·1·2). */
const LC_LEVER_X = [2, 8, 13] as const;
/**
 * 레버가 함께 움직이는 창살(비트 = 창살 0·1·2). 지나간 창살은 등 뒤에서 떨어진다(닫힌다). 이 짝은 칸막이 셋·레버 셋 전수 탐색에서
 * 「감방 둘째 칸까지 갔다가 첫째 칸으로 되돌아와 레버를 다시 당겨야 하는」 유일한 짝 계열이고, 막다른 상태가 없다(BFS 확인).
 */
const LC_LEVER_MASK = [0b101, 0b110, 0b010] as const;

interface LeverState {
  readonly sec: number;
  readonly gates: number;
}

export const leverGatehouse: MechanicDef = {
  build(ctx) {
    const bars = (x: number, y0: number, y1: number) => ({ id: "bars", rect: { x0: x, y0, x1: x, y1 } });
    const gateProp = (x: number): PropState[] => [
      { lines: [bars(x, 5, 13)] },
      { lines: [bars(x, 5, LC_GATE_Y - 1), bars(x, LC_GATE_Y + 1, 13)] },
    ];
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 1,
      right: 1,
      door: [2],
      floor: "dungeon",
      wall: "dungeonw",
      ceiling: "dark",
      // 보물고 바닥은 판석, 칸막이를 꿰는 y=9 줄은 판석 통로(창살 문이 어디인지 바닥이 알려 준다).
      zones: [
        { x0: 16, y0: 5, x1: 18, y1: 13, floor: "flag" },
        { x0: 1, y0: LC_GATE_Y, x1: 15, y1: LC_GATE_Y, floor: "flag" },
      ],
      objects: [
        // 경비실(칸 0): 근무 탁자·걸상·열쇠 고리·무기 걸이·단서 석판
        obj("weapon rack", 1, 3),
        obj("key ring hook", 3, 3),
        obj("wall torch", 4, 3),
        obj("table:mug+bottle", 2, 6),
        obj("stool", 1, 6),
        obj("barrel", 1, 13),
        obj("arrow barrel", 4, 13),
        obj("hint tablet", 4, 11),
        // 감방 1(칸 1): 죄수 침상·족쇄·짚더미·오물통·물 고임
        obj("shackles", 6, 3),
        obj("wall torch", 9, 3),
        obj("prison cot", 6, 5),
        obj("drip puddle", 8, 7),
        obj("straw pile", 9, 12),
        obj("slop bucket", 6, 13),
        obj("candle stubs", 7, 11),
        // 감방 2(칸 2): 짚 침상·해골·부서진 쇠사슬
        obj("shackles", 11, 3),
        obj("cobweb", 14, 3),
        obj("straw bed", 11, 5),
        obj("skull pile", 14, 13),
        obj("loot sacks", 11, 12),
        obj("drip puddle", 13, 7),
        obj("bone pillar", 14, 11),
        // 보물고(칸 3): 깃발·금화·금고·보물 더미
        obj("royal banner", 16, 3),
        obj("wall torch", 18, 3),
        obj("treasure pile", 16, 11),
        obj("coin pile", 16, 13),
        obj("royal chest", 18, 8),
        obj("safe", 18, 13),
      ],
      props: {
        ...Object.fromEntries(LC_GATE_X.map((x, i) => [`gate_${i}`, gateProp(x)])),
        ...Object.fromEntries(LC_LEVER_X.map((x, i) => [`lever_${i}`, [{ objects: [obj("wall lever", x, 3)] }, { objects: [obj("wall lever on", x, 3)] }]])),
        chest: [{ objects: [obj("treasure chest", 17, 6)] }, { objects: [obj("treasure chest open", 17, 6)] }],
      },
    };
    const b = buildRoom(ctx, spec, "lever_secret_passage", [{ x: 4, y: 12 }]);
    const swGate = LC_GATE_X.map((_, i) => ctx.sw(`gate_${i}_open`, `창살 ${i + 1} 열림`));
    const swLever = LC_LEVER_X.map((_, i) => ctx.sw(`lever_${i}_pulled`, `레버 ${i + 1} 당김`));
    const allOpen: Command[] = LC_GATE_X.flatMap((_, i) => [setSw(swGate[i]!, true), ...b.room.set(`gate_${i}`, 1)]);
    const finale: Command[] = [
      textCmd("마지막 창살을 지나자 보물고의 쇠사슬이 풀리며 모든 창살이 천장으로 감겨 올라간다!"),
      ...revealInWaves([...allOpen, ...b.room.set("chest", 1)], goldTheme),
      ...ctx.rewardCommands,
      setSw(ctx.solveSwitchId, true),
    ];
    const levers = LC_LEVER_X.map((x, i) =>
      actEvent(
        ctx,
        b,
        `lever_${i}`,
        `레버 ${i + 1}`,
        { x, y: 4 },
        [
          sfx("switch-clack"),
          ifSw(swLever[i]!, true, [setSw(swLever[i]!, false), ...b.room.set(`lever_${i}`, 0)], [setSw(swLever[i]!, true), ...b.room.set(`lever_${i}`, 1)]),
          ...LC_GATE_X.flatMap((gx, k) => (((LC_LEVER_MASK[i]! >> k) & 1) === 1 ? [toggle(swGate[k]!, b, `gate_${k}`), particles("dust", 400, b.at({ x: gx, y: LC_GATE_Y }))] : [])),
          se("earth2"),
          shake(1, 200),
        ],
        "레버는 당겨진 채 굳었다. 창살은 모두 올라가 있다.",
      ),
    );
    const gates = LC_GATE_X.map((gx, k) => {
      const id = ctx.evId(`gate_${k}`);
      const slam: Command[] =
        k === LC_GATE_X.length - 1
          ? finale
          : [se("collapse1"), shake(3, 300), setSw(swGate[k]!, false), ...b.room.set(`gate_${k}`, 0), particles("dust", 500, b.at({ x: gx, y: LC_GATE_Y })), textCmd("쾅! 지나온 창살이 등 뒤에서 떨어졌다.")];
      return puzzleEvent(id, `쇠창살 문 ${k + 1}`, b.at({ x: gx, y: LC_GATE_Y }), [
        makePage({ id: `${id}_closed`, name: "창살(닫힘)", graphic: TRANSPARENT, commands: [textCmd("녹슨 쇠창살이 내려와 있다. 어느 레버가 이 창살을 감아올릴까?")] }),
        makePage({
          id: `${id}_open`,
          name: "창살(열림 — 지나가면 떨어짐)",
          conditions: [{ kind: "switch", switchId: swGate[k]!, value: true }],
          trigger: "playerTouch",
          priority: "below",
          graphic: TRANSPARENT,
          commands: [{ kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "stepForward" }], repeat: false, wait: true, skippable: true } }, ...slam],
        }),
        makePage({ id: `${id}_solved`, name: "창살(해결 뒤)", conditions: solvedCond(ctx), priority: "below", graphic: TRANSPARENT, commands: [] }),
      ]);
    });
    const tablet = actEvent(ctx, b, "hint_tablet", "간수의 석판", { x: 4, y: 12 }, [
      se("decision1"),
      textCmd(ctx.hint ?? "석판: 「레버 하나는 창살 둘을 함께 움직인다. 창살을 지나면 등 뒤에서 떨어진다 — 보물고는 동쪽 끝.」"),
    ]);
    const model: PuzzleModel<LeverState> = {
      start: { sec: 0, gates: 0 },
      key: (s) => `${s.sec}:${s.gates}`,
      goal: (s) => s.sec === LC_GATE_X.length,
      moves: (s) => {
        const out: Array<readonly [string, LeverState]> = [];
        if (s.sec < LC_LEVER_X.length) out.push([`lever:${s.sec}`, { sec: s.sec, gates: s.gates ^ LC_LEVER_MASK[s.sec]! }]);
        if (s.sec < LC_GATE_X.length && ((s.gates >> s.sec) & 1) === 1) out.push(["E", { sec: s.sec + 1, gates: s.gates & ~(1 << s.sec) }]);
        if (s.sec > 0 && ((s.gates >> (s.sec - 1)) & 1) === 1) out.push(["W", { sec: s.sec - 1, gates: s.gates & ~(1 << (s.sec - 1)) }]);
        return out;
      },
    };
    const origin: Cell = { x: 2, y: 13 };
    const result: MechanicResult<LeverState> = {
      room: b.room,
      origin,
      events: [
        ...levers.map((event, i) => ({ event, role: `레버 ${i + 1}` })),
        ...gates.map((event, i) => ({ event, role: `쇠창살 문 ${i + 1}(지나가면 떨어짐)` })),
        { event: tablet, role: "간수의 석판(규칙)" },
      ],
      revealCommandCount: allOpen.length,
      stagedReach: [levers[1]!.id, levers[2]!.id, gates[1]!.id, gates[2]!.id],
      solveSteps: [
        "레버 셋이 창살을 둘씩(마지막 레버는 하나) 감아올린다. 지나간 창살은 등 뒤에서 떨어진다",
        "레버 1 → 감방 1 → 레버 2 → 감방 2 → 레버 3 → 감방 1 로 되돌아와 레버 2 → 보물고",
      ],
      model,
      mistakeDemo: () => [
        { kind: "goto", x: origin.x, y: origin.y, face: "up" },
        ...new PlayPlanner(b.walk, origin).actOn({ x: LC_LEVER_X[0], y: 4 }).actOn({ x: LC_LEVER_X[0], y: 4 }).steps,
        { kind: "mark", label: "mistake", expectSolved: false },
      ],
      toPlaytest: (solution) => {
        const p = new PlayPlanner(b.walk, origin);
        let sec = 0;
        for (const label of solution) {
          if (label.startsWith("lever:")) p.actOn({ x: LC_LEVER_X[sec]!, y: 4 });
          else if (label === "E") {
            const gx = LC_GATE_X[sec]!;
            p.stepOn({ x: gx - 1, y: LC_GATE_Y }).push({ kind: "walk", moves: "R" }).teleported({ x: gx + 1, y: LC_GATE_Y });
            sec += 1;
          } else {
            const gx = LC_GATE_X[sec - 1]!;
            p.stepOn({ x: gx + 1, y: LC_GATE_Y }).push({ kind: "walk", moves: "L" }).teleported({ x: gx - 1, y: LC_GATE_Y });
            sec -= 1;
          }
        }
        return [{ kind: "goto", x: origin.x, y: origin.y, face: "up" }, ...p.done()];
      },
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 2. 얼음 미끄럼 (ice_conveyor_slide) — 빙판 동굴, 바위·얼음 결정에 부딪혀야 멈춘다
// ---------------------------------------------------------------------------

/**
 * 빙판 8줄 × 14칸(방 x 3..16, y 5..12). '#' 바위·얼음 결정, 'G' 북벽 아래 눈 디딤(목표), '.' 빙판. 남쪽 y=13 은 눈 둑.
 * 무작위 4만 판 중 「둑 왕복·되돌아 미끄러지기」가 필요한 최단 12수 판 셋(모든 칸에서 둑으로 돌아올 수 있음).
 */
const ICE_VARIANTS: readonly (readonly string[])[] = [
  ["..#.G#........", ".#........##..", "...........#..", "..........#...", "....#.........", "#..#.........#", "..............", "...#.........."],
  [".........#.G#.", "#..#........#.", "..............", ".........#....", "...#......#..#", ".#.........#.#", ".............#", "..#.#.......#."],
  ["#.......#G....", ".#...........#", ".........#.#.#", "........#.#...", "....#..#.#....", "..#.....#...#.", "..............", ".....#........"],
];
const ICE_OX = 3;
const ICE_OY = 5;

export const iceCavernSlide: MechanicDef = {
  build(ctx) {
    if (!HAND_INTERIOR_SPEC.floors.ice) throw new Error("얼음 미끄럼 방: 실내 칩셋에 빙판 바닥(ice)이 없습니다 — interior-plus 굽기를 먼저 하세요.");
    const grid = ICE_VARIANTS[ctx.seed % ICE_VARIANTS.length]!;
    const rocks: Cell[] = [];
    let goal: Cell = { x: 10, y: ICE_OY };
    grid.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch === "#") rocks.push({ x: ICE_OX + i, y: ICE_OY + j });
        if (ch === "G") goal = { x: ICE_OX + i, y: ICE_OY + j };
      }),
    );
    const W = grid[0]!.length;
    const H = grid.length;
    const rockObj = (c: Cell, i: number): HandInteriorObject => obj((c.x * 7 + c.y * 3 + i) % 3 === 0 ? "push boulder" : "mana crystal", c.x, c.y);
    const tabletAt: Cell = { x: ICE_OX + W - 1, y: ICE_OY + H };
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 3,
      right: 3,
      floor: "snowmat",
      wall: "rock",
      ceiling: "rock",
      zones: [{ x0: ICE_OX, y0: ICE_OY, x1: ICE_OX + W - 1, y1: ICE_OY + H - 1, floor: "ice" }, { x0: goal.x, y0: goal.y, x1: goal.x, y1: goal.y, floor: "snowmat" }],
      objects: [...rocks.map(rockObj), obj("wall torch", 4, 3), obj("wall torch", 15, 3), obj("hint tablet", tabletAt.x, tabletAt.y), obj("brazier", ICE_OX, ICE_OY + H)],
      props: {
        gate: [
          { objects: [obj("portcullis", goal.x, 3), obj("pressure plate", goal.x, goal.y)] },
          { open: [rect(goal.x - 1, 1, goal.x + 1, 2)], objects: [obj("stairs up stone", goal.x - 1, 3), obj("pressure plate down", goal.x, goal.y)] },
        ],
      },
    };
    const b = buildRoom(ctx, spec, "ice_conveyor_slide", [tabletAt]);
    const tileset = ctx.draft.tilesets[ctx.map.tilesetId]!;
    const ice = (x: number, y: number): boolean => slideRuleAt(tileset, ctx.map, ctx.win.x + x, ctx.win.y + y) === "ice";
    if (!ice(ICE_OX, ICE_OY + H - 1) && !ice(ICE_OX + 1, ICE_OY + H - 1)) throw new Error("얼음 미끄럼 방: 빙판 칸에 미끄럼 규칙(slideTiles ice)이 없습니다.");
    const gateCmds = b.room.set("gate", 1);
    const goalId = ctx.evId("goal_plate");
    const goalEvent = puzzleEvent(goalId, "얼음 위 눈 디딤판", b.at(goal), [
      makePage({
        id: `${goalId}_live`,
        name: "디딤판",
        trigger: "playerTouch",
        priority: "below",
        graphic: TRANSPARENT,
        commands: [sfx("plate-press"), textCmd("눈 디딤판을 밟자 얼음 속 쇠사슬이 울리며 창살이 감겨 올라간다!"), ...revealInWaves(gateCmds, iceTheme), ...ctx.rewardCommands, setSw(ctx.solveSwitchId, true)],
      }),
      makePage({ id: `${goalId}_done`, name: "디딤판(해결 뒤)", conditions: solvedCond(ctx), priority: "below", graphic: TRANSPARENT, commands: [] }),
    ]);
    const tablet = actEvent(ctx, b, "hint_tablet", "얼음 동굴 석판", tabletAt, [
      se("decision1"),
      textCmd(ctx.hint ?? "석판: 「빙판에 오르면 바위나 결정에 부딪힐 때까지 미끄러진다. 북쪽 눈 디딤판에 정확히 멈춰 서라.」"),
    ]);
    const origin: Cell = { x: 10, y: ICE_OY + H };
    const walk = b.walk;
    const slide = (p: Cell, d: { dx: number; dy: number }): Cell | undefined => {
      let x = p.x + d.dx;
      let y = p.y + d.dy;
      if (!walk(x, y)) return undefined;
      while (ice(x, y) && walk(x + d.dx, y + d.dy)) {
        x += d.dx;
        y += d.dy;
      }
      return { x, y };
    };
    const model: PuzzleModel<Cell> = {
      start: origin,
      key: (s) => `${s.x},${s.y}`,
      goal: (s) => s.x === goal.x && s.y === goal.y,
      moves: (s) => {
        const out: Array<readonly [string, Cell]> = [];
        for (const [m, d] of Object.entries(DIR_OF)) {
          const n = slide(s, d);
          if (n && (n.x !== s.x || n.y !== s.y)) out.push([m, n]);
        }
        return out;
      },
    };
    const result: MechanicResult<Cell> = {
      room: b.room,
      origin,
      events: [
        { event: goalEvent, role: "눈 디딤판(목표)" },
        { event: tablet, role: "얼음 동굴 석판(규칙)" },
      ],
      revealCommandCount: gateCmds.length,
      solveSteps: ["빙판에 오르면 막힐 때까지 미끄러진다(엔진 slideTiles ice)", `바위·결정을 멈춤목으로 써서 북쪽 눈 디딤판 (${goal.x},${goal.y}) 에 멈춘다`],
      model: model as PuzzleModel<Cell>,
      mistakeDemo: () => [
        { kind: "goto", x: origin.x, y: origin.y, face: "up" },
        { kind: "walk", moves: "U" },
        { kind: "mark", label: "mistake", expectSolved: false },
      ],
      toPlaytest: (solution) => [
        { kind: "goto", x: origin.x, y: origin.y, face: "up" },
        { kind: "walk", moves: solution.join("") },
        { kind: "wait", ms: 600 },
        { kind: "mark", label: "solved", expectSolved: true },
      ],
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 3. 시간의 문 (time_gate_causality) — 모래시계를 뒤집으면 방 전체가 과거 ↔ 현재로 바뀐다
// ---------------------------------------------------------------------------

/**
 * 시간 신전: 가운데 심연(y 8..9)이 남·북 둑을 가른다.
 * - 과거: 서쪽 돌다리(x 3..4)가 서 있고, 북쪽 「시간의 문」 창살은 봉인돼 있다.
 * - 현재: 다리는 무너져 심연이고, 북쪽 둑 서쪽(x 6..7)은 무너진 돌무더기로 막혔고, 창살은 녹슬어 올라가 있다.
 * 모래시계 A(남쪽 둑)·B(북쪽 둑 동쪽)에서만 시대를 바꿀 수 있다. 과거로 → 다리 건너 → 돌무더기 자리를 지나 B 에서 현재로 → 문.
 */
const TG_CHASM_Y = [8, 9] as const;
const TG_BRIDGE_X = [3, 4] as const;
const TG_HOURGLASS = [
  { x: 5, y: 11 },
  { x: 13, y: 5 },
] as const;
const TG_DOOR: Cell = { x: 10, y: 4 };

interface TimeState {
  readonly x: number;
  readonly y: number;
  readonly past: boolean;
  readonly done: boolean;
}

export const timeTempleEras: MechanicDef = {
  build(ctx) {
    const bridge = rect(TG_BRIDGE_X[0], TG_CHASM_Y[0], TG_BRIDGE_X[1], TG_CHASM_Y[1]);
    const chasmOutside = [rect(1, TG_CHASM_Y[0], TG_BRIDGE_X[0] - 1, TG_CHASM_Y[1]), rect(TG_BRIDGE_X[1] + 1, TG_CHASM_Y[0], 18, TG_CHASM_Y[1])];
    const rubble: Cell[] = [5, 6, 7].flatMap((y) => [{ x: 6, y }, { x: 7, y }]);
    const present: PropState = {
      voids: [bridge],
      objects: [
        ...rubble.map((c, i) => obj(i % 3 === 1 ? "stone sphere" : "push boulder", c.x, c.y)),
        obj("portcullis open", 9, 3),
        obj("cobweb", 2, 3),
        obj("cobweb", 17, 3),
        obj("torn portrait", 15, 3),
        obj("candle stubs", 15, 5),
        obj("skull pile", 1, 5),
      ],
    };
    const past: PropState = {
      zones: [{ ...bridge, floor: "flag" }],
      objects: [
        obj("portcullis", 9, 3),
        obj("royal banner", 2, 3),
        obj("royal banner", 17, 3),
        obj("tapestry", 15, 3),
        obj("candelabra", 8, 5),
        obj("candelabra", 11, 5),
        obj("sanctuary lamp", 13, 3),
        obj("votive stand", 1, 5),
      ],
    };
    const solved: PropState = {
      voids: [bridge],
      open: [rect(9, 1, 11, 2)],
      objects: [...present.objects!.filter((o) => o.id !== "portcullis open"), obj("stairs up stone", 9, 3)],
    };
    const tablet: Cell = { x: 15, y: 12 };
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 1,
      right: 1,
      floor: "marble",
      wall: "marblewall",
      ceiling: "gold",
      lines: [{ id: "rug royal", rect: rect(9, 10, 11, 13) }],
      voids: chasmOutside,
      objects: [
        ...TG_HOURGLASS.map((h) => obj("hourglass", h.x, h.y)),
        obj("column marble", 1, 11),
        obj("column marble", 18, 11),
        obj("column marble", 18, 5),
        obj("statue", 16, 6),
        obj("candelabra", 8, 12),
        obj("candelabra", 12, 12),
        obj("stone bench", 2, 13),
        obj("stone bench", 16, 10),
        obj("holy water font", 13, 13),
        obj("hint tablet", tablet.x, tablet.y),
        obj("tall stained window", 4, 3),
        obj("wall torch", 12, 3),
      ],
      props: { era: [present, past, solved] },
    };
    const b = buildRoom(ctx, spec, "time_gate_causality", [...TG_HOURGLASS, tablet]);
    // 시대별 통행: 과거 그림을 잠깐 칠해 재고 현재로 되돌린다(모형이 엔진과 같은 칸을 본다).
    const sample = (): boolean[] => Array.from({ length: 20 * 15 }, (_, i) => b.walk(i % 20, Math.floor(i / 20)));
    const walkPresent = sample();
    b.room.paint({ era: 1 });
    const walkPast = sample();
    b.room.paint();
    const swPast = ctx.sw("era_past", "과거 시대");
    const toPast = [setSw(swPast, true), ...b.room.set("era", 1), m2("Tint Screen", { value: "214,186,130,0.24", durationMs: 450 })];
    const toPresent = [setSw(swPast, false), ...b.room.set("era", 0), m2("Tint Screen", { value: "neutral", durationMs: 450 })];
    const flip = (h: Cell): Command[] => [
      se("magic1"),
      sfx("crystal-ping"),
      ...tintPulse("230,215,255", 0.4, 120, 380),
      particles("magic", 900, b.at(h)),
      ifSw(swPast, true, [...toPresent, textCmd("모래가 거꾸로 흐른다… 신전이 지금의 폐허로 돌아왔다.")], [...toPast, textCmd("모래가 거꾸로 흐른다… 신전이 천 년 전 모습으로 돌아갔다!")]),
    ];
    const hourglassEvents = TG_HOURGLASS.map((h, i) => actEvent(ctx, b, `hourglass_${i}`, `시간의 모래시계 ${i === 0 ? "남" : "북"}`, h, flip(h), "모래시계는 멈춰 있다. 신전은 지금의 시대에 머문다."));
    const finaleCmds = b.room.set("era", 2);
    const doorId = ctx.evId("time_door");
    const door = puzzleEvent(doorId, "시간의 문", b.at(TG_DOOR), [
      makePage({
        id: `${doorId}_live`,
        name: "시간의 문",
        graphic: TRANSPARENT,
        commands: [
          ifSw(
            swPast,
            true,
            [se("buzzer1"), textCmd("과거의 「시간의 문」은 봉인 창살로 굳게 닫혀 있다. 이 문이 열린 것은 먼 훗날이다.")],
            [
              textCmd("녹슨 창살 너머로 천 년 동안 닫혀 있던 계단이 드러난다!"),
              ...revealInWaves(finaleCmds, timeTheme),
              ...ctx.rewardCommands,
              setSw(ctx.solveSwitchId, true),
            ],
          ),
        ],
      }),
      makePage({ id: `${doorId}_done`, name: "시간의 문(열림)", conditions: solvedCond(ctx), graphic: TRANSPARENT, commands: [textCmd("시간의 문 너머 계단이 위층으로 이어진다.")] }),
    ]);
    const tabletEv = actEvent(ctx, b, "hint_tablet", "시간지기의 석판", tablet, [
      se("decision1"),
      textCmd(ctx.hint ?? "석판: 「모래시계를 뒤집으면 신전은 천 년 전으로, 다시 뒤집으면 지금으로 돌아온다. 다리는 과거에만, 문은 지금에만 열려 있다.」"),
    ]);
    const stands = TG_HOURGLASS.map((h) => ({ x: h.x, y: h.y + 1 }));
    const doorStand: Cell = { x: TG_DOOR.x, y: TG_DOOR.y + 1 };
    const model: PuzzleModel<TimeState> = {
      start: { x: 10, y: 13, past: false, done: false },
      key: (s) => `${s.x},${s.y}:${s.past ? 1 : 0}:${s.done ? 1 : 0}`,
      goal: (s) => s.done,
      moves: (s) => {
        const out: Array<readonly [string, TimeState]> = [];
        const ok = s.past ? walkPast : walkPresent;
        for (const [m, d] of Object.entries(DIR_OF)) {
          const nx = s.x + d.dx;
          const ny = s.y + d.dy;
          if (nx >= 0 && ny >= 0 && nx < 20 && ny < 15 && ok[ny * 20 + nx]) out.push([m, { ...s, x: nx, y: ny }]);
        }
        stands.forEach((st, i) => {
          if (st.x === s.x && st.y === s.y && walkPast[s.y * 20 + s.x] && walkPresent[s.y * 20 + s.x]) out.push([`flip:${i}`, { ...s, past: !s.past }]);
        });
        if (s.x === doorStand.x && s.y === doorStand.y && !s.past) out.push(["door", { ...s, done: true }]);
        return out;
      },
    };
    const origin: Cell = { x: 10, y: 13 };
    const result: MechanicResult<TimeState> = {
      room: b.room,
      origin,
      events: [
        ...hourglassEvents.map((event, i) => ({ event, role: `시간의 모래시계 ${i === 0 ? "남(남쪽 둑)" : "북(북쪽 둑 동쪽)"}` })),
        { event: door, role: "시간의 문(현재에서만 열림)" },
        { event: tabletEv, role: "시간지기의 석판(규칙)" },
      ],
      revealCommandCount: finaleCmds.length,
      stagedReach: [hourglassEvents[1]!.id, door.id],
      solveSteps: [
        "남쪽 모래시계로 과거로 → 서쪽 돌다리로 심연을 건넌다",
        "과거에는 돌무더기가 없으니 북쪽 둑을 따라 동쪽 모래시계로 → 현재로",
        "현재의 녹슨 창살(시간의 문)을 조사한다 — 과거의 문은 봉인돼 있다",
      ],
      model,
      mistakeDemo: () => [
        { kind: "goto", x: origin.x, y: origin.y, face: "up" },
        ...new PlayPlanner(b.walk, origin).actOn(TG_HOURGLASS[0]).steps,
        { kind: "mark", label: "past", expectSolved: false },
        ...new PlayPlanner(b.walk, stands[0]!).actOn(TG_HOURGLASS[0]).steps,
        { kind: "mark", label: "present-again", expectSolved: false },
      ],
      toPlaytest: (solution) => {
        const steps: PuzzlePlayStep[] = [{ kind: "goto", x: origin.x, y: origin.y, face: "up" }];
        let run = "";
        const flush = (): void => {
          if (run) steps.push({ kind: "walk", moves: run });
          run = "";
        };
        for (const label of solution) {
          if (label.length === 1) run += label;
          else {
            flush();
            steps.push({ kind: "face", dir: "up" }, { kind: "act" });
          }
        }
        flush();
        return [...steps, { kind: "wait", ms: 600 }, { kind: "mark", label: "solved", expectSolved: true }];
      },
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 4. 경비병 (stealth_guard_patrol) — 등불 시야를 피해 초소 금고까지, 종으로 경비를 돌려세운다
// ---------------------------------------------------------------------------

/**
 * 초소 막사(x 1..18, y 5..13). y=8·11 은 짐 더미 줄(틈 x 7·11 / 11·13), 북쪽 통로 y=5..7 에 금고(16,5).
 * 경비 둘(서 7,7 · 동 14,7)이 북쪽을 본다(등불 시야 = 막힐 때까지 곧게). 북벽 종 줄 둘: 서쪽 종(3) = 동쪽 경비를 서쪽으로,
 * 가운데 종(11) = 서쪽 경비를 동쪽으로 돌린다(같은 색 깃발). 들키면 입구로 쫓겨나고 경비가 제자리로 돌아온다.
 * 무작위 판 6만 중 종 둘을 모두, 정해진 순서로 울려야 하는 판(BFS 확인).
 */
const SG_GUARDS = [
  { x: 14, y: 7, face: "up", turned: "left", banner: "banner red" },
  { x: 7, y: 7, face: "up", turned: "right", banner: "banner blue" },
] as const;
const SG_BELLS = [
  { x: 3, guard: 0 },
  { x: 11, guard: 1 },
] as const;
const SG_CACHE: Cell = { x: 16, y: 5 };
const SG_ROWS: ReadonlyArray<{ readonly y: number; readonly gaps: readonly number[] }> = [
  { y: 8, gaps: [7, 11] },
  { y: 11, gaps: [11, 13] },
];

interface GuardState {
  readonly x: number;
  readonly y: number;
  readonly turned: number; // 비트 = 돌아선 경비
  readonly done: boolean;
}

export const guardPostStealth: MechanicDef = {
  build(ctx) {
    const STORE = ["crate", "barrel", "crate", "sack", "barrel", "weapon crate", "crate", "barrel", "powder keg"] as const;
    const storage: HandInteriorObject[] = [];
    for (const row of SG_ROWS) {
      for (let x = 1; x <= 18; x += 1) if (!row.gaps.includes(x)) storage.push(obj(STORE[(x * 5 + row.y) % STORE.length]!, x, row.y));
    }
    const beam = hasObject("guard lantern light") ? "guard lantern light" : undefined;
    const spec0: PuzzleRoomSpec = {
      top: 3,
      left: 1,
      right: 1,
      floor: "cobble",
      wall: "stone",
      ceiling: "dark",
      objects: [
        ...storage,
        // 같은 색 깃발 = 그 종에 응답하는 경비(깃발은 경비 머리 위와 종 줄 옆에 하나씩)
        ...SG_GUARDS.map((g) => obj(g.banner, g.x, 3)),
        ...SG_BELLS.map((bl) => obj(SG_GUARDS[bl.guard]!.banner, bl.x + 1, 3)),
        obj("wall torch", 5, 3),
        obj("wall torch", 9, 3),
        obj("wall torch", 16, 3),
        obj("shield wall", 17, 3),
        obj("spear rack", 1, 5),
        obj("hint tablet", 8, 13),
        obj("sack pile", 1, 12),
        obj("barrel stack", 17, 12),
        obj("water bucket", 1, 9),
        obj("table:mug+bottle", 4, 13),
        obj("stool", 3, 13),
        obj("stool", 6, 13),
        obj("training dummy", 18, 10),
        obj("arrow barrel", 15, 13),
      ],
    };
    // 시야를 재려면 짐 더미가 깔린 방이 먼저 있어야 한다 — 시야 기물 없이 한 번 지어 통행을 잰다.
    const probe = new PuzzleRoom(ctx.draft, ctx.map, ctx.win, { ...spec0, props: {} }, "stealth_guard_patrol:probe");
    probe.paint();
    const guardCells = SG_GUARDS.map((g) => ({ x: g.x, y: g.y }));
    const tabletAt: Cell = { x: 8, y: 13 };
    const solidEv = [...guardCells, SG_CACHE, tabletAt, ...SG_BELLS.map((bl) => ({ x: bl.x, y: 4 }))];
    const walk0 = roomWalkable((x, y) => isPassable(ctx.draft, ctx.map, x, y), ctx.win, solidEv);
    const sight = (gi: number, turned: boolean): Cell[] => {
      const g = SG_GUARDS[gi]!;
      const d = DIR_OF[{ up: "U", down: "D", left: "L", right: "R" }[turned ? g.turned : g.face]]!;
      const out: Cell[] = [];
      for (let x = g.x + d.dx, y = g.y + d.dy; walk0(x, y); x += d.dx, y += d.dy) out.push({ x, y });
      return out;
    };
    const watched = (turned: number): Set<string> => new Set(SG_GUARDS.flatMap((_, gi) => sight(gi, ((turned >> gi) & 1) === 1)).map((c) => `${c.x},${c.y}`));
    const sightProps: PropState[] = [0, 1, 2, 3].map((t) => ({ overlays: beam ? [...watched(t)].map((k) => { const [x, y] = k.split(",").map(Number); return obj(beam, x!, y!); }) : [] }));
    const spec: PuzzleRoomSpec = {
      ...spec0,
      props: {
        sight: sightProps,
        ...Object.fromEntries(SG_BELLS.map((bl, i) => [`bell_${i}`, [{ objects: [obj("bell rope", bl.x, 3)] }, { objects: [obj("bell rope", bl.x, 3)] }]])),
        cache: [{ objects: [obj("treasure chest", SG_CACHE.x, SG_CACHE.y)] }, { objects: [obj("treasure chest open", SG_CACHE.x, SG_CACHE.y)] }],
      },
    };
    const b = buildRoom(ctx, spec, "stealth_guard_patrol", solidEv);
    const swTurned = SG_GUARDS.map((_, i) => ctx.sw(`guard_${i}_turned`, `경비 ${i + 1} 돌아섬`));
    const origin: Cell = { x: 10, y: 13 };
    const guardIds = SG_GUARDS.map((_, i) => ctx.evId(`guard_${i}`));
    let guardGraphic: EventPageGraphic;
    try {
      // 투구·갑옷이 있어 뒷모습(북쪽 감시)에서도 경비로 읽히는 「파란 갑옷 기사」.
      guardGraphic = resolveGraphic({ selectionId: "charset:tex_easyrpg_charset_people3:7" });
    } catch {
      guardGraphic = resolveGraphic({ query: "병사" }, { overrides: ctx.draft.charsetLabels });
    }
    const sightIndex = (): Command[] =>
      // 시야 그림 = 돌아선 경비 비트(0..3)
      [ifSw(swTurned[0]!, true, [ifSw(swTurned[1]!, true, b.room.set("sight", 3), b.room.set("sight", 1))], [ifSw(swTurned[1]!, true, b.room.set("sight", 2), b.room.set("sight", 0))])];
    const penalty = ctx.failPenalty;
    const caught = (gi: number): Command[] => [
      { kind: "showEmote", target: { eventId: guardIds[gi]! }, emote: "exclamation", durationMs: 700 },
      sfx("wrong"),
      shake(3, 300),
      textCmd(penalty?.text ?? (penalty?.sendTo ? "경비병: 「거기 누구냐!」 — 등불에 들켜 끌려갔다." : "경비병: 「거기 누구냐! 썩 나가!」 — 등불에 들켜 입구로 쫓겨났다.")),
      // 들킨 벌: 먼저 경비와 싸운다(도망 불가). 져도 게임 오버가 아니라 끌려간다.
      ...(penalty?.troopId ? [{ kind: "battleProcessing", troopId: penalty.troopId, canEscape: false, canLose: true } as unknown as Command] : []),
      ...swTurned.map((s) => setSw(s, false)),
      ...b.room.set("sight", 0),
      penalty?.sendTo
        ? { kind: "transfer", mapId: penalty.sendTo.mapId, x: penalty.sendTo.x, y: penalty.sendTo.y, direction: "down", fade: "black" } as Command
        : { kind: "transfer", mapId: ctx.map.id, x: ctx.win.x + origin.x, y: ctx.win.y + origin.y, direction: "up", fade: "black" } as Command,
    ];
    // 들킴 칸: 어느 상태에서든 시야에 드는 칸마다 밟기 이벤트 — 그 칸을 보는 경비가 그 방향을 보고 있으면 들킨다.
    const sightCells = new Map<string, Array<{ gi: number; turned: boolean }>>();
    for (let gi = 0; gi < SG_GUARDS.length; gi += 1) {
      for (const t of [false, true]) for (const c of sight(gi, t)) sightCells.set(`${c.x},${c.y}`, [...(sightCells.get(`${c.x},${c.y}`) ?? []), { gi, turned: t }]);
    }
    const sightEvents: GameEvent[] = [...sightCells.entries()].map(([k, watchers], n) => {
      const [x, y] = k.split(",").map(Number) as [number, number];
      const id = ctx.evId(`sight_${n}`);
      return puzzleEvent(id, "경비 등불 시야", b.at({ x, y }), [
        makePage({
          id: `${id}_live`,
          name: "시야(밟으면 들킴)",
          trigger: "playerTouch",
          priority: "below",
          graphic: TRANSPARENT,
          commands: watchers.map((w) => ifSw(swTurned[w.gi]!, w.turned, caught(w.gi))),
        }),
        makePage({ id: `${id}_done`, name: "시야(해결 뒤)", conditions: solvedCond(ctx), priority: "below", graphic: TRANSPARENT, commands: [] }),
      ]);
    });
    const guards = SG_GUARDS.map((g, gi) => {
      const id = guardIds[gi]!;
      const look = (dir: "up" | "left" | "right"): EventPageGraphic => {
        if (!("sprite" in guardGraphic) || typeof guardGraphic.pattern !== "number") return { ...guardGraphic, direction: dir };
        const frame = decodeCharsetFrameIndex(guardGraphic.pattern);
        return { ...guardGraphic, direction: dir, pattern: charsetFrameIndex({ ...frame, direction: dir, pattern: 1 }) };
      };
      return puzzleEvent(id, `초소 경비병 ${gi + 1}`, b.at({ x: g.x, y: g.y }), [
        makePage({ id: `${id}_watch`, name: "경비(북쪽 감시)", graphic: look(g.face), commands: [textCmd("경비병: 「금고 쪽은 출입 금지다.」")] }),
        makePage({
          id: `${id}_turned`,
          name: "경비(종소리 쪽 감시)",
          conditions: [{ kind: "switch", switchId: swTurned[gi]!, value: true }],
          graphic: look(g.turned),
          commands: [textCmd("경비병: 「방금 종이 울렸지…?」")],
        }),
      ]);
    });
    const bells = SG_BELLS.map((bl, i) =>
      actEvent(
        ctx,
        b,
        `bell_${i}`,
        `${SG_GUARDS[bl.guard]!.banner === "banner red" ? "붉은" : "푸른"} 깃발 종 줄`,
        { x: bl.x, y: 4 },
        [
          se("bell"),
          { kind: "showEmote", target: { eventId: guardIds[bl.guard]! }, emote: "question", durationMs: 650 },
          setSw(swTurned[bl.guard]!, true),
          ...sightIndex(),
          textCmd(`땡그랑— ${SG_GUARDS[bl.guard]!.banner === "banner red" ? "붉은" : "푸른"} 깃발 아래 경비병이 종소리 쪽으로 돌아섰다.`),
        ],
        "종 줄은 이제 조용하다.",
      ),
    );
    const cacheEv = actEvent(ctx, b, "cache", "초소 금고 상자", SG_CACHE, [
      textCmd("경비병들이 서로를 바라보는 사이 금고 상자를 열었다!"),
      ...revealInWaves(b.room.set("cache", 1), goldTheme),
      ...ctx.rewardCommands,
      setSw(ctx.solveSwitchId, true),
    ], "금고 상자는 비어 있다.");
    const tablet = actEvent(ctx, b, "hint_tablet", "초소 근무표", tabletAt, [
      se("decision1"),
      textCmd(ctx.hint ?? "근무표: 「붉은 초소는 붉은 깃발 종에, 푸른 초소는 푸른 깃발 종에 응답할 것. 등불이 비추는 곳은 지나가지 말 것.」"),
    ]);
    const walk = b.walk;
    const stands = SG_BELLS.map((bl) => ({ x: bl.x, y: 5 }));
    const W = [0, 1, 2, 3].map((t) => watched(t));
    const start: GuardState = { x: origin.x, y: origin.y, turned: 0, done: false };
    const model: PuzzleModel<GuardState> = {
      start,
      key: (s) => `${s.x},${s.y}:${s.turned}:${s.done ? 1 : 0}`,
      goal: (s) => s.done,
      moves: (s) => {
        const out: Array<readonly [string, GuardState]> = [];
        for (const [m, d] of Object.entries(DIR_OF)) {
          const nx = s.x + d.dx;
          const ny = s.y + d.dy;
          if (!walk(nx, ny)) continue;
          out.push([m, W[s.turned]!.has(`${nx},${ny}`) ? start : { ...s, x: nx, y: ny }]);
        }
        stands.forEach((st, i) => {
          if (st.x === s.x && st.y === s.y) {
            const t = s.turned | (1 << SG_BELLS[i]!.guard);
            out.push([`bell:${i}`, W[t]!.has(`${s.x},${s.y}`) ? start : { ...s, turned: t }]);
          }
        });
        if (Math.abs(s.x - SG_CACHE.x) + Math.abs(s.y - SG_CACHE.y) === 1) out.push(["cache", { ...s, done: true }]);
        return out;
      },
    };
    const result: MechanicResult<GuardState> = {
      room: b.room,
      origin,
      events: [
        ...guards.map((event, i) => ({ event, role: `초소 경비병 ${i + 1}` })),
        ...bells.map((event, i) => ({ event, role: `종 줄 ${i + 1}` })),
        { event: cacheEv, role: "초소 금고 상자(목표)" },
        { event: tablet, role: "초소 근무표(규칙)" },
        ...sightEvents.map((event) => ({ event, role: "경비 등불 시야(들킴)" })),
      ],
      revealCommandCount: b.room.set("cache", 1).length,
      solveSteps: [
        "가운데 짐 더미 틈으로 북쪽 통로에 올라 푸른 깃발 종 → 서쪽 경비가 동쪽을 본다",
        "그 사이 서쪽 붉은 깃발 종 → 동쪽 경비가 서쪽을 본다(두 경비가 서로를 바라본다)",
        "북쪽 벽을 따라 금고 상자로. 등불 시야에 들어가면 입구로 쫓겨난다",
      ],
      model,
      mistakeDemo: () => {
        // 가장 빠른 들킴: 처음 상태에서 시야 칸을 밟는다.
        const target = [...W[0]!][0]!.split(",").map(Number) as [number, number];
        const path = new PlayPlanner(walk, origin).stepOn({ x: target[0], y: target[1] }).steps;
        return [{ kind: "goto", x: origin.x, y: origin.y, face: "up" }, ...path, { kind: "mark", label: "mistake", expectSolved: false }];
      },
      toPlaytest: (solution) => {
        const steps: PuzzlePlayStep[] = [{ kind: "goto", x: origin.x, y: origin.y, face: "up" }];
        let run = "";
        let at: Cell = origin;
        const flush = (): void => {
          if (run) steps.push({ kind: "walk", moves: run });
          run = "";
        };
        for (const label of solution) {
          if (label.length === 1) {
            run += label;
            at = { x: at.x + DIR_OF[label]!.dx, y: at.y + DIR_OF[label]!.dy };
          } else if (label.startsWith("bell:")) {
            flush();
            steps.push({ kind: "face", dir: "up" }, { kind: "act" }, { kind: "wait", ms: 300 });
          } else {
            flush();
            const dx = SG_CACHE.x - at.x;
            const dy = SG_CACHE.y - at.y;
            steps.push({ kind: "face", dir: dx > 0 ? "right" : dx < 0 ? "left" : dy < 0 ? "up" : "down" }, { kind: "act" });
          }
        }
        flush();
        return [...steps, { kind: "wait", ms: 600 }, { kind: "mark", label: "solved", expectSolved: true }];
      },
    };
    return result as MechanicResult;
  },
};

void wait;
