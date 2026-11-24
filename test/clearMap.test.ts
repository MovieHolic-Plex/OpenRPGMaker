import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { getTool, runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE, DEFAULT_ITEM_ID, DEFAULT_TROOP_ID, CASTLE_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";
import type { GameEvent, GameMap, Project, Rect } from "@/project/types";
import { ToolError } from "@/editor/tools/types";
import { createBattleRuntime } from "@/battle/runtime";
import { commandPanel, type BattleCommandPanelOptions } from "@/player/battleCommandDom";
import { applyBattleDirectorState, commandPromptState } from "@/player/battleDirectorDom";
import { noEscapeInlineReason, noEscapeNoticeLine } from "@/player/emeraldBattleNarration";
import { store } from "@/project/store";
import { installFakeDom, type FakeElement } from "./fakeDom";
import type Phaser from "phaser";
import { registerTilesetTextureFrames } from "@/assets/bundled";
import { isDestructiveOutcome } from "@/ai/approvalPolicy";
import { reviewOverInsertion } from "@/ai/overInsertionReview";
import type { ProposedCall } from "@/ai/assistantSession";
import { completedHouseProject } from "./fixtures/completedHouse";
import { isolateTimers } from "./mergedTeardown";

describe("aiPlacementCutsceneCheckpoint", () => {
  isolateTimers();
  // script_cutscene / 맵 진입 체크포인트가 물·벽 위에 서는 버그 계약.
  // 체크포인트는 auto 트리거라 밟을 필요는 없지만 지형 안에 심으면 event-unreachable 린트가 난다.
  // 컷신은 트리거에 따라 갈린다: playerTouch/touch 는 밟을 수 있어야 하고, action 은 인접 통행 가능 칸만 있으면 된다.

  function fixture(): { project: Project; map: GameMap; mapId: string } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    return { project, map, mapId };
  }
  function setWater(map: GameMap, x: number, y: number): void {
    map.lowerTiles[y * map.width + x] = TILE.WATER;
    map.upperTiles[y * map.width + x] = TILE.EMPTY;
  }
  function eventById(map: GameMap, id: string): GameEvent {
    const found = map.events.find((entry) => entry.id === id);
    if (!found) throw new Error(`event not found: ${id}`);
    return found;
  }
  function checkpointId(map: GameMap): string {
    return `${map.id}_checkpoint_auto`;
  }
  function placeCheckpoint(project: Project, mapId: string, trapAt: { x: number; y: number }): void {
    getTool("place_trap")!.run(project, {
      mapId,
      cells: [trapAt],
      trigger: "touch",
      respawnCheckpoint: true,
    });
  }
  const SAY_BEAT = { kind: "say" as const, speaker: "나", text: "그날을 기억한다." };
  describe("ensureMapCheckpointEvent 통행 가능 착지", () => {
    it("(0,0)이 물이면 체크포인트 auto 이벤트는 통행 가능 칸에 착지한다", () => {
      const { project, map, mapId } = fixture();
      setWater(map, 0, 0);
      expect(isPassable(project, map, 0, 0)).toBe(false);

      placeCheckpoint(project, mapId, { x: 5, y: 5 });

      const checkpoint = eventById(map, checkpointId(map));
      expect(isPassable(project, map, checkpoint.x, checkpoint.y)).toBe(true);
    });

    it("일반 맵에서는 체크포인트가 기존처럼 (0,0)에 선다", () => {
      const { project, map, mapId } = fixture();
      expect(isPassable(project, map, 0, 0)).toBe(true);

      placeCheckpoint(project, mapId, { x: 5, y: 5 });

      const checkpoint = eventById(map, checkpointId(map));
      expect([checkpoint.x, checkpoint.y]).toEqual([0, 0]);
    });

    // auto 트리거는 좌표와 무관하게 발동하므로, 좌상단 반경 3이 전부 막혔다고 트랩 배치 전체를
    // 실패시키면 고치려던 버그보다 나쁘다(동굴·두꺼운 벽 맵에서 place_trap 이 통째로 죽는다).
    it("좌상단 반경 3이 전부 막힌 맵에서도 트랩 배치는 성공하고 체크포인트가 남는다", () => {
      const { project, map, mapId } = fixture();
      for (let y = 0; y <= 3; y += 1) {
        for (let x = 0; x <= 3; x += 1) setWater(map, x, y);
      }
      expect(isPassable(project, map, 0, 0)).toBe(false);
      expect(isPassable(project, map, 3, 3)).toBe(false);

      expect(() => placeCheckpoint(project, mapId, { x: 8, y: 8 })).not.toThrow();

      const checkpoint = eventById(map, checkpointId(map));
      expect(isPassable(project, map, checkpoint.x, checkpoint.y)).toBe(true);
      expect(map.events.some((event) => event.id.startsWith("ev_trap"))).toBe(true);
    });
  });
  describe("script_cutscene 통행 가능 착지", () => {
    it("물 위 playerTouch 컷신은 통행 가능 칸에 착지한다", () => {
      const { project, map, mapId } = fixture();
      setWater(map, 5, 5);
      expect(isPassable(project, map, 5, 5)).toBe(false);

      const result = getTool("script_cutscene")!.run(project, {
        mapId,
        x: 5,
        y: 5,
        trigger: "playerTouch",
        beats: [SAY_BEAT],
      });

      const data = result.data as { eventId: string };
      const event = eventById(map, data.eventId);
      expect(isPassable(project, map, event.x, event.y)).toBe(true);
    });

    it("물 위 기존 action 컷신에 playerTouch 페이지를 더하면 이벤트를 통행 가능 칸으로 옮긴다", () => {
      const { project, map, mapId } = fixture();
      setWater(map, 5, 5);

      getTool("script_cutscene")!.run(project, {
        mapId,
        eventId: "ev_existing_water",
        x: 5,
        y: 5,
        trigger: "action",
        beats: [SAY_BEAT],
      });
      const result = getTool("script_cutscene")!.run(project, {
        mapId,
        eventId: "ev_existing_water",
        mode: "append",
        trigger: "playerTouch",
        beats: [{ kind: "say", speaker: "나", text: "밟으면 시작한다." }],
      });

      const event = eventById(map, "ev_existing_water");
      expect(isPassable(project, map, event.x, event.y)).toBe(true);
      expect(event.pages).toHaveLength(2);
      expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
    });

    it("통행 가능 이웃이 있는 물 위 action 컷신은 작성 좌표를 유지한다", () => {
      const { project, map, mapId } = fixture();
      setWater(map, 4, 4);
      expect(isPassable(project, map, 4, 4)).toBe(false);
      expect(isPassable(project, map, 4, 5)).toBe(true);

      const result = getTool("script_cutscene")!.run(project, {
        mapId,
        x: 4,
        y: 4,
        trigger: "action",
        beats: [SAY_BEAT],
      });

      const data = result.data as { eventId: string };
      const event = eventById(map, data.eventId);
      expect([event.x, event.y]).toEqual([4, 4]);
    });
  });
  describe("체크포인트·컷신 기존 이벤트 재사용", () => {
    it("이미 있는 체크포인트/컷신 이벤트는 재사용하고 복제하지 않는다", () => {
      const { project, map, mapId } = fixture();

      placeCheckpoint(project, mapId, { x: 5, y: 5 });
      placeCheckpoint(project, mapId, { x: 6, y: 6 });
      const checkpoints = map.events.filter((event) => event.id === checkpointId(map));
      expect(checkpoints).toHaveLength(1);

      getTool("script_cutscene")!.run(project, {
        mapId,
        eventId: "ev_memory",
        x: 8,
        y: 8,
        trigger: "action",
        beats: [SAY_BEAT],
      });
      getTool("script_cutscene")!.run(project, {
        mapId,
        eventId: "ev_memory",
        x: 1,
        y: 1,
        trigger: "action",
        beats: [{ kind: "say", speaker: "나", text: "두 번째 장면." }],
      });
      const cutscenes = map.events.filter((event) => event.id === "ev_memory");
      expect(cutscenes).toHaveLength(1);
      expect(cutscenes[0].pages).toHaveLength(1);
      expect(cutscenes[0].pages?.[0].commands).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "text", body: "두 번째 장면." }),
      ]));
      expect([cutscenes[0].x, cutscenes[0].y]).toEqual([8, 8]);
    });
  });
});

describe("aiPlacementInvestigationPuzzles", () => {
  isolateTimers();
  function fixture(): { project: Project; map: GameMap; mapId: string } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    return { project, map, mapId };
  }
  function setSolid(map: GameMap, x: number, y: number, tile: number): void {
    map.lowerTiles[y * map.width + x] = tile;
    map.upperTiles[y * map.width + x] = TILE.EMPTY;
  }
  function solidBlock(map: GameMap, cx: number, cy: number, radius: number, tile: number = TILE.WALL): void {
    for (let y = cy - radius; y <= cy + radius; y += 1) {
      for (let x = cx - radius; x <= cx + radius; x += 1) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        setSolid(map, x, y, tile);
      }
    }
  }
  function eventsByIds(map: GameMap, ids: readonly string[]): GameEvent[] {
    return ids.map((id) => {
      const event = map.events.find((entry) => entry.id === id);
      if (!event) throw new Error(`event not found: ${id}`);
      return event;
    });
  }
  type PuzzleData = {
    readonly created: number;
    readonly skipped: number;
    readonly eventIds: readonly string[];
    readonly plateSwitchIds?: readonly string[];
  };
  describe("조사 퍼즐 이벤트 통행 가능 배치", () => {
    it("push-switches는 물 발판을 착지시키고 막힌 발판만 건너뛰며 남은 배선을 맞춘다", () => {
      const { project, map, mapId } = fixture();
      setSolid(map, 4, 4, TILE.WATER);
      // 자동 착지 탐색 반경이 5칸이 됐다(#2894) — 막힌 발판은 반경 5 블록으로 둘러야 skip 된다.
      solidBlock(map, 10, 8, 5, TILE.WATER);
      expect(isPassable(project, map, 4, 4)).toBe(false);
      expect(isPassable(project, map, 10, 8)).toBe(false);

      const result = getTool("compile_puzzle")!.run(project, {
        mapId,
        puzzleId: "water_plates",
        kind: "push-switches",
        plates: [
          { at: { x: 4, y: 4 } },
          { at: { x: 10, y: 8 } },
          { at: { x: 16, y: 4 } },
        ],
        all: true,
        onSolve: { setSwitch: "sw_water_plates_solved" },
      });

      const data = result.data as PuzzleData;
      expect(data).toMatchObject({ created: 2, skipped: 1 });
      expect(data.eventIds).toHaveLength(2);
      expect(data.plateSwitchIds).toHaveLength(2);
      const events = eventsByIds(map, data.eventIds);
      expect(events.every((event) => isPassable(project, map, event.x, event.y))).toBe(true);
      expect(result.warnings?.some((warning) => warning.includes("(4, 4)") && warning.includes("위치 자동 조정"))).toBe(true);
      expect(result.warnings?.some((warning) => warning.includes("(10, 8)") && warning.includes("skip"))).toBe(true);

      const wiring = JSON.stringify(events.map((event) => event.pages?.[0]?.commands));
      for (const switchId of data.plateSwitchIds ?? []) expect(wiring).toContain(switchId);
      expect(wiring).not.toContain("sw_water_plates_plate_2");
    });

    it("push-switches는 같은 자동 착지 칸을 재사용하지 않고 남은 발판을 건너뛴다", () => {
      const { project, map, mapId } = fixture();
      // 탐색 반경 5칸(#2894) 안의 착지 칸이 블록 윗변의 (6, 3) 하나뿐이도록 반경 5 블록으로 막는다(옛 반경 3 의 (6, 5) 와 같은 자리).
      // 버들항 기본 칩셋에서 TILE.GRASS 는 통행 불가다 — 맵의 빈 바닥 타일로 착지 칸을 연다.
      const ground = map.lowerTiles[0]!;
      solidBlock(map, 8, 8, 5, TILE.WATER);
      solidBlock(map, 9, 8, 5, TILE.WATER);
      setSolid(map, 6, 3, ground);

      const result = getTool("compile_puzzle")!.run(project, {
        mapId,
        puzzleId: "reserved_plates",
        kind: "push-switches",
        plates: [{ at: { x: 8, y: 8 } }, { at: { x: 9, y: 8 } }],
        all: true,
        onSolve: {},
      });

      const data = result.data as PuzzleData;
      expect(data).toMatchObject({ created: 1, skipped: 1 });
      const positions = eventsByIds(map, data.eventIds).map((event) => `${event.x},${event.y}`);
      expect(new Set(positions).size).toBe(positions.length);
      expect(result.warnings?.some((warning) => warning.includes("총 1개 skip"))).toBe(true);
    });

    it("switch-sequence는 같은 자동 착지 칸을 재사용하지 않고 남은 노드를 건너뛴다", () => {
      const { project, map, mapId } = fixture();
      // 탐색 반경 5칸(#2894) 안의 착지 칸이 블록 윗변의 (6, 3) 하나뿐이도록 반경 5 블록으로 막는다(옛 반경 3 의 (6, 5) 와 같은 자리).
      // 버들항 기본 칩셋에서 TILE.GRASS 는 통행 불가다 — 맵의 빈 바닥 타일로 착지 칸을 연다.
      const ground = map.lowerTiles[0]!;
      solidBlock(map, 8, 8, 5, TILE.WATER);
      solidBlock(map, 9, 8, 5, TILE.WATER);
      setSolid(map, 6, 3, ground);

      const result = getTool("compile_puzzle")!.run(project, {
        mapId,
        puzzleId: "reserved_sequence",
        kind: "switch-sequence",
        nodes: [
          { at: { x: 8, y: 8 }, name: "첫 장치" },
          { at: { x: 9, y: 8 }, name: "둘째 장치" },
        ],
        order: [0, 1],
        onSolve: {},
      });

      const data = result.data as PuzzleData;
      expect(data).toMatchObject({ created: 1, skipped: 1 });
      const positions = eventsByIds(map, data.eventIds).map((event) => `${event.x},${event.y}`);
      expect(new Set(positions).size).toBe(positions.length);
      expect(result.warnings?.some((warning) => warning.includes("총 1개 skip"))).toBe(true);
    });

    it("switch-sequence는 접근 가능한 물 노드는 유지하고 사방이 막힌 노드는 자동 착지시킨다", () => {
      const { project, map, mapId } = fixture();
      setSolid(map, 3, 3, TILE.WATER);
      solidBlock(map, 10, 7, 1, TILE.WALL);
      expect(isPassable(project, map, 3, 3)).toBe(false);
      expect(isPassable(project, map, 10, 7)).toBe(false);

      const result = getTool("compile_puzzle")!.run(project, {
        mapId,
        puzzleId: "wall_sequence",
        kind: "switch-sequence",
        nodes: [
          { at: { x: 3, y: 3 }, name: "물 위 액자" },
          { at: { x: 10, y: 7 }, name: "갇힌 액자" },
        ],
        order: [0, 1],
        onSolve: { setSwitch: "sw_wall_sequence_solved" },
      });

      const data = result.data as PuzzleData;
      expect(data).toMatchObject({ created: 2, skipped: 0 });
      const [waterNode, landedNode] = eventsByIds(map, data.eventIds);
      expect([waterNode.x, waterNode.y]).toEqual([3, 3]);
      expect([landedNode.x, landedNode.y]).not.toEqual([10, 7]);
      expect(isPassable(project, map, landedNode.x, landedNode.y)).toBe(true);
      expect(result.warnings?.some((warning) => warning.includes("(10, 7)") && warning.includes("위치 자동 조정"))).toBe(true);
    });

    it("password와 item-gate도 action 상호작용 배치 규칙을 따른다", () => {
      const passwordFixture = fixture();
      setSolid(passwordFixture.map, 5, 5, TILE.WATER);
      expect(isPassable(passwordFixture.project, passwordFixture.map, 5, 5)).toBe(false);

      const passwordResult = getTool("compile_puzzle")!.run(passwordFixture.project, {
        mapId: passwordFixture.mapId,
        puzzleId: "water_password",
        kind: "password",
        at: { x: 5, y: 5 },
        answer: "1234",
        onSolve: {},
      });
      const passwordData = passwordResult.data as PuzzleData;
      const passwordEvent = eventsByIds(passwordFixture.map, passwordData.eventIds)[0];
      expect([passwordEvent.x, passwordEvent.y]).toEqual([5, 5]);

      const gateFixture = fixture();
      solidBlock(gateFixture.map, 11, 8, 1, TILE.WALL);
      expect(isPassable(gateFixture.project, gateFixture.map, 11, 8)).toBe(false);

      const gateResult = getTool("compile_puzzle")!.run(gateFixture.project, {
        mapId: gateFixture.mapId,
        puzzleId: "walled_gate",
        kind: "item-gate",
        at: { x: 11, y: 8 },
        requiredItemId: DEFAULT_ITEM_ID,
        onSolve: {},
      });
      const gateData = gateResult.data as PuzzleData;
      const gateEvent = eventsByIds(gateFixture.map, gateData.eventIds)[0];
      expect([gateEvent.x, gateEvent.y]).not.toEqual([11, 8]);
      expect(isPassable(gateFixture.project, gateFixture.map, gateEvent.x, gateEvent.y)).toBe(true);
      expect(gateResult.warnings?.some((warning) => warning.includes("(11, 8)") && warning.includes("위치 자동 조정"))).toBe(true);
    });

    it("열린 바닥에서는 네 퍼즐의 작성 좌표를 그대로 보존한다", () => {
      const { project, map, mapId } = fixture();

      const sequence = getTool("compile_puzzle")!.run(project, {
        mapId,
        puzzleId: "open_sequence",
        kind: "switch-sequence",
        nodes: [{ at: { x: 2, y: 2 } }, { at: { x: 3, y: 2 } }],
        order: [0, 1],
        onSolve: {},
      });
      const password = getTool("compile_puzzle")!.run(project, {
        mapId,
        puzzleId: "open_password",
        kind: "password",
        at: { x: 6, y: 2 },
        answer: "7",
        onSolve: {},
      });
      const gate = getTool("compile_puzzle")!.run(project, {
        mapId,
        puzzleId: "open_gate",
        kind: "item-gate",
        at: { x: 9, y: 2 },
        requiredItemId: DEFAULT_ITEM_ID,
        onSolve: {},
      });
      const plates = getTool("compile_puzzle")!.run(project, {
        mapId,
        puzzleId: "open_plates",
        kind: "push-switches",
        plates: [{ at: { x: 12, y: 2 } }, { at: { x: 13, y: 2 } }],
        all: true,
        onSolve: {},
      });

      expect(eventsByIds(map, (sequence.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[2, 2], [3, 2]]);
      expect(eventsByIds(map, (password.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[6, 2]]);
      expect(eventsByIds(map, (gate.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[9, 2]]);
      expect(eventsByIds(map, (plates.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[12, 2], [13, 2]]);
      expect(sequence.warnings).toBeUndefined();
      // 자리는 그대로다(위치 조정 경고 없음) — 그 칸에 물건 타일이 없다는 알림 하나만 온다.
      expect(password.warnings).toEqual([expect.stringContaining("has no picture")]);
      expect(gate.warnings).toBeUndefined();
      expect(plates.warnings).toBeUndefined();
    });
  });
});

describe("aiPlacementLighting", () => {
  isolateTimers();
  type LightingToolCase = {
    readonly name: string;
    readonly label: string;
    readonly args: (mapId: string, area: Rect) => Record<string, unknown>;
  };
  const CASES: readonly LightingToolCase[] = [
    {
      name: "set_lighting_volume",
      label: "영역 조명",
      args: (mapId, area) => ({ mapId, ambient: 0.7, applyMode: "event", area }),
    },
    {
      name: "set_scene_mood",
      label: "장면 분위기",
      args: (mapId, area) => ({
        mapId,
        applyMode: "event",
        weather: { kind: "fog", intensity: 0.4 },
        lighting: { ambient: 0.7, area },
      }),
    },
  ];
  function fixture(): { project: Project; map: GameMap; mapId: string } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    return { project, map: project.maps[mapId], mapId };
  }
  function setSolid(map: GameMap, x: number, y: number, tile: number): void {
    map.lowerTiles[y * map.width + x] = tile;
    map.upperTiles[y * map.width + x] = TILE.EMPTY;
  }
  function cells(area: Rect): Array<{ x: number; y: number }> {
    const result: Array<{ x: number; y: number }> = [];
    for (let y = area.y; y < area.y + area.h; y += 1) {
      for (let x = area.x; x < area.x + area.w; x += 1) result.push({ x, y });
    }
    return result;
  }
  for (const toolCase of CASES) {
    describe(`${toolCase.name} 통행 불가 칸 제외`, () => {
      it(`${toolCase.label} 영역에서 물과 벽을 건너뛰고 통행 가능 칸에만 이벤트를 만든다`, () => {
        const { project, map, mapId } = fixture();
        const area = { x: 2, y: 2, w: 3, h: 2 };
        setSolid(map, 2, 2, TILE.WATER);
        setSolid(map, 3, 2, TILE.WALL);
        expect(isPassable(project, map, 2, 2)).toBe(false);
        expect(isPassable(project, map, 3, 2)).toBe(false);
        const passableCount = cells(area).filter(({ x, y }) => isPassable(project, map, x, y)).length;

        const result = getTool(toolCase.name)!.run(project, toolCase.args(mapId, area));

        const data = result.data as { eventIds: string[] };
        expect(data.eventIds).toHaveLength(passableCount);
        const created = map.events.filter((event) => data.eventIds.includes(event.id));
        expect(created).toHaveLength(passableCount);
        for (const event of created) expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings?.[0]).toContain("2개");
        expect(result.warnings?.[0]).toContain("(2, 2)");
        expect(result.warnings?.[0]).toContain("(3, 2)");
      });

      it(`${toolCase.label} 영역이 모두 통행 가능하면 이전과 같은 수의 이벤트를 만든다`, () => {
        const { project, map, mapId } = fixture();
        const area = { x: 8, y: 8, w: 2, h: 2 };
        expect(cells(area).every(({ x, y }) => isPassable(project, map, x, y))).toBe(true);

        const result = getTool(toolCase.name)!.run(project, toolCase.args(mapId, area));

        const data = result.data as { eventIds: string[] };
        expect(data.eventIds).toHaveLength(area.w * area.h);
        expect(result.warnings).toBeUndefined();
      });
    });
  }
});

describe("aiPlacementStarterMonsters", () => {
  isolateTimers();
  function fixture(): { project: Project; map: GameMap; mapId: string; speciesId: string } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const speciesId = project.database.monsterSpecies[0]?.id;
    if (!speciesId) throw new Error("fixture monster species missing");
    return { project, map, mapId, speciesId };
  }
  function setWater(map: GameMap, x: number, y: number): void {
    map.lowerTiles[y * map.width + x] = TILE.WATER;
    map.upperTiles[y * map.width + x] = TILE.EMPTY;
  }
  function waterBlock(map: GameMap, cx: number, cy: number, radius: number): void {
    for (let y = cy - radius; y <= cy + radius; y += 1) {
      for (let x = cx - radius; x <= cx + radius; x += 1) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        setWater(map, x, y);
      }
    }
  }
  function blockInteractionCell(map: GameMap, x: number, y: number): void {
    setWater(map, x, y);
    setWater(map, x, y + 1);
    setWater(map, x, y - 1);
    setWater(map, x + 1, y);
    setWater(map, x - 1, y);
  }
  function eventById(map: GameMap, id: string): GameEvent {
    const event = map.events.find((entry) => entry.id === id);
    if (!event) throw new Error(`event not found: ${id}`);
    return event;
  }
  describe("give_starter_monsters 통행 가능 배치", () => {
    it("시작 위치 옆 기본 칸이 물로 막히면 통행 가능 칸으로 자동 조정하고 경고한다", () => {
      const { project, map, speciesId } = fixture();
      project.startPos = { x: 8, y: 8 };
      project.system.monsterCollection = false;
      blockInteractionCell(map, 9, 8);
      expect(isPassable(project, map, 9, 8)).toBe(false);

      const result = getTool("give_starter_monsters")!.run(project, { speciesIds: [speciesId] });

      const event = eventById(map, "ev_starter_monsters");
      expect(isPassable(project, map, event.x, event.y)).toBe(true);
      expect([event.x, event.y]).not.toEqual([9, 8]);
      expect(result.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining(`(9, 8) → (${event.x}, ${event.y})`),
        expect.stringContaining("system.monsterCollection"),
      ]));
    });

    it("명시한 물 좌표도 같은 방식으로 통행 가능 칸에 자동 착지한다", () => {
      const { project, map, mapId, speciesId } = fixture();
      blockInteractionCell(map, 12, 10);
      expect(isPassable(project, map, 12, 10)).toBe(false);

      const result = getTool("give_starter_monsters")!.run(project, {
        speciesIds: [speciesId],
        actorEvent: { mapId, eventId: "ev_requested_starter", x: 12, y: 10 },
      });

      const event = eventById(map, "ev_requested_starter");
      expect(isPassable(project, map, event.x, event.y)).toBe(true);
      expect([event.x, event.y]).not.toEqual([12, 10]);
      expect(result.warnings?.some((warning) => warning.includes(`(12, 10) → (${event.x}, ${event.y})`))).toBe(true);
    });

    it("기본 칸이 통행 가능한 땅이면 좌표를 옮기지 않는다", () => {
      const { project, map, speciesId } = fixture();
      project.startPos = { x: 8, y: 8 };
      expect(isPassable(project, map, 9, 8)).toBe(true);

      const result = getTool("give_starter_monsters")!.run(project, { speciesIds: [speciesId] });

      const event = eventById(map, "ev_starter_monsters");
      expect([event.x, event.y]).toEqual([9, 8]);
      expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).not.toBe(true);
    });

    it("요청 좌표 반경 5칸이 전부 물이면 starter-monsters-impassable ToolError", () => {
      const { project, map, mapId, speciesId } = fixture();
      // nearestPassableCell now searches a clean landing up to radius 5 before failing (#2894), so the blocked area must cover radius 5.
      waterBlock(map, 12, 10, 5);
      expect(isPassable(project, map, 12, 10)).toBe(false);

      let error: unknown;
      try {
        getTool("give_starter_monsters")!.run(project, {
          speciesIds: [speciesId],
          actorEvent: { mapId, x: 12, y: 10 },
        });
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(ToolError);
      expect((error as ToolError).code).toBe("starter-monsters-impassable");
      expect((error as ToolError).message).toContain("(12, 10)");
      expect(map.events).toHaveLength(0);
    });

    // 2026-09-24 몬스터 수집 r2: place_npc 가 먼저 (4,5) 를 쓴 뒤 모델이 같은 칸에 ev_starters 를
    // 요청했다. 점유 검사가 없어 두 이벤트가 한 칸에 겹쳤고, 조사는 NPC 에 가려 ev_starters 를
    // 못 건드렸다(autoplay-failed: 첫 파트너 받기).
    it("요청 칸에 이미 다른 이벤트가 있으면 점유를 피해 자동 조정한다", () => {
      const { project, map, mapId, speciesId } = fixture();
      const npc = getTool("place_npc")!.run(project, { mapId, x: 4, y: 5, name: "바람 박사", pages: [{ lines: ["어서 오렴."] }] });
      const npcAt = npc.data as { x: number; y: number };
      expect(isPassable(project, map, npcAt.x, npcAt.y)).toBe(true);

      const result = getTool("give_starter_monsters")!.run(project, {
        speciesIds: [speciesId],
        actorEvent: { mapId, eventId: "ev_starters", x: npcAt.x, y: npcAt.y },
      });

      const starter = eventById(map, "ev_starters");
      expect([starter.x, starter.y]).not.toEqual([npcAt.x, npcAt.y]);
      expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
    });

    // r2 후속: 점유 회피 조정이 NPC 뒤 밀폐 주머니에 놓이면 플레이어가 도달할 수 없다.
    // 같은 반경 후보가 갈라지면 큰 통행 컴포넌트(방) 쪽을 골라야 한다.
    it("요청 칸 반경 안의 작은 주머니 대신 방 쪽 칸으로 조정한다", () => {
      const { project, map, mapId, speciesId } = fixture();
      // (6,6) 은 벽 세 겹 + 입구 NPC 로 봉인된 주머니. 방은 아래쪽이 트여 있다.
      for (const [wx, wy] of [[4, 5], [5, 5], [6, 5], [4, 6], [6, 7], [7, 6]] as const) {
        map.lowerTiles[wy * map.width + wx] = TILE.WALL;
        map.upperTiles[wy * map.width + wx] = TILE.EMPTY;
      }
      getTool("place_npc")!.run(project, { mapId, x: 5, y: 6, name: "마을 주민", pages: [{ lines: ["안녕."] }] });
      const npc = map.events.find((entry) => entry.name === "마을 주민");
      expect([npc?.x, npc?.y]).toEqual([5, 6]);

      const result = getTool("give_starter_monsters")!.run(project, {
        speciesIds: [speciesId],
        actorEvent: { mapId, eventId: "ev_starters", x: 5, y: 6 },
      });

      const starter = eventById(map, "ev_starters");
      expect([starter.x, starter.y]).not.toEqual([6, 6]);
      expect([starter.x, starter.y]).toEqual([4, 7]);
      expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
    });
  });
});

describe("aiPlacementStoryArc", () => {
  isolateTimers();
  function fixture(): { project: Project; map: GameMap; mapId: string } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    return { project, map: project.maps[mapId], mapId };
  }
  function setWater(map: GameMap, x: number, y: number): void {
    map.lowerTiles[y * map.width + x] = TILE.WATER;
    map.upperTiles[y * map.width + x] = TILE.EMPTY;
  }
  function waterBlock(map: GameMap, cx: number, cy: number, radius: number): void {
    for (let y = cy - radius; y <= cy + radius; y += 1) {
      for (let x = cx - radius; x <= cx + radius; x += 1) setWater(map, x, y);
    }
  }
  function storyArgs(mapId: string, x: number, y: number): Record<string, unknown> {
    return {
      id: "lost-crown",
      title: "잃어버린 왕관",
      mapId,
      eventId: "ev_story_beat",
      at: { x, y },
      opening: ["왕관의 흔적을 찾았다."],
      tutorialObjectives: [{ id: "find-clue", text: "단서를 조사한다." }],
      branchChoices: [
        { id: "return", label: "돌려준다", lines: ["왕관을 돌려준다."] },
        { id: "keep", label: "간직한다", lines: ["왕관을 숨긴다."] },
      ],
      twist: { enabled: false, flagId: "crown-twist", description: "", discoverInBranchId: "", reveal: [] },
    };
  }
  function eventById(map: GameMap): GameEvent {
    const event = map.events.find((candidate) => candidate.id === "ev_story_beat");
    if (!event) throw new Error("story beat event not found");
    return event;
  }
  describe("author_story_arc 비트 이벤트 통행 가능 배치", () => {
    it("통행 가능 이웃이 있는 물 타일은 상호작용 좌표를 유지한다", () => {
      const { project, map, mapId } = fixture();
      setWater(map, 5, 5);
      expect(isPassable(project, map, 5, 5)).toBe(false);

      const result = getTool("author_story_arc")!.run(project, storyArgs(mapId, 5, 5));

      const event = eventById(map);
      expect([event.x, event.y]).toEqual([5, 5]);
      expect((result.data as { adjusted: boolean }).adjusted).toBe(false);
    });

    it("3x3 물 블록 중심의 비트는 통행 가능 칸으로 자동 착지하고 경고한다", () => {
      const { project, map, mapId } = fixture();
      waterBlock(map, 8, 7, 1);
      expect(isPassable(project, map, 8, 7)).toBe(false);

      const result = getTool("author_story_arc")!.run(project, storyArgs(mapId, 8, 7));

      const event = eventById(map);
      expect(isPassable(project, map, event.x, event.y)).toBe(true);
      expect([event.x, event.y]).not.toEqual([8, 7]);
      expect((result.data as { adjusted: boolean }).adjusted).toBe(true);
      const warnings = result.warnings?.join("\n") ?? "";
      expect(warnings).toContain("(8, 7)");
      expect(warnings).toContain(`(${event.x}, ${event.y})`);
    });

    it("반경 5칸이 전부 물이면 story-beat-impassable ToolError를 낸다", () => {
      const { project, map, mapId } = fixture();
      // nearestPassableCell now searches a clean landing up to radius 5 before failing (#2894), so the blocked area must cover radius 5.
      waterBlock(map, 8, 7, 5);
      expect(isPassable(project, map, 8, 7)).toBe(false);

      let error: unknown;
      try {
        getTool("author_story_arc")!.run(project, storyArgs(mapId, 8, 7));
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(ToolError);
      expect((error as ToolError).code).toBe("story-beat-impassable");
      expect(map.events).toHaveLength(0);
    });

    it("일반 지면의 비트 좌표는 바꾸지 않는다", () => {
      const { project, map, mapId } = fixture();
      expect(isPassable(project, map, 4, 4)).toBe(true);

      const result = getTool("author_story_arc")!.run(project, storyArgs(mapId, 4, 4));

      const event = eventById(map);
      expect([event.x, event.y]).toEqual([4, 4]);
      expect((result.data as { adjusted: boolean }).adjusted).toBe(false);
      expect(result.warnings).toBeUndefined();
    });
  });
});

describe("battleNoEscapeNotice", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function panelOptions(runtime: ReturnType<typeof createBattleRuntime>): BattleCommandPanelOptions {
    return {
      runtime,
      submenu: null,
      setSubmenu: () => undefined,
      setDirectorState: () => undefined,
      render: () => undefined,
      runActorCommand: () => undefined,
      beginTargetCommand: () => undefined,
      confirmTargetSelection: () => undefined,
    };
  }
  describe("blocked escape notice", () => {
    it("tells the player this fight forbids escape, using the project's escape term", () => {
      const project = createBlankProject();
      project.meta.terms.escape = "도주";
      store.replace(project);
      const runtime = createBattleRuntime({
        project,
        troopId: DEFAULT_TROOP_ID,
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        rng: () => 0.5,
      });
      const snapshot = runtime.snapshot();
      const root = commandPanel(snapshot, panelOptions(runtime)) as unknown as FakeElement;
      const escape = root.querySelector("[data-testid='actor-command-escape']");
      if (!escape) throw new Error("missing escape command");

      expect(escape.dataset.battleCommandInert).toBe("true");
      // 버튼 안 한 줄은 짧은 형태 — 전체 문장은 2열 메뉴에서 「도주할 수…」로 잘렸다(1.36 VQA #4 #5 #8 #9 #27). 전체 문장은 위 배너가 말한다.
      expect(escape.dataset.battleCommandInertReason).toBe("도주 불가");
      expect(escape.getAttribute("aria-label")).toBe("도주: 도주 불가");
      expect(noEscapeInlineReason(snapshot)).toBe("도주 불가");
      expect(noEscapeNoticeLine(snapshot)).toBe("이 싸움에서는 도주할 수 없습니다.");

      const scene = document.createElement("div");
      applyBattleDirectorState(scene, { ...commandPromptState(snapshot, noEscapeNoticeLine(snapshot)), flash: true }, snapshot);
      expect(scene.dataset.battleNotice).toBe("true");
      expect(scene.dataset.battleDirectorStep).toBe("command");
      applyBattleDirectorState(scene, commandPromptState(snapshot), snapshot);
      expect(scene.dataset.battleNotice).toBeUndefined();
    });

    it("keeps a short inline reason but moves a long root reason to the cursor hint line (no spill onto the next row)", () => {
      const project = createBlankProject();
      project.meta.terms.escape = "도주";
      store.replace(project);
      const runtime = createBattleRuntime({ project, troopId: DEFAULT_TROOP_ID, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5 });
      const root = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
      expect(root.querySelector("[data-testid='actor-command-escape-reason']")?.textContent).toBe("도주 불가");

      project.meta.terms.escape = "후퇴 후 재집결";
      store.replace(project);
      const longRoot = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
      const escape = longRoot.querySelector("[data-testid='actor-command-escape']");
      expect(escape?.dataset.battleCommandInertReason).toBe("후퇴 후 재집결 불가");
      expect(longRoot.querySelector("[data-testid='actor-command-escape-reason']")).toBeNull();
    });

    it("leaves escape usable when the fight allows it", () => {
      const project = createBlankProject();
      store.replace(project);
      const runtime = createBattleRuntime({
        project,
        troopId: DEFAULT_TROOP_ID,
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        rng: () => 0.5,
      });
      const root = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
      const escape = root.querySelector("[data-testid='actor-command-escape']");
      if (!escape) throw new Error("missing escape command");
      expect(escape.dataset.battleCommandInert).toBeUndefined();
    });

    it("keeps the monster-battle sentence for the pokemon skin", () => {
      const project = createBlankProject();
      project.system.battleUiStyle = "pokemon";
      store.replace(project);
      expect(noEscapeNoticeLine({ troopId: "no_such_troop" })).toBe("도망칠 수 없다!");
    });
  });
});

describe("castleTileset", () => {
  isolateTimers();
  describe("bundled Castle atlas", () => {
    // 「옛 프로젝트에 성채 아틀라스를 심는다」 사례는 뺐다 — OpenGameArt 성채 PNG·번들 정의는 2026-10-07 저작권 정리로 지워졌다(ensureBundledTilesets 가 더는 심지 않는다).
    it("registers complete 32-column frames, including baked texture keys", () => {
      for (const key of [CASTLE_TILESET_TEXTURE_KEY, `${CASTLE_TILESET_TEXTURE_KEY}__transparent_ff00ff`]) {
        const add = vi.fn();
        const create = vi.fn();
        const scene = {
          textures: { get: () => ({ getFrameNames: () => [], add }) },
          anims: { exists: () => false, create },
        } as unknown as Phaser.Scene;
        if (key === CASTLE_TILESET_TEXTURE_KEY) registerTilesetTextureFrames(scene, key, 1024);
        else registerTilesetTextureFrames(scene, key, 1024, 16, 32);
        expect(add).toHaveBeenCalledWith("tile_31", 0, 496, 0, 16, 16);
        expect(add).toHaveBeenCalledWith("tile_32", 0, 0, 16, 16, 16);
        expect(add).toHaveBeenCalledWith("tile_1023", 0, 496, 496, 16, 16);
        expect(add).toHaveBeenCalledWith("tile_1023_se", 0, 504, 504, 8, 8);
        expect(create).not.toHaveBeenCalled(); // RM2K water-strip indices mean something else here.
      }
    });

    // 「성채 PNG·출처 고지를 웹 내보내기에 싣는다」 사례도 같은 정리로 뺐다 — 내보낼 성채 그림이 없다.
  });
});

describe("clearMap", () => {
  isolateTimers();
  const MAP_ID = "clear_map_target";
  function context(): ToolContext {
    const ctx = { project: createBlankProject() };
    const created = runTool(ctx, "create_map", {
      id: MAP_ID, name: "Clear fixture", width: 12, height: 10, border: "wall", bgm: { mode: "none" },
    });
    expect(created.ok, JSON.stringify(created.issues)).toBe(true);
    return ctx;
  }
  function paintSomething(ctx: ToolContext): void {
    const painted = runTool(ctx, "paint_tiles", {
      mapId: MAP_ID, layer: "lower", mode: "rect",
      from: { x: 2, y: 2 }, to: { x: 5, y: 5 }, tile: TILE.PATH,
    });
    expect(painted.ok, JSON.stringify(painted.issues)).toBe(true);
  }
  describe("clear_map", () => {
    it("is a registered write tool in the map domain", () => {
      const tool = getTool("clear_map");
      expect(tool).toBeDefined();
      expect(tool?.mode).toBe("write");
      expect(tool?.domains).toContain("map");
    });

    it("clears every cell to grass by default and drops tile stacks", () => {
      const ctx = context();
      paintSomething(ctx);
      const map = ctx.project.maps[MAP_ID];
      if (!map) throw new Error("Missing fixture map");
      map.lowerTileStacks = { [2 * map.width + 2]: [TILE.PATH, TILE.PATH] };
      map.upperTiles[3 * map.width + 3] = 199;

      const result = runTool(ctx, "clear_map", { mapId: MAP_ID, confirmDestroy: true });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const after = ctx.project.maps[MAP_ID];
      if (!after) throw new Error("Missing cleared map");
      expect(after.lowerTiles.every((tile) => tile === TILE.GRASS)).toBe(true);
      expect(after.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
      expect(after.lowerTileStacks ?? {}).toEqual({});
      expect(after.upperTileStacks ?? {}).toEqual({});
    });

    it("fill empty leaves a true void instead of ground", () => {
      const ctx = context();
      paintSomething(ctx);
      const result = runTool(ctx, "clear_map", { mapId: MAP_ID, fill: "empty", confirmDestroy: true });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const after = ctx.project.maps[MAP_ID];
      if (!after) throw new Error("Missing cleared map");
      expect(after.lowerTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
      expect(after.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
    });

    it("refuses without confirmDestroy and changes nothing", () => {
      const ctx = context();
      paintSomething(ctx);
      const before = structuredClone(ctx.project);
      const result = runTool(ctx, "clear_map", { mapId: MAP_ID });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("invalid-args");
      expect(ctx.project).toEqual(before);
    });

    it("keeps events by default and warns with their ids", () => {
      const ctx = context();
      const placed = runTool(ctx, "place_npc", {
        mapId: MAP_ID, x: 6, y: 6, name: "잔류 주민", pages: [{ lines: ["남아 있는다"] }],
      });
      expect(placed.ok, JSON.stringify(placed.issues)).toBe(true);
      const result = runTool(ctx, "clear_map", { mapId: MAP_ID, confirmDestroy: true });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const after = ctx.project.maps[MAP_ID];
      expect(after?.events).toHaveLength(1);
      // 쓰기 툴의 warnings 는 diff 로 전달된다(toolRunner 가 exec.warnings 를 diff.warnings 에 합친다).
      expect(result.diff?.warnings.join(" ")).toContain("남겨둠");
    });

    it("removes every event when asked and reports the removal in the diff", () => {
      const ctx = context();
      const placed = runTool(ctx, "place_npc", {
        mapId: MAP_ID, x: 6, y: 6, name: "철거 주민", pages: [{ lines: ["곧 사라진다"] }],
      });
      expect(placed.ok, JSON.stringify(placed.issues)).toBe(true);
      const result = runTool(ctx, "clear_map", { mapId: MAP_ID, events: "remove", confirmDestroy: true });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(ctx.project.maps[MAP_ID]?.events).toHaveLength(0);
      expect(result.diff?.eventsRemoved).toBe(1);
    });

    it("keeps the start cell walkable on an empty fill and warns", () => {
      const ctx = context();
      ctx.project.startMapId = MAP_ID;
      ctx.project.startPos = { x: 5, y: 5 };
      const result = runTool(ctx, "clear_map", { mapId: MAP_ID, fill: "empty", confirmDestroy: true });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const after = ctx.project.maps[MAP_ID];
      if (!after) throw new Error("Missing cleared map");
      expect(after.lowerTiles[5 * after.width + 5]).not.toBe(TILE.EMPTY);
      expect(result.diff?.warnings.join(" ")).toContain("시작 위치");
    });

    it("refuses to erase a recorded house and changes nothing", () => {
      const ctx = { project: completedHouseProject() };
      const before = structuredClone(ctx.project);
      const result = runTool(ctx, "clear_map", { mapId: ctx.project.startMapId, confirmDestroy: true });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("protected-house-write");
      expect(ctx.project).toEqual(before);
    });

    it("is a destructive outcome and forces the over-insertion review modal path", () => {
      expect(isDestructiveOutcome("clear_map", { mapId: MAP_ID, confirmDestroy: true }, undefined)).toBe(true);
      const result: ToolResult = { ok: true, summary: "clear_map" };
      const call: ProposedCall = { name: "clear_map", args: {}, summary: "clear", result, destructive: true };
      const review = reviewOverInsertion({ calls: [call], beforeMapCount: 1, afterMapCount: 1 });
      expect(review.needsReview).toBe(true);
      expect(review.destructive).toBe(true);
    });
  });
});
