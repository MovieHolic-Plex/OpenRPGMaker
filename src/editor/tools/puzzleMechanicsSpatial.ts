// src/editor/tools/puzzleMechanicsSpatial.ts
// 공간·이동 계열 품질 퍼즐: 석상 밀기 발판(소코반), 무너지는 판자 다리(한붓 그리기), 미끄러운 대리석 회랑(미끄럼 미로),
// 순간이동 진 미로, 굴림 바위.
//
// 모두 「플레이어가 어디에 서고 무엇을 미느냐」가 풀이다. 모형은 플레이어 칸 단위 BFS 이고, 최단 해가 그대로 걸음 절차가 된다.

import type { Command, GameEvent } from "@/project/types";
import { HAND_INTERIOR_SPEC } from "@/editor/handInterior/builder";
import type { Cell } from "./jrpgVolumeTools";
import {
  analysePuzzleModel,
  approachAndFace,
  DIR_OF,
  gridPath,
  seededShuffle,
  type MechanicDef,
  type MechanicResult,
  type PuzzleModel,
  type PuzzlePlayStep,
} from "./puzzleMechanicCore";
import {
  ifSw,
  ifVar,
  m2,
  makePage,
  obj,
  objGraphic,
  particles,
  PuzzleRoom,
  puzzleEvent,
  rect,
  revealInWaves,
  se,
  sfx,
  setSw,
  setVar,
  shake,
  textCmd,
  TRANSPARENT,
  wait,
  type PuzzleRoomSpec,
} from "./puzzleKit";
import { puzzleSfxResourceId } from "@/assets/puzzleSfxAssets";

const getEventId = (variableId: string, at: Cell): Command => m2("Get Event ID", { variableId, x: at.x, y: at.y });
const setEventLocation = (target: string, mapId: string, at: Cell): Command => m2("Set Event Location", { target, mapId, x: at.x, y: at.y });

/** 격자 문자열을 방 좌표 칸 목록으로 읽는다. */
function gridCells(grid: readonly string[], ox: number, oy: number, chars: string): Cell[] {
  const out: Cell[] = [];
  grid.forEach((row, y) => [...row].forEach((c, x) => chars.includes(c) && out.push({ x: ox + x, y: oy + y })));
  return out;
}

/** 해 앞뒤에 표시를 끼운 기본 절차: 해 → 해결 확인. */
function withMarks(steps: readonly PuzzlePlayStep[]): PuzzlePlayStep[] {
  return [...steps, { kind: "wait", ms: 600 }, { kind: "mark", label: "solved", expectSolved: true }];
}

// ---------------------------------------------------------------------------
// 1. 석상 밀기 발판 (statue_pressure_plates) — 소코반 두 바위
// ---------------------------------------------------------------------------

/**
 * '#' 안쪽 돌기둥, 'B' 바위, 'P' 발판, '@' 입구(남쪽 문). 둘레 '#' 는 쇠창살 울타리·방 벽.
 * BFS(플레이어 칸 단위) 최단 25걸음·밀기 7회. 바위를 북쪽 모서리에 붙이면 다시 뺄 수 없는 교착이 생긴다 → 되돌림 룬석.
 */
const SOKO_GRID = [
  "#########",
  "#..P....#",
  "#.#B##..#",
  "#...B..##",
  "#R.#..P.#",
  "#.......#",
  "####@####",
] as const;
const SOKO_OX = 6;
const SOKO_OY = 8;

interface SokoState {
  readonly p: Cell;
  readonly b: readonly Cell[];
}

export const sokobanPlates: MechanicDef = {
  build(ctx) {
    const at = (c: Cell): Cell => ({ x: ctx.win.x + c.x, y: ctx.win.y + c.y });
    const walls = gridCells(SOKO_GRID, SOKO_OX, SOKO_OY, "#R");
    const inner = walls.filter((c) => c.x > SOKO_OX && c.x < SOKO_OX + 8 && c.y > SOKO_OY && c.y < SOKO_OY + 6);
    const boulders = gridCells(SOKO_GRID, SOKO_OX, SOKO_OY, "B");
    const plates = gridCells(SOKO_GRID, SOKO_OX, SOKO_OY, "P");
    const resetStone = gridCells(SOKO_GRID, SOKO_OX, SOKO_OY, "R")[0]!;
    const gateCell = { x: 10, y: SOKO_OY };
    const fence = walls.filter((c) => c.y === SOKO_OY || c.x === SOKO_OX || c.x === SOKO_OX + 8);
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 2,
      right: 2,
      floor: "dungeon",
      wall: "stone",
      ceiling: "dark",
      zones: [{ x0: 7, y0: 9, x1: 13, y1: 13, floor: "grey" }],
      objects: [
        obj("wall torch", 5, 3),
        obj("wall torch", 14, 3),
        obj("statue", 4, 6),
        obj("statue", 15, 6),
        obj("skull pile", 3, 13),
        obj("skull pile", 16, 12),
        obj("column stone", 3, 9),
        obj("column stone", 16, 9),
        ...inner.filter((c) => c.x !== resetStone.x || c.y !== resetStone.y).map((c) => obj("column stone", c.x, c.y)),
        obj("rune stone", resetStone.x, resetStone.y),
      ],
      lines: [{ id: "bars", cells: fence.filter((c) => c.y < 14 && !(c.x === gateCell.x && c.y === gateCell.y)) }],
      props: {
        // 계단은 철창이 열린 뒤에만 드러난다(닫힌 상태에서는 출입구에서 닿을 수 없어 실내 문법이 거절한다).
        gate: [
          { objects: [obj("iron gate", gateCell.x, gateCell.y), obj("seal stone", 10, 5)] },
          { objects: [obj("iron gate open", gateCell.x, gateCell.y), obj("teleport pad", 9, 5)] },
        ],
        plate_1: [{ objects: [obj("pressure plate", plates[0]!.x, plates[0]!.y)] }, { objects: [obj("pressure plate down", plates[0]!.x, plates[0]!.y)] }],
        plate_2: [{ objects: [obj("pressure plate", plates[1]!.x, plates[1]!.y)] }, { objects: [obj("pressure plate down", plates[1]!.x, plates[1]!.y)] }],
      },
    };
    const room = new PuzzleRoom(ctx.draft, ctx.map, ctx.win, spec, "statue_pressure_plates");
    room.paint();

    const swPlate = [ctx.sw("plate_1", "석상 발판 1 눌림"), ctx.sw("plate_2", "석상 발판 2 눌림")];
    const swReady = ctx.sw("plates_ready", "석상 발판 둘 다 눌림");
    const vOcc = [ctx.v("plate_1_occupant", "발판 1 위 이벤트 번호"), ctx.v("plate_2_occupant", "발판 2 위 이벤트 번호")];
    const boulderIds = [ctx.evId("boulder_1"), ctx.evId("boulder_2")];

    const plateWatch = (i: 0 | 1): Command[] => {
      const key = i === 0 ? "plate_1" : "plate_2";
      const p = at(plates[i]!);
      return [
        getEventId(vOcc[i]!, p),
        ifVar(
          vOcc[i]!,
          "!=",
          0,
          [ifSw(swPlate[i]!, false, [setSw(swPlate[i]!, true), ...room.set(key, 1), sfx("plate-press"), particles("dust", 600, p), shake(1, 120)])],
          [ifSw(swPlate[i]!, true, [setSw(swPlate[i]!, false), ...room.set(key, 0), se("cursor2")])],
        ),
      ];
    };
    const watcher = puzzleEvent(ctx.evId("plate_watcher"), "발판 감시(병렬)", at({ x: 1, y: 14 }), [
      makePage({
        id: `${ctx.evId("plate_watcher")}_watch`,
        name: "발판 감시",
        trigger: "parallel",
        priority: "below",
        graphic: TRANSPARENT,
        commands: [...plateWatch(0), ...plateWatch(1), ifSw(swPlate[0]!, true, [ifSw(swPlate[1]!, true, [setSw(swReady, true)])]), wait(120)],
      }),
      makePage({ id: `${ctx.evId("plate_watcher")}_done`, name: "발판 감시(끝)", conditions: [{ kind: "switch", switchId: swReady, value: true }], priority: "below", graphic: TRANSPARENT, commands: [] }),
    ]);
    const gateCmds = room.set("gate", 1);
    const reveal = puzzleEvent(ctx.evId("gate_reveal"), "석문 개방 연출", at({ x: 2, y: 14 }), [
      makePage({ id: `${ctx.evId("gate_reveal")}_idle`, name: "대기", priority: "below", graphic: TRANSPARENT, commands: [] }),
      makePage({
        id: `${ctx.evId("gate_reveal")}_run`,
        name: "개방",
        conditions: [{ kind: "switch", switchId: swReady, value: true }],
        trigger: "auto",
        priority: "below",
        graphic: TRANSPARENT,
        commands: [
          // 낮은 굉음은 revealInWaves 첫 물결(earth2)이 낸다 — 여기서 또 울리면 두 번 겹친다.
          shake(3, 400),
          textCmd("쿠웅…! 두 바위가 발판을 동시에 짓누르자 울타리 철창이 사슬 소리를 내며 올라간다."),
          ...revealInWaves(gateCmds, { flash: "white", pulse: "255,236,180", waves: ["dust", "dust", "sparkle"] }),
          ...ctx.rewardCommands,
          setSw(ctx.solveSwitchId, true),
        ],
      }),
      makePage({ id: `${ctx.evId("gate_reveal")}_done`, name: "끝", conditions: [{ kind: "switch", switchId: ctx.solveSwitchId, value: true }], priority: "below", graphic: TRANSPARENT, commands: [] }),
    ]);
    const boulderEvents = boulders.map((b, i) =>
      puzzleEvent(boulderIds[i]!, `밀 수 있는 바위 ${i + 1}`, at(b), [
        makePage({
          id: `${boulderIds[i]}_page`,
          name: "바위",
          graphic: objGraphic("object2", 5),
          priority: "same",
          interaction: { kind: "pushable", sound: puzzleSfxResourceId("stone-push") },
          animationType: "normal",
          commands: [],
        }),
      ]),
    );
    const resetEvent = puzzleEvent(ctx.evId("reset_stone"), "되돌림 룬석", at(resetStone), [
      makePage({
        id: `${ctx.evId("reset_stone")}_page`,
        name: "되돌림 룬석",
        graphic: TRANSPARENT,
        commands: [
          textCmd(ctx.hint ?? "룬석: 「두 바위로 두 발판을 함께 눌러라. 바위는 밀 수만 있고 끌 수는 없다. 길이 막히면 나를 만져라.」"),
          {
            kind: "choices",
            options: [
              {
                text: "룬석을 만져 바위를 제자리로 돌린다",
                branch: [
                  se("teleport2"),
                  ...boulders.flatMap((b, i) => [particles("magic", 700, at(b)), setEventLocation(boulderIds[i]!, ctx.map.id, at(b))]),
                  shake(1, 200),
                  textCmd("룬이 빛나며 바위 두 개가 처음 자리로 끌려 돌아갔다."),
                ],
              },
              { text: "그만둔다", branch: [] },
            ],
            cancelBehavior: "branch",
            cancelBranch: [],
          },
        ],
      }),
    ]);

    // 모형: 플레이어 한 칸 걸음 단위 BFS(밀기 포함). 북쪽 철창·벽·기둥·룬석은 막힘.
    const blocked = new Set(walls.map((c) => `${c.x},${c.y}`));
    const free = (c: Cell): boolean => c.x >= SOKO_OX && c.x <= SOKO_OX + 8 && c.y >= SOKO_OY && c.y <= SOKO_OY + 6 && !blocked.has(`${c.x},${c.y}`);
    const start: SokoState = { p: { x: 10, y: 13 }, b: boulders };
    const plateKey = plates.map((c) => `${c.x},${c.y}`).sort().join("|");
    const model: PuzzleModel<SokoState> = {
      start,
      key: (s) => `${s.p.x},${s.p.y}#${s.b.map((c) => `${c.x},${c.y}`).sort().join("|")}`,
      goal: (s) => s.b.map((c) => `${c.x},${c.y}`).sort().join("|") === plateKey,
      moves: (s) => {
        const out: Array<readonly [string, SokoState]> = [];
        for (const [m, d] of Object.entries(DIR_OF)) {
          const n = { x: s.p.x + d.dx, y: s.p.y + d.dy };
          if (!free(n)) continue;
          const hit = s.b.findIndex((c) => c.x === n.x && c.y === n.y);
          if (hit < 0) {
            out.push([m, { p: n, b: s.b }]);
            continue;
          }
          const t = { x: n.x + d.dx, y: n.y + d.dy };
          if (!free(t) || s.b.some((c) => c.x === t.x && c.y === t.y)) continue;
          out.push([m, { p: n, b: s.b.map((c, i) => (i === hit ? t : c)) }]);
        }
        return out;
      },
    };
    const result: MechanicResult<SokoState> = {
      room,
      origin: { x: 10, y: 13 },
      events: [
        ...boulderEvents.map((event, i) => ({ event, role: `밀 수 있는 바위 ${i + 1}` })),
        { event: watcher, role: "발판 감시(병렬)" },
        { event: reveal, role: "철창 개방 연출(자동)" },
        { event: resetEvent, role: "되돌림 룬석" },
      ],
      revealCommandCount: gateCmds.length,
      solveSteps: [
        `바위 두 개(${boulders.map((c) => `(${c.x},${c.y})`).join(", ")})를 밀어 발판 두 개(${plates.map((c) => `(${c.x},${c.y})`).join(", ")})에 올린다`,
        "바위를 모서리·벽에 붙이면 다시 뺄 수 없으니 막히면 되돌림 룬석으로 처음 배치로 돌린다",
        `두 발판이 동시에 눌리면 (${gateCell.x},${gateCell.y}) 울타리 철창이 열리고 북쪽 순간이동진이 드러난다`,
      ],
      model,
      // 오답 시연: 모형이 찾은 가장 가까운 교착(되돌릴 수 없는 밀기)까지 걷고 → 룬석으로 되돌림 → 처음 자리에서 해를 시작한다.
      mistakeDemo: (analysis) => [
        { kind: "walk", moves: analysis.deadEndPath.join("") },
        { kind: "mark", label: "mistake", expectSolved: false },
        { kind: "goto", x: resetStone.x, y: resetStone.y + 1, face: "up" },
        { kind: "act", choose: [0] },
        { kind: "mark", label: "reset", expectSolved: false },
        { kind: "goto", x: 10, y: 13, face: "up" },
      ],
      toPlaytest: (solution) => withMarks([{ kind: "walk", moves: solution.join("") }]),
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 2. 무너지는 판자 다리 (cracked_plank_bridge) — 모든 판자를 한 번씩만 밟고 건넌다
// ---------------------------------------------------------------------------

/**
 * 심연 위 판자 격자. 'o' 판자, ' ' 심연, 'S' 남쪽 둑 진입 칸, 'E' 북쪽 둑 출구 칸. 밟고 떠난 판자는 무너져 심연이 된다.
 * 판자를 전부 무너뜨려야(= 모두 한 번씩 밟아야) 북쪽 둑의 봉인 철창이 열린다. 갇히면 떨어져 처음으로 돌아간다.
 */
// 해밀턴 경로 전수 탐색으로 고른 판(해 1~3가지, 판자 14~16장). 판자를 대충 밟으면 거의 반드시 고립된다.
/** 심연 위 판자 프레임(멀쩡 → 금 감 → 꺾임 → 떨어짐) — interior-plus 손 도트 조각. */
const PLANK_FRAMES = ["plank bridge", "plank bridge cracked", "plank bridge falling 1", "plank bridge falling 2"] as const;

const PLANK_VARIANTS: readonly (readonly string[])[] = [
  [" E   ", "oooo ", "oooo ", "oo o ", "oo o ", "   S "],
  ["  E  ", "  oo ", "oooo ", "ooooo", " oooo", "   S "],
  ["   E ", "oooo ", "o oo ", "ooooo", " oooo", " S   "],
];

interface PlankState {
  readonly at: number; // -1 = 진입 둑, -2 = 출구 둑, 0.. = 판자
  readonly cur: number; // 마지막으로 올라선 판자(-1 = 없음) — 다른 판자로 옮겨 가면 무너진다
  readonly broken: number; // 비트
  readonly fell: boolean;
}

export const crackedPlankBridge: MechanicDef = {
  build(ctx) {
    const at = (c: Cell): Cell => ({ x: ctx.win.x + c.x, y: ctx.win.y + c.y });
    const grid = PLANK_VARIANTS[ctx.seed % PLANK_VARIANTS.length]!;
    const OX = 7;
    const OY = 5;
    const planks = gridCells(grid, OX, OY, "o");
    const entry = gridCells(grid, OX, OY, "S")[0]!;
    const exit = gridCells(grid, OX, OY, "E")[0]!;
    const idx = new Map(planks.map((c, i) => [`${c.x},${c.y}`, i]));
    const nbr = (c: Cell): Cell[] => Object.values(DIR_OF).map((d) => ({ x: c.x + d.dx, y: c.y + d.dy }));
    // 판자 띠 전체(진입 칸·출구 칸이 있는 둑 가장자리 줄까지)를 심연으로 두고 판자·진입·출구 칸만 남긴다 —
    // 그래야 판자에서 둑 아무 데로나 내려서는 지름길이 없다.
    const chasm = rect(2, OY, 17, OY + grid.length - 1);
    const plankArtPresent = PLANK_FRAMES.every((id) => Boolean(HAND_INTERIOR_SPEC.objects[id]));
    const keep = new Set([...(plankArtPresent ? [] : idx.keys()), `${entry.x},${entry.y}`, `${exit.x},${exit.y}`]);
    const spec: PuzzleRoomSpec = {
      top: 1,
      left: 2,
      right: 2,
      floor: "cave",
      wall: "rock",
      ceiling: "rock",
      zones: [
        { x0: 2, y0: 3, x1: 17, y1: 4, floor: "earth" },
        { x0: 2, y0: 11, x1: 17, y1: 13, floor: "earth" },
        { x0: entry.x, y0: entry.y, x1: entry.x, y1: entry.y, floor: "earth" },
        { x0: exit.x, y0: exit.y, x1: exit.x, y1: exit.y, floor: "earth" },
      ],
      objects: [
        obj("wall torch", 6, 1),
        obj("wall torch", 13, 1),
        obj("rope coil", 4, 12),
        obj("skull pile", 15, 13),
        obj("column stone", 3, 4),
        obj("column stone", 16, 4),
        obj("column stone", 3, 13),
        obj("column stone", 16, 13),
        obj("treasure chest", 12, 3),
        obj("hint tablet", 5, 12),
      ],
      // 판자 아닌 칸은 심연. 판자 칸은 짙은 마루(판자) 구역.
      voids: (() => {
        const out = [];
        for (let y = chasm.y0; y <= chasm.y1; y += 1) {
          for (let x = chasm.x0; x <= chasm.x1; x += 1) if (!keep.has(`${x},${y}`)) out.push(rect(x, y, x, y));
        }
        return out;
      })(),
    };
    // 판자 그림(2026-10-20 r4): 심연 위에 얹는 판자 프레임 넷(멀쩡 → 금 감 → 꺾임 → 떨어짐)이 칩셋에 있으면 판자 칸도 심연으로 파고
    // 2층에 판자를 얹는다(상태 0 멀쩡 · 1 사라짐 · 2 금 감(올라섬) · 3·4 무너지는 중). 없으면 옛 마루 바닥 판자.
    const plankArt = plankArtPresent;
    const plankProps = Object.fromEntries(
      planks.map((c, i) => [
        `plank_${i}`,
        plankArt
          ? [
              { overlays: [obj(PLANK_FRAMES[0], c.x, c.y)] },
              { voids: [rect(c.x, c.y, c.x, c.y)] },
              { overlays: [obj(PLANK_FRAMES[1], c.x, c.y)] },
              { overlays: [obj(PLANK_FRAMES[2], c.x, c.y)] },
              { overlays: [obj(PLANK_FRAMES[3], c.x, c.y)] },
            ]
          : [{ zones: [{ x0: c.x, y0: c.y, x1: c.x, y1: c.y, floor: "dplank" }] }, { voids: [rect(c.x, c.y, c.x, c.y)] }],
      ]),
    );
    const room = new PuzzleRoom(
      ctx.draft,
      ctx.map,
      ctx.win,
      {
        ...spec,
        props: {
          ...plankProps,
          gate: [{ objects: [obj("iron gate", exit.x, exit.y)] }, { objects: [obj("iron gate open", exit.x, exit.y)] }],
        },
      },
      "cracked_plank_bridge",
    );
    room.paint();

    const vCur = ctx.v("plank_current", "지금 선 판자 번호(+1)");
    const vCount = ctx.v("plank_count", "무너뜨린 판자 수");
    const swBroken = planks.map((_, i) => ctx.sw(`plank_${i}_broken`, `판자 ${i + 1} 무너짐`));
    const restoreAll: Command[] = planks.flatMap((_, i) => [setSw(swBroken[i]!, false), ...room.set(`plank_${i}`, 0)]);
    const fall: Command[] = [
      se("fall1"),
      shake(6, 400),
      textCmd("발밑 판자까지 무너졌다! 으아아—"),
      ...restoreAll,
      setVar(vCur, 0),
      setVar(vCount, 0),
      textCmd("…밧줄에 매달려 남쪽 둑으로 기어 올라왔다. 판자가 다시 놓였다."),
      { kind: "transfer", mapId: ctx.map.id, x: at(entry).x, y: at(entry).y, direction: "up", fade: "black" },
    ];
    const breakPlank = (i: number): Command[] => [
      setSw(swBroken[i]!, true),
      ...(plankArt ? [...room.set(`plank_${i}`, 3), se("knock"), wait(90), ...room.set(`plank_${i}`, 4), wait(90)] : []),
      ...room.set(`plank_${i}`, 1),
      se("collapse1"),
      particles("dust", 700, at(planks[i]!)),
      setVar(vCount, 1, "+="),
    ];
    const plankEvents: GameEvent[] = planks.map((c, i) => {
      const id = ctx.evId(`plank_${i}`);
      const nbrs = nbr(c).map((n) => idx.get(`${n.x},${n.y}`)).filter((n): n is number => n !== undefined);
      const touchesBank = nbr(c).some((n) => n.x === entry.x && n.y === entry.y);
      // 떠난 판자(지금 번호)를 무너뜨린다 — 지금 판자와 같으면 아무것도 안 한다(둑에 내렸다 다시 오른 경우).
      const leave: Command[] = planks.map((_, k) => ifVar(vCur, "==", k + 1, k === i ? [] : [ifSw(swBroken[k]!, false, breakPlank(k))]));
      // 갇힘: 이웃 판자가 모두 무너졌고 둑에도 닿지 않으면 떨어진다(마지막 판자는 예외 — 그때는 출구가 열린다).
      const trapped = touchesBank
        ? []
        : nbrs.reduceRight<Command[]>((inner, k) => [ifSw(swBroken[k]!, true, inner)], [ifVar(vCount, "<", planks.length - 1, fall)]);
      return puzzleEvent(id, `낡은 판자 ${i + 1}`, at(c), [
        makePage({
          id: `${id}_intact`,
          name: "판자(멀쩡)",
          trigger: "playerTouch",
          priority: "below",
          graphic: TRANSPARENT,
          commands: [
            ...leave,
            setVar(vCur, i + 1),
            ...(plankArt ? room.set(`plank_${i}`, 2) : []),
            se("knock"),
            particles("dust", 400, at(c)),
            ...trapped,
          ],
        }),
        makePage({ id: `${id}_gone`, name: "판자(무너짐)", conditions: [{ kind: "switch", switchId: swBroken[i]!, value: true }], priority: "below", graphic: TRANSPARENT, commands: [] }),
        // 풀린 뒤에는 다리가 튼튼한 새 판자로 다시 놓인다(아래 해제 연출) — 밟아도 무너지지 않는다.
        makePage({ id: `${id}_solved`, name: "판자(해결 뒤 튼튼함)", conditions: [{ kind: "switch", switchId: ctx.solveSwitchId, value: true }], priority: "below", graphic: TRANSPARENT, commands: [] }),
      ]);
    });
    const gateCmds = room.set("gate", 1);
    // 해제 연출은 철창만 여는 게 아니라 무너진 다리를 남쪽부터 다시 놓는다. 방의 유일한 출입문은 남쪽이라
    // 다리를 그대로 두면 북쪽 둑에 갇힌다(2026-10-20 적대 검수에서 발견한 진행 불능).
    const rebuildCmds = planks.flatMap((_, i) => room.set(`plank_${i}`, 0));
    // 출구 앞 둑: 판자를 모두 밟았으면 마지막 판자도 무너지며 철창이 열린다.
    const exitId = ctx.evId("exit_gate");
    const exitEvent = puzzleEvent(exitId, "북쪽 둑 봉인 철창", at(exit), [
      makePage({
        id: `${exitId}_locked`,
        name: "철창(잠김)",
        graphic: TRANSPARENT,
        priority: "same",
        commands: [
          ifVar(
            vCount,
            ">=",
            planks.length - 1,
            [
              ...planks.map((_, k) => ifVar(vCur, "==", k + 1, [ifSw(swBroken[k]!, false, breakPlank(k))])),
              textCmd("마지막 판자가 무너져 내리자 철창의 사슬이 풀리고, 심연 위로 새 판자가 차례로 놓인다!"),
              ...revealInWaves([...gateCmds, ...rebuildCmds], { flash: "white", pulse: "255,230,170", waves: ["dust", "smoke", "sparkle"] }),
              ...ctx.rewardCommands,
              setSw(ctx.solveSwitchId, true),
            ],
            [textCmd(ctx.hint ?? "철창에 새겨진 글: 「다리의 판자를 모두 무너뜨린 자만 지나가리라.」 — 남은 판자가 있다.")],
          ),
        ],
      }),
      makePage({ id: `${exitId}_open`, name: "철창(열림)", conditions: [{ kind: "switch", switchId: ctx.solveSwitchId, value: true }], priority: "below", graphic: TRANSPARENT, commands: [] }),
    ]);
    const tabletId = ctx.evId("hint_tablet");
    const tablet = puzzleEvent(tabletId, "다리지기의 석판", at({ x: 5, y: 12 }), [
      makePage({
        id: `${tabletId}_page`,
        name: "석판",
        graphic: TRANSPARENT,
        commands: [textCmd("석판: 「썩은 판자는 한 번 밟고 떠나면 무너진다. 모든 판자를 한 번씩만 밟고 북쪽 철창에 닿아라. 길이 끊기면 떨어진다.」")],
      }),
    ]);
    // 모형: 이벤트와 같은 규칙 — 다른 판자에 오르면 마지막 판자(cur)가 무너지고, 이웃 판자가 다 무너졌는데 진입 둑에도
    // 닿지 않으면(마지막 판자 아닐 때) 떨어져 처음으로. 출구 철창은 마지막 판자 위에서 다른 판자가 모두 무너졌을 때만 열린다.
    const full = (1 << planks.length) - 1;
    const popcount = (n: number): number => n.toString(2).replace(/0/g, "").length;
    const neighbourIdx = planks.map((c) => nbr(c).map((n) => idx.get(`${n.x},${n.y}`)).filter((n): n is number => n !== undefined));
    const touchesEntry = planks.map((c) => nbr(c).some((n) => n.x === entry.x && n.y === entry.y));
    const model: PuzzleModel<PlankState> = {
      start: { at: -1, cur: -1, broken: 0, fell: false },
      key: (s) => `${s.at}:${s.cur}:${s.broken}:${s.fell ? 1 : 0}`,
      goal: (s) => s.at === -2,
      moves: (s) => {
        const here = s.at === -1 ? entry : s.at === -2 ? exit : planks[s.at]!;
        const out: Array<readonly [string, PlankState]> = [];
        for (const [m, d] of Object.entries(DIR_OF)) {
          const n = { x: here.x + d.dx, y: here.y + d.dy };
          if (n.x === exit.x && n.y === exit.y) {
            if (s.at >= 0 && (s.broken | (1 << s.at)) === full) out.push([m, { ...s, at: -2, broken: full }]);
            continue;
          }
          if (n.x === entry.x && n.y === entry.y) {
            out.push([m, { ...s, at: -1 }]);
            continue;
          }
          const k = idx.get(`${n.x},${n.y}`);
          if (k === undefined || (s.broken & (1 << k)) !== 0) continue;
          const broken = s.cur >= 0 && s.cur !== k ? s.broken | (1 << s.cur) : s.broken;
          const trapped = !touchesEntry[k] && neighbourIdx[k]!.every((j) => (broken & (1 << j)) !== 0) && popcount(broken) < planks.length - 1;
          out.push([m, trapped ? { at: -1, cur: -1, broken: 0, fell: true } : { at: k, cur: k, broken, fell: s.fell }]);
        }
        return out;
      },
    };
    return {
      room,
      origin: { x: entry.x, y: entry.y },
      events: [
        ...plankEvents.map((event, i) => ({ event, role: `판자 ${i + 1}` })),
        { event: exitEvent, role: "북쪽 봉인 철창" },
        { event: tablet, role: "다리지기 석판(규칙)" },
      ],
      revealCommandCount: gateCmds.length,
      solveSteps: [
        `남쪽 둑 (${entry.x},${entry.y}) 에서 판자 ${planks.length}장을 모두 한 번씩만 밟는다(밟고 떠난 판자는 무너진다)`,
        "이웃 판자가 모두 무너진 자리에 서면 떨어져 처음으로 돌아간다(판자 복구)",
        `마지막 판자에서 북쪽 철창 (${exit.x},${exit.y}) 을 조사하면 열린다`,
      ],
      model: model as PuzzleModel<unknown>,
      // 오답 시연은 시공 때 모형에서 「가장 빨리 떨어지는 길」을 찾아 걷는다(떨어지면 판자가 복구되는지 확인).
      mistakeDemo: () => {
        const fallPath = analysePuzzleModel({ ...model, goal: (s) => s.fell }).solution.join("");
        return fallPath
          ? [
              { kind: "goto", x: entry.x, y: entry.y, face: "up" },
              { kind: "walk", moves: fallPath },
              { kind: "mark", label: "mistake", expectSolved: false },
            ]
          : [];
      },
      toPlaytest: (solution) => {
        // 마지막 수(출구로 들어가기)는 걸음이 아니라 철창 조사다.
        const moves = solution.join("");
        const last = moves.slice(-1);
        return withMarks([
          { kind: "goto", x: entry.x, y: entry.y, face: "up" },
          { kind: "walk", moves: moves.slice(0, -1) },
          { kind: "face", dir: DIR_OF[last]!.dir },
          { kind: "act" },
        ]);
      },
    };
  },
};

void gridPath;
void approachAndFace;
void seededShuffle;
