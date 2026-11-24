import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { runTool } from "@/editor/tools";
import { DEFAULT_RECOLLECTION_PICTURE_RESOURCE_ID } from "@/editor/recollectionBeats";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";
import { createBlankProject, createBlankMap, TILE } from "@/project/defaults";
import { createMemoryCutsceneProject, MEMORY_CUTSCENE_MAP_ID, MEMORY_CUTSCENE_PICTURE_ID, MEMORY_CUTSCENE_PICTURE_RESOURCE_ID } from "./fixtures/memoryCutsceneFixture";
import { editorState } from "@/editor/editorState";
import { installSelectionChipHint, notifyRightDragRegionSelected, resetSelectionChipHintForTests, RIGHT_DRAG_REGION_HINT_KEY, RIGHT_DRAG_REGION_HINT_TEXT, SELECTION_CHIP_HINT_KEY, SELECTION_CHIP_HINT_TEXT, setRightDragRegionHintStorage } from "@/editor/selectionChipHint";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { planSelectionVillage } from "@/editor/selectionVillage";
import { terrainFrameViolations } from "@/project/terrainFrame";
import { newCommand } from "@/editor/eventCommandFactory";
import { createInterpreter } from "@/player/interpreter";
import type { Command, GameMap } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { buildConceptEvents } from "@/editor/interiorConceptEvents";
import type { ConceptPlacement } from "@/editor/interiorConceptCompose";
import { createEmptyRoomMap } from "@/editor/interiorRoomPipeline";
import { acceptedObjectNames, baseName, nearestStampObjects, resolveStampObject, type StampObjectEntry } from "@/ai/stampObjects";
import { expandStampObjects, parseStampPlan, type StampPlanFacts } from "@/ai/stampPlanner";
import { describeStampEffect, hasVisibleChange, measureStampEffect } from "@/editor/stampEffect";
import { createStampOrderQueue, formatStampOrderSummary, stampOrderRect, stampRectsOverlap, type StampOrderQueue } from "@/editor/stampOrderQueue";
import type { StampRunInput, StampRunResult } from "@/editor/stampPlaceRunner";
import { moveEvent, createDefaultGameEvent } from "@/editor/eventActions";
import { recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { paintTile } from "@/editor/tileActions";
import { store } from "@/project/store";
import { brushSizePatch, landBrushCells, landRectCells, landStepTarget, paintLandCells, softenShore } from "@/editor/terrainLandBrush";
import { applyTerrainPreset, hillPresetCells, pathPresetPoints, riverPresetCells } from "@/editor/terrainPresets";
import { layerTilePickAt, visibleTilePickAt } from "@/editor/tilePicking";
import { tileRectToClientRect } from "@/editor/selectionOverlayAnchor";
import { isolateTimers } from "./mergedTeardown";

describe("scriptCutsceneIntegration", () => {
  isolateTimers();
  describe("script_cutscene + run_scene_test", () => {
    // 컷신이 pan 으로 끝나면 끝날 때 카메라가 주인공에게 돌아온다 — 조작이 돌아왔는데 카메라가 화면에 고정돼 있으면
    // 주인공이 화면 밖으로 걸어 나간다(2026-09-24 회상 스토리). 그림은 컷신이 남긴 상태 그대로다.
    it("회상 컷신이 카메라 pan, 픽처 표시, 종료 후 입력 잠금 해제를 통과한다", () => {
      const project = createMemoryCutsceneProject();
      const result = runTool(
        { project },
        "run_scene_test",
        {
          mapId: MEMORY_CUTSCENE_MAP_ID,
          start: { x: 2, y: 2 },
          steps: [
            { kind: "interact" },
            {
              kind: "expect",
              cameraAt: { cx: characterSpriteX(2), cy: characterSpriteY(2), tolerance: 0.001 },
              pictureVisible: { id: MEMORY_CUTSCENE_PICTURE_ID, resourceId: MEMORY_CUTSCENE_PICTURE_RESOURCE_ID },
              cutsceneLocked: false,
            },
            { kind: "move", dir: "right" },
            { kind: "expect", playerAt: { x: 3, y: 2 } },
          ],
        }
      );

      expect(result.ok, result.summary).toBe(true);
      expect(result.data).toMatchObject({
        ok: true,
        finalState: {
          mapId: MEMORY_CUTSCENE_MAP_ID,
          x: 3,
          y: 2,
          cutsceneLocked: false,
        },
      });
    });

    it("memory_opening 프리셋은 회상 스틸을 올리고 끝나면 입력을 돌려준다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const placed = runTool(ctx, "script_cutscene_preset", {
        mapId,
        preset: "memory_opening",
        eventId: "ev_recollect",
        x: 2,
        y: 3,
      });
      expect(placed.ok, placed.summary).toBe(true);
      const result = runTool(ctx, "run_scene_test", {
        mapId,
        start: { x: 2, y: 2 },
        steps: [
          { kind: "interact" },
          {
            kind: "expect",
            pictureVisible: { id: "pic_memory", resourceId: DEFAULT_RECOLLECTION_PICTURE_RESOURCE_ID },
          },
          { kind: "interact" },
          { kind: "interact" },
          { kind: "expect", cutsceneLocked: false },
          { kind: "move", dir: "right" },
          { kind: "expect", playerAt: { x: 3, y: 2 } },
        ],
      });
      expect(result.ok, result.summary).toBe(true);
    });

    it("리소스 라벨 Decision1을 실제 효과음 id로 자동 해석한다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "script_cutscene", {
        mapId: ctx.project.startMapId,
        eventId: "ev_decision",
        x: 2,
        y: 2,
        beats: [
          { kind: "music", action: "se", resourceId: "Decision1" },
          { kind: "say", speaker: "수호석", text: "선택하라." },
        ],
      });

      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const event = ctx.project.maps[ctx.project.startMapId]?.events.find((entry) => entry.id === "ev_decision");
      expect(event?.pages?.[0]?.commands).toContainEqual({
        kind: "playAudio",
        resourceId: "easyrpg-sound-decision1",
        loop: false,
      });
      expect(result.diff?.warnings.join("\n") ?? "").toContain("Decision1");
    });
  });
  describe("script_cutscene 진행 비트(switch · transfer · ending)와 requiresSwitches", () => {
    function memoryProject() {
      const ctx = { project: createBlankProject() };
      const startMapId = ctx.project.startMapId;
      const next = runTool(ctx, "create_map", { id: "map_memory_2", name: "두 번째 기억", width: 12, height: 10 });
      expect(next.ok, next.summary).toBe(true);
      const [memento, gateDone] = ctx.project.switches.slice(0, 2).map((entry) => entry.id);
      return { ctx, startMapId, memento: memento!, gateDone: gateDone! };
    }

    it("메멘토 스위치가 켜지면 자동 컷신이 페이드 → 다음 기억으로 옮기고 잠금을 푼다", () => {
      const { ctx, startMapId, memento, gateDone } = memoryProject();
      const examine = runTool(ctx, "script_cutscene", {
        mapId: startMapId, eventId: "ev_memento", x: 3, y: 2, trigger: "action",
        beats: [{ kind: "say", speaker: "노을", text: "오래된 턴테이블이에요." }, { kind: "switch", switchId: memento }],
      });
      expect(examine.ok, examine.summary).toBe(true);
      const gate = runTool(ctx, "script_cutscene", {
        mapId: startMapId, eventId: "ev_gate", x: 6, y: 6, trigger: "auto", once: true, skippable: true,
        requiresSwitches: [memento],
        beats: [
          { kind: "say", speaker: "서하온", text: "다음 기억으로 간다." },
          { kind: "fade", direction: "out", durationMs: 400, wait: true },
          { kind: "switch", switchId: gateDone },
          { kind: "transfer", mapId: "map_memory_2", x: 4, y: 4, facing: "up" },
          { kind: "fade", direction: "in", durationMs: 400, wait: true },
        ],
      });
      expect(gate.ok, gate.summary).toBe(true);
      const page = ctx.project.maps[startMapId]!.events.find((event) => event.id === "ev_gate")!.pages![0]!;
      expect(page.conditions).toEqual([
        { kind: "switch", switchId: memento, value: true },
        { kind: "selfSwitch", key: "A", value: false },
      ]);
      const result = runTool(ctx, "run_scene_test", {
        mapId: startMapId,
        start: { x: 2, y: 2 },
        steps: [
          { kind: "face", dir: "right" },
          { kind: "interact" },
          { kind: "expect", mapId: "map_memory_2", playerAt: { x: 4, y: 4 }, cutsceneLocked: false, switchOn: gateDone },
        ],
      });
      expect(result.ok, result.summary).toBe(true);
    });

    it("건너뛰기 착지 라벨 뒤에 스위치·이동·엔딩이 남는다 — Esc 로 건너뛰어도 진행이 빠지지 않는다", () => {
      const { ctx, startMapId, gateDone } = memoryProject();
      const ending = runTool(ctx, "define_ending", { id: "ending_song", name: "마지막 소절", conditions: [] });
      expect(ending.ok, ending.summary).toBe(true);
      const placed = runTool(ctx, "script_cutscene", {
        mapId: startMapId, eventId: "ev_final", x: 5, y: 5, trigger: "action", skippable: true,
        beats: [
          { kind: "say", speaker: "별", text: "언니, 노래 불러 줘." },
          { kind: "switch", switchId: gateDone },
          { kind: "transfer", mapId: "map_memory_2", x: 4, y: 4 },
          { kind: "say", speaker: "노을", text: "병실로 돌아왔어요." },
          { kind: "ending", endingId: "ending_song" },
        ],
      });
      expect(placed.ok, placed.summary).toBe(true);
      const commands = ctx.project.maps[startMapId]!.events.find((event) => event.id === "ev_final")!.pages![0]!.commands;
      const kinds = commands.map((command) => command.kind);
      const skipLanding = kinds.indexOf("label");
      expect(skipLanding).toBeGreaterThan(0);
      const afterLanding = kinds.slice(skipLanding);
      expect(afterLanding).toContain("setSwitch");
      expect(afterLanding).toContain("transfer");
      expect(kinds.at(-1)).toBe("triggerEnding");
      expect(kinds.filter((kind) => kind === "transfer")).toHaveLength(1);
    });

    it("없는 맵·스위치·엔딩을 가리키면 어느 비트인지 짚어 거부한다", () => {
      const { ctx, startMapId } = memoryProject();
      const bad = runTool(ctx, "script_cutscene", {
        mapId: startMapId, trigger: "action",
        beats: [{ kind: "switch", switchId: "sw_nope" }, { kind: "transfer", mapId: "map_nope", x: 1, y: 1 }, { kind: "ending", endingId: "ending_nope" }],
      });
      expect(bad.ok).toBe(false);
      expect(bad.summary).toContain("beats[0].switchId");
      expect(bad.summary).toContain("beats[1].mapId");
      expect(bad.summary).toContain("beats[2].endingId");
      const missingGate = runTool(ctx, "script_cutscene", { mapId: startMapId, trigger: "auto", requiresSwitches: ["sw_nope"], beats: [{ kind: "wait", ms: 200 }] });
      expect(missingGate.ok).toBe(false);
      expect(missingGate.summary).toContain("sw_nope");
    });
  });
  describe("script_cutscene_preset ending_fade", () => {
    it("엔딩 스위치를 켜고 실제로 엔딩을 부르며, 한 번만 재생된다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const placed = runTool(ctx, "script_cutscene_preset", {
        mapId, preset: "ending_fade", eventId: "ev_last", x: 4, y: 4, trigger: "action",
        speaker: "노을", lines: ["노래가 끝까지 이어졌어요."], endingId: "ending_song", endingName: "마지막 소절",
      });
      expect(placed.ok, placed.summary).toBe(true);
      const page = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_last")!.pages![0]!;
      const kinds = page.commands.map((command) => command.kind);
      expect(kinds).toContain("triggerEnding");
      expect(kinds).not.toContain("m2Command:camera");
      const result = runTool(ctx, "run_scene_test", {
        mapId, start: { x: 3, y: 4 },
        steps: [{ kind: "face", dir: "right" }, { kind: "interact" }, { kind: "expect", endingReached: "ending_song" }],
      });
      expect(result.ok, result.summary).toBe(true);
    });
  });
  describe("script_cutscene moveActor 경로 경고", () => {
    it("벽·맵 밖으로 걷는 이벤트 이동을 막힌 칸과 함께 경고한다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const npc = runTool(ctx, "place_npc", { mapId, name: "노을", x: 1, y: 1, lines: ["선배!"] });
      expect(npc.ok, npc.summary).toBe(true);
      const npcId = ctx.project.maps[mapId]!.events.find((event) => event.name === "노을")!.id;
      const placed = runTool(ctx, "script_cutscene", {
        mapId, trigger: "action", x: 5, y: 5,
        beats: [{ kind: "moveActor", target: npcId, moves: [{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }] }],
      });
      expect(placed.ok, placed.summary).toBe(true);
      const warnings = (placed.diff as { warnings?: string[] } | undefined)?.warnings ?? placed.warnings ?? [];
      expect(JSON.stringify(warnings)).toContain("컷신 이동 막힘");
    });
  });
  describe("script_cutscene camera return·fixed 는 카탈로그를 통과한다", () => {
    it("camera return 비트가 거부되지 않고, fixed 는 lock 으로 남는다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const placed = runTool(ctx, "script_cutscene", {
        mapId, trigger: "action", x: 5, y: 5, eventId: "ev_cam",
        beats: [
          { kind: "camera", mode: "pan", x: 8, y: 6, durationMs: 300 },
          { kind: "say", text: "저기다." },
          { kind: "camera", mode: "return", durationMs: 300 },
          { kind: "camera", mode: "fixed", x: 3, y: 3 },
        ],
      });
      expect(placed.ok, placed.summary).toBe(true);
      const modes = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_cam")!.pages![0]!.commands
        .filter((command) => command.kind === "m2Command").map((command) => (command as { fields: { mode?: string } }).fields.mode);
      expect(modes).toContain("return");
      expect(modes).toContain("lock");
    });
  });
});

describe("selectionChipHint", () => {
  isolateTimers();
  // e9d308b43a: 선택 액션 바의 「AI 작업」 단추는 옆에 뜨는 AI 지시 줄로 바뀌었다 — 안내도 그 줄을 가리킨다.
  // 문구는 계약이 아니므로 내보낸 상수 그대로를 비교한다(없어진 라벨을 다시 가리키지 않는지만 따로 본다).
  const SELECT_HINT = SELECTION_CHIP_HINT_TEXT;
  const RIGHT_DRAG_HINT = RIGHT_DRAG_REGION_HINT_TEXT;
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();

    get length(): number {
      return this.values.size;
    }

    clear(): void {
      this.values.clear();
    }

    getItem(key: string): string | null {
      return this.values.get(key) ?? null;
    }

    key(index: number): string | null {
      return Array.from(this.values.keys())[index] ?? null;
    }

    removeItem(key: string): void {
      this.values.delete(key);
    }

    setItem(key: string, value: string): void {
      this.values.set(key, value);
    }
  }
  function fakeBody(): FakeElement {
    if (document.body instanceof FakeElement) return document.body;
    throw new Error("Expected fake body");
  }
  describe("선택 도구 AI 칩 힌트", () => {
    let restore: () => void;
    let storage: MemoryStorage;

    beforeEach(() => {
      restore = installFakeDom();
      storage = new MemoryStorage();
      resetSelectionChipHintForTests();
      editorState.set({ tool: "paint", layer: "lower" });
    });

    afterEach(() => {
      restore();
      resetSelectionChipHintForTests();
    });

    it("선택 도구로 처음 바꿀 때 1회만 토스트를 띄우고 플래그를 저장한다", () => {
      installSelectionChipHint(storage);

      editorState.set({ tool: "select" });

      const toastNode = findByTestId(fakeBody(), "toast");
      expect(toastNode?.textContent).toContain(SELECT_HINT);
      expect(storage.getItem(SELECTION_CHIP_HINT_KEY)).toBe("1");

      // 다른 도구로 갔다가 다시 select — 재노출 없음.
      if (toastNode) toastNode.textContent = "";
      editorState.set({ tool: "erase" });
      editorState.set({ tool: "select" });
      expect(findByTestId(fakeBody(), "toast")?.textContent ?? "").not.toContain(SELECT_HINT);
    });

    it("이미 본 사용자는 처음부터 토스트가 없다", () => {
      storage.setItem(SELECTION_CHIP_HINT_KEY, "1");
      installSelectionChipHint(storage);

      editorState.set({ tool: "select" });

      expect(findByTestId(fakeBody(), "toast")).toBeNull();
    });

    it("select가 아닌 도구 전환은 반응하지 않는다", () => {
      installSelectionChipHint(storage);

      editorState.set({ tool: "fill" });
      editorState.set({ tool: "event", layer: "event" });

      expect(findByTestId(fakeBody(), "toast")).toBeNull();
      expect(storage.getItem(SELECTION_CHIP_HINT_KEY)).toBeNull();
    });
  });
  // 우클릭 드래그는 **다른 제스처**다. 선택 도구 전환에 걸린 위 힌트는 우클릭 사용자를 못 잡고,
  // 기본(beginner) 모드에서는 선택 도구가 도구막대에 없어 아예 뜨지 않는다.
  describe("우클릭 드래그 영역 힌트", () => {
    let restore: () => void;
    let storage: MemoryStorage;

    beforeEach(() => {
      restore = installFakeDom();
      storage = new MemoryStorage();
      resetSelectionChipHintForTests();
      setRightDragRegionHintStorage(storage);
    });

    afterEach(() => {
      restore();
      resetSelectionChipHintForTests();
    });

    it("첫 우클릭 드래그 성공 직후 1회만 토스트를 띄운다", () => {
      notifyRightDragRegionSelected();

      const toastNode = findByTestId(fakeBody(), "toast");
      // 문구는 화면에 실제로 있는 것만 가리킨다 — 액션 바의 「AI 작업」 단추는 없어졌다(e9d308b43a).
      expect(toastNode?.textContent).toContain(RIGHT_DRAG_HINT);
      expect(toastNode?.textContent).not.toContain("AI 작업");
      expect(storage.getItem(RIGHT_DRAG_REGION_HINT_KEY)).toBe("1");

      if (toastNode) toastNode.textContent = "";
      notifyRightDragRegionSelected();
      expect(findByTestId(fakeBody(), "toast")?.textContent ?? "").not.toContain(RIGHT_DRAG_HINT);
    });

    it("이미 본 사용자는 처음부터 토스트가 없다", () => {
      storage.setItem(RIGHT_DRAG_REGION_HINT_KEY, "1");

      notifyRightDragRegionSelected();

      expect(findByTestId(fakeBody(), "toast")).toBeNull();
    });

    it("선택 도구 힌트와 서로 다른 키를 쓴다 — 한쪽을 봤다고 다른 쪽이 사라지지 않는다", () => {
      storage.setItem(SELECTION_CHIP_HINT_KEY, "1");

      notifyRightDragRegionSelected();

      expect(findByTestId(fakeBody(), "toast")?.textContent).toContain(RIGHT_DRAG_HINT);
      expect(RIGHT_DRAG_REGION_HINT_KEY).not.toBe(SELECTION_CHIP_HINT_KEY);
    });
  });
});

describe("selectionVillage", () => {
  isolateTimers();
  function plateauProject() {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const levels = new Array<number>(map.width * map.height).fill(0);
    for (let y = 2; y < 13; y++) for (let x = 2; x < 18; x++) levels[y * map.width + x] = 2;
    map.relief = { width: map.width, height: map.height, levels };
    map.terrainDesign = { frameLock: true };
    return { project, map };
  }
  describe("선택 안 마을", () => {
    it("땅 모양 잠금이 켜져도 선택 안에만 집을 짓고 높이·경사로·물은 그대로다", () => {
      const { project, map } = plateauProject();
      const tileset = project.tilesets[map.tilesetId]!;
      const rect = { x: 4, y: 3, width: 12, height: 10 };
      const plan = planSelectionVillage(map, tileset, rect);
      expect(plan.houses).toBeGreaterThanOrEqual(2);
      const next = structuredClone(project);
      plan.apply!(next.maps[map.id]!);
      const before = project.maps[map.id]!, after = next.maps[map.id]!;
      for (let i = 0; i < before.lowerTiles.length; i++) {
        const x = i % before.width, y = Math.floor(i / before.width);
        const inRect = x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
        if (!inRect) expect([after.lowerTiles[i], after.upperTiles[i]]).toEqual([before.lowerTiles[i], before.upperTiles[i]]);
      }
      expect(terrainFrameViolations(project, next)).toEqual([]);
    });

    it("잠긴 칸뿐이면 짓지 않고 잠금 때문이라고 알린다", () => {
      const { project, map } = plateauProject();
      map.terrainDesign = { lockedCells: Array.from({ length: map.width * map.height }, (_, i) => i) };
      const plan = planSelectionVillage(map, project.tilesets[map.tilesetId]!, { x: 4, y: 3, width: 12, height: 10 });
      expect(plan.apply).toBeUndefined();
      expect(plan.blockedByLocks).toBe(true);
    });
  });
});

describe("shopProcessingCommand", () => {
  isolateTimers();
  function mkSession(): PlaySessionLike {
    return {
      flags: {},
      switches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [],
      actorVitals: {},
      currentMapId: "m1",
      x: 0,
      y: 0,
    };
  }
  describe("Shop Processing command options", () => {
    it("creates RM-style shop processing defaults", () => {
      // 진열은 상품 추가·서식이 채운다. 없는 잡화 ID를 기본값으로 심지 않는다.
      expect(newCommand("shop")).toMatchObject({
        kind: "shop",
        itemIds: [],
        shopType: "normal",
        messageType: "welcome",
        branchOnTransaction: false,
        transactionBranch: [],
        quantityMode: "single",
      });
    });

    it("passes RM-style shop options through the interpreter handoff", () => {
      const command: Command = {
        kind: "shop",
        itemIds: ["item_potion"],
        shopType: "sellOnly",
        messageType: "welcome",
        branchOnTransaction: true,
        allowSell: true,
        quantityMode: "select",
      };
      const result = createInterpreter([command], mkSession()).start();

      expect(result).toEqual({
        kind: "shop",
        itemIds: ["item_potion"],
        shopType: "sellOnly",
        messageType: "welcome",
        branchOnTransaction: true,
        allowSell: true,
        quantityMode: "select",
      });
    });

    it("runs the transaction branch only after a buy or sell succeeds", () => {
      const command: Command = {
        kind: "shop",
        itemIds: ["item_potion"],
        branchOnTransaction: true,
        transactionBranch: [{ kind: "text", body: "Thank you." }],
      };
      const interpreter = createInterpreter([command, { kind: "text", body: "After shop." }], mkSession());

      expect(interpreter.start()).toMatchObject({ kind: "shop", branchOnTransaction: true });
      expect(interpreter.resume(true)).toMatchObject({ kind: "text", body: "Thank you." });
      expect(interpreter.resume(undefined)).toMatchObject({ kind: "text", body: "After shop." });
    });

    it("skips the transaction branch when the shop closes without a transaction", () => {
      const command: Command = {
        kind: "shop",
        itemIds: ["item_potion"],
        branchOnTransaction: true,
        transactionBranch: [{ kind: "text", body: "Thank you." }],
      };
      const interpreter = createInterpreter([command, { kind: "text", body: "After shop." }], mkSession());

      expect(interpreter.start()).toMatchObject({ kind: "shop", branchOnTransaction: true });
      expect(interpreter.resume(false)).toMatchObject({ kind: "text", body: "After shop." });
    });
  });
});

describe("stairTransferDepth", () => {
  isolateTimers();
  describe('stair transfer coverage + single-tile stair depth', () => {
    it('creates a transfer event for every tile of a horizontal 3-wide stair', () => {
      const map = createEmptyRoomMap({mapId:'stair3',name:'stair3',width:10,height:10,wings:[{x:1,y:1,w:8,h:8}],door:{x:1,y:8},theme:'corridor',seed:1});
      // stairs_horizontal lower 141/111/171 row at y=4, x=3..5
      const cells = [
        { x: 3, y: 4, layer: 'lower' as const, tile: 141 },
        { x: 4, y: 4, layer: 'lower' as const, tile: 111 },
        { x: 5, y: 4, layer: 'lower' as const, tile: 171 },
      ];
      for (const c of cells) map.lowerTiles[c.y * 10 + c.x] = c.tile;
      const placement = { objectId: 'stairs_horizontal', thingId: 'main_stair', label: '돌계단', roomId: 'corridor', anchor: { x: 4, y: 4 }, cells, chips: ['pass', 'transfer'], required: true } as ConceptPlacement;
      const result = buildConceptEvents(map, [placement], { door: { x: 1, y: 8 }, transferTarget: { mapId: 'up', x: 2, y: 2 } });
      expect(result.events.length).toBe(3);
      // 중앙 앵커가 첫 번째 — 기존 호출부(listConceptConnections[0]를 계단 대표점으로 쓰는 곳)와 호환.
      expect(result.events.map((e) => ({ x: e.x, y: e.y }))).toEqual([{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 5, y: 4 }]);
      for (const e of result.events) {
        expect(e.pages?.[0]?.commands.some((c) => c.kind === "transfer" && (c as { mapId: string }).mapId === "up")).toBe(true);
      }
    });

    it('single-tile stairs_down event does not float above character', () => {
      const map = createEmptyRoomMap({mapId:'stair1',name:'stair1',width:8,height:8,wings:[{x:1,y:1,w:6,h:6}],door:{x:1,y:5},theme:'corridor',seed:1});
      map.lowerTiles[3 * 8 + 3] = 72;
      map.upperTiles[3 * 8 + 3] = 474;
      const placement = { objectId: 'stairs_down', thingId: 'down_stair', label: '아래층 계단', roomId: 'corridor', anchor: { x: 3, y: 3 }, cells: [{ x: 3, y: 3, layer: 'upper', tile: 474 }], chips: ['pass', 'event'], required: true } as ConceptPlacement;
      const result = buildConceptEvents(map, [placement], { door: { x: 1, y: 5 } });
      expect(result.events[0]?.pages?.[0]?.priority).toBe('below');
    });
  });
});

// 바로 깔기 물건 찾기 — 이름 대조·동의어 묶음·거절·칸 고르기·실제 변경 측정. 네트워크·스토어 없음.
// 코퍼스(scripts/qa/stamp-place-corpus.mts) 2026-10-15: 「화분」이 자갈·물고기·풀 얼룩으로 깔리고 「완료」라 적히던 것을 막는 순수 규칙.
describe("stampObjects", () => {
  isolateTimers();
  function entry(id: string, name: string, extra: Partial<StampObjectEntry> = {}): StampObjectEntry {
    const text = name.toLowerCase();
    return { id, kind: "kit", name, source: "pack", width: 1, height: 1, nameText: text, descText: "", floorStanding: true, ...extra };
  }
  const INDEX: readonly StampObjectEntry[] = [
    entry("k-pot", "화분"),
    entry("k-table", "탁자"),
    entry("k-torch", "벽 횃불", { floorStanding: false }),
    entry("k-bench", "나무 벤치", { width: 2 }),
  ];
  const FACTS: StampPlanFacts = {
    text: "화분 깔아 줘",
    mapId: "m",
    mapWidth: 20,
    mapHeight: 20,
    target: { x: 2, y: 2, w: 8, h: 6 },
    targetIsSelection: true,
    fillMaterials: ["흙"],
    materialHint: "",
    objects: INDEX,
    isOpenCell: () => true,
    hasArtAt: () => false,
  };
  describe("resolveStampObject", () => {
    it("finds a thing by its name and refuses things that are not in the chipset", () => {
      expect(resolveStampObject(INDEX, ["화분"])?.entry.id).toBe("k-pot");
      expect(resolveStampObject(INDEX, ["자판기"])).toBeNull();
    });

    it("never returns a wall-mounted piece for a floor request", () => {
      expect(resolveStampObject(INDEX, ["횃불"])).toBeNull();
    });

    it("fixes a one-letter typo only on the user's own word", () => {
      const hit = resolveStampObject(INDEX, ["화뷴"]);
      expect(hit?.entry.id).toBe("k-pot");
      expect(hit?.corrected).toBe(true);
    });

    it("accepts only same-group synonyms from the model, never a similar different thing", () => {
      const accepted = acceptedObjectNames("탁자", ["테이블", "왕좌"]);
      expect(accepted.names).toContain("테이블");
      expect(accepted.rejected).toContain("왕좌");
    });

    it("lists nearest names for a refusal and strips size/coordinate suffixes", () => {
      expect(nearestStampObjects(INDEX, ["화뷴"])).toContain("화분");
      expect(baseName("화분 고사리 (0,0)")).toBe("화분 고사리");
      expect(baseName("버들항 소품 둥근 돌 화분 1×1")).toBe("버들항 소품 둥근 돌 화분");
    });

    it("avoids wooden furniture false matches on tree queries and respects maxSize", () => {
      const pool: readonly StampObjectEntry[] = [
        entry("k-chair", "학교 나무 의자"),
        entry("k-garden", "학급 밭(이랑·새싹·나무 팻말)"),
        entry("k-tree-big", "가로수 · ginkgo", { width: 4, height: 6 }),
        entry("k-tree-small", "벚나무", { width: 2, height: 3 }),
      ];
      const names = acceptedObjectNames("나무", ["가로수", "벚나무"]).names;
      expect(resolveStampObject(pool, names)?.entry.id).toBe("k-tree-small");
      expect(resolveStampObject(pool, ["가로수"], { w: 10, h: 5 })?.entry.id).toBe("k-tree-big");
      const bridges: readonly StampObjectEntry[] = [
        entry("b-tall", "바위 다리", { width: 3, height: 7, placement: "water" }),
        entry("b-fit", "나무 널다리", { width: 5, height: 4, placement: "water" }),
      ];
      expect(resolveStampObject(bridges, acceptedObjectNames("다리", []).names, { w: 40, h: 5 })?.entry.id).toBe("b-fit");
    });

    it("prevents pillar/gate and stair-direction compound conflicts and prefers river footbridge & pedestrian signals", () => {
      const dungeonPool: readonly StampObjectEntry[] = [
        entry("bd-garden-gate", "버들항 소품 정원 정문 (돌 기둥 · 열린 쇠문)", { coreName: "정원 정문 돌 기둥 열린 쇠문", width: 2, height: 2 }),
        entry("bd-column-cata", "버들항 고성·지하 카타콤 · 카타콤 기둥", { coreName: "카타콤 기둥", width: 1, height: 3 }),
        entry("bd-stairs-up", "버들항 지하 수도교·하수도 · 올라가는 계단 (벽 앞면)", { coreName: "올라가는 계단 벽 앞면", width: 2, height: 3, placement: "wall", floorStanding: false }),
        entry("bd-stairs-down", "버들항 지하 수도교·하수도 · 내려가는 계단", { coreName: "내려가는 계단", width: 2, height: 2 }),
      ];
      expect(resolveStampObject(dungeonPool, acceptedObjectNames("돌기둥", ["기둥"]).names)?.entry.id).toBe("bd-column-cata");
      expect(resolveStampObject(dungeonPool, acceptedObjectNames("내려가는 계단", ["계단"]).names)?.entry.id).toBe("bd-stairs-down");

      const bridgePool: readonly StampObjectEntry[] = [
        entry("bd-bridge-arch", "버들항 다리 (아치)", { coreName: "다리 아치", width: 4, height: 5, placement: "water" }),
        entry("bd-river-bridge", "버들항 강변 통나무 판자 다리 (인도교)", { coreName: "강변 통나무 판자 다리 인도교", width: 5, height: 4, placement: "water" }),
      ];
      expect(resolveStampObject(bridgePool, acceptedObjectNames("나무 다리", ["다리", "목교"]).names, { w: 40, h: 5 })?.entry.id).toBe("bd-river-bridge");
    });
  });
  describe("place_object planning", () => {
    it("turns a known name into a pending object step and a missing one into a refusal", () => {
      const plan = parseStampPlan(JSON.stringify({ steps: [
        { tool: "place_object", args: { name: "화분", count: 3 } },
        { tool: "place_object", args: { name: "자판기" } },
      ] }), FACTS);
      expect(plan.steps.map((step) => step.tool)).toEqual(["place_object"]);
      expect(plan.steps[0]!.args).toMatchObject({ entryId: "k-pot", count: 3 });
      expect(plan.refused).toHaveLength(1);
      expect(plan.refused[0]!.wanted).toBe("자판기");
    });

    it("does not stand a person in for a thing, and drops hotspots on bare floor", () => {
      const plan = parseStampPlan(JSON.stringify({ steps: [
        { tool: "place_npc", args: { at: { x: 3, y: 3 }, name: "자판기 관리인" } },
        { tool: "place_examine_hotspots", args: { spots: [{ at: { x: 4, y: 4 }, name: "비석" }] } },
      ] }), { ...FACTS, text: "자판기 놓아 줘" });
      expect(plan.steps).toHaveLength(0);
      expect(plan.dropped).toHaveLength(2);
    });

    it("expands to real tool calls on open cells inside the target, one per requested piece", () => {
      const plan = parseStampPlan(JSON.stringify({ steps: [{ tool: "place_object", args: { name: "화분", count: 3 } }] }), FACTS);
      const expanded = expandStampObjects(plan.steps, FACTS);
      expect(expanded.steps).toHaveLength(3);
      for (const step of expanded.steps) {
        expect(step.tool).toBe("stamp_tileset_object");
        const at = step.at![0]!;
        expect(at.x).toBeGreaterThanOrEqual(2);
        expect(at.x).toBeLessThan(10);
        expect(at.y).toBeGreaterThanOrEqual(2);
        expect(at.y).toBeLessThan(8);
      }
      const keys = new Set(expanded.steps.map((step) => `${step.at![0]!.x},${step.at![0]!.y}`));
      expect(keys.size).toBe(3);
    });

    it("says why nothing was placed when no cell is open", () => {
      const plan = parseStampPlan(JSON.stringify({ steps: [{ tool: "place_object", args: { name: "화분" } }] }), FACTS);
      const expanded = expandStampObjects(plan.steps, { ...FACTS, isOpenCell: () => false });
      expect(expanded.steps).toHaveLength(0);
      expect(expanded.dropped[0]).toContain("놓을 자리가 없습니다");
    });
  });
  describe("measureStampEffect", () => {
    it("counts changed tiles and tells visible events from invisible ones", () => {
      const before = createBlankProject();
      const after = structuredClone(before);
      const mapId = before.startMapId;
      const map = after.maps[mapId]!;
      map.lowerTiles[0] = 99999;
      map.lowerTiles[1] = 99998;
      const none = measureStampEffect(before, before, mapId);
      expect(hasVisibleChange(none)).toBe(false);
      const changed = measureStampEffect(before, after, mapId);
      expect(changed.tilesChanged).toBe(2);
      expect(hasVisibleChange(changed)).toBe(true);
      expect(describeStampEffect(changed)).toContain("타일 2칸");
    });
  });
});

// 바로 깔기 주문 대기열 — 같은 맵은 직렬, 다른 맵은 병렬, 조수 턴 동안 새 주문은 대기한다.
// 러너는 주입한다(모델·스토어 없음). 러너가 받는 waitForApply 를 실제로 기다려야 게이트 동작이 보인다.
describe("stampOrderQueue", () => {
  isolateTimers();
  interface Pending {
    readonly input: StampRunInput;
    finish(result?: Partial<StampRunResult>): Promise<void>;
  }
  function harness(options: { readonly concurrency?: number; readonly projectKey?: () => string } = {}) {
    const started: Pending[] = [];
    const applied: string[] = [];
    const queue = createStampOrderQueue({
      concurrency: options.concurrency ?? 3,
      projectKey: options.projectKey ?? (() => "p1"),
      mapSize: (mapId) => (["m1", "m2", "m3"].includes(mapId) ? { width: 20, height: 20 } : undefined),
      run: (input) => new Promise<StampRunResult>((resolve) => {
        input.signal?.addEventListener("abort", () => resolve({ ok: false, lines: [], applied: 0, usedModel: true }), { once: true });
        started.push({
          input,
          finish: async (result) => {
            // 실제 러너처럼: 모델 계획이 끝나면 적용 차례를 기다린 뒤 깐다.
            await input.waitForApply?.();
            if (input.signal?.aborted) {
              resolve({ ok: false, lines: ["바로 깔기를 중단했습니다."], applied: 0, usedModel: true });
              return;
            }
            applied.push(input.text);
            resolve({ ok: true, lines: [input.text + " 깔림"], applied: 1, usedModel: true, ...result });
          },
        });
      }),
    });
    return { queue, started, applied };
  }
  const sel = (x: number, y: number, width = 4, height = 4, mapId = "m1") => ({ mapId, x, y, width, height });
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  let live: StampOrderQueue | null = null;
  afterEach(() => {
    live?.dispose();
    live = null;
  });
  describe("stampOrderRect / overlap", () => {
    it("clips the selection to the map and falls back to the whole map", () => {
      expect(stampOrderRect({ width: 10, height: 10 }, "m1", sel(8, 8, 5, 5))).toEqual({ x: 8, y: 8, w: 2, h: 2 });
      expect(stampOrderRect({ width: 10, height: 10 }, "m1", null)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
      expect(stampOrderRect({ width: 10, height: 10 }, "m1", sel(0, 0, 3, 3, "other"))).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    });

    it("treats touching edges as separate", () => {
      expect(stampRectsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 4, y: 0, w: 4, h: 4 })).toBe(false);
      expect(stampRectsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 3, y: 3, w: 4, h: 4 })).toBe(true);
    });
  });
  describe("createStampOrderQueue", () => {
    it("serializes separated regions of the same map in FIFO order", async () => {
      const h = harness();
      live = h.queue;
      const a = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
      const b = h.queue.enqueue({ text: "연못", mapId: "m1", selection: sel(10, 10) })!;
      const c = h.queue.enqueue({ text: "길", mapId: "m1", selection: sel(2, 2) })!;
      expect(h.started.map((p) => p.input.text)).toEqual(["숲"]);
      expect(c.status).toBe("waiting");
      expect(c.wait).toBe("overlap");
      expect(c.blockedBy).toBe(a.id);
      expect(h.queue.summary()).toEqual({ waiting: 2, running: 1, total: 3 });

      await h.started[0]!.finish();
      await flush();
      expect(a.status).toBe("done");
      expect(b.status).toBe("planning");
      expect(c.status).toBe("waiting");
      await h.started[1]!.finish();
      await flush();
      expect(c.status).toBe("planning");
      expect(h.started.map((p) => p.input.text)).toEqual(["숲", "연못", "길"]);
    });

    it("does not treat the same rect on another map as an overlap", () => {
      const h = harness();
      live = h.queue;
      h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) });
      h.queue.enqueue({ text: "숲", mapId: "m2", selection: sel(0, 0, 4, 4, "m2") });
      expect(h.started).toHaveLength(2);
    });

    it("a whole-map order waits for every order on that map", () => {
      const h = harness();
      live = h.queue;
      h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(15, 15) });
      const whole = h.queue.enqueue({ text: "알아서", mapId: "m1", selection: null })!;
      expect(whole.wait).toBe("overlap");
      expect(h.started).toHaveLength(1);
    });

    it("caps concurrent orders and marks the rest as capacity waits", async () => {
      const h = harness({ concurrency: 2 });
      live = h.queue;
      h.queue.enqueue({ text: "a", mapId: "m1", selection: sel(0, 0, 2, 2) });
      h.queue.enqueue({ text: "b", mapId: "m2", selection: sel(5, 0, 2, 2, "m2") });
      const c = h.queue.enqueue({ text: "c", mapId: "m3", selection: sel(10, 0, 2, 2, "m3") })!;
      expect(h.started).toHaveLength(2);
      expect(c.wait).toBe("capacity");
      await h.started[0]!.finish();
      await flush();
      expect(c.status).toBe("planning");
    });

    it("holds a new model call while chat runs, then also gates apply", async () => {
      let chatBusy = true;
      const h = harness();
      live = h.queue;
      h.queue.setChatBusyProbe(() => chatBusy);
      const order = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
      expect(h.started).toHaveLength(0);
      expect(order.wait).toBe("chat");
      chatBusy = false;
      h.queue.pokeGate();
      expect(h.started).toHaveLength(1);
      chatBusy = true;
      const done = h.started[0]!.finish();
      await flush();
      expect(order.status).toBe("applying");
      expect(order.wait).toBe("chat");
      expect(h.applied).toEqual([]);
      chatBusy = false;
      h.queue.pokeGate();
      await done;
      await flush();
      expect(h.applied).toEqual(["숲"]);
      expect(order.status).toBe("done");
    });

    it("aborts an order whose project was replaced before its apply", async () => {
      let key = "p1";
      const h = harness({ projectKey: () => key });
      live = h.queue;
      const order = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
      key = "p2";
      await h.started[0]!.finish();
      await flush();
      expect(h.applied).toEqual([]);
      expect(order.status).toBe("aborted");
    });

    it("cancelAll drops waiting orders without starting them", async () => {
      const h = harness();
      live = h.queue;
      const a = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
      const b = h.queue.enqueue({ text: "길", mapId: "m1", selection: sel(1, 1) })!;
      expect(h.queue.cancelAll()).toBe(2);
      await h.started[0]!.finish();
      await flush();
      expect(a.status).toBe("aborted");
      expect(b.status).toBe("aborted");
      expect(h.started).toHaveLength(1);
      expect(h.queue.active()).toBe(false);
    });

    it("reports each finished order once", async () => {
      const h = harness();
      live = h.queue;
      h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) });
      await h.started[0]!.finish();
      await flush();
      expect(h.queue.takeUnreported().map((o) => o.lines)).toEqual([["숲 깔림"]]);
      expect(h.queue.takeUnreported()).toEqual([]);
    });

    it("rejects an unknown map", () => {
      const h = harness();
      live = h.queue;
      expect(h.queue.enqueue({ text: "숲", mapId: "nope", selection: null })).toBeNull();
    });
  });
  describe("formatStampOrderSummary", () => {
    it("is empty when nothing runs", () => {
      expect(formatStampOrderSummary({ waiting: 0, running: 0, total: 0 })).toBe("");
      expect(formatStampOrderSummary({ waiting: 2, running: 3, total: 5 })).toBe("바로 깔기 3개 진행 · 2개 대기");
    });
  });
});

describe("storeUpdateMap", () => {
  isolateTimers();
  beforeEach(() => {
    store.replace(createBlankProject());
    store._setPersistedBaselineForTest(null);
    resetMapEditHistory();
  });
  describe("store.updateMap", () => {
    it("replaces only the target map and structurally shares the rest of the project", () => {
      const project = createBlankProject();
      const targetMapId = project.startMapId;
      const otherMap = createBlankMap("공유 확인 맵", 8, 8);
      project.maps[otherMap.id] = otherMap;
      project.mapTree.children.push({ mapId: otherMap.id, children: [] });
      store.replace(project);

      const before = store.getCurrent();
      const beforeTargetMap = before.maps[targetMapId];
      const beforeOtherMap = before.maps[otherMap.id];
      const beforeTilesets = before.tilesets;
      const beforeDatabase = before.database;

      store.updateMap(targetMapId, (map) => {
        map.lowerTiles[0] = TILE.WATER;
      }, { cells: [{ x: 0, y: 0, layer: "lower" }] });

      const after = store.getCurrent();
      expect(after).not.toBe(before);
      expect(after.maps).not.toBe(before.maps);
      expect(after.maps[targetMapId]).not.toBe(beforeTargetMap);
      expect(after.maps[otherMap.id]).toBe(beforeOtherMap);
      expect(after.tilesets).toBe(beforeTilesets);
      expect(after.database).toBe(beforeDatabase);
      expect(beforeTargetMap.lowerTiles[0]).not.toBe(TILE.WATER);
      expect(after.maps[targetMapId].lowerTiles[0]).toBe(TILE.WATER);
    });

    it("does not let later map patches mutate the persisted baseline snapshot", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId].lowerTiles[0] = TILE.GRASS;
      store.replace(project);
      store._setPersistedBaselineForTest(structuredClone(store.getCurrent()));

      store.updateMap(mapId, (map) => {
        map.lowerTiles[0] = TILE.WATER;
      });
      store.updateMap(mapId, (map) => {
        map.lowerTiles[1] = TILE.SAND;
      });

      const baseline = store._getPersistedBaselineForTest();
      expect(baseline).not.toBeNull();
      expect(baseline?.maps[mapId]).not.toBe(store.getCurrent().maps[mapId]);
      expect(baseline?.maps[mapId].lowerTiles[0]).toBe(TILE.GRASS);
      expect(baseline?.maps[mapId].lowerTiles[1]).not.toBe(TILE.SAND);
    });

    it("keeps map-kind history snapshots isolated from later updateMap edits", () => {
      const mapId = store.getCurrent().startMapId;
      const before = store.getCurrent().maps[mapId].lowerTiles[0];

      recordProjectSnapshot("맵 패치 전", mapId, { kind: "map" });
      store.updateMap(mapId, (map) => {
        map.lowerTiles[0] = TILE.WATER;
      });
      store.updateMap(mapId, (map) => {
        map.lowerTiles[0] = TILE.SAND;
      });

      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles[0]).toBe(before);
    });
  });
  describe("map-only editor actions on updateMap", () => {
    it("paintTile and moveEvent preserve shared project subtrees outside the edited map", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const event = createDefaultGameEvent(1, 1);
      project.maps[mapId].events.push(event);
      store.replace(project);

      const beforePaint = store.getCurrent();
      paintTile(mapId, "lower", 1, 1, TILE.WATER, { autoConnect: false });
      expect(store.getCurrent().tilesets).toBe(beforePaint.tilesets);
      expect(store.getCurrent().database).toBe(beforePaint.database);

      const beforeMove = store.getCurrent();
      moveEvent(mapId, event.id, 3, 4);
      expect(store.getCurrent().tilesets).toBe(beforeMove.tilesets);
      expect(store.getCurrent().maps[mapId]).not.toBe(beforeMove.maps[mapId]);
      expect(store.getCurrent().maps[mapId].events.find((item) => item.id === event.id)).toMatchObject({ x: 3, y: 4 });
    });
  });
});

describe("terrainLandBrush", () => {
  isolateTimers();
  function current() {
    const project = store.getCurrent();
    return project.maps[project.startMapId]!;
  }
  describe("땅 칸 붓", () => {
    beforeEach(() => { store.replaceProject(createBlankProject()); });

    it("사각형 한 번이 그 칸만 정확히 그 단으로 맞춘다", () => {
      const map = current();
      const cells = landRectCells(map, { x: 2, y: 3 }, { x: 11, y: 10 });
      expect(cells).toHaveLength(80);
      expect(paintLandCells(map.id, cells, 2, true)).toBe(true);
      const levels = current().relief!.levels;
      const inside = new Set(cells);
      expect(levels.filter((v, i) => inside.has(i) && v === 2)).toHaveLength(80);
      expect(levels.filter((v, i) => !inside.has(i) && v !== 0)).toHaveLength(0);
    });

    it("물 칸은 깊이를 늘 기록하고(가장자리 얕은 물), 낮은 땅으로 덮으면 물이 걷힌다", () => {
      const map = current();
      const lake = landRectCells(map, { x: 1, y: 1 }, { x: 5, y: 4 });
      paintLandCells(map.id, lake, "water", true);
      const depth = current().terrainDesign!.waterDepth!;
      expect(lake.every((i) => depth[i]! > 0)).toBe(true);
      expect(depth[1 * map.width + 1]).toBe(1);
      expect(depth[2 * map.width + 2]).toBeGreaterThan(1);
      paintLandCells(map.id, landBrushCells(map, { x: 3, y: 2 }, 3), 0, true);
      expect(current().terrainDesign?.waterDepth?.[2 * map.width + 3] ?? 0).toBe(0);
    });

    it("잠긴 칸은 높이를 바꾸지 않는다", () => {
      const map = current();
      store.updateMap(map.id, (draft) => { draft.terrainDesign = { lockedCells: [map.width + 1] }; });
      paintLandCells(map.id, landBrushCells(map, { x: 1, y: 1 }, 3), 4, true);
      expect(current().relief!.levels[map.width + 1]).toBe(0);
      expect(current().relief!.levels[map.width + 2]).toBe(4);
    });

    it("땅 올리기·내리기는 누른 칸보다 한 층 위·아래를 목표로 고른다(물→낮은 땅→높은 땅→더 높은 땅)", () => {
      const map = current();
      paintLandCells(map.id, [0], "water", true);
      paintLandCells(map.id, [2], 2, true);
      paintLandCells(map.id, [3], 4, true);
      const m = current();
      expect(landStepTarget(m, { x: 0, y: 0 }, "raise")).toBe(0);
      expect(landStepTarget(m, { x: 1, y: 0 }, "raise")).toBe(2);
      expect(landStepTarget(m, { x: 2, y: 0 }, "raise")).toBe(4);
      expect(landStepTarget(m, { x: 3, y: 0 }, "raise")).toBe(4);
      expect(landStepTarget(m, { x: 3, y: 0 }, "lower")).toBe(2);
      expect(landStepTarget(m, { x: 2, y: 0 }, "lower")).toBe(0);
      expect(landStepTarget(m, { x: 1, y: 0 }, "lower")).toBe(0);
      expect(landStepTarget(m, { x: 0, y: 0 }, "lower")).toBe("water");
    });

    it("붓 크기 하나가 땅 붓·폭·높이 붓 크기를 함께 정한다(7칸 = 49칸 정사각)", () => {
      const map = current();
      expect(landBrushCells(map, { x: 10, y: 7 }, 7)).toHaveLength(49);
      expect(brushSizePatch(1)).toEqual({ terrainLandSize: 1, terrainWidth: 1, reliefRoughSize: "S" });
      expect(brushSizePatch(3).reliefRoughSize).toBe("S");
      expect(brushSizePatch(5)).toEqual({ terrainLandSize: 5, terrainWidth: 5, reliefRoughSize: "M" });
      expect(brushSizePatch(7).reliefRoughSize).toBe("L");
    });
  });
});

describe("terrainPresets", () => {
  isolateTimers();
  function current() {
    const project = store.getCurrent();
    return project.maps[project.startMapId]!;
  }
  describe("한 번에 프리셋 붓", () => {
    beforeEach(() => { store.replaceProject(createBlankProject()); });

    it("칸 계산: 언덕 7×5에서 귀퉁이 넷을 뺀 31칸, 강은 모든 줄, 오솔길은 맵 너비만큼", () => {
      const map = current();
      expect(hillPresetCells(map, { x: 10, y: 7 })).toHaveLength(31);
      const river = riverPresetCells(map, { x: 10, y: 7 });
      expect(new Set(river.map((i) => Math.floor(i / map.width))).size).toBe(map.height);
      const path = pathPresetPoints(map, { x: 10, y: 7 });
      expect(new Set(path.map((p) => p.x)).size).toBe(map.width);
      // 줄이 바뀌는 곳도 상하좌우로 이어져 걸을 수 있다.
      const key = new Set(path.map((p) => `${p.x},${p.y}`));
      expect(path.every((p) => p.x === 0 || key.has(`${p.x - 1},${p.y}`) || key.has(`${p.x},${p.y - 1}`) || key.has(`${p.x},${p.y + 1}`))).toBe(true);
    });

    it("언덕 하나는 높은 땅 31칸과 걸어 오를 경사로를 함께 깐다", () => {
      const map = current();
      expect(applyTerrainPreset(map.id, "hill", { x: 10, y: 6 }, true)).toBe(true);
      const after = current();
      expect(after.relief!.levels.filter((v) => v === 2).length).toBeGreaterThanOrEqual(25);
      expect((after.relief!.ramps ?? []).some(Boolean)).toBe(true);
    });

    it("강 하나는 위에서 아래까지 물 깊이를 기록한다", () => {
      const map = current();
      expect(applyTerrainPreset(map.id, "river", { x: 10, y: 7 }, true)).toBe(true);
      const depth = current().terrainDesign?.waterDepth ?? [];
      const wetRows = new Set(depth.flatMap((d, i) => (d > 0 ? [Math.floor(i / map.width)] : [])));
      expect(wetRows.size).toBe(map.height);
    });
  });
});

describe("terrainShoreSoften", () => {
  isolateTimers();
  const map = { width: 20, height: 15 };
  describe("호수 모서리 다듬기", () => {
    it("8×5 사각형 호수는 네 모서리 칸을 빼고 가운데는 남긴다", () => {
      const rect = landRectCells(map, { x: 1, y: 1 }, { x: 8, y: 5 });
      const kept = new Set(softenShore(map, rect));
      for (const [x, y] of [[1, 1], [8, 1], [1, 5], [8, 5]]) expect(kept.has(y * map.width + x)).toBe(false);
      expect(kept.has(3 * map.width + 4)).toBe(true);
      expect(kept.size).toBeGreaterThan(rect.length * 0.8);
    });

    it("작은 사각형(3×3)은 그대로 둔다", () => {
      const rect = landRectCells(map, { x: 1, y: 1 }, { x: 3, y: 3 });
      expect(softenShore(map, rect)).toEqual(rect);
    });
  });
});

describe("tilePicking", () => {
  isolateTimers();
  describe("visible tile picking", () => {
    it("picks the upper tile when an upper tile is visible over a lower tile", () => {
      const map = mapWithTiles({ lower: 75, upper: 288 });

      const pick = visibleTilePickAt(map, 0);

      expect(pick).toEqual({ layer: "upper", tile: 288 });
    });

    it("falls back to the lower tile when the upper tile is empty", () => {
      const map = mapWithTiles({ lower: 75, upper: TILE.EMPTY });

      const pick = visibleTilePickAt(map, 0);

      expect(pick).toEqual({ layer: "lower", tile: 75 });
    });
  });
  describe("layer tile picking", () => {
    it("덧그림 빈 칸은 공백을 집는다 — 바닥 타일로 떨어지지 않는다", () => {
      const map = mapWithTiles({ lower: 75, upper: TILE.EMPTY });

      expect(layerTilePickAt(map, 0, "upper")).toEqual({ layer: "upper", tile: TILE.EMPTY });
    });

    it("덧그림에 타일이 있으면 그 타일을 집는다", () => {
      const map = mapWithTiles({ lower: 75, upper: 288 });

      expect(layerTilePickAt(map, 0, "upper")).toEqual({ layer: "upper", tile: 288 });
    });

    it("바닥 빈 칸은 집지 않는다", () => {
      const map = mapWithTiles({ lower: TILE.EMPTY, upper: TILE.EMPTY });

      expect(layerTilePickAt(map, 0, "lower")).toBeNull();
    });
  });
  function mapWithTiles(input: { readonly lower: number; readonly upper: number }): GameMap {
    return {
      events: [],
      height: 1,
      id: "m",
      lowerTiles: [input.lower],
      name: "m",
      tileSize: 16,
      tilesetId: "default",
      upperTiles: [input.upper],
      width: 1,
    };
  }
});

describe("tileRectToClientRect", () => {
  isolateTimers();
  const TILE = 16;
  describe("tileRectToClientRect", () => {
    it("zoom 1 에서 캔버스 원점 + 타일 오프셋", () => {
      expect(tileRectToClientRect({
        tileRect: { x: 2, y: 3, width: 4, height: 5 },
        worldView: { x: 0, y: 0 },
        zoom: 1,
        canvasOrigin: { x: 100, y: 50 },
        tileSize: TILE,
      })).toEqual({ x: 132, y: 98, width: 64, height: 80 });
    });

    it("worldView 스크롤을 뺀다", () => {
      expect(tileRectToClientRect({
        tileRect: { x: 10, y: 10, width: 1, height: 1 },
        worldView: { x: 96, y: 32 },
        zoom: 1,
        canvasOrigin: { x: 0, y: 0 },
        tileSize: TILE,
      })).toEqual({ x: 64, y: 128, width: 16, height: 16 });
    });

    it("zoom 2 는 오프셋과 크기 양쪽에 걸린다", () => {
      expect(tileRectToClientRect({
        tileRect: { x: 4, y: 0, width: 2, height: 2 },
        worldView: { x: 32, y: 0 },
        zoom: 2,
        canvasOrigin: { x: 10, y: 20 },
        tileSize: TILE,
      })).toEqual({ x: 74, y: 20, width: 64, height: 64 });
    });

    it("영역이 뷰포트 왼쪽 위로 밀려나면 음수 좌표를 그대로 돌려준다", () => {
      const rect = tileRectToClientRect({
        tileRect: { x: 0, y: 0, width: 3, height: 3 },
        worldView: { x: 320, y: 240 },
        zoom: 1,
        canvasOrigin: { x: 0, y: 0 },
        tileSize: TILE,
      });
      expect(rect.x).toBeLessThan(0);
      expect(rect.y).toBeLessThan(0);
    });

    it("0.5 배 줌에서도 최소 1px 은 보장한다", () => {
      const rect = tileRectToClientRect({
        tileRect: { x: 0, y: 0, width: 0, height: 0 },
        worldView: { x: 0, y: 0 },
        zoom: 0.5,
        canvasOrigin: { x: 0, y: 0 },
        tileSize: TILE,
      });
      expect(rect.width).toBe(1);
      expect(rect.height).toBe(1);
    });
  });
});
