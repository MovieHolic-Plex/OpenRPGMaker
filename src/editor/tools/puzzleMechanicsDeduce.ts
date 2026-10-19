// src/editor/tools/puzzleMechanicsDeduce.ts
// 추론·자원 계열 품질 퍼즐: 거짓말쟁이 상자, 방 안 개수 세기 숫자 자물쇠, 원소 구슬 자리, 두 저수조(물통 붓기),
// 저울 추(부분합), 뒤집히는 바닥(밟으면 뒤집힘), 빨강·파랑 결정 차단벽, 속이 빈 벽 두드리기(폭약 한 개).

import { isPassable } from "@/project/collision";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import type { Command, GameEvent } from "@/project/types";
import type { Cell } from "./jrpgVolumeTools";
import {
  DIR_OF,
  hashSeed,
  PlayPlanner,
  roomWalkable,
  seededShuffle,
  type MechanicContext,
  type MechanicDef,
  type MechanicResult,
  type PuzzleModel,
  type PuzzlePlayStep,
} from "./puzzleMechanicCore";
import {
  choices,
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
  setSw,
  setVar,
  shake,
  textCmd,
  tintPulse,
  TRANSPARENT,
  type PropState,
  type PuzzleRoomSpec,
  type RevealTheme,
} from "./puzzleKit";

const GATE: readonly PropState[] = [
  { objects: [obj("portcullis", 9, 3), obj("portcullis", 10, 3)] },
  { open: [rect(9, 1, 11, 2)], objects: [obj("stairs up stone", 9, 3)] },
];
const ORIGIN: Cell = { x: 10, y: 13 };
const blueTheme: RevealTheme = { flash: "white", pulse: "170,210,255", waves: ["magic", "dust", "sparkle"] };
const goldTheme: RevealTheme = { flash: "white", pulse: "255,236,170", waves: ["dust", "magic", "sparkle"] };
const waterTheme: RevealTheme = { flash: "white", pulse: "150,200,255", waves: ["splash", "splash", "sparkle"] };

interface Built {
  readonly room: PuzzleRoom;
  readonly at: (c: Cell) => Cell;
  readonly walk: (x: number, y: number) => boolean;
  readonly gateCmds: Command[];
}

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

function actEvent(ctx: MechanicContext, b: Built, suffix: string, name: string, cell: Cell, commands: readonly Command[], afterText?: string): GameEvent {
  const id = ctx.evId(suffix);
  return puzzleEvent(id, name, b.at(cell), [
    makePage({ id: `${id}_live`, name, graphic: TRANSPARENT, commands }),
    ...(afterText ? [makePage({ id: `${id}_done`, name: `${name}(해결 뒤)`, conditions: solvedCond(ctx), graphic: TRANSPARENT, commands: [textCmd(afterText)] })] : []),
  ]);
}

const wrongBuzz = (line: string): Command[] => [se("buzzer1"), ...tintPulse("200,40,40", 0.3, 100, 400), shake(3, 300), textCmd(line)];

function planFrom(b: Built): PlayPlanner {
  return new PlayPlanner(b.walk, ORIGIN);
}

function finish(steps: PuzzlePlayStep[]): PuzzlePlayStep[] {
  return [{ kind: "goto", x: ORIGIN.x, y: ORIGIN.y, face: "up" }, ...steps];
}

// ---------------------------------------------------------------------------
// 1. 거짓말쟁이 상자 (riddle_mimic_chests) — 세 문구 중 참은 하나, 진짜 상자는 하나
// ---------------------------------------------------------------------------

const CHEST_NAMES = ["금빛", "은빛", "구릿빛"] as const;

interface Statement {
  readonly text: string;
  readonly holds: (t: number) => boolean;
}

function chestStatements(self: number): Statement[] {
  const out: Statement[] = [
    { text: "보물은 이 상자에 있다.", holds: (t) => t === self },
    { text: "보물은 이 상자에 없다.", holds: (t) => t !== self },
  ];
  for (let k = 0; k < 3; k += 1) {
    if (k === self) continue;
    out.push({ text: `보물은 ${CHEST_NAMES[k]} 상자에 있다.`, holds: (t) => t === k });
    out.push({ text: `보물은 ${CHEST_NAMES[k]} 상자에 없다.`, holds: (t) => t !== k });
  }
  return out;
}

/** 「참은 하나뿐」 규칙으로 보물 자리가 하나로 정해지는 세 문구를 씨앗 순으로 찾는다. */
export function pickLiarRiddle(seed: number): { readonly lines: readonly Statement[]; readonly treasure: number } {
  const pools = [0, 1, 2].map((i) => seededShuffle(chestStatements(i), seed + i * 977));
  for (const a of pools[0]!) {
    for (const bb of pools[1]!) {
      for (const c of pools[2]!) {
        const lines = [a, bb, c];
        const fits = [0, 1, 2].filter((t) => lines.filter((s) => s.holds(t)).length === 1);
        if (fits.length === 1) return { lines, treasure: fits[0]! };
      }
    }
  }
  throw new Error("거짓말쟁이 상자 문제를 만들지 못했습니다.");
}

export const liarChests: MechanicDef = {
  build(ctx) {
    const { lines, treasure } = pickLiarRiddle(ctx.seed);
    const chestCells: Cell[] = [
      { x: 6, y: 8 },
      { x: 10, y: 8 },
      { x: 14, y: 8 },
    ];
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 2,
      right: 2,
      floor: "sandstone",
      wall: "stone",
      ceiling: "gold",
      zones: [{ x0: 4, y0: 6, x1: 15, y1: 10, floor: "terra" }],
      objects: [
        obj("wall torch", 5, 3),
        obj("wall torch", 14, 3),
        obj("lion statue", 2, 6),
        obj("lion statue", 16, 6),
        obj("tall vase red", 3, 12),
        obj("tall vase teal", 16, 12),
        obj("hint tablet", 10, 11),
      ],
      props: {
        gate: GATE,
        ...Object.fromEntries(chestCells.map((c, i) => [`chest_${i}`, [{ objects: [obj("treasure chest", c.x, c.y)] }, { objects: [obj(i === treasure ? "treasure chest open" : "mimic", c.x, c.y)] }]])),
      },
    };
    const b = buildRoom(ctx, spec, "riddle_mimic_chests", [...chestCells, { x: 10, y: 11 }]);
    const events = chestCells.map((c, i) => {
      const open: Command[] =
        i === treasure
          ? [se("chime2"), ...b.room.set(`chest_${i}`, 1), particles("sparkle", 900, b.at(c)), ...finale(ctx, b, `${CHEST_NAMES[i]} 상자가 진짜였다! 바닥의 창살이 걷힌다.`, goldTheme)]
          : [
              se("monster1"),
              ...b.room.set(`chest_${i}`, 1),
              ...wrongBuzz(`${CHEST_NAMES[i]} 상자가 이빨을 드러냈다 — 미믹이다! 덥석 물리고 입구까지 튕겨 나갔다.`),
              ...b.room.set(`chest_${i}`, 0),
              textCmd("미믹은 다시 상자인 척 입을 다물었다."),
              { kind: "transfer", mapId: ctx.map.id, x: b.at(ORIGIN).x, y: b.at(ORIGIN).y, direction: "up", fade: "black" },
            ];
      return actEvent(ctx, b, `chest_${i}`, `${CHEST_NAMES[i]} 상자`, c, [
        textCmd(`${CHEST_NAMES[i]} 상자의 뚜껑 글귀: 「${lines[i]!.text}」`),
        choices(undefined, [
          { text: "연다", branch: open },
          { text: "그만둔다", branch: [] },
        ]),
      ], "빈 상자다.");
    });
    const tablet = actEvent(ctx, b, "hint_tablet", "단서 석판", { x: 10, y: 11 }, [se("decision1"), textCmd(ctx.hint ?? "석판: 「세 상자의 글귀 가운데 참은 단 하나. 보물은 한 상자에만 있고, 나머지 둘은 미믹이다.」")]);
    const model: PuzzleModel<number> = {
      start: -1,
      key: (s) => String(s),
      goal: (s) => s === 1,
      moves: () => [0, 1, 2].map((i) => [`open:${i}`, i === treasure ? 1 : -1] as const),
    };
    const result: MechanicResult<number> = {
      room: b.room,
      origin: ORIGIN,
      events: [...events.map((event, i) => ({ event, role: `${CHEST_NAMES[i]} 상자` })), { event: tablet, role: "단서 석판(참은 하나)" }],
      revealCommandCount: b.gateCmds.length,
      solveSteps: [...lines.map((s, i) => `${CHEST_NAMES[i]} 상자: ${s.text}`), `참이 하나뿐인 경우는 보물이 ${CHEST_NAMES[treasure]} 상자에 있을 때뿐이다`],
      model,
      mistakeDemo: () => {
        const wrong = [0, 1, 2].find((i) => i !== treasure)!;
        return [...planFrom(b).actOn(chestCells[wrong]!, { choose: [0] }).steps, { kind: "mark", label: "mistake", expectSolved: false }];
      },
      toPlaytest: () => finish(planFrom(b).actOn({ x: 10, y: 11 }).actOn(chestCells[treasure]!, { choose: [0] }).done()),
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 2. 숫자 자물쇠 (number_code_lock) — 방 안의 물건을 세어 세 자리 번호를 맞힌다
// ---------------------------------------------------------------------------

const COUNT_SLOTS: readonly Cell[] = [
  { x: 3, y: 7 }, { x: 3, y: 9 }, { x: 3, y: 11 }, { x: 5, y: 12 }, { x: 7, y: 12 },
  { x: 16, y: 7 }, { x: 16, y: 9 }, { x: 16, y: 11 }, { x: 14, y: 12 }, { x: 12, y: 12 },
  { x: 6, y: 6 }, { x: 13, y: 6 }, { x: 8, y: 9 }, { x: 11, y: 9 }, { x: 5, y: 9 },
];

export const numberCodeLock: MechanicDef = {
  build(ctx) {
    const kinds = [
      { id: "candelabra", name: "촛대" },
      { id: "skull pile", name: "해골 더미" },
      { id: "book pile", name: "책 더미" },
    ] as const;
    const counts = [0, 1, 2].map((k) => ((hashSeed(`${ctx.baseId}:${k}`) >>> 4) % 4) + 2); // 2..5
    const slots = seededShuffle(COUNT_SLOTS, ctx.seed);
    const placed = kinds.flatMap((k, i) => slots.splice(0, counts[i]!).map((c) => obj(k.id, c.x, c.y)));
    const code = counts[0]! * 100 + counts[1]! * 10 + counts[2]!;
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 2,
      right: 2,
      floor: "dplank",
      wall: "stone",
      ceiling: "wood",
      objects: [obj("bookshelf 3w", 2, 5), obj("bookshelf 3w", 15, 5), obj("wall torch", 6, 3), obj("wall torch", 13, 3), ...placed, obj("hint tablet", 10, 6)],
      props: { gate: GATE },
    };
    const b = buildRoom(ctx, spec, "number_code_lock", [{ x: 10, y: 6 }, { x: 9, y: 4 }]);
    const vCode = ctx.v("code_input", "자물쇠에 넣은 번호");
    const lock = actEvent(
      ctx,
      b,
      "code_lock",
      "세 자리 자물쇠",
      { x: 9, y: 4 },
      [
        { kind: "inputNumber", variableId: vCode, digits: 3, prompt: "자물쇠 번호(세 자리)", showPad: true },
        ifVar(vCode, "==", code, [se("key"), ...finale(ctx, b, "딸깍— 자물쇠가 풀리며 창살이 올라간다!", goldTheme)], wrongBuzz("철컥, 자물쇠가 꿈쩍도 하지 않는다.")),
      ],
      "열린 자물쇠다.",
    );
    const tablet = actEvent(ctx, b, "hint_tablet", "사서의 쪽지", { x: 10, y: 6 }, [
      se("decision1"),
      textCmd(ctx.hint ?? `쪽지: 「번호는 이 방이 품은 것들의 수. 백의 자리는 ${kinds[0].name}, 십의 자리는 ${kinds[1].name}, 일의 자리는 ${kinds[2].name}.」`),
    ]);
    const model: PuzzleModel<number> = {
      start: 0,
      key: (s) => String(s),
      goal: (s) => s === 1,
      moves: () => [[`code:${code}`, 1] as const, [`code:${(code + 111) % 1000}`, 0] as const],
    };
    const result: MechanicResult<number> = {
      room: b.room,
      origin: ORIGIN,
      events: [
        { event: lock, role: "세 자리 자물쇠(inputNumber)" },
        { event: tablet, role: "사서의 쪽지(세는 규칙)" },
      ],
      revealCommandCount: b.gateCmds.length,
      solveSteps: [`방 안 ${kinds.map((k, i) => `${k.name} ${counts[i]}개`).join(", ")}를 센다`, `번호 ${code} 를 북쪽 자물쇠에 넣는다`],
      model,
      mistakeDemo: () => [...planFrom(b).actOn({ x: 9, y: 4 }, { number: (code + 111) % 1000 }).steps, { kind: "mark", label: "mistake", expectSolved: false }],
      toPlaytest: () => finish(planFrom(b).actOn({ x: 10, y: 6 }).actOn({ x: 9, y: 4 }, { number: code }).done()),
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 3. 원소 구슬 자리 (elemental_pedestal_swap) — 네 구슬을 단서대로 네 제단에 놓는다
// ---------------------------------------------------------------------------

const ORB_NAMES = ["불꽃", "얼음", "바람", "대지"] as const;
const PEDESTAL_NAMES = ["북서", "북동", "남서", "남동"] as const;
const PEDESTAL_CELLS: readonly Cell[] = [
  { x: 6, y: 7 },
  { x: 13, y: 7 },
  { x: 6, y: 11 },
  { x: 13, y: 11 },
];

interface OrbClue {
  readonly text: string;
  readonly test: (place: readonly number[]) => boolean; // place[pedestal] = orb
}

function orbClues(): OrbClue[] {
  const out: OrbClue[] = [];
  const isNorth = (p: number) => p < 2;
  const isWest = (p: number) => p % 2 === 0;
  for (let o = 0; o < 4; o += 1) {
    out.push({ text: `${ORB_NAMES[o]}은 북쪽에 놓인다.`, test: (pl) => isNorth(pl.indexOf(o)) });
    out.push({ text: `${ORB_NAMES[o]}은 남쪽에 놓인다.`, test: (pl) => !isNorth(pl.indexOf(o)) });
    out.push({ text: `${ORB_NAMES[o]}은 서쪽에 놓인다.`, test: (pl) => isWest(pl.indexOf(o)) });
    out.push({ text: `${ORB_NAMES[o]}은 동쪽에 놓인다.`, test: (pl) => !isWest(pl.indexOf(o)) });
    for (let q = o + 1; q < 4; q += 1) {
      out.push({ text: `${ORB_NAMES[o]}과 ${ORB_NAMES[q]}은 대각선으로 마주 본다.`, test: (pl) => pl.indexOf(o) + pl.indexOf(q) === 3 });
      out.push({ text: `${ORB_NAMES[o]}과 ${ORB_NAMES[q]}은 같은 줄(북쪽 줄 또는 남쪽 줄)에 있다.`, test: (pl) => isNorth(pl.indexOf(o)) === isNorth(pl.indexOf(q)) });
    }
  }
  return out;
}

function perms4(): number[][] {
  const out: number[][] = [];
  for (const a of [0, 1, 2, 3]) for (const b of [0, 1, 2, 3]) for (const c of [0, 1, 2, 3]) for (const d of [0, 1, 2, 3]) if (new Set([a, b, c, d]).size === 4) out.push([a, b, c, d]);
  return out;
}

export const elementalOrbPlacement: MechanicDef = {
  build(ctx) {
    const answer = seededShuffle([0, 1, 2, 3], ctx.seed); // answer[pedestal] = orb
    let alive = perms4();
    const clues: OrbClue[] = [];
    for (const clue of seededShuffle(orbClues().filter((c) => c.test(answer)), hashSeed(`${ctx.baseId}:orb`))) {
      const next = alive.filter((p) => clue.test(p));
      if (next.length === alive.length) continue;
      clues.push(clue);
      alive = next;
      if (alive.length === 1) break;
    }
    const orbItems = ORB_NAMES.map((_, i) => `item_${ctx.baseId}_orb_${i}`);
    for (const [i, id] of orbItems.entries()) {
      if (!ctx.draft.database.items.some((it) => it.id === id)) {
        ctx.draft.database.items.push(normalizeItemRecord({ id, name: `${ORB_NAMES[i]}의 구슬`, description: "제단에 놓을 원소 구슬.", price: 0, consumable: false, occasion: "never" }));
      }
    }
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 2,
      right: 2,
      floor: "elfstone",
      wall: "marblewall",
      ceiling: "gold",
      zones: [{ x0: 5, y0: 6, x1: 14, y1: 12, floor: "marble" }],
      objects: [obj("wall torch", 5, 3), obj("wall torch", 14, 3), obj("magic circle", 9, 8), obj("hint tablet", 10, 11)],
      props: {
        gate: GATE,
        ...Object.fromEntries(PEDESTAL_CELLS.map((c, i) => [`pedestal_${i}`, [{ objects: [obj("plinth", c.x, c.y)] }, { objects: [obj("orb pedestal", c.x, c.y)] }]])),
        shelf: [{ objects: [obj("crystal ball", 3, 12), obj("crystal ball", 4, 12), obj("crystal ball", 15, 12), obj("crystal ball", 16, 12)] }, { objects: [] }],
      },
    };
    const b = buildRoom(ctx, spec, "elemental_pedestal_swap", [...PEDESTAL_CELLS, { x: 10, y: 11 }, { x: 3, y: 12 }]);
    const vPlaced = PEDESTAL_CELLS.map((_, i) => ctx.v(`pedestal_${i}_orb`, `${PEDESTAL_NAMES[i]} 제단 구슬(+1)`));
    const vCount = ctx.v("orbs_placed", "놓은 구슬 수");
    const swTaken = ctx.sw("orbs_taken", "구슬 넷을 집음");
    const giveBack: Command[] = [
      ...orbItems.map((itemId) => ({ kind: "changeItem", itemId, op: "=", amount: 1 }) as Command),
      ...PEDESTAL_CELLS.flatMap((_, i) => [setVar(vPlaced[i]!, 0), ...b.room.set(`pedestal_${i}`, 0)]),
      setVar(vCount, 0),
    ];
    const check: Command[] = [
      ifVar(vCount, "==", 4, [
        PEDESTAL_CELLS.reduceRight<Command>(
          (inner, _, i) => ifVar(vPlaced[i]!, "==", answer[i]! + 1, [inner], [...wrongBuzz("구슬들이 서로 밀어내며 튀어 올랐다! 자리가 틀렸다."), ...giveBack]),
          { kind: "fork", condition: { kind: "switch", switchId: swTaken, value: true }, then: finale(ctx, b, "네 원소가 마법진으로 모이며 창살이 사라진다!", blueTheme), else: [] },
        ),
      ]),
    ];
    const pedestals = PEDESTAL_CELLS.map((c, i) => {
      const place = (o: number): Command[] => [
        { kind: "changeItem", itemId: orbItems[o]!, op: "-=", amount: 1 },
        setVar(vPlaced[i]!, o + 1),
        setVar(vCount, 1, "+="),
        ...b.room.set(`pedestal_${i}`, 1),
        se("magic1"),
        particles("magic", 700, b.at(c)),
        textCmd(`${PEDESTAL_NAMES[i]} 제단에 ${ORB_NAMES[o]}의 구슬을 올렸다.`),
        ...check,
      ];
      const id = ctx.evId(`pedestal_${i}`);
      return puzzleEvent(id, `${PEDESTAL_NAMES[i]} 제단`, b.at(c), [
        makePage({
          id: `${id}_live`,
          name: `${PEDESTAL_NAMES[i]} 제단`,
          graphic: TRANSPARENT,
          commands: [
            ifVar(
              vPlaced[i]!,
              "==",
              0,
              [{ kind: "presentItem", prompt: `${PEDESTAL_NAMES[i]} 제단에 놓을 구슬`, itemIds: [...orbItems], options: orbItems.map((itemId, o) => ({ itemId, branch: place(o) })), cancelBranch: [] }],
              [
                textCmd("이미 구슬이 놓여 있다."),
                choices(undefined, [
                  { text: "구슬을 도로 집는다", branch: [...orbItems.map((itemId, o) => ifVar(vPlaced[i]!, "==", o + 1, [{ kind: "changeItem", itemId, op: "+=", amount: 1 }])), setVar(vPlaced[i]!, 0), setVar(vCount, 1, "-="), ...b.room.set(`pedestal_${i}`, 0)] },
                  { text: "그대로 둔다", branch: [] },
                ]),
              ],
            ),
          ],
        }),
        makePage({ id: `${id}_done`, name: "제단(해결 뒤)", conditions: solvedCond(ctx), graphic: TRANSPARENT, commands: [textCmd("구슬이 원소의 빛을 뿜고 있다.")] }),
      ]);
    });
    const shelf = actEvent(ctx, b, "orb_shelf", "구슬 진열대", { x: 3, y: 12 }, [
      ifSw(swTaken, false, [setSw(swTaken, true), ...giveBack, ...b.room.set("shelf", 1), se("item1"), textCmd("진열대에서 원소 구슬 넷(불꽃·얼음·바람·대지)을 챙겼다.")], [textCmd("진열대는 비어 있다.")]),
    ]);
    const tablet = actEvent(ctx, b, "hint_tablet", "단서 석판", { x: 10, y: 11 }, [se("decision1"), textCmd(ctx.hint ?? `석판: 「네 제단에 네 구슬을 하나씩. ${clues.map((c) => c.text).join(" ")}」`)]);
    const model: PuzzleModel<string> = {
      start: "----",
      key: (s) => s,
      goal: (s) => s === "done",
      moves: (s) => {
        if (s === "done") return [];
        const out: Array<readonly [string, string]> = [];
        for (let p = 0; p < 4; p += 1) {
          if (s[p] !== "-") continue;
          for (let o = 0; o < 4; o += 1) {
            if (s.includes(String(o))) continue;
            const next = s.slice(0, p) + o + s.slice(p + 1);
            const full = !next.includes("-");
            out.push([`place:${p}:${o}`, full ? (next === answer.join("") ? "done" : "----") : next]);
          }
        }
        return out;
      },
    };
    const result: MechanicResult<string> = {
      room: b.room,
      origin: ORIGIN,
      events: [...pedestals.map((event, i) => ({ event, role: `${PEDESTAL_NAMES[i]} 제단(presentItem)` })), { event: shelf, role: "구슬 진열대" }, { event: tablet, role: `단서 석판(단서 ${clues.length}개)` }],
      revealCommandCount: b.gateCmds.length,
      solveSteps: [`단서: ${clues.map((c) => c.text).join(" / ")}`, `정답: ${answer.map((o, p) => `${PEDESTAL_NAMES[p]}=${ORB_NAMES[o]}`).join(", ")}`, "네 개를 다 놓았는데 틀리면 모두 튀어 돌아온다"],
      model,
      toPlaytest: (solution) => {
        const p = planFrom(b).actOn({ x: 3, y: 12 }).actOn({ x: 10, y: 11 });
        for (const label of solution) {
          const [, ped, orb] = label.split(":");
          p.actOn(PEDESTAL_CELLS[Number(ped)]!, { present: [orbItems[Number(orb)]!] });
        }
        return finish(p.done());
      },
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 4. 두 저수조 (sluice_lava_bridge) — 3칸·5칸 수조로 정확히 4칸을 맞춘다(물통 붓기)
// ---------------------------------------------------------------------------

export const twinCisterns: MechanicDef = {
  build(ctx) {
    const capA = 3;
    const capB = 5;
    const target = 4;
    // 수위 눈금: 수조 옆 항아리 줄(아래부터 채워진다).
    const gaugeA: Cell[] = Array.from({ length: capA }, (_, k) => ({ x: 5, y: 12 - k }));
    const gaugeB: Cell[] = Array.from({ length: capB }, (_, k) => ({ x: 14, y: 12 - k }));
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 2,
      right: 2,
      floor: "wetstone",
      wall: "stone",
      ceiling: "dark",
      zones: [
        { x0: 4, y0: 8, x1: 6, y1: 13, floor: "grate" },
        { x0: 13, y0: 7, x1: 15, y1: 13, floor: "grate" },
      ],
      objects: [obj("wall torch", 6, 3), obj("wall torch", 13, 3), obj("drain grate", 10, 7), obj("hint tablet", 10, 9), obj("water trough", 9, 5)],
      props: {
        gate: GATE,
        ...Object.fromEntries(gaugeA.map((c, k) => [`a_${k}`, [{ objects: [obj("pot", c.x, c.y)] }, { objects: [obj("water jar", c.x, c.y)] }]])),
        ...Object.fromEntries(gaugeB.map((c, k) => [`b_${k}`, [{ objects: [obj("pot", c.x, c.y)] }, { objects: [obj("water jar", c.x, c.y)] }]])),
      },
    };
    const valveA: Cell = { x: 7, y: 9 };
    const valveB: Cell = { x: 12, y: 9 };
    const b = buildRoom(ctx, spec, "sluice_lava_bridge", [...gaugeA, ...gaugeB, valveA, valveB, { x: 10, y: 9 }]);
    const vA = ctx.v("cistern_a", "작은 수조(3) 수위");
    const vB = ctx.v("cistern_b", "큰 수조(5) 수위");
    const vT = ctx.v("cistern_tmp", "붓기 계산용");
    const redraw = (v: string, prefix: string, cap: number): Command[] =>
      Array.from({ length: cap }, (_, k) => ifVar(v, ">=", k + 1, b.room.set(`${prefix}_${k}`, 1), b.room.set(`${prefix}_${k}`, 0)));
    const redrawAll: Command[] = [...redraw(vA, "a", capA), ...redraw(vB, "b", capB), se("wave1")];
    const check = ifVar(vB, "==", target, [...finale(ctx, b, `큰 수조가 정확히 ${target}칸에서 멈추자 부표가 떠올라 창살 사슬을 당긴다!`, waterTheme)]);
    // pour X→Y: t = min(X, capY - Y); X -= t; Y += t
    const pour = (from: string, to: string, capTo: number): Command[] => [
      setVar(vT, capTo),
      { kind: "setVariable", variableId: vT, op: "-=", value: { kind: "var", id: to } },
      ifVar(vT, ">", 0, [
        // t = min(from, cap-to): 비교를 변수끼리 할 수 없어 from 값마다 분기한다.
        ...Array.from({ length: 6 }, (_, n) =>
          ifVar(from, "==", n, [ifVar(vT, ">", n, [setVar(vT, n)])]),
        ),
        { kind: "setVariable", variableId: from, op: "-=", value: { kind: "var", id: vT } },
        { kind: "setVariable", variableId: to, op: "+=", value: { kind: "var", id: vT } },
      ]),
    ];
    const valve = (self: string, other: string, capSelf: number, capOther: number, name: string, otherName: string): Command[] => [
      textCmd(`${name} 수조 밸브다. (지금 ${name} 수조와 ${otherName} 수조의 수위는 항아리 수로 보인다.)`),
      choices(undefined, [
        { text: `${name} 수조를 가득 채운다`, branch: [setVar(self, capSelf), ...redrawAll, particles("splash", 600, b.at({ x: 10, y: 5 })), check] },
        { text: `${name} 수조를 비운다`, branch: [setVar(self, 0), ...redrawAll, particles("splash", 600, b.at({ x: 10, y: 7 })), check] },
        { text: `${otherName} 수조로 붓는다`, branch: [...pour(self, other, capOther), ...redrawAll, check] },
        { text: "그만둔다", branch: [] },
      ]),
    ];
    const vaEvent = actEvent(ctx, b, "valve_a", "작은 수조 밸브(3)", valveA, valve(vA, vB, capA, capB, "작은", "큰"), "수문이 열린 뒤라 밸브는 잠겼다.");
    const vbEvent = actEvent(ctx, b, "valve_b", "큰 수조 밸브(5)", valveB, valve(vB, vA, capB, capA, "큰", "작은"), "수문이 열린 뒤라 밸브는 잠겼다.");
    const tablet = actEvent(ctx, b, "hint_tablet", "수문지기 석판", { x: 10, y: 9 }, [
      se("decision1"),
      textCmd(ctx.hint ?? `석판: 「큰 수조(항아리 5칸)에 물을 정확히 ${target}칸 담으면 부표가 창살을 연다. 작은 수조는 3칸. 눈금은 없다 — 채우고, 비우고, 서로 부어라.」`),
    ]);
    type S = readonly [number, number];
    const model: PuzzleModel<S> = {
      start: [0, 0],
      key: (s) => s.join(","),
      goal: (s) => s[1] === target,
      moves: ([a, bb]) => {
        const tAB = Math.min(a, capB - bb);
        const tBA = Math.min(bb, capA - a);
        return [
          ["A:0", [capA, bb]],
          ["A:1", [0, bb]],
          ["A:2", [a - tAB, bb + tAB]],
          ["B:0", [a, capB]],
          ["B:1", [a, 0]],
          ["B:2", [a + tBA, bb - tBA]],
        ] as const;
      },
    };
    const result: MechanicResult<S> = {
      room: b.room,
      origin: ORIGIN,
      events: [
        { event: vaEvent, role: "작은 수조 밸브(채움·비움·붓기)" },
        { event: vbEvent, role: "큰 수조 밸브(채움·비움·붓기)" },
        { event: tablet, role: "수문지기 석판(목표 수위)" },
      ],
      revealCommandCount: b.gateCmds.length,
      solveSteps: ["3칸·5칸 두 수조를 채우고·비우고·서로 부어 큰 수조를 정확히 4칸으로 맞춘다(최소 6번)", "수위는 수조 옆 항아리(빈 항아리 ↔ 물 항아리) 줄로 보인다"],
      model,
      toPlaytest: (solution) => {
        const p = planFrom(b).actOn({ x: 10, y: 9 });
        for (const label of solution) {
          const [which, opt] = label.split(":");
          p.actOn(which === "A" ? valveA : valveB, { choose: [Number(opt)] });
        }
        return finish(p.done());
      },
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 5. 저울 추 (balance_scale_weights) — 추 다섯 중 몇 개를 올려 목표 무게를 정확히
// ---------------------------------------------------------------------------

export const balanceScaleWeights: MechanicDef = {
  build(ctx) {
    const sets = [
      [2, 3, 5, 7, 11],
      [1, 4, 6, 9, 13],
      [3, 4, 8, 10, 15],
    ] as const;
    const weights = sets[ctx.seed % sets.length]!;
    const sums = new Map<number, number[]>();
    for (let m = 1; m < 32; m += 1) {
      const s = weights.reduce((acc, w, i) => acc + ((m >> i) & 1 ? w : 0), 0);
      sums.set(s, [...(sums.get(s) ?? []), m]);
    }
    const unique = [...sums.entries()].filter(([, ms]) => ms.length === 1 && ms[0]!.toString(2).replace(/0/g, "").length >= 3).map(([s]) => s).sort((a, c) => a - c);
    const target = unique[ctx.seed % unique.length]!;
    const answerMask = sums.get(target)![0]!;
    const stands: Cell[] = [5, 7, 9, 11, 13].map((x) => ({ x, y: 7 }));
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 2,
      right: 2,
      floor: "check",
      wall: "goldwood",
      ceiling: "wood",
      zones: [{ x0: 4, y0: 6, x1: 14, y1: 8, floor: "parquet" }],
      objects: [obj("wall torch", 5, 3), obj("wall torch", 14, 3), obj("balance scale", 9, 10), obj("apothecary drawers", 2, 5), obj("hint tablet", 11, 10)],
      props: {
        gate: GATE,
        ...Object.fromEntries(stands.map((c, i) => [`weight_${i}`, [{ objects: [obj("plinth helmet", c.x, c.y)] }, { objects: [obj("plinth", c.x, c.y)] }]])),
        pan: [{ objects: [] }, { objects: [obj("crystal ball", 8, 11)] }],
      },
    };
    const b = buildRoom(ctx, spec, "balance_scale_weights", [...stands, { x: 9, y: 10 }, { x: 11, y: 10 }]);
    const swOn = stands.map((_, i) => ctx.sw(`weight_${i}_on`, `${weights[i]}근 추 올림`));
    const vSum = ctx.v("scale_sum", "저울 위 무게");
    const standEvents = stands.map((c, i) =>
      actEvent(ctx, b, `weight_${i}`, `${weights[i]}근 추`, c, [
        ifSw(
          swOn[i]!,
          false,
          [setSw(swOn[i]!, true), setVar(vSum, weights[i]!, "+="), ...b.room.set(`weight_${i}`, 1), se("item1"), textCmd(`${weights[i]}근 추를 저울에 올렸다.`)],
          [setSw(swOn[i]!, false), setVar(vSum, weights[i]!, "-="), ...b.room.set(`weight_${i}`, 0), se("cancel1"), textCmd(`${weights[i]}근 추를 받침에 되돌렸다.`)],
        ),
      ]),
    );
    const scale = actEvent(
      ctx,
      b,
      "scale",
      "청동 저울",
      { x: 9, y: 10 },
      [ifVar(vSum, "==", target, [se("chime2"), ...b.room.set("pan", 1), ...finale(ctx, b, `저울이 ${target}근에서 정확히 수평을 이루자 창살이 올라간다!`, goldTheme)], wrongBuzz("저울이 한쪽으로 기운다. 무게가 맞지 않는다."))],
      "저울이 수평을 지키고 있다.",
    );
    const tablet = actEvent(ctx, b, "hint_tablet", "저울지기의 쪽지", { x: 11, y: 10 }, [se("decision1"), textCmd(ctx.hint ?? `쪽지: 「추 몇 개를 저울에 올려 정확히 ${target}근을 만들고 저울을 두드려라. 추는 ${weights.join("·")}근.」`)]);
    const model: PuzzleModel<{ m: number; ok: boolean }> = {
      start: { m: 0, ok: false },
      key: (s) => `${s.m}:${s.ok}`,
      goal: (s) => s.ok,
      moves: (s) => [...weights.map((_, i) => [`weight:${i}`, { m: s.m ^ (1 << i), ok: false }] as const), ["scale", { m: s.m, ok: s.m === answerMask }] as const],
    };
    const result: MechanicResult<{ m: number; ok: boolean }> = {
      room: b.room,
      origin: ORIGIN,
      events: [...standEvents.map((event, i) => ({ event, role: `${weights[i]}근 추` })), { event: scale, role: "청동 저울(판정)" }, { event: tablet, role: "저울지기의 쪽지(목표 무게)" }],
      revealCommandCount: b.gateCmds.length,
      solveSteps: [`추 ${weights.join("·")}근 중 몇 개로 정확히 ${target}근(조합은 하나뿐)`, `정답: ${weights.filter((_, i) => (answerMask >> i) & 1).join("+")}`],
      model,
      mistakeDemo: () => planFrom(b).actOn(stands[0]!).actOn({ x: 9, y: 10 }).push({ kind: "mark", label: "mistake", expectSolved: false }).actOn(stands[0]!).steps,
      toPlaytest: (solution) => {
        const p = planFrom(b).actOn({ x: 11, y: 10 });
        for (const label of solution) p.actOn(label === "scale" ? { x: 9, y: 10 } : stands[Number(label.split(":")[1])]!);
        return finish(p.done());
      },
    };
    return result as MechanicResult;
  },
};

// ---------------------------------------------------------------------------
// 6. 뒤집히는 바닥 (flip_floor_tiles) — 밟을 때마다 판이 뒤집힌다, 모두 푸르게
// ---------------------------------------------------------------------------

export const flipFloorTiles: MechanicDef = {
  build(ctx) {
    const W = 4;
    const H = 3;
    const OX = 8;
    const OY = 7;
    const tiles: Cell[] = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) tiles.push({ x: OX + x, y: OY + y });
    const entry: Cell = { x: OX + 1, y: OY + H }; // 남쪽 진입 칸
    const spec: PuzzleRoomSpec = {
      top: 3,
      left: 2,
      right: 2,
      floor: "dungeon",
      wall: "rune",
      ceiling: "dark",
      objects: [
        obj("wall torch", 5, 3),
        obj("wall torch", 14, 3),
        obj("hint tablet", 6, 11),
        ...[6, 13].flatMap((x) => [obj("column stone", x, 7), obj("column stone", x, 9)]),
        // 판 둘레를 울타리처럼 막아 진입 칸 하나로만 오르내린다.
        ...[7, 12].flatMap((x) => [obj("barrel", x, 7), obj("barrel", x, 8), obj("barrel", x, 9)]),
        ...[8, 9, 10, 11].map((x) => obj("crate", x, 6)),
        ...[8, 10, 11].map((x) => obj("crate", x, 10)),
      ],
      props: {
        gate: GATE,
        ...Object.fromEntries(tiles.map((c, i) => [`tile_${i}`, [{ zones: [{ x0: c.x, y0: c.y, x1: c.x, y1: c.y, floor: "terra" }] }, { zones: [{ x0: c.x, y0: c.y, x1: c.x, y1: c.y, floor: "elfstone" }] }]])),
      },
    };
    const b = buildRoom(ctx, spec, "flip_floor_tiles", [{ x: 6, y: 11 }]);
    const swFlip = tiles.map((_, i) => ctx.sw(`tile_${i}_blue`, `판 ${i + 1} 푸름`));
    const reset: Command[] = tiles.flatMap((_, i) => [setSw(swFlip[i]!, false), ...b.room.set(`tile_${i}`, 0)]);
    const allBlue = (onTrue: readonly Command[]): Command[] => swFlip.reduceRight<Command[]>((inner, sw) => [ifSw(sw, true, inner)], [...onTrue]);
    const tileEvents = tiles.map((c, i) => {
      const id = ctx.evId(`tile_${i}`);
      return puzzleEvent(id, `뒤집히는 판 ${i + 1}`, b.at(c), [
        makePage({
          id: `${id}_live`,
          name: "뒤집히는 판",
          trigger: "playerTouch",
          priority: "below",
          graphic: TRANSPARENT,
          commands: [
            ifSw(swFlip[i]!, false, [setSw(swFlip[i]!, true), ...b.room.set(`tile_${i}`, 1), se("cursor2")], [setSw(swFlip[i]!, false), ...b.room.set(`tile_${i}`, 0), se("cancel2")]),
            particles("magic", 300, b.at(c)),
            ...allBlue(finale(ctx, b, "열두 판이 모두 푸르게 물들자 창살이 올라간다!", blueTheme)),
          ],
        }),
        makePage({ id: `${id}_done`, name: "판(해결 뒤)", conditions: solvedCond(ctx), priority: "below", graphic: TRANSPARENT, commands: [] }),
      ]);
    });
    const tablet = actEvent(ctx, b, "hint_tablet", "룬 석판", { x: 6, y: 11 }, [
      se("decision1"),
      textCmd(ctx.hint ?? "석판: 「붉은 판은 밟으면 푸르게, 푸른 판은 밟으면 붉게 뒤집힌다. 열두 판을 모두 푸르게 하라. 판 위에서는 되돌아 밟아도 뒤집힌다.」"),
      choices("판을 처음으로 되돌릴까?", [
        { text: "되돌린다", branch: [...reset, se("teleport2")] },
        { text: "그대로 둔다", branch: [] },
      ]),
    ]);
    // 모형: (판 위 위치 또는 진입 칸, 푸른 판 비트) — 판에서 판으로 한 칸 걸음마다 그 판을 뒤집는다.
    const idxOf = (x: number, y: number): number => (x >= OX && x < OX + W && y >= OY && y < OY + H ? (y - OY) * W + (x - OX) : -1);
    const full = (1 << tiles.length) - 1;
    const model: PuzzleModel<{ p: number; m: number }> = {
      start: { p: -1, m: 0 },
      key: (s) => `${s.p}:${s.m}`,
      goal: (s) => s.m === full,
      moves: (s) => {
        const here = s.p < 0 ? entry : tiles[s.p]!;
        const out: Array<readonly [string, { p: number; m: number }]> = [];
        for (const [mv, d] of Object.entries(DIR_OF)) {
          const nx = here.x + d.dx;
          const ny = here.y + d.dy;
          if (nx === entry.x && ny === entry.y) {
            out.push([mv, { p: -1, m: s.m }]);
            continue;
          }
          const k = idxOf(nx, ny);
          if (k < 0) continue;
          out.push([mv, { p: k, m: s.m ^ (1 << k) }]);
        }
        return out;
      },
    };
    const result: MechanicResult<{ p: number; m: number }> = {
      room: b.room,
      origin: ORIGIN,
      events: [...tileEvents.map((event, i) => ({ event, role: `뒤집히는 판 ${i + 1}` })), { event: tablet, role: "룬 석판(규칙·되돌리기)" }],
      revealCommandCount: b.gateCmds.length,
      solveSteps: ["4×3 판 위를 걸으며 밟는 판마다 붉음↔푸름이 뒤집힌다", "열두 판을 모두 푸르게 만드는 걸음 순서를 찾는다(같은 판을 두 번 밟으면 도로 붉어진다)", "막히면 룬 석판에서 처음으로"],
      model,
      mistakeDemo: () => [
        ...new PlayPlanner(b.walk, ORIGIN).stepOn(entry).steps,
        { kind: "walk", moves: "UD" },
        { kind: "mark", label: "mistake", expectSolved: false },
        ...new PlayPlanner(b.walk, entry).actOn({ x: 6, y: 11 }, { choose: [0] }).steps,
        { kind: "mark", label: "reset", expectSolved: false },
      ],
      toPlaytest: (solution) => finish([...new PlayPlanner(b.walk, ORIGIN).stepOn(entry).steps, { kind: "walk", moves: solution.join("") }, { kind: "wait", ms: 600 }, { kind: "mark", label: "solved", expectSolved: true }]),
    };
    return result as MechanicResult;
  },
};
