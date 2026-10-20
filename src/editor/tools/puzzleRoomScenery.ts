// src/editor/tools/puzzleRoomScenery.ts
// author_map_puzzle 의 6대 무대 프리셋을 손 도트 v5 실내 칩셋(atlas_biome_interior) 한 벌로 20×15 화면 전체에 짓는다.
// 예전에는 맵이 무엇이든 그 위에 5×5 남짓한 판을 덧찍어 설원 마을 한가운데 갱도가, 하늘섬 잔디 위에 흰 대리석 칸이 떴다
// (2026-10-18 사용자 「타일세트를 좀 제대로 깔아라. 지금처럼 아무거나 깔지 말고」). 이제 방 하나를 바닥·벽면·천장·가구까지
// 한 칩셋 문법(buildHandInteriorLayers)으로 지어 붙이고, 퍼즐 전/중/후 상태도 같은 방을 다시 지어 바뀐 칸만 changeTile 로 낸다.

import {
  buildHandInteriorLayers,
  HAND_INTERIOR_SPEC,
  HAND_INTERIOR_TILESET_ID,
  type HandInteriorInput,
  type HandInteriorLine,
  type HandInteriorObject,
  type HandInteriorZone,
} from "@/editor/handInterior/builder";
import { changeTileProblems } from "@/project/changeTileValidation";
import type { Command, GameMap, Project } from "@/project/types";
import type { Cell } from "./jrpgVolumeTools";
import type { PuzzlePresetId } from "./puzzleAuthoringTools";

/** 플레이어 카메라 한 화면(16px × 20×15). 방은 이 창을 꽉 채운다. */
export const PUZZLE_ROOM_W = 20;
export const PUZZLE_ROOM_H = 15;

export type PuzzleRoomPresetId =
  | "cathedral_organ_tuning"
  | "brazier_ignition_order"
  | "statue_pressure_plates"
  | "dynamite_rock_blast"
  | "riddle_mimic_chests"
  | "boss_seal_monoliths"
  | "rolling_boulder_chasm"
  | "mirror_beam_refraction"
  | "minecart_track_switch"
  | "elemental_pedestal_swap";

const ROOM_PRESETS: Record<string, true> = {
  cathedral_organ_tuning: true,
  brazier_ignition_order: true,
  statue_pressure_plates: true,
  dynamite_rock_blast: true,
  riddle_mimic_chests: true,
  boss_seal_monoliths: true,
  rolling_boulder_chasm: true,
  mirror_beam_refraction: true,
  minecart_track_switch: true,
  elemental_pedestal_swap: true,
};

export function isPuzzleRoomPreset(presetId: PuzzlePresetId): presetId is PuzzleRoomPresetId {
  return ROOM_PRESETS[presetId] === true;
}

export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** 한 상태의 방 설계. plan 은 20×15 문자열, chasm 은 바닥을 지우고 심연(빈 칸)으로 둘 칸. */
export interface RoomState {
  readonly input: HandInteriorInput;
  readonly chasm?: readonly Rect[];
  /** 심연 위에 얹는 밟는 기물(무너지는 판자 등, 사양 kind flat) — 심연을 판 뒤 2층에 쓴다. */
  readonly overlays?: readonly HandInteriorObject[];
}

interface RoomDesign {
  readonly states: {
    readonly before: RoomState;
    readonly after: RoomState;
    /** 단계 효과(점화·발판·비석) — 키는 puzzleAuthoringTools 의 stepChangeTileCommands 키. */
    readonly steps?: Readonly<Record<string, RoomState>>;
  };
  /** 단계 효과를 모두 되돌리는 키(화로 순서 오답 리셋). */
  readonly resetKey?: string;
  /** puzzleAuthoringTools 가 읽는 칸 순서(프리셋마다 다름). 방 기준 좌표. */
  readonly cells: readonly Cell[];
  readonly origin: Cell;
  /** 해결 뒤 나타나는 보상(보물상자·성유물) 자리 — 빈 바닥 칸. */
  readonly reward: Cell;
}

export interface Layers {
  readonly lower: number[];
  readonly lower2: number[];
  readonly upper: number[];
  readonly upper2: number[];
}

export const LAYER_KEYS = ["lower", "lower2", "upper", "upper2"] as const;

/**
 * 20×15 평면. top = 북쪽 벽 두께(천장 줄 수, 그 아래 두 줄이 벽면), left/right = 옆벽 두께.
 * 남쪽 벽 가운데에 출입구 틈을 둔다(맵이 더 크면 바깥과 이어지고, 딱 20×15 면 화면 아래로 나가는 문이 된다).
 */
export function roomPlan(opts: {
  readonly top: number;
  readonly left?: number;
  readonly right?: number;
  readonly door: readonly number[];
  readonly open?: readonly Rect[];
}): string[] {
  const left = opts.left ?? 1;
  const right = opts.right ?? 1;
  const rows: string[] = [];
  for (let y = 0; y < PUZZLE_ROOM_H; y += 1) {
    let row = "";
    for (let x = 0; x < PUZZLE_ROOM_W; x += 1) {
      let floor = y >= opts.top && y < PUZZLE_ROOM_H - 1 && x >= left && x < PUZZLE_ROOM_W - right;
      if (y === PUZZLE_ROOM_H - 1 && opts.door.includes(x)) floor = true;
      if (opts.open?.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)) floor = true;
      row += floor ? "." : "#";
    }
    rows.push(row);
  }
  return rows;
}

const obj = (id: string, x: number, y: number): HandInteriorObject => ({ id, x, y });
const rectLine = (id: string, x0: number, y0: number, x1: number, y1: number): HandInteriorLine => ({ id, rect: { x0, y0, x1, y1 } });

// ---------------------------------------------------------------------------
// 1. 대성당 파이프 오르간 — 회색 판석 바닥, 북벽 스테인드글라스, 좌우 신도석, 붉은 중앙 통로 카펫, 오르간 오른쪽 숨은 지하 계단.
// ---------------------------------------------------------------------------
function cathedralDesign(): RoomDesign {
  const door = [9, 10];
  const common = (solved: boolean): HandInteriorObject[] => [
    obj("pipe organ", 9, 3),
    obj("candelabra", 7, 3),
    obj("candelabra", 12, 3),
    obj("candelabra", 2, 3),
    obj("music stand", 5, 4),
    obj("tall stained window", 3, 1),
    obj("tall stained window", 6, 1),
    obj("stained glass", 12, 1),
    obj("tall stained window", 16, 1),
    ...[7, 9, 11].flatMap((y) => [obj("pew", 3, y), obj("pew", 6, y), obj("pew", 12, y), obj("pew", 15, y)]),
    obj("holy water font", 2, 12),
    obj("holy water font", 17, 12),
    obj("candelabra", 17, 3),
    ...(solved ? [obj("stairwell down", 14, 3)] : [obj("statue", 15, 3)]),
  ];
  const state = (solved: boolean): RoomState => ({
    input: {
      plan: roomPlan({ top: 1, door }),
      floor: "flag",
      wall: "stone",
      ceiling: "dark",
      objects: [...common(solved), obj("wall sconce", 14, 1)],
      lines: [rectLine(solved ? "rug royal" : "rug red", 9, 4, 10, 14)],
      start: [{ x: 9, y: 14 }],
    },
  });
  return {
    states: { before: state(false), after: state(true) },
    // cOrgan, cScore, cStair
    cells: [
      { x: 9, y: 3 },
      { x: 5, y: 4 },
      { x: 15, y: 4 },
    ],
    origin: { x: 9, y: 13 },
    reward: { x: 17, y: 5 },
  };
}

// ---------------------------------------------------------------------------
// 2. 화산 화염 성소 — 그을린 돌바닥, 바위 벽, 좌우 용암 화덕 수로, 받침 위 세 화로, 북쪽 봉인 창살문 → 돌계단 회랑.
// ---------------------------------------------------------------------------
function brazierDesign(): RoomDesign {
  const door = [10];
  const braziers: readonly Cell[] = [
    { x: 5, y: 9 },
    { x: 15, y: 9 },
    { x: 10, y: 11 },
  ];
  const state = (lit: number, solved: boolean): RoomState => ({
    input: {
      plan: roomPlan({ top: 3, left: 2, door, ...(solved ? { open: [{ x0: 9, y0: 1, x1: 11, y1: 2 }] } : {}) }),
      floor: "dungeon",
      wall: "rock",
      ceiling: "rock",
      zones: [
        { x0: 2, y0: 0, x1: 3, y1: 14, floor: "soot" },
        { x0: 17, y0: 0, x1: 18, y1: 14, floor: "soot" },
        { x0: 8, y0: 0, x1: 12, y1: 14, floor: "soot" },
      ] satisfies HandInteriorZone[],
      objects: [
        obj("long hearth 6", 2, 6),
        obj("long hearth 6", 18, 6),
        obj("lava brazier", 7, 5),
        obj("lava brazier", 13, 5),
        obj("wall torch", 4, 3),
        obj("wall torch", 16, 3),
        obj("skull pile", 3, 13),
        obj("skull pile", 17, 13),
        ...braziers.map((b, i) => obj(i < lit ? "brazier" : "cauldron", b.x, b.y)),
        ...(solved ? [obj("stairs up stone", 9, 3)] : [obj("portcullis", 9, 3), obj("portcullis", 10, 3), obj("summoning circle", 9, 5)]),
      ],
      daises: braziers.map((b) => ({ id: "dais stone", x: b.x, y: b.y, w: 1, h: 1 })),
      start: [{ x: 10, y: 14 }],
    },
  });
  return {
    states: {
      before: state(0, false),
      after: state(3, true),
      steps: { brazier_1: state(1, false), brazier_2: state(2, false), brazier_3: state(3, false) },
    },
    resetKey: "brazier_reset",
    // cB1, cB2, cB3, cSeal
    cells: [...braziers, { x: 10, y: 4 }],
    origin: { x: 10, y: 13 },
    reward: { x: 13, y: 12 },
  };
}

// ---------------------------------------------------------------------------
// 3. 지하 심연 석실 — 가로로 갈라진 심연, 남북 둑의 어두운 던전 바닥, 남쪽 둑 압력판, 해결 시 3칸 폭 돌다리 + 북벽 돌계단.
// ---------------------------------------------------------------------------
function platesDesign(): RoomDesign {
  const door = [10];
  const chasm: Rect = { x0: 2, y0: 6, x1: 18, y1: 8 };
  const bridge: Rect = { x0: 9, y0: 6, x1: 11, y1: 8 };
  const state = (pressed: number, solved: boolean): RoomState => ({
    input: {
      plan: roomPlan({ top: 1, left: 2, door }),
      floor: "cobble",
      wall: "dungeonw",
      ceiling: "dark",
      zones: [{ ...bridge, floor: "dplank" }],
      objects: [
        obj("statue", 4, 4),
        obj("statue", 16, 4),
        obj("column stone", 6, 3),
        obj("column stone", 14, 3),
        obj("wall torch", 4, 1),
        obj("wall torch", 16, 1),
        obj(pressed >= 1 ? "pressure plate down" : "pressure plate", 5, 11),
        obj(pressed >= 2 ? "pressure plate down" : "pressure plate", 15, 11),
        obj(solved ? "iron gate open" : "iron gate", 9, 9),
        obj(solved ? "iron gate open" : "iron gate", 10, 9),
        obj(solved ? "iron gate open" : "iron gate", 11, 9),
        obj("column stone", 3, 10),
        obj("column stone", 17, 10),
        obj("skull pile", 3, 13),
        obj("stone sphere", 17, 13),
        ...(solved ? [obj("stairs up stone", 9, 3)] : [obj("cracked wall", 10, 1)]),
      ],
      start: [{ x: 10, y: 14 }],
    },
    chasm: solved ? [{ ...chasm, x1: bridge.x0 - 1 }, { ...chasm, x0: bridge.x1 + 1 }] : [chasm],
  });
  return {
    states: { before: state(0, false), after: state(2, true), steps: { plate_1: state(1, false) } },
    // cP1, cP2, cGate
    cells: [
      { x: 5, y: 11 },
      { x: 15, y: 11 },
      { x: 10, y: 9 },
    ],
    origin: { x: 10, y: 13 },
    reward: { x: 13, y: 12 },
  };
}

// ---------------------------------------------------------------------------
// 4. 지하 광산 갱도 — 흙바닥, 갱도 벽(버팀목), 남북 광차 선로, 북쪽 갱도를 막은 낙석 더미 → 폭파 후 열린 갱도와 광석 결정.
// ---------------------------------------------------------------------------
function dynamiteDesign(): RoomDesign {
  const door = [10];
  const rubble: readonly Cell[] = [
    { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }, { x: 11, y: 5 }, { x: 12, y: 5 },
    { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 },
  ];
  const state = (blasted: boolean): RoomState => ({
    input: {
      plan: roomPlan({ top: 3, left: 2, door, ...(blasted ? { open: [{ x0: 9, y0: 1, x1: 11, y1: 2 }] } : {}) }),
      floor: "earth",
      wall: "mine",
      ceiling: "rock",
      objects: [
        obj("timber prop", 3, 5),
        obj("timber prop", 17, 5),
        obj("timber prop", 3, 10),
        obj("timber prop", 17, 10),
        obj("ore vein", 5, 3),
        obj("pick rack", 7, 3),
        obj("ore vein", 15, 3),
        obj("wall torch", 13, 3),
        obj("powder kegs", 4, 12),
        obj("powder keg", 5, 12),
        obj("mine cart", 10, 12),
        obj("rope coil", 16, 12),
        obj("firewood bundle", 15, 7),
        ...(blasted
          ? [obj("ore pile", 6, 5), obj("ore pile", 13, 5), obj("mine cart", 10, 3)]
          : [...rubble.map((c) => obj("push boulder", c.x, c.y)), obj("cracked wall", 10, 3)]),
      ],
      lines: [{ id: "rail", cells: Array.from({ length: blasted ? 12 : 8 }, (_, i) => ({ x: 10, y: 14 - i })).filter((c) => blasted || c.y >= 7) }],
      start: [{ x: 10, y: 14 }],
    },
  });
  return {
    states: { before: state(false), after: state(true) },
    // cSupply, cBoulder
    cells: [
      { x: 15, y: 11 },
      { x: 10, y: 6 },
    ],
    origin: { x: 10, y: 13 },
    reward: { x: 13, y: 8 },
  };
}

// ---------------------------------------------------------------------------
// 5. 고대 신전 수수께끼 전당 — 사암 판석 바닥, 고대 석벽, 좌우 대칭 수호 석상·기둥·화로, 가운데 수수께끼 석판,
//    해결 시 북벽을 막던 봉인 석벽이 걷히며 지하 돌계단이 드러난다.
// ---------------------------------------------------------------------------
function riddleDesign(): RoomDesign {
  const door = [10];
  const state = (solved: boolean): RoomState => ({
    input: {
      plan: roomPlan({ top: 1, left: 2, door }),
      floor: "sandstone",
      wall: "stone",
      ceiling: "dark",
      objects: [
        obj("demon statue", 4, 4),
        obj("demon statue", 16, 4),
        obj("column stone", 3, 7),
        obj("column stone", 17, 7),
        obj("brazier", 6, 3),
        obj("brazier", 14, 3),
        obj("hint tablet", 10, 7),
        obj("statue", 4, 11),
        obj("statue", 16, 11),
        obj("wall torch", 4, 1),
        obj("wall torch", 16, 1),
        ...(solved ? [obj("stairwell down", 9, 3), obj("brazier", 8, 5), obj("brazier", 12, 5)] : [obj("seal stone", 10, 5)]),
      ],
      lines: [rectLine("rug brown", 10, 8, 10, 14)],
      start: [{ x: 10, y: 14 }],
    },
  });
  return {
    states: { before: state(false), after: state(true) },
    // cTablet, cDecoy1, cDecoy2, cTrue
    cells: [
      { x: 10, y: 7 },
      { x: 6, y: 10 },
      { x: 14, y: 10 },
      { x: 10, y: 10 },
    ],
    origin: { x: 10, y: 13 },
    reward: { x: 14, y: 7 },
  };
}

// ---------------------------------------------------------------------------
// 6. 마왕 보스 전실 — 어두운 석판 바닥, 룬 석벽, 보라 융단과 소환진, 좌·우·북 세 봉인 비석, 결계 창살 → 열린 보스 성역 회랑.
// ---------------------------------------------------------------------------
function monolithDesign(): RoomDesign {
  const door = [10];
  const monoliths: readonly Cell[] = [
    { x: 5, y: 9 },
    { x: 15, y: 9 },
    { x: 10, y: 6 },
  ];
  const state = (awake: readonly boolean[], solved: boolean): RoomState => ({
    input: {
      plan: roomPlan({ top: 3, left: 2, door, ...(solved ? { open: [{ x0: 9, y0: 1, x1: 11, y1: 2 }] } : {}) }),
      floor: "soot",
      wall: "rune",
      ceiling: "dark",
      objects: [
        ...monoliths.map((m, i) => obj(awake[i] ? "rune stone" : "seal stone", m.x, m.y)),
        obj("demon statue", 4, 5),
        obj("demon statue", 16, 5),
        obj("bone pillar", 3, 11),
        obj("bone pillar", 17, 11),
        obj("lava brazier", 7, 5),
        obj("lava brazier", 13, 5),
        obj("royal banner", 5, 3),
        obj("royal banner", 15, 3),
        ...(solved
          ? [obj("stairs up stone", 9, 3), obj("magic circle", 9, 8)]
          : [obj("portcullis", 9, 3), obj("portcullis", 10, 3), obj("summoning circle", 9, 8)]),
      ],
      lines: [rectLine("rug purple", 9, 11, 11, 13), rectLine("rug purple", 10, 14, 10, 14)],
      start: [{ x: 10, y: 14 }],
    },
  });
  const none = [false, false, false];
  return {
    states: {
      before: state(none, false),
      after: state([true, true, true], true),
      steps: {
        monolith_1: state([true, false, false], false),
        monolith_2: state([false, true, false], false),
        monolith_3: state([false, false, true], false),
      },
    },
    // cM1, cM2, cM3, cBossGate
    cells: [...monoliths, { x: 10, y: 4 }],
    origin: { x: 10, y: 13 },
    reward: { x: 13, y: 11 },
  };
}

// ---------------------------------------------------------------------------
// 7. 거대 바위 굴리기·구렁 메우기 (rolling_boulder_chasm) — 산악 유적 바위 경사로(북→남 슈트)와 심연 구렁.
//    서쪽 회랑을 따라 북쪽 고패 윈치(6,4)와 바위 멈춤쇠(8,4)를 풀면, 상단 3열 바위가 5단계(y=4→5→6→7→8→9)로
//    회전·교차하며 굴러 내려와 심연 구렁(y=8..9)을 메우고 3×2 돌다리와 동북쪽 성소 돌계단을 연다.
// ---------------------------------------------------------------------------
function boulderDesign(): RoomDesign {
  const door = [10];
  // step: 0 = 상단 대기, 1..5 = 경사로 굴러 내려오는 5단계 궤적, 6 = 구렁 착지·돌다리 완성
  const state = (winchReleased: boolean, step: 0 | 1 | 2 | 3 | 4 | 5 | 6): RoomState => {
    const solved = step === 6;
    const boulderObjs: HandInteriorObject[] =
      step === 0
        ? [obj("push boulder", 9, 4), obj("push boulder", 10, 4), obj("push boulder", 11, 4)]
        : step === 1
          ? [
              obj("push boulder", 9, 5),
              obj("push boulder", 10, 5),
              obj("push boulder", 11, 4),
              obj("drip puddle", 9, 4),
            ]
          : step === 2
            ? [
                obj("push boulder", 9, 5),
                obj("push boulder", 10, 6),
                obj("push boulder", 11, 6),
                obj("drip puddle", 9, 4),
                obj("drip puddle", 11, 5),
              ]
            : step === 3
              ? [
                  obj("push boulder", 9, 7),
                  obj("push boulder", 10, 7),
                  obj("push boulder", 11, 6),
                  obj("drip puddle", 9, 5),
                  obj("drip puddle", 11, 5),
                ]
              : step === 4
                ? [
                    obj("push boulder", 9, 7),
                    obj("push boulder", 10, 8),
                    obj("push boulder", 11, 8),
                    obj("drip puddle", 9, 6),
                    obj("drip puddle", 11, 7),
                  ]
                : step === 5
                  ? [
                      obj("push boulder", 9, 9),
                      obj("push boulder", 10, 9),
                      obj("push boulder", 11, 8),
                      obj("drip puddle", 9, 7),
                      obj("drip puddle", 11, 7),
                    ]
                  : [
                      obj("push boulder", 8, 8),
                      obj("push boulder", 12, 8),
                      obj("stairs up stone", 15, 3),
                    ];

    const chasmRects: readonly Rect[] =
      step < 4
        ? [{ x0: 6, y0: 8, x1: 18, y1: 9 }]
        : step === 4
          ? [
              { x0: 6, y0: 8, x1: 8, y1: 8 },
              { x0: 12, y0: 8, x1: 18, y1: 8 },
              { x0: 6, y0: 9, x1: 18, y1: 9 },
            ]
          : step === 5
            ? [
                { x0: 6, y0: 8, x1: 8, y1: 9 },
                { x0: 12, y0: 8, x1: 18, y1: 9 },
              ]
            : [
                { x0: 6, y0: 8, x1: 7, y1: 9 },
                { x0: 8, y0: 9, x1: 8, y1: 9 },
                { x0: 12, y0: 9, x1: 12, y1: 9 },
                { x0: 13, y0: 8, x1: 18, y1: 9 },
              ];

    const railMaxY = step >= 5 ? 9 : step === 4 ? 8 : 7;
    return {
      input: {
        plan: roomPlan({ top: 1, left: 2, door }),
        floor: "cobble",
        wall: "rock",
        ceiling: "rock",
        zones: [
          { x0: 2, y0: 3, x1: 5, y1: 13, floor: "dungeon" },
          { x0: 9, y0: 4, x1: 11, y1: 10, floor: "dplank" },
          ...(step >= 1
            ? [{ x0: 9, y0: 4, x1: 11, y1: Math.min(7, 3 + step), floor: "soot" } satisfies HandInteriorZone]
            : []),
        ],
        objects: [
          obj("wall torch", 4, 1),
          obj(winchReleased ? "wall lever on" : "wall lever", 7, 1),
          obj("wall torch", 12, 1),
          obj("wall torch", 18, 1),
          obj("column stone", 3, 4),
          obj("column stone", 3, 9),
          obj("rope coil", 5, 3),
          obj("gate winch", 6, 4),
          obj(winchReleased ? "pressure plate down" : "pressure plate", 8, 4),
          obj("column stone", 13, 4),
          obj(solved ? "iron gate open" : "iron gate", 13, 5),
          obj("column stone", 13, 7),
          obj("brazier", 14, 4),
          obj("statue", 17, 5),
          obj(solved ? "iron gate open" : "iron gate", 9, 10),
          obj(solved ? "iron gate open" : "iron gate", 10, 10),
          obj(solved ? "iron gate open" : "iron gate", 11, 10),
          obj("column stone", 6, 10),
          obj("column stone", 14, 10),
          obj("skull pile", 3, 13),
          obj("stone sphere", 17, 13),
          ...boulderObjs,
          ...(solved ? [] : [obj("cracked wall", 15, 1)]),
        ],
        lines: [
          {
            id: "rail",
            cells: Array.from({ length: railMaxY - 3 }, (_, i) => ({ x: 10, y: 4 + i })),
          },
        ],
        start: [{ x: 10, y: 14 }],
      },
      chasm: chasmRects,
    };
  };

  return {
    states: {
      before: state(false, 0),
      after: state(true, 6),
      steps: {
        boulder_winch: state(true, 0),
        boulder_step_1: state(true, 1),
        boulder_step_2: state(true, 2),
        boulder_step_3: state(true, 3),
        boulder_step_4: state(true, 4),
        boulder_step_5: state(true, 5),
      },
    },
    // cWinch, cStopper, cChasmGate
    cells: [
      { x: 6, y: 4 },
      { x: 8, y: 4 },
      { x: 10, y: 10 },
    ],
    origin: { x: 10, y: 13 },
    reward: { x: 14, y: 12 },
  };
}

// ---------------------------------------------------------------------------
// 8. 고대 거울 빛줄기 굴절 퍼즐 (mirror_beam_refraction) — 대리석 태양 성소, 서·동 굴절 거울 기둥, 황금 빛줄기 궤적.
// ---------------------------------------------------------------------------
function mirrorDesign(): RoomDesign {
  const door = [10];
  const state = (step: 0 | 1 | 2, solved: boolean): RoomState => ({
    input: {
      plan: roomPlan({ top: 3, left: 2, door, ...(solved ? { open: [{ x0: 9, y0: 1, x1: 11, y1: 2 }] } : {}) }),
      floor: "marble",
      wall: "marblewall",
      ceiling: "gold",
      objects: [
        obj("tall stained window", 4, 3),
        obj("tall stained window", 15, 3),
        obj("column marble", 3, 6),
        obj("column marble", 17, 6),
        obj("column marble", 3, 11),
        obj("column marble", 17, 11),
        obj("candelabra", 6, 5),
        obj("candelabra", 14, 5),
        obj("skylight light", 5, 9),
        obj(step >= 1 ? "mana crystal" : "tailor mirror", 6, 10),
        obj(step >= 2 ? "mana crystal" : "tailor mirror", 14, 10),
        ...(step >= 1 ? [obj("footlights", 9, 10), obj("footlights", 12, 10)] : []),
        ...(step >= 2 ? [obj("footlights", 14, 8), obj("crystal switch", 14, 6)] : [obj("plinth", 14, 6)]),
        ...(solved
          ? [obj("stairs up stone", 9, 3), obj("magic circle", 9, 6), obj("save crystal", 10, 8)]
          : [obj("portcullis", 9, 3), obj("portcullis", 10, 3), obj("dark orb pedestal", 10, 6)]),
      ],
      lines: [
        ...(step >= 1 ? [rectLine("rug royal", 6, 10, 14, 10)] : []),
        ...(step >= 2 ? [rectLine("rug royal", 14, 6, 14, 10), rectLine("rug royal", 10, 6, 14, 6)] : []),
        ...(solved ? [rectLine("rug royal", 9, 5, 11, 10)] : []),
      ],
      start: [{ x: 10, y: 14 }],
    },
  });
  return {
    states: {
      before: state(0, false),
      after: state(2, true),
      steps: {
        mirror_1: state(1, false),
        mirror_2: state(2, false),
      },
    },
    // cMirror1, cMirror2, cSeal
    cells: [
      { x: 6, y: 10 },
      { x: 14, y: 10 },
      { x: 10, y: 6 },
    ],
    origin: { x: 10, y: 13 },
    reward: { x: 16, y: 12 },
  };
}

// ---------------------------------------------------------------------------
// 9. 광산 선로 전환기 & 광차 충돌 퍼즐 (minecart_track_switch) — 분기 선로 전환 + 광차 질주 4단계 + 바리케이드 파쇄.
// ---------------------------------------------------------------------------
function minecartDesign(): RoomDesign {
  const door = [10];
  const state = (switched: boolean, cartStep: 0 | 1 | 2 | 3 | 4, solved: boolean): RoomState => {
    const cartPos: Cell =
      solved
        ? { x: 10, y: 3 }
        : cartStep === 0
          ? { x: 6, y: 11 }
          : cartStep === 1
            ? { x: 6, y: 9 }
            : cartStep === 2
              ? { x: 6, y: 7 }
              : cartStep === 3
                ? { x: 10, y: 7 }
                : { x: 10, y: 6 };
    const railCells: Cell[] = [
      { x: 6, y: 12 },
      { x: 6, y: 11 },
      { x: 6, y: 10 },
      { x: 6, y: 9 },
      { x: 6, y: 8 },
      { x: 6, y: 7 },
      ...(switched
        ? [
            { x: 7, y: 7 },
            { x: 8, y: 7 },
            { x: 9, y: 7 },
            { x: 10, y: 7 },
            { x: 10, y: 6 },
            ...(solved ? [{ x: 10, y: 5 }, { x: 10, y: 4 }, { x: 10, y: 3 }] : []),
          ]
        : [
            { x: 5, y: 7 },
            { x: 4, y: 7 },
          ]),
    ];
    return {
      input: {
        plan: roomPlan({ top: 3, left: 2, door, ...(solved ? { open: [{ x0: 9, y0: 1, x1: 11, y1: 2 }] } : {}) }),
        floor: "earth",
        wall: "mine",
        ceiling: "rock",
        objects: [
          obj("timber prop", 3, 5),
          obj("timber prop", 17, 5),
          obj("timber prop", 3, 11),
          obj("timber prop", 17, 11),
          obj("ore vein", 5, 3),
          obj("pick rack", 7, 3),
          obj("wall torch", 13, 3),
          obj("ore vein", 15, 3),
          obj("gate winch", 8, 9),
          obj(switched ? "pressure plate down" : "pressure plate", 8, 8),
          obj("powder kegs", 15, 12),
          obj("rope coil", 16, 12),
          obj("mine cart", cartPos.x, cartPos.y),
          ...(solved
            ? [obj("ore pile", 6, 5), obj("treasure pile", 13, 5)]
            : [
                obj("push boulder", 9, 5),
                obj("push boulder", 10, 5),
                obj("push boulder", 11, 5),
                obj("cracked wall", 10, 3),
              ]),
        ],
        lines: [{ id: "rail", cells: railCells }],
        start: [{ x: 10, y: 14 }],
      },
    };
  };
  return {
    states: {
      before: state(false, 0, false),
      after: state(true, 4, true),
      steps: {
        minecart_switch: state(true, 0, false),
        minecart_step_1: state(true, 1, false),
        minecart_step_2: state(true, 2, false),
        minecart_step_3: state(true, 3, false),
        minecart_step_4: state(true, 4, false),
      },
    },
    // cSwitch, cCart, cBarricade
    cells: [
      { x: 8, y: 9 },
      { x: 6, y: 11 },
      { x: 10, y: 5 },
    ],
    origin: { x: 10, y: 13 },
    reward: { x: 14, y: 11 },
  };
}

// ---------------------------------------------------------------------------
// 10. 사원소 룬 제단 공명 퍼즐 (elemental_pedestal_swap) — 화·빙·풍·지 4제단 유물 안치와 중앙 대마법진·성역 계단 개방.
// ---------------------------------------------------------------------------
function elementalDesign(): RoomDesign {
  const door = [10];
  const pedestals: readonly Cell[] = [
    { x: 5, y: 7 },
    { x: 15, y: 7 },
    { x: 5, y: 11 },
    { x: 15, y: 11 },
  ];
  const activeObjIds = ["lava brazier", "mana crystal", "rune stone", "stone sphere"] as const;
  const state = (awake: readonly boolean[], solved: boolean): RoomState => ({
    input: {
      plan: roomPlan({ top: 3, left: 2, door, ...(solved ? { open: [{ x0: 9, y0: 1, x1: 11, y1: 2 }] } : {}) }),
      floor: "elfstone",
      wall: "rune",
      ceiling: "dark",
      zones: [
        { x0: 4, y0: 6, x1: 6, y1: 8, floor: "soot" },
        { x0: 14, y0: 6, x1: 16, y1: 8, floor: "snowmat" },
        { x0: 4, y0: 10, x1: 6, y1: 12, floor: "marble" },
        { x0: 14, y0: 10, x1: 16, y1: 12, floor: "sandstone" },
      ] satisfies HandInteriorZone[],
      objects: [
        ...pedestals.map((p, i) => obj(awake[i] ? activeObjIds[i]! : "plinth", p.x, p.y)),
        obj("royal banner", 5, 3),
        obj("royal banner", 15, 3),
        obj("column dwarf", 3, 5),
        obj("column dwarf", 17, 5),
        obj("column dwarf", 3, 13),
        obj("column dwarf", 17, 13),
        ...(solved
          ? [obj("stairs up stone", 9, 3), obj("magic circle", 9, 8), obj("save crystal", 10, 6)]
          : [obj("portcullis", 9, 3), obj("portcullis", 10, 3), obj("summoning circle", 9, 8), obj("seal stone", 10, 5)]),
      ],
      daises: pedestals.map((p) => ({ id: "dais stone", x: p.x, y: p.y, w: 1, h: 1 })),
      start: [{ x: 10, y: 14 }],
    },
  });
  return {
    states: {
      before: state([false, false, false, false], false),
      after: state([true, true, true, true], true),
      steps: {
        pedestal_1: state([true, false, false, false], false),
        pedestal_2: state([true, true, false, false], false),
        pedestal_3: state([true, true, true, false], false),
        pedestal_4: state([true, true, true, true], false),
      },
    },
    // cFire, cIce, cWind, cEarth
    cells: pedestals,
    origin: { x: 10, y: 13 },
    reward: { x: 12, y: 12 },
  };
}

function designFor(presetId: PuzzleRoomPresetId): RoomDesign {
  switch (presetId) {
    case "cathedral_organ_tuning":
      return cathedralDesign();
    case "brazier_ignition_order":
      return brazierDesign();
    case "statue_pressure_plates":
      return platesDesign();
    case "dynamite_rock_blast":
      return dynamiteDesign();
    case "riddle_mimic_chests":
      return riddleDesign();
    case "boss_seal_monoliths":
      return monolithDesign();
    case "rolling_boulder_chasm":
      return boulderDesign();
    case "mirror_beam_refraction":
      return mirrorDesign();
    case "minecart_track_switch":
      return minecartDesign();
    case "elemental_pedestal_swap":
      return elementalDesign();
  }
}

export function buildLayers(project: Project, state: RoomState, label: string): Layers {
  const tileset = project.tilesets[HAND_INTERIOR_TILESET_ID];
  const built = buildHandInteriorLayers(state.input, tileset, HAND_INTERIOR_SPEC);
  const errors = built.issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new Error(`퍼즐 무대 ${label} 설계 오류: ${errors.map((e) => e.message).join(" / ")}`);
  }
  const layers: Layers = {
    lower: [...built.lowerTiles],
    lower2: [...built.lowerOverlayTiles],
    upper: [...built.upperTiles],
    upper2: [...built.upperOverlayTiles],
  };
  const pit = new Set<number>();
  for (const r of state.chasm ?? []) {
    for (let y = r.y0; y <= r.y1; y += 1) {
      for (let x = r.x0; x <= r.x1; x += 1) pit.add(y * PUZZLE_ROOM_W + x);
    }
  }
  const floorTiles = floorTileSet();
  for (const i of pit) {
    layers.lower[i] = abyssTile(pit, layers.lower, floorTiles, i % PUZZLE_ROOM_W, Math.floor(i / PUZZLE_ROOM_W));
    layers.lower2[i] = -1;
    layers.upper[i] = -1;
    layers.upper2[i] = -1;
  }
  // 심연 위 판자처럼 밟는 기물은 구덩이를 판 뒤에 2층(밟는 무늬)에 얹는다 — 조립기는 바닥 밖 기물을 오류로 막는다.
  for (const o of state.overlays ?? []) {
    const def = HAND_INTERIOR_SPEC.objects[o.id];
    if (!def) throw new Error(`퍼즐 무대 ${label}: 심연 위 기물 '${o.id}' 가 실내 칩셋 사양에 없습니다.`);
    for (const [dx, dy, tile, layer] of def.cells) {
      const x = o.x + dx;
      const y = o.y + dy;
      if (x < 0 || y < 0 || x >= PUZZLE_ROOM_W || y >= PUZZLE_ROOM_H) continue;
      const key = layer === 2 ? "lower2" : layer === 4 ? "upper2" : "upper";
      layers[key][y * PUZZLE_ROOM_W + x] = tile;
    }
  }
  return layers;
}

let floorTilesCache: Set<number> | undefined;
function floorTileSet(): Set<number> {
  if (!floorTilesCache) {
    floorTilesCache = new Set<number>();
    for (const f of Object.values(HAND_INTERIOR_SPEC.floors)) for (const t of f.tiles) floorTilesCache.add(t);
  }
  return floorTilesCache;
}

/**
 * 심연 칸 그림: 사양에 심연 자동 타일(pits.abyss)이 있으면 8이웃 마스크로 고른다 — 북쪽이 바닥이면 깊은 벼랑 벽, 남쪽이
 * 바닥이면 바닥 끝 입술이 보인다. 바닥이 아닌 이웃(벽·천장·방 밖)은 구덩이가 벽 밑으로 이어지는 것으로 본다. 없으면 옛 공허 칸.
 */
function abyssTile(pit: ReadonlySet<number>, lower: readonly number[], floors: ReadonlySet<number>, x: number, y: number): number {
  const set = HAND_INTERIOR_SPEC.pits?.abyss;
  if (!set) return HAND_INTERIOR_SPEC.void;
  const deep = (nx: number, ny: number): boolean => {
    if (nx < 0 || ny < 0 || nx >= PUZZLE_ROOM_W || ny >= PUZZLE_ROOM_H) return true;
    const i = ny * PUZZLE_ROOM_W + nx;
    return pit.has(i) || !floors.has(lower[i] ?? -1);
  };
  const n = deep(x, y - 1), e = deep(x + 1, y), so = deep(x, y + 1), w = deep(x - 1, y);
  let m = (n ? 1 : 0) | (e ? 4 : 0) | (so ? 16 : 0) | (w ? 64 : 0);
  if (n && e && deep(x + 1, y - 1)) m |= 2;
  if (so && e && deep(x + 1, y + 1)) m |= 8;
  if (so && w && deep(x - 1, y + 1)) m |= 32;
  if (n && w && deep(x - 1, y - 1)) m |= 128;
  const k = set.masks.indexOf(m);
  return k >= 0 ? set.tiles[k]! : HAND_INTERIOR_SPEC.void;
}

export function diffCommands(project: Project, map: GameMap, ox: number, oy: number, from: Layers, to: Layers): Command[] {
  const out: Command[] = [];
  for (let i = 0; i < PUZZLE_ROOM_W * PUZZLE_ROOM_H; i += 1) {
    for (const key of LAYER_KEYS) {
      const a = from[key][i] ?? -1;
      const b = to[key][i] ?? -1;
      if (a === b) continue;
      const cmd: Command = {
        kind: "changeTile",
        mapId: map.id,
        layer: key,
        x: ox + (i % PUZZLE_ROOM_W),
        y: oy + Math.floor(i / PUZZLE_ROOM_W),
        tile: b,
      };
      const problems = changeTileProblems(cmd, project);
      if (problems.length > 0) throw new Error(`퍼즐 무대 changeTile 검증 실패: ${problems.join(" ")}`);
      out.push(cmd);
    }
  }
  return out;
}

export function writeLayers(map: GameMap, ox: number, oy: number, layers: Layers): void {
  const size = map.width * map.height;
  if (!map.lowerOverlayTiles || map.lowerOverlayTiles.length !== size) map.lowerOverlayTiles = new Array<number>(size).fill(-1);
  if (!map.upperOverlayTiles || map.upperOverlayTiles.length !== size) map.upperOverlayTiles = new Array<number>(size).fill(-1);
  for (let ry = 0; ry < PUZZLE_ROOM_H; ry += 1) {
    for (let rx = 0; rx < PUZZLE_ROOM_W; rx += 1) {
      const i = ry * PUZZLE_ROOM_W + rx;
      const idx = (oy + ry) * map.width + (ox + rx);
      map.lowerTiles[idx] = layers.lower[i] ?? HAND_INTERIOR_SPEC.void;
      map.lowerOverlayTiles[idx] = layers.lower2[i] ?? -1;
      map.upperTiles[idx] = layers.upper[i] ?? -1;
      map.upperOverlayTiles[idx] = layers.upper2[i] ?? -1;
      if (map.shadowBits && idx < map.shadowBits.length) map.shadowBits[idx] = 0;
      delete map.lowerTileStacks?.[idx];
      delete map.upperTileStacks?.[idx];
    }
  }
}

/** 방을 둘 20×15 창의 왼쪽 위. 맵이 딱 한 화면이면 (0,0), 더 크면 요청 좌표(없으면 맵 가운데)를 중심으로 맵 안에 맞춘다. */
function roomWindow(map: GameMap, anchor: Cell | undefined): Cell {
  const cx = anchor?.x ?? Math.floor(map.width / 2);
  const cy = anchor?.y ?? Math.floor(map.height / 2);
  return {
    x: Math.max(0, Math.min(map.width - PUZZLE_ROOM_W, cx - Math.floor(PUZZLE_ROOM_W / 2))),
    y: Math.max(0, Math.min(map.height - PUZZLE_ROOM_H, cy - Math.floor(PUZZLE_ROOM_H / 2))),
  };
}

export interface PuzzleRoomBuild {
  readonly origin: Cell;
  readonly center: Cell;
  readonly reward: Cell;
  readonly cells: readonly Cell[];
  readonly changeTileCommands: Command[];
  readonly stepChangeTileCommands: Record<string, Command[]>;
}

/**
 * 20×15 방 창을 맵에서 확보한다. 이미 사람이 꾸민 맵(이동 착지점·이벤트가 있는 맵)을 망치지 않도록
 * - 실내 칩셋 맵이면 방 창 안에 이동 착지점·이벤트·시작점이 없을 때만,
 * - 다른 칩셋 맵이면 이벤트·착지점이 하나도 없는 빈 맵일 때만 맵 전체를 실내 칩셋으로 바꿔 쓴다.
 * 확보하지 못하면 undefined.
 */
export function claimPuzzleRoomWindow(
  project: Project,
  map: GameMap,
  anchor: Cell | undefined,
  landings: ReadonlySet<string>,
): Cell | undefined {
  const tileset = project.tilesets[HAND_INTERIOR_TILESET_ID];
  if (!tileset || map.width < PUZZLE_ROOM_W || map.height < PUZZLE_ROOM_H) return undefined;
  const win = roomWindow(map, anchor);
  if (map.tilesetId !== HAND_INTERIOR_TILESET_ID) {
    if (landings.size > 0 || map.events.length > 0 || project.startMapId === map.id) return undefined;
    // 다른 칩셋 번호는 새 칩셋에서 엉뚱한 그림이 되므로 맵 전체를 실내 칩셋의 빈 칸(바깥 어둠)으로 비우고 바꾼다.
    const size = map.width * map.height;
    map.tilesetId = HAND_INTERIOR_TILESET_ID;
    map.tileSize = tileset.tileSize;
    map.lowerTiles = new Array<number>(size).fill(HAND_INTERIOR_SPEC.void);
    map.upperTiles = new Array<number>(size).fill(-1);
    map.lowerOverlayTiles = new Array<number>(size).fill(-1);
    map.upperOverlayTiles = new Array<number>(size).fill(-1);
    delete map.shadowBits;
    delete map.lowerTileStacks;
    delete map.upperTileStacks;
    delete map.relief;
    return win;
  }
  const inWin = (x: number, y: number): boolean => x >= win.x && x < win.x + PUZZLE_ROOM_W && y >= win.y && y < win.y + PUZZLE_ROOM_H;
  for (const key of landings) {
    const [lx = -1, ly = -1] = key.split(",").map(Number);
    if (inWin(lx, ly)) return undefined;
  }
  if (map.events.some((e) => inWin(e.x, e.y))) return undefined;
  const start = project.startMapId === map.id ? project.startPos : undefined;
  if (start && inWin(start.x, start.y)) return undefined;
  return win;
}

/**
 * 프리셋 무대 방 한 칸(20×15)을 화면 전체로 짓는다. 방 창을 확보하지 못하면 undefined(기존 무대 시공으로 넘어간다).
 */
export function buildPuzzleRoomStage(
  project: Project,
  map: GameMap,
  presetId: PuzzleRoomPresetId,
  anchor: Cell | undefined,
  landings: ReadonlySet<string>,
): PuzzleRoomBuild | undefined {
  const win = claimPuzzleRoomWindow(project, map, anchor, landings);
  if (!win) return undefined;
  const design = designFor(presetId);
  const before = buildLayers(project, design.states.before, `${presetId}:before`);
  const after = buildLayers(project, design.states.after, `${presetId}:after`);
  const stepChangeTileCommands: Record<string, Command[]> = {};
  const touched = new Set<number>();
  let previous = before;
  for (const [key, state] of Object.entries(design.states.steps ?? {})) {
    const layers = buildLayers(project, state, `${presetId}:${key}`);
    // 화로·바위 굴리기·거울 굴절·광차 질주·사원소 제단처럼 차례로 쌓이는 단계는 앞 단계(previous)에서, 서로 독립인 단계(plate·monolith)는 처음 상태에서 잰다.
    const isSequential =
      key.startsWith("brazier_") ||
      key.startsWith("boulder_") ||
      key.startsWith("mirror_") ||
      key.startsWith("minecart_") ||
      key.startsWith("pedestal_");
    const from = isSequential ? previous : before;
    stepChangeTileCommands[key] = diffCommands(project, map, win.x, win.y, from, layers);
    for (const cmd of stepChangeTileCommands[key]!) {
      if (cmd.kind === "changeTile") touched.add((cmd.y - win.y) * PUZZLE_ROOM_W + (cmd.x - win.x));
    }
    previous = layers;
  }
  if (design.resetKey) {
    const fromAll: Layers = { lower: [...before.lower], lower2: [...before.lower2], upper: [...before.upper], upper2: [...before.upper2] };
    for (const i of touched) for (const key of LAYER_KEYS) fromAll[key][i] = -2;
    // 되돌리기: 단계가 건드린 칸만 처음 그림으로 다시 쓴다(-2 는 「무엇이었든 다르다」 표시라 칸마다 명령이 나온다).
    stepChangeTileCommands[design.resetKey] = diffCommands(project, map, win.x, win.y, fromAll, before);
  }
  // 단계(boulder_step_* 등)가 잠시 바위·광차를 그렸던 칸이 after 에서 비어야 할 때도 빠짐없이 정리되도록 반영한다.
  const finalFrom: Layers = { lower: [...before.lower], lower2: [...before.lower2], upper: [...before.upper], upper2: [...before.upper2] };
  for (const i of touched) {
    for (const key of LAYER_KEYS) {
      if (previous[key][i] !== after[key][i]) finalFrom[key][i] = -2;
    }
  }
  writeLayers(map, win.x, win.y, before);
  const shift = (c: Cell): Cell => ({ x: c.x + win.x, y: c.y + win.y });
  return {
    origin: shift(design.origin),
    center: shift({ x: Math.floor(PUZZLE_ROOM_W / 2), y: Math.floor(PUZZLE_ROOM_H / 2) }),
    reward: shift(design.reward),
    cells: design.cells.map(shift),
    changeTileCommands: diffCommands(project, map, win.x, win.y, finalFrom, after),
    stepChangeTileCommands,
  };
}
