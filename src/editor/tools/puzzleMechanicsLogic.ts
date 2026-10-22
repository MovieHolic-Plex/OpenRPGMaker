// src/editor/tools/puzzleMechanicsLogic.ts
// 판단·기억·추론 계열 품질 퍼즐: 봉인 수정 뒤집기(lights-out), 화로 점화 순서(관계 단서 추론), 오르간 메아리(기억),
// 레버 판정(마스터마인드), 거짓말쟁이 상자(참말 하나), 숫자 자물쇠(방 안 개수 세기), 룬 해독문(로제타 쌍),
// 원소 구슬 자리(배치 추론), 두 저수조(물통 붓기), 저울 추(부분합).
//
// 모두 북쪽 벽 창살(portcullis)을 연다 — 같은 GATE 기물(닫힘 → 벽이 열리며 돌계단)과 세 물결 연출을 공유한다.

import { isPassable } from "@/project/collision";
import type { Command, GameEvent } from "@/project/types";
import type { Cell } from "./jrpgVolumeTools";
import {
  hashSeed,
  PlayPlanner,
  roomWalkable,
  seededShuffle,
  type MechanicContext,
  type MechanicDef,
  type MechanicResult,
  type PuzzleModel,
} from "./puzzleMechanicCore";
import {
  ifSw,
  ifVar,
  makePage,
  obj,
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
  tintPulse,
  TRANSPARENT,
  wait,
  type PropState,
  type PuzzleRoomSpec,
  type RevealTheme,
} from "./puzzleKit";

/** 북쪽 벽 가운데 창살 → 해결 시 벽이 열리고 돌계단(손 도트 화로 성소와 같은 문법). */
const GATE: readonly PropState[] = [
  { objects: [obj("portcullis", 9, 3), obj("portcullis", 10, 3)] },
  { open: [rect(9, 1, 11, 2)], objects: [obj("stairs up stone", 9, 3)] },
];

interface Built {
  readonly room: PuzzleRoom;
  readonly at: (c: Cell) => Cell;
  readonly walk: (x: number, y: number) => boolean;
  readonly gateCmds: Command[];
}

/** 방을 짓고 칠한 뒤 걷기 판정을 준다. solid = 막는 이벤트를 둘 칸(방 기준). */
function buildRoom(ctx: MechanicContext, spec: PuzzleRoomSpec, label: string, solid: readonly Cell[], initial: Readonly<Record<string, number>> = {}): Built {
  const room = new PuzzleRoom(ctx.draft, ctx.map, ctx.win, spec, label);
  room.paint(initial);
  return {
    room,
    at: (c) => room.at(c.x, c.y),
    walk: roomWalkable((x, y) => isPassable(ctx.draft, ctx.map, x, y), ctx.win, solid),
    gateCmds: room.set("gate", 1),
  };
}

function finale(ctx: MechanicContext, b: Built, line: string, theme: RevealTheme): Command[] {
  return [textCmd(line), ...revealInWaves(b.gateCmds, theme), ...ctx.rewardCommands, setSw(ctx.solveSwitchId, true)];
}

const solvedCond = (ctx: MechanicContext) => [{ kind: "switch" as const, switchId: ctx.solveSwitchId, value: true }];

/** 조사 대상 이벤트(투명, 막힘) — 해결 뒤에는 afterText 한 줄만 말한다. */
function actEvent(ctx: MechanicContext, b: Built, suffix: string, name: string, cell: Cell, commands: readonly Command[], afterText?: string): GameEvent {
  const id = ctx.evId(suffix);
  return puzzleEvent(id, name, b.at(cell), [
    makePage({ id: `${id}_live`, name, graphic: TRANSPARENT, commands }),
    ...(afterText ? [makePage({ id: `${id}_done`, name: `${name}(해결 뒤)`, conditions: solvedCond(ctx), graphic: TRANSPARENT, commands: [textCmd(afterText)] })] : []),
  ]);
}

function tabletEvent(ctx: MechanicContext, b: Built, cell: Cell, text: string): GameEvent {
  return actEvent(ctx, b, "hint_tablet", "단서 석판", cell, [se("decision1"), textCmd(ctx.hint ?? text)]);
}

const wrongBuzz = (line: string): Command[] => [sfx("wrong"), ...tintPulse("200,40,40", 0.3, 100, 400), shake(3, 300), textCmd(line)];

const blueTheme: RevealTheme = { flash: "white", pulse: "170,210,255", waves: ["magic", "dust", "sparkle"] };
const fireTheme: RevealTheme = { flash: "white", pulse: "255,170,90", waves: ["fire", "smoke", "sparkle"] };
const goldTheme: RevealTheme = { flash: "white", pulse: "255,236,170", waves: ["dust", "magic", "sparkle"] };

// ---------------------------------------------------------------------------
// 1. 봉인 수정 뒤집기 (boss_seal_monoliths) — 3×3 lights-out
// ---------------------------------------------------------------------------

export const sealCrystalsLightsOut: MechanicDef = {
  build(ctx) {
    const xs = [6, 10, 14];
    const ys = [7, 9, 11];
    const cells: Cell[] = ys.flatMap((y) => xs.map((x) => ({ x, y })));
    const links = cells.map((_, i) => {
      const r = Math.floor(i / 3);
      const c = i % 3;
      return [i, ...[[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([rr, cc]) => rr! >= 0 && rr! < 3 && cc! >= 0 && cc! < 3).map(([rr, cc]) => rr! * 3 + cc!)];
    });
    // 모두 켜진 상태에서 씨앗으로 고른 서로 다른 네 칸을 친 결과가 처음 상태 → 최소 4번(3×3 은 해가 하나뿐).
    const presses = seededShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], ctx.seed).slice(0, 4);
    let litMask = 0b111111111;
    for (const p of presses) for (const j of links[p]!) litMask ^= 1 << j;
    const initialLit = cells.map((_, i) => (litMask & (1 << i)) !== 0);
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 2,
      right: 2,
      floor: "dungeon",
      wall: "rune",
      ceiling: "dark",
      zones: [{ x0: 5, y0: 6, x1: 15, y1: 12, floor: "grey" }],
      objects: [
        obj("wall torch", 5, 3),
        obj("wall torch", 14, 3),
        obj("demon statue", 3, 7),
        obj("demon statue", 16, 7),
        obj("column stone", 3, 11),
        obj("column stone", 16, 11),
        obj("hint tablet", 4, 13),
      ],
      props: {
        gate: GATE,
        ...Object.fromEntries(cells.map((c, i) => [`crystal_${i}`, [{ objects: [obj("dark orb pedestal", c.x, c.y)] }, { objects: [obj("crystal switch", c.x, c.y)] }]])),
      },
    };
    const b = buildRoom(ctx, spec, "boss_seal_monoliths", [...cells, { x: 4, y: 13 }], Object.fromEntries(cells.map((_, i) => [`crystal_${i}`, initialLit[i] ? 1 : 0])));
    // 뒤집힘 스위치: 켜짐 = 처음 상태와 반대.
    const flipped = cells.map((_, i) => ctx.sw(`crystal_${i}_flipped`, `봉인 수정 ${i + 1} 뒤집힘`));
    const toggle = (j: number): Command =>
      ifSw(flipped[j]!, true, [setSw(flipped[j]!, false), ...b.room.set(`crystal_${j}`, initialLit[j] ? 1 : 0)], [setSw(flipped[j]!, true), ...b.room.set(`crystal_${j}`, initialLit[j] ? 0 : 1)]);
    const allLit = (onTrue: readonly Command[]): Command[] =>
      cells.reduceRight<Command[]>((inner, _, j) => [ifSw(flipped[j]!, !initialLit[j], inner)], [...onTrue]);
    const crystalEvents = cells.map((c, i) =>
      actEvent(
        ctx,
        b,
        `crystal_${i}`,
        `봉인 수정 ${i + 1}`,
        c,
        [
          sfx("crystal-ping"),
          ...links[i]!.map((j) => particles("magic", 500, b.at(cells[j]!))),
          ...links[i]!.map(toggle),
          shake(1, 150),
          ...allLit(finale(ctx, b, "아홉 수정이 모두 푸르게 타오르자 봉인 결계가 갈라진다!", blueTheme)),
        ],
        "수정이 결계를 지탱하던 빛을 모두 풀어냈다.",
      ),
    );
    const tablet = tabletEvent(ctx, b, { x: 4, y: 13 }, "석판: 「수정 하나를 치면 그 수정과 앞뒤좌우로 맞닿은 수정이 함께 뒤집힌다. 아홉이 모두 푸르게 빛날 때 봉인이 풀린다.」");
    const model: PuzzleModel<number> = {
      start: litMask,
      key: (s) => String(s),
      goal: (s) => s === 0b111111111,
      moves: (s) => cells.map((_, i) => [`strike:${i}`, links[i]!.reduce((m, j) => m ^ (1 << j), s)] as const),
    };
    const result: MechanicResult<number> = {
      room: b.room,
      origin: { x: 10, y: 13 },
      events: [...crystalEvents.map((event, i) => ({ event, role: `봉인 수정 ${i + 1}` })), { event: tablet, role: "단서 석판" }],
      revealCommandCount: b.gateCmds.length,
      solveSteps: [
        "수정 하나를 치면 자신과 상하좌우 이웃이 함께 뒤집힌다(꺼짐 보라 ↔ 켜짐 푸름)",
        `처음에 꺼진 수정 ${initialLit.filter((l) => !l).length}개 — 정확히 네 번 쳐야 아홉 개가 모두 켜진다`,
      ],
      model,
      mistakeDemo: () => {
        const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((i) => !presses.includes(i))!;
        return [
          ...new PlayPlanner(b.walk, { x: 10, y: 13 }).actOn(cells[wrong]!).steps,
          { kind: "mark", label: "mistake", expectSolved: false },
          { kind: "act" },
        ];
      },
      toPlaytest: (solution) => {
        const p = new PlayPlanner(b.walk, { x: 10, y: 13 });
        for (const label of solution) p.actOn(cells[Number(label.split(":")[1])]!);
        return [{ kind: "goto", x: 10, y: 13, face: "up" }, ...p.done()];
      },
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 2. 화로 점화 순서 (brazier_ignition_order) — 관계 단서로 순서를 추론
// ---------------------------------------------------------------------------

const BRAZIER_NAMES = ["북서", "북동", "남서", "남동"] as const;
const BRAZIER_CELLS: readonly Cell[] = [
  { x: 6, y: 7 },
  { x: 13, y: 7 },
  { x: 6, y: 11 },
  { x: 13, y: 11 },
];

type Order = readonly number[]; // order[k] = k번째로 켤 화로

interface Clue {
  readonly text: string;
  readonly test: (o: Order) => boolean;
}

function brazierClues(): Clue[] {
  const rank = (o: Order, b: number): number => o.indexOf(b);
  const out: Clue[] = [];
  const side = (b: number): { ns: string; ew: string } => ({ ns: b < 2 ? "북" : "남", ew: b % 2 === 0 ? "서" : "동" });
  for (const ord of [0, 3] as const) {
    for (const s of ["북", "남", "서", "동"]) {
      out.push({
        text: `${ord === 0 ? "첫" : "마지막"} 불은 ${s}쪽 화로다.`,
        test: (o) => {
          const sd = side(o[ord]!);
          return sd.ns === s || sd.ew === s;
        },
      });
    }
  }
  for (let a = 0; a < 4; a += 1) {
    for (let c = 0; c < 4; c += 1) {
      if (a === c) continue;
      out.push({ text: `${BRAZIER_NAMES[a]} 화로는 ${BRAZIER_NAMES[c]} 화로보다 먼저 탄다.`, test: (o) => rank(o, a) < rank(o, c) });
    }
    for (let k = 0; k < 4; k += 1) out.push({ text: `${BRAZIER_NAMES[a]} 화로는 ${k + 1}번째가 아니다.`, test: (o) => rank(o, a) !== k });
  }
  out.push({ text: "잇달아 타는 두 화로는 결코 대각선으로 마주 보지 않는다.", test: (o) => o.every((b, k) => k === 0 || b + o[k - 1]! !== 3) });
  out.push({ text: "불은 같은 쪽 벽을 두 번 연달아 건너지 않는다 — 북에서 남, 남에서 북으로 번갈아 옮는다.", test: (o) => o.every((b, k) => k === 0 || (b < 2) !== (o[k - 1]! < 2)) });
  return out;
}

function permutations(n: number): number[][] {
  if (n === 1) return [[0]];
  return permutations(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]));
}

/** 씨앗 순서에 맞는 단서를 씨앗 순으로 골라, 남는 순서가 하나가 될 때까지 더한다(쓸모없는 단서는 건너뛴다). */
export function pickBrazierClues(order: Order, seed: number): Clue[] {
  const all = seededShuffle(brazierClues().filter((c) => c.test(order)), seed);
  let alive = permutations(4);
  const picked: Clue[] = [];
  for (const clue of all) {
    const next = alive.filter((o) => clue.test(o));
    if (next.length === alive.length) continue;
    picked.push(clue);
    alive = next;
    if (alive.length === 1) break;
  }
  return picked;
}

export const brazierRelationalOrder: MechanicDef = {
  build(ctx) {
    const order = seededShuffle([0, 1, 2, 3], ctx.seed);
    const clues = pickBrazierClues(order, hashSeed(`${ctx.baseId}:clues`));
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 2,
      right: 2,
      floor: "dungeon",
      wall: "rock",
      ceiling: "rock",
      zones: [
        { x0: 2, y0: 5, x1: 3, y1: 13, floor: "soot" },
        { x0: 16, y0: 5, x1: 17, y1: 13, floor: "soot" },
        { x0: 9, y0: 5, x1: 10, y1: 13, floor: "soot" },
      ],
      objects: [
        obj("long hearth 6", 2, 6),
        obj("long hearth 6", 17, 6),
        obj("wall torch", 5, 3),
        obj("wall torch", 14, 3),
        obj("skull pile", 3, 13),
        obj("skull pile", 16, 13),
        obj("hint tablet", 10, 9),
      ],
      daises: BRAZIER_CELLS.map((c) => ({ id: "dais stone", x: c.x, y: c.y, w: 1, h: 1 })),
      props: {
        gate: GATE,
        // 꺼진 화로는 숯 통(가마솥은 초록 약이 끓어 「솥」으로 읽혔다 — 폴른 스타 감사 3차).
        ...Object.fromEntries(BRAZIER_CELLS.map((c, i) => [`brazier_${i}`, [{ objects: [obj("coal bin", c.x, c.y)] }, { objects: [obj("brazier", c.x, c.y)] }]])),
      },
    };
    const b = buildRoom(ctx, spec, "brazier_ignition_order", [...BRAZIER_CELLS, { x: 10, y: 9 }]);
    const vStep = ctx.v("brazier_step", "화로 점화 단계");
    const swLit = BRAZIER_CELLS.map((_, i) => ctx.sw(`brazier_${i}_lit`, `${BRAZIER_NAMES[i]} 화로 점화`));
    const douse: Command[] = [
      ...BRAZIER_CELLS.flatMap((c, i) => [ifSw(swLit[i]!, true, [setSw(swLit[i]!, false), ...b.room.set(`brazier_${i}`, 0), particles("smoke", 800, b.at(c))])]),
      setVar(vStep, 0),
    ];
    const events = BRAZIER_CELLS.map((c, i) => {
      const k = order.indexOf(i);
      const light: Command[] = [
        setSw(swLit[i]!, true),
        ...b.room.set(`brazier_${i}`, 1),
        se("fire7"),
        particles("fire", 1000, b.at(c)),
        setVar(vStep, k + 1),
        ...(k === 3 ? finale(ctx, b, "네 화로가 하나의 불길로 이어지며 창살이 녹아내린다!", fireTheme) : [textCmd(`화르륵— ${BRAZIER_NAMES[i]} 화로가 타오른다. (${k + 1}/4)`)]),
      ];
      const id = ctx.evId(`brazier_${i}`);
      return puzzleEvent(id, `${BRAZIER_NAMES[i]} 화로`, b.at(c), [
        makePage({ id: `${id}_cold`, name: "꺼진 화로", graphic: TRANSPARENT, commands: [ifVar(vStep, "==", k, light, [...wrongBuzz("불길이 역류해 모든 화로가 꺼졌다! 순서가 틀렸다."), ...douse])] }),
        makePage({ id: `${id}_lit`, name: "타는 화로", conditions: [{ kind: "switch", switchId: swLit[i]!, value: true }], graphic: TRANSPARENT, commands: [textCmd("화로가 타오르고 있다.")] }),
      ]);
    });
    const tablet = tabletEvent(ctx, b, { x: 10, y: 9 }, `석판: 「네 화로에 차례로 불을 옮겨라. ${clues.map((c) => c.text).join(" ")} 틀리면 불은 모두 꺼진다.」`);
    const model: PuzzleModel<number> = {
      start: 0,
      key: (s) => String(s),
      goal: (s) => s === 4,
      moves: (s) => [0, 1, 2, 3].map((i) => [`light:${i}`, order.indexOf(i) === s ? s + 1 : 0] as const),
    };
    const result: MechanicResult<number> = {
      room: b.room,
      origin: { x: 10, y: 13 },
      events: [...events.map((event, i) => ({ event, role: `${BRAZIER_NAMES[i]} 화로` })), { event: tablet, role: `단서 석판(단서 ${clues.length}개로 순서가 하나로 정해짐)` }],
      revealCommandCount: b.gateCmds.length,
      solveSteps: [`석판 단서: ${clues.map((c) => c.text).join(" / ")}`, `정답 순서: ${order.map((i) => BRAZIER_NAMES[i]).join(" → ")}`, "틀리면 켜진 화로가 모두 꺼진다"],
      model,
      mistakeDemo: () => {
        const p = new PlayPlanner(b.walk, { x: 10, y: 13 }).actOn({ x: 10, y: 9 }).actOn(BRAZIER_CELLS[order[1]!]!);
        return [...p.steps, { kind: "mark", label: "mistake", expectSolved: false }];
      },
      toPlaytest: (solution) => {
        const p = new PlayPlanner(b.walk, { x: 10, y: 13 });
        for (const label of solution) p.actOn(BRAZIER_CELLS[Number(label.split(":")[1])]!);
        return [{ kind: "goto", x: 10, y: 13, face: "up" }, ...p.done()];
      },
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 3. 오르간 메아리 (cathedral_organ_tuning) — 다섯 음 기억해 발판으로 따라 치기
// ---------------------------------------------------------------------------

/** 네 발판은 같은 오르간 음색에 음높이만 다르다 — 따라 치기 기억은 귀로도 구별돼야 한다(옛 판은 종·방울·성가 샘플이 길이·음량이 제각각이라 겹쳐 뭉개졌다). */
const NOTE_SE = ["organ-c", "organ-e", "organ-g", "organ-c2"] as const;
const NOTE_NAMES = ["낮은 도", "미", "솔", "높은 도"] as const;
const NOTE_CELLS: readonly Cell[] = [
  { x: 5, y: 7 },
  { x: 14, y: 7 },
  { x: 5, y: 11 },
  { x: 14, y: 11 },
];

export const organEchoMemory: MechanicDef = {
  build(ctx) {
    // 다섯 음, 같은 음 연속 금지(같은 발판을 내렸다 다시 밟아야 하는 어색함을 없앤다).
    const seq: number[] = [];
    let s = ctx.seed;
    while (seq.length < 5) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      const n = (s >>> 8) % 4;
      if (seq[seq.length - 1] !== n) seq.push(n);
    }
    const spec: PuzzleRoomSpec = {
      top: 1,
      floor: "flag",
      wall: "stone",
      ceiling: "dark",
      door: [9, 10],
      objects: [
        obj("pipe organ", 9, 3),
        obj("candelabra", 7, 3),
        obj("candelabra", 12, 3),
        obj("tall stained window", 3, 1),
        obj("tall stained window", 6, 1),
        obj("tall stained window", 12, 1),
        obj("tall stained window", 16, 1),
        // 양옆 회중석 줄 + 봉헌 초 — 옛 판은 바닥 절반이 빈 회색이었다. 발판(5·14열)과 붉은 길(9~10열)은 비워 둔다.
        ...[7, 9, 11, 13].flatMap((y) => [obj("pew", 2, y), obj("pew", 16, y)]),
        obj("votive stand", 7, 6),
        obj("votive stand", 12, 6),
        obj("holy water font", 2, 5),
        obj("holy water font", 17, 5),
      ],
      lines: [{ id: "rug red", rect: { x0: 9, y0: 5, x1: 10, y1: 13 } }],
      props: {
        gate: [{ objects: [obj("statue", 15, 3)] }, { objects: [obj("stairwell down", 14, 3)] }],
        ...Object.fromEntries(NOTE_CELLS.map((c, i) => [`note_${i}`, [{ objects: [obj("pressure plate", c.x, c.y)] }, { objects: [obj("pressure plate down", c.x, c.y)] }]])),
      },
    };
    const b = buildRoom(ctx, spec, "cathedral_organ_tuning", [{ x: 9, y: 3 }]);
    const vProg = ctx.v("echo_progress", "메아리 따라 친 음 수");
    const blink = (i: number, ms: number): Command[] => [...b.room.set(`note_${i}`, 1), sfx(NOTE_SE[i]!), particles("sparkle", 600, b.at(NOTE_CELLS[i]!)), wait(ms), ...b.room.set(`note_${i}`, 0)];
    const organ = actEvent(
      ctx,
      b,
      "organ",
      "대성당 파이프 오르간",
      { x: 9, y: 3 },
      [
        textCmd("건반에 손을 얹자 오르간이 스스로 다섯 음을 울린다… 바닥의 네 발판이 차례로 빛난다."),
        setVar(vProg, 0),
        wait(300),
        ...seq.flatMap((n) => [...blink(n, 420), wait(220)]),
        textCmd("메아리를 그대로 따라 발판을 밟아라. 한 음이라도 어긋나면 처음부터다."),
      ],
      "오르간이 조율을 마치고 고요히 울리고 있다.",
    );
    const notes = NOTE_CELLS.map((c, i) => {
      const id = ctx.evId(`note_${i}`);
      const positions = seq.map((n, j) => (n === i ? j : -1)).filter((j) => j >= 0);
      const wrong: Command[] = [...wrongBuzz("불협화음! 메아리가 흩어졌다 — 오르간을 다시 울려 처음부터."), setVar(vProg, 0)];
      const branch = positions.reduceRight<Command[]>(
        (otherwise, j) => [
          ifVar(
            vProg,
            "==",
            j,
            [...blink(i, 260), setVar(vProg, j + 1), ...(j === seq.length - 1 ? finale(ctx, b, "다섯 음이 하나의 화음으로 겹치며 석상이 미끄러져 지하 계단이 열린다!", goldTheme) : [])],
            otherwise,
          ),
        ],
        wrong,
      );
      return puzzleEvent(id, `${NOTE_NAMES[i]} 발판`, b.at(c), [
        makePage({ id: `${id}_live`, name: `${NOTE_NAMES[i]} 발판`, trigger: "playerTouch", priority: "below", graphic: TRANSPARENT, commands: branch }),
        makePage({ id: `${id}_done`, name: "발판(해결 뒤)", conditions: solvedCond(ctx), priority: "below", graphic: TRANSPARENT, commands: [] }),
      ]);
    });
    const model: PuzzleModel<number> = {
      start: 0,
      key: (st) => String(st),
      goal: (st) => st === seq.length,
      moves: (st) => [0, 1, 2, 3].map((i) => [`step:${i}`, seq[st] === i ? st + 1 : 0] as const),
    };
    const otherPlates = (except: number) => (x: number, y: number) => NOTE_CELLS.some((c, k) => k !== except && c.x === x && c.y === y);
    const result: MechanicResult<number> = {
      room: b.room,
      origin: { x: 10, y: 13 },
      events: [{ event: organ, role: "파이프 오르간(선율 재생)" }, ...notes.map((event, i) => ({ event, role: `${NOTE_NAMES[i]} 발판` }))],
      revealCommandCount: b.gateCmds.length,
      solveSteps: ["오르간을 조사해 다섯 음과 발판 빛을 기억한다", `같은 순서로 발판을 밟는다: ${seq.map((n) => NOTE_NAMES[n]).join(" → ")}`, "다른 발판을 밟고 지나가도 틀린 음이다 — 길을 골라 걷는다"],
      model,
      mistakeDemo: () => {
        const wrongPlate = [0, 1, 2, 3].find((i) => i !== seq[0])!;
        const p = new PlayPlanner(b.walk, { x: 10, y: 13 }).stepOn(NOTE_CELLS[wrongPlate]!, otherPlates(wrongPlate));
        return [...p.steps, { kind: "mark", label: "mistake", expectSolved: false }];
      },
      toPlaytest: (solution) => {
        const p = new PlayPlanner(b.walk, { x: 10, y: 13 }).actOn({ x: 9, y: 3 });
        for (const label of solution) {
          const i = Number(label.split(":")[1]);
          p.stepOn(NOTE_CELLS[i]!, otherPlates(i));
        }
        return [{ kind: "goto", x: 10, y: 13, face: "up" }, ...p.done()];
      },
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 4. 레버 판정 (two_step_sequence) — 레버 넷 + 맞은 개수만 알려 주는 판정 석상(마스터마인드)
// ---------------------------------------------------------------------------

const LEVER_X = [5, 7, 12, 14] as const;

export const leverMastermind: MechanicDef = {
  build(ctx) {
    const secret = ((ctx.seed >>> 3) % 15) + 1; // 0000 은 처음 상태라 제외
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 2,
      right: 2,
      floor: "grate",
      wall: "riveted",
      ceiling: "steel",
      zones: [{ x0: 7, y0: 9, x1: 12, y1: 12, floor: "grey" }],
      objects: [obj("gear wall", 2, 3), obj("gear wall", 16, 3), obj("barrel stack", 3, 12), obj("barrel stack", 16, 12), obj("control console", 16, 5)],
      props: {
        gate: GATE,
        ...Object.fromEntries(LEVER_X.map((x, i) => [`lever_${i}`, [{ objects: [obj("wall lever", x, 3)] }, { objects: [obj("wall lever on", x, 3)] }]])),
        ...Object.fromEntries([0, 1, 2, 3].map((k) => [`lamp_${k}`, [{ objects: [obj("dark orb pedestal", 8 + k, 7)] }, { objects: [obj("crystal switch", 8 + k, 7)] }]])),
      },
    };
    const b = buildRoom(ctx, spec, "two_step_sequence", [{ x: 16, y: 5 }, ...LEVER_X.map((x) => ({ x, y: 4 }))]);
    const swLever = LEVER_X.map((_, i) => ctx.sw(`lever_${i}`, `레버 ${i + 1} 올림`));
    const vHits = ctx.v("judge_hits", "판정 석상이 센 맞은 레버 수");
    const levers = LEVER_X.map((x, i) =>
      actEvent(ctx, b, `lever_${i}`, `레버 ${i + 1}`, { x, y: 4 }, [
        sfx("switch-clack"),
        ifSw(swLever[i]!, true, [setSw(swLever[i]!, false), ...b.room.set(`lever_${i}`, 0)], [setSw(swLever[i]!, true), ...b.room.set(`lever_${i}`, 1)]),
        shake(1, 100),
      ]),
    );
    const judge = actEvent(
      ctx,
      b,
      "judge_console",
      "판정 제어반",
      { x: 16, y: 5 },
      [
        textCmd("제어반이 레버 넷을 읽는다…"),
        setVar(vHits, 0),
        ...LEVER_X.map((_, i) => ifSw(swLever[i]!, ((secret >> i) & 1) === 1, [setVar(vHits, 1, "+=")])),
        ...[0, 1, 2, 3].flatMap((k) => [ifVar(vHits, ">=", k + 1, [...b.room.set(`lamp_${k}`, 1), se("chime1"), wait(160)], b.room.set(`lamp_${k}`, 0))]),
        ifVar(vHits, "==", 4, finale(ctx, b, "등 넷이 모두 켜졌다! 북쪽 창살이 올라간다.", blueTheme), [textCmd("켜진 등의 수 = 제자리에 맞은 레버의 수. 어느 레버가 맞았는지는 알려 주지 않는다.")]),
      ],
      "판정이 끝난 제어반이 조용히 웅웅거린다.",
    );
    const model: PuzzleModel<{ bits: number; done: boolean }> = {
      start: { bits: 0, done: false },
      key: (st) => `${st.bits}:${st.done}`,
      goal: (st) => st.done,
      moves: (st) => [...LEVER_X.map((_, i) => [`lever:${i}`, { bits: st.bits ^ (1 << i), done: false }] as const), ["judge", { bits: st.bits, done: st.bits === secret }] as const],
    };
    const result: MechanicResult<{ bits: number; done: boolean }> = {
      room: b.room,
      origin: { x: 10, y: 13 },
      events: [...levers.map((event, i) => ({ event, role: `레버 ${i + 1}` })), { event: judge, role: "판정 제어반(맞은 수 표시)" }],
      revealCommandCount: b.gateCmds.length,
      solveSteps: ["레버 넷을 올리고 내린 뒤 제어반으로 판정 — 켜진 등 수가 제자리에 맞은 레버 수", "레버를 하나씩 바꿔 가며 판정하면 각 레버의 정답을 알아낼 수 있다", `정답: ${LEVER_X.map((_, i) => (((secret >> i) & 1) === 1 ? "올림" : "내림")).join("·")}`],
      model,
      mistakeDemo: () => [...new PlayPlanner(b.walk, { x: 10, y: 13 }).actOn({ x: 16, y: 5 }).steps, { kind: "mark", label: "mistake", expectSolved: false }],
      toPlaytest: (solution) => {
        const p = new PlayPlanner(b.walk, { x: 10, y: 13 });
        for (const label of solution) {
          if (label === "judge") p.actOn({ x: 16, y: 5 });
          else p.actOn({ x: LEVER_X[Number(label.split(":")[1])]!, y: 4 }, {});
        }
        return [{ kind: "goto", x: 10, y: 13, face: "up" }, ...p.done()];
      },
    };
    return result as MechanicResult;
  },
};

