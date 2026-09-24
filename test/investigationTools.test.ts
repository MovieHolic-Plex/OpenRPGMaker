import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject, DEFAULT_ITEM_ID, TILE } from "@/project/defaults";
import type { GameEvent, GameMap, Project } from "@/project/types";
import {
  createGalleryPhase4Fixture,
  GALLERY_ENDING_ID,
  GALLERY_EXIT_SWITCH,
  GALLERY_ORDER_SWITCH,
} from "./fixtures/galleryPhase4Fixture";

type ToolData = {
  readonly created?: number;
  readonly skipped?: number;
  readonly eventIds?: readonly string[];
  readonly ok?: boolean;
  readonly failureReason?: string;
  readonly finalState?: {
    readonly switchesOn: readonly string[];
    readonly variables: Record<string, number>;
  };
};

function startMap(project: Project): GameMap {
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  return map;
}

function existingEvent(id: string, x: number, y: number): GameEvent {
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [] };
}

function assertTool(result: { readonly ok: boolean; readonly summary: string; readonly issues?: unknown }): void {
  expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
}

function puzzleSnapshot(map: GameMap): unknown {
  return map.events.map((event) => ({
    id: event.id,
    x: event.x,
    y: event.y,
    pages: (event.pages ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      conditions: page.conditions,
      trigger: page.trigger,
      commands: page.commands,
    })),
  }));
}

describe("place_examine_hotspots", () => {
  it("일괄 생성 중 좌표 중복/맵 밖/기존 이벤트 겹침은 항목별 skip warning으로 반환한다", () => {
    const ctx = { project: createBlankProject() };
    const map = startMap(ctx.project);
    map.events.push(existingEvent("ev_existing", 3, 3));

    const result = runTool(ctx, "place_examine_hotspots", {
      mapId: map.id,
      hotspots: [
        { at: { x: 1, y: 1 }, name: "책상", lines: ["서랍이 비어 있다."] },
        { at: { x: 1, y: 1 }, name: "중복 책상", lines: ["겹친다."] },
        { at: { x: 99, y: 1 }, name: "밖" },
        { at: { x: 3, y: 3 }, name: "기존 자리" },
      ],
    });

    assertTool(result);
    expect(result.summary).toContain("조사 핫스팟 1개 생성, 3개 스킵");
    expect(result.data).toMatchObject({ created: 1, skipped: 3 });
    expect(result.diff?.warnings?.filter((warning) => warning.includes("skip"))).toHaveLength(3);
    expect(result.diff?.warnings?.some((warning) => warning.startsWith("보이지 않는 조사 지점"))).toBe(false);
    expect(result.diff?.warnings?.some((warning) => warning.includes("보석 표식") && warning.includes("책상"))).toBe(true);
    const placed = startMap(ctx.project).events.find((event) => event.id === "ev_examine_1");
    expect(placed?.pages?.[0]?.graphic?.sprite?.id).toBe("tex_easyrpg_charset_object2");
    expect(startMap(ctx.project).events.map((event) => event.id)).toContain("ev_examine_1");
  });

  it("graphic:{transparent:true} 는 투명으로 두고, 본문 「이름:」 은 그 줄의 화자로 옮긴다", () => {
    const ctx = { project: createBlankProject() };
    const map = startMap(ctx.project);
    const result = runTool(ctx, "place_examine_hotspots", {
      mapId: map.id,
      hotspots: [{
        at: { x: 4, y: 4 },
        name: "긁힌 LP판",
        graphic: { transparent: true },
        lines: ["서하온: 첫 소절만 남아 있다.", "[잔류 사념: 그 멜로디가 뭐였더라]"],
      }],
    });
    assertTool(result);
    const event = startMap(ctx.project).events.find((entry) => entry.id === "ev_examine_1");
    expect(event?.pages?.[0]?.graphic).toEqual({ transparent: true });
    expect(event?.pages?.[0]?.commands).toEqual([
      { kind: "text", speaker: "서하온", body: "첫 소절만 남아 있다." },
      { kind: "text", speaker: "긁힌 LP판", body: "[잔류 사념: 그 멜로디가 뭐였더라]" },
    ]);
    expect(result.diff?.warnings?.some((warning) => warning.includes("보이지 않는 조사 지점"))).toBe(true);
  });

  it("once:true는 self-switch A 기반 1회성 페이지 구조를 만든다", () => {
    const ctx = { project: createBlankProject() };
    const map = startMap(ctx.project);
    const result = runTool(ctx, "place_examine_hotspots", {
      mapId: map.id,
      hotspots: [{ at: { x: 2, y: 2 }, name: "은색 상자", lines: ["상자가 닫혔다."], once: true }],
    });

    assertTool(result);
    const eventId = ((result.data as ToolData).eventIds ?? [])[0];
    const event = startMap(ctx.project).events.find((entry) => entry.id === eventId);
    expect(event?.pages).toHaveLength(2);
    expect(event?.pages?.[0]).toMatchObject({
      id: "ev_examine_1_once",
      conditions: [{ kind: "selfSwitch", key: "A", value: false }],
      commands: [
        { kind: "text", speaker: "은색 상자", body: "상자가 닫혔다." },
        { kind: "setSelfSwitch", key: "A", value: true },
      ],
    });
    expect(event?.pages?.[1]).toMatchObject({
      id: "ev_examine_1_done",
      conditions: [{ kind: "selfSwitch", key: "A", value: true }],
      commands: [],
    });
  });
});

describe("compile_puzzle", () => {
  it("퍼즐 4종을 기존 이벤트 커맨드 트리로 컴파일한다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    assertTool(runTool(ctx, "compile_puzzle", {
      mapId,
      puzzleId: "snap_seq",
      kind: "switch-sequence",
      nodes: [
        { at: { x: 2, y: 2 }, name: "왼쪽 종" },
        { at: { x: 3, y: 2 }, name: "오른쪽 종" },
      ],
      order: [0, 1],
      onSolve: { setSwitch: "sw_snap_seq", message: "문이 열렸다." },
    }));
    assertTool(runTool(ctx, "compile_puzzle", {
      mapId,
      puzzleId: "snap_password",
      kind: "password",
      at: { x: 5, y: 2 },
      name: "암호 석판",
      answer: "1234",
      prompt: "네 자리 숫자를 넣는다.",
      onSolve: { setSwitch: "sw_snap_password", message: "석판이 빛났다." },
    }));
    assertTool(runTool(ctx, "compile_puzzle", {
      mapId,
      puzzleId: "snap_gate",
      kind: "item-gate",
      at: { x: 7, y: 2 },
      name: "잠긴 함",
      requiredItemId: DEFAULT_ITEM_ID,
      consumeItem: true,
      lockedMessage: "열쇠가 필요하다.",
      unlockedMessage: "함이 열렸다.",
      onSolve: { setSwitch: "sw_snap_gate" },
    }));
    assertTool(runTool(ctx, "compile_puzzle", {
      mapId,
      puzzleId: "snap_push",
      kind: "push-switches",
      plates: [{ at: { x: 9, y: 2 } }, { at: { x: 10, y: 2 } }],
      all: true,
      onSolve: { setSwitch: "sw_snap_push", message: "철문이 내려앉았다." },
    }));

    expect(puzzleSnapshot(startMap(ctx.project))).toMatchInlineSnapshot(`
      [
        {
          "id": "ev_snap_seq_seq_1",
          "pages": [
            {
              "commands": [
                {
                  "condition": {
                    "kind": "variable",
                    "op": "==",
                    "value": 0,
                    "variableId": "var_snap_seq_step",
                  },
                  "else": [
                    {
                      "body": "순서가 틀렸다. 처음부터 다시 해야 한다.",
                      "kind": "text",
                    },
                    {
                      "kind": "setVariable",
                      "op": "=",
                      "value": 0,
                      "variableId": "var_snap_seq_step",
                    },
                  ],
                  "kind": "fork",
                  "then": [
                    {
                      "kind": "setVariable",
                      "op": "=",
                      "value": 1,
                      "variableId": "var_snap_seq_step",
                    },
                    {
                      "body": "어딘가에서 작은 소리가 났다.",
                      "kind": "text",
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_seq",
                  "value": false,
                },
              ],
              "id": "ev_snap_seq_seq_1_active",
              "name": "왼쪽 종",
              "trigger": {
                "kind": "action",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_seq",
                  "value": true,
                },
              ],
              "id": "ev_snap_seq_seq_1_solved",
              "name": "왼쪽 종 해결 후",
              "trigger": {
                "kind": "action",
              },
            },
          ],
          "x": 2,
          "y": 2,
        },
        {
          "id": "ev_snap_seq_seq_2",
          "pages": [
            {
              "commands": [
                {
                  "condition": {
                    "kind": "variable",
                    "op": "==",
                    "value": 1,
                    "variableId": "var_snap_seq_step",
                  },
                  "else": [
                    {
                      "body": "순서가 틀렸다. 처음부터 다시 해야 한다.",
                      "kind": "text",
                    },
                    {
                      "kind": "setVariable",
                      "op": "=",
                      "value": 0,
                      "variableId": "var_snap_seq_step",
                    },
                  ],
                  "kind": "fork",
                  "then": [
                    {
                      "kind": "setVariable",
                      "op": "=",
                      "value": 2,
                      "variableId": "var_snap_seq_step",
                    },
                    {
                      "body": "문이 열렸다.",
                      "kind": "text",
                    },
                    {
                      "kind": "setSwitch",
                      "switchId": "sw_snap_seq",
                      "value": true,
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_seq",
                  "value": false,
                },
              ],
              "id": "ev_snap_seq_seq_2_active",
              "name": "오른쪽 종",
              "trigger": {
                "kind": "action",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_seq",
                  "value": true,
                },
              ],
              "id": "ev_snap_seq_seq_2_solved",
              "name": "오른쪽 종 해결 후",
              "trigger": {
                "kind": "action",
              },
            },
          ],
          "x": 3,
          "y": 2,
        },
        {
          "id": "ev_snap_password_password",
          "pages": [
            {
              "commands": [
                {
                  "body": "네 자리 숫자를 넣는다.",
                  "kind": "text",
                },
                {
                  "digits": 4,
                  "kind": "inputNumber",
                  "variableId": "var_snap_password_password",
                },
                {
                  "condition": {
                    "kind": "variable",
                    "op": "==",
                    "value": 1234,
                    "variableId": "var_snap_password_password",
                  },
                  "else": [
                    {
                      "body": "암호가 틀렸다.",
                      "kind": "text",
                    },
                    {
                      "kind": "setVariable",
                      "op": "=",
                      "value": 0,
                      "variableId": "var_snap_password_password",
                    },
                  ],
                  "kind": "fork",
                  "then": [
                    {
                      "body": "석판이 빛났다.",
                      "kind": "text",
                    },
                    {
                      "kind": "setSwitch",
                      "switchId": "sw_snap_password",
                      "value": true,
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_password",
                  "value": false,
                },
              ],
              "id": "ev_snap_password_password_active",
              "name": "암호 석판",
              "trigger": {
                "kind": "action",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_password",
                  "value": true,
                },
              ],
              "id": "ev_snap_password_password_solved",
              "name": "암호 석판 해결 후",
              "trigger": {
                "kind": "action",
              },
            },
          ],
          "x": 5,
          "y": 2,
        },
        {
          "id": "ev_snap_gate_gate",
          "pages": [
            {
              "commands": [
                {
                  "condition": {
                    "itemId": "item_potion",
                    "kind": "item",
                    "present": true,
                  },
                  "else": [
                    {
                      "body": "열쇠가 필요하다.",
                      "kind": "text",
                    },
                  ],
                  "kind": "fork",
                  "then": [
                    {
                      "body": "함이 열렸다.",
                      "kind": "text",
                    },
                    {
                      "amount": 1,
                      "itemId": "item_potion",
                      "kind": "changeItem",
                      "op": "-=",
                    },
                    {
                      "kind": "setSwitch",
                      "switchId": "sw_snap_gate",
                      "value": true,
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_gate",
                  "value": false,
                },
              ],
              "id": "ev_snap_gate_gate_active",
              "name": "잠긴 함",
              "trigger": {
                "kind": "action",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_gate",
                  "value": true,
                },
              ],
              "id": "ev_snap_gate_gate_solved",
              "name": "잠긴 함 해결 후",
              "trigger": {
                "kind": "action",
              },
            },
          ],
          "x": 7,
          "y": 2,
        },
        {
          "id": "ev_snap_push_plate_1",
          "pages": [
            {
              "commands": [
                {
                  "key": "A",
                  "kind": "setSelfSwitch",
                  "value": true,
                },
                {
                  "kind": "setSwitch",
                  "switchId": "sw_snap_push_plate_1",
                  "value": true,
                },
                {
                  "condition": {
                    "kind": "switch",
                    "switchId": "sw_snap_push_plate_1",
                    "value": true,
                  },
                  "else": [],
                  "kind": "fork",
                  "then": [
                    {
                      "condition": {
                        "kind": "switch",
                        "switchId": "sw_snap_push_plate_2",
                        "value": true,
                      },
                      "else": [],
                      "kind": "fork",
                      "then": [
                        {
                          "body": "철문이 내려앉았다.",
                          "kind": "text",
                        },
                        {
                          "kind": "setSwitch",
                          "switchId": "sw_snap_push",
                          "value": true,
                        },
                      ],
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": false,
                },
                {
                  "key": "A",
                  "kind": "selfSwitch",
                  "value": false,
                },
              ],
              "id": "ev_snap_push_plate_1_fresh",
              "name": "발판 1",
              "trigger": {
                "kind": "playerTouch",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": false,
                },
                {
                  "key": "A",
                  "kind": "selfSwitch",
                  "value": true,
                },
              ],
              "id": "ev_snap_push_plate_1_pressed",
              "name": "발판 1 눌림",
              "trigger": {
                "kind": "playerTouch",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": true,
                },
              ],
              "id": "ev_snap_push_plate_1_solved",
              "name": "발판 1 해결 후",
              "trigger": {
                "kind": "playerTouch",
              },
            },
          ],
          "x": 9,
          "y": 2,
        },
        {
          "id": "ev_snap_push_plate_2",
          "pages": [
            {
              "commands": [
                {
                  "key": "A",
                  "kind": "setSelfSwitch",
                  "value": true,
                },
                {
                  "kind": "setSwitch",
                  "switchId": "sw_snap_push_plate_2",
                  "value": true,
                },
                {
                  "condition": {
                    "kind": "switch",
                    "switchId": "sw_snap_push_plate_1",
                    "value": true,
                  },
                  "else": [],
                  "kind": "fork",
                  "then": [
                    {
                      "condition": {
                        "kind": "switch",
                        "switchId": "sw_snap_push_plate_2",
                        "value": true,
                      },
                      "else": [],
                      "kind": "fork",
                      "then": [
                        {
                          "body": "철문이 내려앉았다.",
                          "kind": "text",
                        },
                        {
                          "kind": "setSwitch",
                          "switchId": "sw_snap_push",
                          "value": true,
                        },
                      ],
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": false,
                },
                {
                  "key": "A",
                  "kind": "selfSwitch",
                  "value": false,
                },
              ],
              "id": "ev_snap_push_plate_2_fresh",
              "name": "발판 2",
              "trigger": {
                "kind": "playerTouch",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": false,
                },
                {
                  "key": "A",
                  "kind": "selfSwitch",
                  "value": true,
                },
              ],
              "id": "ev_snap_push_plate_2_pressed",
              "name": "발판 2 눌림",
              "trigger": {
                "kind": "playerTouch",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": true,
                },
              ],
              "id": "ev_snap_push_plate_2_solved",
              "name": "발판 2 해결 후",
              "trigger": {
                "kind": "playerTouch",
              },
            },
          ],
          "x": 10,
          "y": 2,
        },
      ]
    `);
  });

  it("solvability 위반은 한국어 사유로 거부한다", () => {
    const orderCtx = { project: createBlankProject() };
    const order = runTool(orderCtx, "compile_puzzle", {
      mapId: orderCtx.project.startMapId,
      puzzleId: "bad_order",
      kind: "switch-sequence",
      nodes: [{ at: { x: 2, y: 2 }, name: "종" }],
      order: [1],
      onSolve: {},
    });
    expect(order.ok).toBe(false);
    expect(order.issues?.[0]?.message).toContain("범위");

    const passwordCtx = { project: createBlankProject() };
    const password = runTool(passwordCtx, "compile_puzzle", {
      mapId: passwordCtx.project.startMapId,
      puzzleId: "bad_password",
      kind: "password",
      at: { x: 2, y: 2 },
      answer: "",
      onSolve: {},
    });
    expect(password.ok).toBe(false);
    expect(password.issues?.[0]?.message).toContain("비어");

    const itemCtx = { project: createBlankProject() };
    const itemGate = runTool(itemCtx, "compile_puzzle", {
      mapId: itemCtx.project.startMapId,
      puzzleId: "bad_item",
      kind: "item-gate",
      at: { x: 2, y: 2 },
      requiredItemId: "item_missing",
      onSolve: {},
    });
    expect(itemGate.ok).toBe(false);
    expect(itemGate.issues?.[0]?.message).toContain("DB에 존재하지 않습니다");

    const openPlateCtx = { project: createBlankProject() };
    const openPlateMap = startMap(openPlateCtx.project);
    openPlateMap.lowerTiles[2 + 2 * openPlateMap.width] = TILE.WATER;
    const openPlate = runTool(openPlateCtx, "compile_puzzle", {
      mapId: openPlateMap.id,
      puzzleId: "adjusted_plate",
      kind: "push-switches",
      plates: [{ at: { x: 2, y: 2 } }],
      all: true,
      onSolve: {},
    });
    expect(openPlate.ok).toBe(true);
    expect(openPlate.diff?.warnings.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);

    const blockedPlateCtx = { project: createBlankProject() };
    const blockedPlateMap = startMap(blockedPlateCtx.project);
    for (let y = 0; y <= 5; y += 1) {
      for (let x = 0; x <= 5; x += 1) blockedPlateMap.lowerTiles[x + y * blockedPlateMap.width] = TILE.WATER;
    }
    const blockedPlate = runTool(blockedPlateCtx, "compile_puzzle", {
      mapId: blockedPlateMap.id,
      puzzleId: "blocked_plate",
      kind: "push-switches",
      plates: [{ at: { x: 2, y: 2 } }],
      all: true,
      onSolve: {},
    });
    expect(blockedPlate.ok).toBe(true);
    expect(blockedPlate.data).toMatchObject({ created: 0, skipped: 1 });
    expect(blockedPlate.diff?.warnings.some((warning) => warning.includes("총 1개 skip"))).toBe(true);
  });
});

describe("Phase 4 조사/퍼즐 run_scene_test 통합", () => {
  function createSceneProject(): Project {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    assertTool(runTool(ctx, "compile_puzzle", {
      mapId,
      puzzleId: "scene_seq",
      kind: "switch-sequence",
      nodes: [
        { at: { x: 2, y: 2 }, name: "첫 종" },
        { at: { x: 3, y: 2 }, name: "둘째 종" },
      ],
      order: [0, 1],
      onSolve: { setSwitch: "sw_scene_seq" },
    }));
    assertTool(runTool(ctx, "place_examine_hotspots", {
      mapId,
      hotspots: [{ at: { x: 4, y: 4 }, name: "작은 열쇠", itemId: DEFAULT_ITEM_ID, once: true }],
    }));
    assertTool(runTool(ctx, "compile_puzzle", {
      mapId,
      puzzleId: "scene_gate",
      kind: "item-gate",
      at: { x: 5, y: 4 },
      name: "잠긴 문",
      requiredItemId: DEFAULT_ITEM_ID,
      lockedMessage: "잠겨 있다.",
      unlockedMessage: "문이 열린다.",
      onSolve: { setSwitch: "sw_scene_gate" },
    }));
    assertTool(runTool(ctx, "compile_puzzle", {
      mapId,
      puzzleId: "scene_push",
      kind: "push-switches",
      plates: [{ at: { x: 6, y: 6 } }, { at: { x: 7, y: 6 } }],
      all: true,
      onSolve: { setSwitch: "sw_scene_push" },
    }));
    return ctx.project;
  }

  it("순서 퍼즐은 정순 해결 시 스위치를 켠다", () => {
    const project = createSceneProject();
    const result = runTool({ project }, "run_scene_test", {
      mapId: project.startMapId,
      start: { x: 2, y: 2 },
      steps: [
        { kind: "interact" },
        { kind: "expect", variableEquals: { variableId: "var_scene_seq_step", value: 1 }, switchOff: "sw_scene_seq" },
        { kind: "move", dir: "right" },
        { kind: "interact" },
        { kind: "expect", switchOn: "sw_scene_seq" },
      ],
    });

    assertTool(result);
    expect((result.data as ToolData).ok, (result.data as ToolData).failureReason).toBe(true);
  });

  it("순서 퍼즐은 오답 입력 시 진행도를 리셋한다", () => {
    const project = createSceneProject();
    const result = runTool({ project }, "run_scene_test", {
      mapId: project.startMapId,
      start: { x: 2, y: 2 },
      steps: [
        { kind: "interact" },
        { kind: "expect", variableEquals: { variableId: "var_scene_seq_step", value: 1 } },
        { kind: "interact" },
        { kind: "expect", variableEquals: { variableId: "var_scene_seq_step", value: 0 }, switchOff: "sw_scene_seq" },
      ],
    });

    assertTool(result);
    expect((result.data as ToolData).ok, (result.data as ToolData).failureReason).toBe(true);
  });

  it("item-gate는 아이템 없이 잠기고 지급 후 통과한다", () => {
    const project = createSceneProject();
    const result = runTool({ project }, "run_scene_test", {
      mapId: project.startMapId,
      start: { x: 5, y: 4 },
      steps: [
        { kind: "interact" },
        { kind: "expect", switchOff: "sw_scene_gate" },
        { kind: "move", dir: "left" },
        { kind: "interact" },
        { kind: "move", dir: "right" },
        { kind: "interact" },
        { kind: "expect", switchOn: "sw_scene_gate" },
      ],
    });

    assertTool(result);
    expect((result.data as ToolData).ok, (result.data as ToolData).failureReason).toBe(true);
  });

  it("push-switches는 모든 발판을 밟으면 해결 스위치를 켠다", () => {
    const project = createSceneProject();
    const result = runTool({ project }, "run_scene_test", {
      mapId: project.startMapId,
      start: { x: 5, y: 6 },
      steps: [
        { kind: "move", dir: "right" },
        { kind: "expect", switchOff: "sw_scene_push" },
        { kind: "move", dir: "right" },
        { kind: "expect", switchOn: "sw_scene_push" },
      ],
    });

    assertTool(result);
    expect((result.data as ToolData).ok, (result.data as ToolData).failureReason).toBe(true);
  });
});

describe("갤러리 방 Phase 4 fixture", () => {
  it("조사 핫스팟 12개, 순서 퍼즐, item-gate, 엔딩 스위치를 포함한다", () => {
    const project = createGalleryPhase4Fixture();
    const map = startMap(project);

    expect(map.name).toBe("갤러리 방");
    expect(map.events.filter((event) => event.id.startsWith("ev_examine_"))).toHaveLength(12);
    expect(map.events.some((event) => event.id === "ev_gallery_order_seq_1")).toBe(true);
    expect(map.events.some((event) => event.id === "ev_gallery_exit_gate")).toBe(true);
    expect(project.switches.map((entry) => entry.id)).toEqual(expect.arrayContaining([GALLERY_ORDER_SWITCH, GALLERY_EXIT_SWITCH]));
    expect(project.endings?.find((ending) => ending.id === GALLERY_ENDING_ID)).toMatchObject({
      conditions: [{ kind: "switch", switchId: GALLERY_EXIT_SWITCH, value: true }],
    });
  });
});
