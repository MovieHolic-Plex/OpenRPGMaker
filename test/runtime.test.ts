import { describe, expect, it, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type Phaser from "phaser";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { WORLD_COAST_GROUP_ID, withWorldCoastRenderPass, worldCoastAutotileGroup } from "@/project/defaults/worldCoastMapping";
import { setAutotileVariant } from "@/editor/tilesetActions";
import { committedEvents, mapWithCommittedEvents } from "@/project/eventDrafts";
import { ensureFogTexture } from "@/player/weather/fogTexture";
import { CLOUD_SHAPE_FRAMES, cloudShapeTextureKey, ensureCloudShapeTextures } from "@/player/weather/cloudShadowTexture";
import { AtmosphereAudio } from "@/player/audio/atmosphereAudio";
import { WeatherAudio } from "@/player/audio/weatherAudio";
import { lightingGradientParams } from "@/player/lighting";
import { M2_HISTORY_LIMIT, ensureM2Runtime, pushM2History } from "@/player/interpreter/m2RuntimeState";
import { executeModernCommand } from "@/player/interpreter/m2ModernRuntime";
import { parseLifeState } from "@/project/lifeStateReconciliation";
import { armTerrainComponents, terrainMayReach } from "@/project/tilePassabilityComponents";
import { findChasePath } from "@/player/chaseAi";
import { fitBattleEnemy } from "@/player/battleEnemyFit";
import { startSession } from "@/project/session";
import { createBlockingEventQuery, findBlockingEventOverlappingRect, initialRuntimeEventPositions, invalidateEventIdIndexPass, runtimeEventViewById, runtimeEventViewsForMap, withEventIdIndexPass } from "@/project/runtimeEventState";
import { footprintBounds, pointRect } from "@/project/footprint";
import { TILE } from "@/project/defaults/constants";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { applyChangeTileStep } from "@/player/playSceneMapCommands";
import { firstConnectionToward } from "@/player/npcLivingTravel";
import type { GameEvent, GameMap, MapConnection, Project, TileGraft, TilesetDef } from "@/project/types";
import { updateParallelEvents } from "@/player/playSceneSchedulers";
import { livingPathCases, runLivingPathCase } from "../scripts/qa/living-path-regression";
import { normalizeScenario, renderSummary, evaluateBattlerGeometry, evaluateExpect, shotFileName, shouldCaptureShot } from "../scripts/lib/runtimeQa.mjs";
import type { RuntimeQaBattler, RuntimeQaFootprintRect, RuntimeQaOp, RuntimeQaReport } from "../scripts/lib/runtimeQa.d.mts";
import { isolateTimers } from "./mergedTeardown";

describe("runtimeJuiceSelectCss", () => {
  isolateTimers();
  describe("runtime menu-select juice CSS", () => {
    const juiceCss = readFileSync(resolve("src/styles/runtime/juice.css"), "utf8");
    const dockCss = readFileSync(resolve("src/styles/runtime/statusMenuEdgeDock.css"), "utf8");

    it("does not flash the whole overlay when the cursor moves", () => {
      expect(juiceCss).not.toMatch(/juice-menu-select-tick/);
      const selectRuleBody = groupedRule(juiceCss, [".juice-menu-select", ".juice-title-select"]);
      expect(selectRuleBody).toMatch(/animation:\s*none/);
      expect(selectRuleBody).not.toMatch(/filter:/);
      expect(selectRuleBody).not.toMatch(/transform:/);
    });

    it("moves the ESC overlay only when the menu opens or closes", () => {
      const overlayIdle = groupedRule(juiceCss, [
        ".oprn-status-menu.juice-menu-select",
        ".oprn-status-menu.juice-menu-confirm",
        ".oprn-status-menu.juice-menu-back",
        ".oprn-status-menu.juice-menu-invalid",
      ]);
      expect(overlayIdle).toMatch(/animation:\s*none/);
      expect(overlayIdle).not.toMatch(/transform:/);

      expect(groupedRule(juiceCss, [".juice-menu-open", ".juice-title-enter"])).toMatch(
        /juice-menu-open-pop/,
      );
      expect(groupedRule(juiceCss, [".juice-menu-back", ".juice-menu-close"])).toMatch(
        /juice-menu-back-slide/,
      );
      expect(selectRule(juiceCss, ".juice-menu-invalid")).toMatch(/juice-menu-invalid-shake/);
    });

    it("keeps the ESC-menu cursor highlight without bloom", () => {
      const selectedDock = selectRule(
        dockCss,
        ".oprn-status-menu .status-menu-primary-dock > .status-menu-command.selected",
      );
      expect(selectedDock).toMatch(/box-shadow:\s*none/);
      expect(selectedDock).not.toMatch(/0 0 12px/);

      const selectedAction = selectRule(
        dockCss,
        ".oprn-status-menu .status-menu-detail-action.selected",
      );
      expect(selectedAction).toMatch(/inset 2px 0 0/);
      expect(selectedAction).not.toMatch(/0 0 10px/);
    });
  });
  function groupedRule(css: string, selectors: readonly string[]): string {
    const header = selectors
      .map((selector) => selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
      .join("\\s*,\\s*");
    return ruleBody(css, header, selectors.join(", "));
  }
  function selectRule(css: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return ruleBody(css, escaped, selector);
  }
  function ruleBody(css: string, headerPattern: string, label: string): string {
    const match = new RegExp(`${headerPattern}\\s*\\{`, "u").exec(css);
    expect(match, `missing rule ${label}`).toBeTruthy();
    const start = match!.index + match![0].length;
    const end = css.indexOf("}", start);
    expect(end, `unclosed rule ${label}`).toBeGreaterThan(start);
    return css.slice(start, end);
  }
});

// 런타임 렉 수정 2차(2026-09-27)의 동등성 회귀. 기억(memo)은 입력이 바뀌면 반드시 무효가 되고,
// 나눠 굽기는 한 번에 굽기와 같은 결과를 내는지를 본다. 속도 자체는 단위 테스트로 증명하지 않는다.
describe("runtimeLagFixes2", () => {
  isolateTimers();
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  describe("이식 텍스처 suffix 기억", () => {
    const graft = (targetTile: number, sourceTile = 1): TileGraft => ({ sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile, targetTile });

    it("같은 배열이면 같은 답, push·새 배열이면 새 답", () => {
      const grafts = [graft(10)];
      const tileset: Pick<TilesetDef, "tileGrafts"> = { tileGrafts: grafts };
      const first = tileGraftsTextureSuffix(tileset);
      expect(first).not.toBe("");
      expect(tileGraftsTextureSuffix(tileset)).toBe(first);
      grafts.push(graft(11));
      const pushed = tileGraftsTextureSuffix(tileset);
      expect(pushed).not.toBe(first);
      expect(pushed).toBe(tileGraftsTextureSuffix({ tileGrafts: [graft(10), graft(11)] }));
      tileset.tileGrafts = [graft(10, 2)];
      expect(tileGraftsTextureSuffix(tileset)).toBe(tileGraftsTextureSuffix({ tileGrafts: [graft(10, 2)] }));
      expect(tileGraftsTextureSuffix(tileset)).not.toBe(first);
      tileset.tileGrafts = [];
      expect(tileGraftsTextureSuffix(tileset)).toBe("");
    });
  });
  describe("월드 해안 그룹 기억", () => {
    function worldTileset(): TilesetDef {
      store.replace(createBlankProject());
      const found = Object.values(store.getCurrent().tilesets).find((tileset) => worldCoastAutotileGroup(tileset));
      if (!found) throw new Error("월드 해안 그룹이 있는 번들 타일셋이 없습니다");
      return found;
    }

    it("편집기가 같은 그룹의 variantMap 을 제자리 대입하면 판정이 다시 계산된다", () => {
      const tileset = worldTileset();
      expect(worldCoastAutotileGroup(tileset)?.id).toBe(WORLD_COAST_GROUP_ID);
      setAutotileVariant(tileset.id, WORLD_COAST_GROUP_ID, 0, 999);
      expect(worldCoastAutotileGroup(store.getCurrent().tilesets[tileset.id]!)).toBeUndefined();
    });

    it("그룹 필드·이식을 제자리에서 바꾸면 판정이 다시 계산된다", () => {
      const tileset = structuredClone(worldTileset());
      const group = tileset.autotileGroups!.find((entry) => entry.id === WORLD_COAST_GROUP_ID)!;
      expect(worldCoastAutotileGroup(tileset)).toBe(group);
      const members = group.memberTileIds;
      group.memberTileIds = members.slice(1);
      expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
      group.memberTileIds = members;
      expect(worldCoastAutotileGroup(tileset)).toBe(group);
      group.neighborhood = 4;
      expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
      group.neighborhood = 8;
      expect(worldCoastAutotileGroup(tileset)).toBe(group);
      tileset.tileGrafts = [{ sourceChipset: "x", sourceTile: 0, targetTile: group.memberTileIds[0]! }];
      expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
    });

    it("그리기 한 번 안에서만 판정을 고정하고, 끝나면 다시 내용을 본다", () => {
      const tileset = structuredClone(worldTileset());
      const group = tileset.autotileGroups!.find((entry) => entry.id === WORLD_COAST_GROUP_ID)!;
      withWorldCoastRenderPass(() => {
        expect(worldCoastAutotileGroup(tileset)).toBe(group);
        expect(worldCoastAutotileGroup(tileset)).toBe(group);
      });
      group.variantMap["255"] = 3;
      expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
      withWorldCoastRenderPass(() => expect(worldCoastAutotileGroup(tileset)).toBeUndefined());
    });
  });
  describe("mapWithCommittedEvents", () => {
    it("예전 구현(전체 복제 후 events 교체)과 같은 값·같은 키 순서를 낸다", () => {
      const project = createBlankProject();
      const map = createBlankMap("m", 12, 9, Object.keys(project.tilesets)[0]!);
      map.events = [
        { id: "a", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "showText", text: "hi" }], pages: [] },
        { id: "b", x: 2, y: 1, trigger: { kind: "action" }, commands: [], pages: [], draft: { kind: "new" } },
      ] as never;
      const legacy = structuredClone(map);
      legacy.events = committedEvents(map.events);
      const next = mapWithCommittedEvents(map);
      expect(JSON.stringify(next)).toBe(JSON.stringify(legacy));
      expect(next.lowerTiles).not.toBe(map.lowerTiles);
      expect(next.events[0]).not.toBe(map.events[0]);
    });
  });
  // ---- 캔버스·텍스처 가짜 ----
  class FakeImageData {
    readonly data: Uint8ClampedArray;
    constructor(readonly width: number, readonly height: number) { this.data = new Uint8ClampedArray(width * height * 4); }
  }
  class FakeCanvas {
    width = 0;
    height = 0;
    image: FakeImageData | null = null;
    getContext() {
      return {
        createImageData: (width: number, height: number) => new FakeImageData(width, height),
        putImageData: (image: FakeImageData) => { this.image = image; },
      };
    }
  }
  function fakeTextures() {
    const added = new Map<string, FakeCanvas>();
    const textures = {
      exists: (key: string) => added.has(key),
      addCanvas: (key: string, canvas: FakeCanvas) => { added.set(key, canvas); return { setFilter() {} }; },
    } as unknown as Phaser.Textures.TextureManager;
    return { textures, added };
  }
  function stubCanvas() {
    vi.stubGlobal("document", { createElement: () => new FakeCanvas() });
  }
  describe("안개 나눠 굽기", () => {
    it("줄 단위로 나눠 구워도 한 번에 구운 것과 같은 픽셀이다", () => {
      stubCanvas();
      const whole = fakeTextures();
      expect(ensureFogTexture(whole.textures, "fog")).toBe("fog");
      const split = fakeTextures();
      let pendingSteps = 0;
      while (ensureFogTexture(split.textures, "fog", 64) === null) pendingSteps += 1;
      expect(pendingSteps).toBe(3);
      expect(split.added.get("fog")!.image!.data).toEqual(whole.added.get("fog")!.image!.data);
    });
  });
  describe("구름 모양 나눠 굽기", () => {
    it("예산만큼만 굽고, 지금 보이는 장부터 굽고, 한 번에 구운 것과 같다", () => {
      stubCanvas();
      const { textures, added } = fakeTextures();
      expect(ensureCloudShapeTextures(textures, 2, { budget: 1, firstFrame: 5 })).toBe(false);
      expect([...added.keys()]).toEqual([cloudShapeTextureKey(5, 2)]);
      let calls = 1;
      for (;;) {
        calls += 1;
        if (ensureCloudShapeTextures(textures, 2, { budget: 1, firstFrame: 5 })) break;
      }
      expect(calls).toBe(CLOUD_SHAPE_FRAMES);
      expect(added.size).toBe(CLOUD_SHAPE_FRAMES);
      const whole = fakeTextures();
      expect(ensureCloudShapeTextures(whole.textures, 2)).toBe(true);
      for (let frame = 0; frame < CLOUD_SHAPE_FRAMES; frame += 1) {
        const key = cloudShapeTextureKey(frame, 2);
        expect(added.get(key)!.image!.data).toEqual(whole.added.get(key)!.image!.data);
      }
    });
  });
  // ---- 오디오 가짜 ----
  class FakeBuffer {
    readonly data: Float32Array[];
    constructor(channels: number, length: number, readonly sampleRate: number) {
      this.data = Array.from({ length: channels }, () => new Float32Array(length));
    }
    getChannelData(channel: number) { return this.data[channel]!; }
  }
  class FakeParam {
    value = 0;
    setTargetAtTime() {}
    cancelScheduledValues() {}
    setValueAtTime() {}
    linearRampToValueAtTime() {}
    exponentialRampToValueAtTime() {}
  }
  class FakeNode { gain = new FakeParam(); frequency = new FakeParam(); type = ""; connect() {} disconnect() {} }
  class FakeSource extends FakeNode { buffer: unknown; loop = false; onended: unknown; start() {} stop() {} }
  function fakeAudioContext(rate: number, created: FakeBuffer[]) {
    return class {
      state = "running";
      currentTime = 0;
      destination = {};
      sampleRate = rate;
      createBuffer(channels: number, length: number, bufferRate: number) {
        const buffer = new FakeBuffer(channels, length, bufferRate);
        created.push(buffer);
        return buffer;
      }
      createGain() { return new FakeNode(); }
      createBiquadFilter() { return new FakeNode(); }
      createBufferSource() { return new FakeSource(); }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    };
  }
  describe("분위기 소리 나눠 합성", () => {
    it("여러 update 에 나눠 합성한 버퍼가 예전 한 번 합성과 같은 표본이다", () => {
      const created: FakeBuffer[] = [];
      vi.stubGlobal("AudioContext", fakeAudioContext(44100, created));
      const audio = new AtmosphereAudio();
      const effects = [{ kind: "fireflies", amount: 1, volume: 0.5, sound: "fire" }] as never;
      const voices = () => (audio as unknown as { voices: Map<string, unknown> }).voices.size;
      let updates = 0;
      while (voices() === 0 && updates < 100) { audio.update(effects, true); updates += 1; }
      expect(voices()).toBe(1);
      expect(updates).toBeGreaterThan(1);
      const buffer = created[0]!;
      expect(buffer.data[0]!.length).toBe(22050 * 12);
      // 예전 구현(한 번에 합성)으로 뽑아 둔 표본 지문.
      let hash = 0;
      for (const channel of buffer.data) for (let i = 0; i < channel.length; i += 97) hash = (hash * 31 + Math.round(channel[i]! * 1e6)) | 0;
      expect(hash).toBe(375032406);
      audio.stop();
    });
  });
  describe("빗소리 잡음 버퍼 재사용", () => {
    it("비가 그쳤다 다시 와도 같은 표본율이면 잡음을 다시 합성하지 않는다", () => {
      const created: FakeBuffer[] = [];
      vi.stubGlobal("AudioContext", fakeAudioContext(12345, created));
      const weather = new WeatherAudio();
      weather.update({ kind: "rain", intensity: 0.6 }, 0, true);
      expect(created).toHaveLength(1);
      weather.update({ kind: "none", intensity: 0 }, 16, true);
      weather.update({ kind: "rain", intensity: 0.6 }, 32, true);
      expect(created).toHaveLength(1);
      weather.stop();
    });
  });
  describe("3차: 화면 밖 광원", () => {
    it("화면과 겹치지 않는 광원은 서명·그리기 대상에서 빠지고, 반경이 걸치면 남는다", () => {
      const params = lightingGradientParams(
        { ambient: 0.8, sources: [
          { id: "far", at: { x: 1000, y: 1000 }, radius: 3, intensity: 1, flicker: true },
          { id: "edge", at: { x: -2, y: 2 }, radius: 3, intensity: 1 },
          { id: "near", at: { x: 2, y: 2 }, radius: 1, intensity: 1 },
        ] },
        { viewportWidth: 320, viewportHeight: 240, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0,
          resolveAnchor: (anchor) => (anchor === "player" || "eventId" in anchor ? undefined : anchor) },
      );
      expect(params.gradients.map((entry) => entry.id)).toEqual(["edge", "near"]);
    });
  });
  describe("3차: 명령 이력 상한", () => {
    it("표현식 평가를 반복해도 이력은 상한에서 멈추고 가장 최근 것이 남는다", () => {
      const session = startSession(createBlankProject());
      const runtime = ensureM2Runtime(session);
      for (let index = 0; index < M2_HISTORY_LIMIT * 3; index += 1) {
        executeModernCommand(session, runtime, "Evaluate Expression", { expression: String(index), resultVariableId: "v" });
      }
      expect(runtime.expressions).toHaveLength(M2_HISTORY_LIMIT);
      expect(runtime.expressions.at(-1)?.expression).toBe(String(M2_HISTORY_LIMIT * 3 - 1));
      expect(session.variables.v).toBe(M2_HISTORY_LIMIT * 3 - 1);
    });

    it("상한 아래에서는 push 와 같다", () => {
      const list: number[] = [];
      for (let index = 0; index < 5; index += 1) pushM2History(list, index);
      expect(list).toEqual([0, 1, 2, 3, 4]);
    });
  });
  describe("3차: 생활 상태 파서", () => {
    it("항목을 제자리에 붙여도 예전 펼침과 같은 사전이고, __proto__ id 도 평범한 키다", () => {
      const shipping = JSON.parse('{"a":1,"__proto__":2,"b":0,"c":3}') as Record<string, number>;
      const parsed = parseLifeState({ shippingQueue: shipping });
      expect(Object.keys(parsed.shippingQueue!)).toEqual(["a", "__proto__", "c"]);
      expect(Object.getPrototypeOf(parsed.shippingQueue)).toBe(Object.prototype);
      expect(parsed.shippingQueue!["__proto__"]).toBe(2);
      expect(parsed.shippingQueue).not.toBe(shipping);
    });
  });
  describe("3차: 한 방향 턱과 성분 색인", () => {
    it("색인을 만든 뒤에도 턱을 정해진 방향으로 넘는 경로를 막지 않는다", () => {
      const project = createBlankProject();
      const tilesetId = Object.keys(project.tilesets)[0]!;
      const tileset = project.tilesets[tilesetId]!;
      const floor = TILE.GRASS;
      const ledge = floor === 1 ? 2 : 1;
      const wall = floor === 3 || ledge === 3 ? 4 : 3;
      const open = { up: true, down: true, left: true, right: true };
      tileset.passability[floor] = open;
      tileset.passability[ledge] = open;
      tileset.passability[wall] = { up: false, down: false, left: false, right: false };
      tileset.ledgeDirections = { [String(ledge)]: "left" };
      const map = createBlankMap("m", 4, 1, tilesetId);
      map.id = "m";
      map.lowerTiles = [floor, ledge, floor, wall];
      map.upperTiles = [-1, -1, -1, -1];
      project.maps[map.id] = map;
      expect(findChasePath(project, map, { x: 2, y: 0 }, { x: 0, y: 0 })).toHaveLength(2);
      armTerrainComponents(project, map);
      expect(terrainMayReach(project, map, 2, 0, 0, 0)).toBe(true);
      expect(findChasePath(project, map, { x: 2, y: 0 }, { x: 0, y: 0 })).toHaveLength(2);
      // 반대 방향은 정말 막혀 있다 — 탐색이 스스로 빈 경로를 낸다.
      expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(0);
      // 턱을 제자리에서 지우면 지문이 바뀌어 색인이 다시 만들어진다.
      tileset.ledgeDirections = {};
      expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(2);
    });
  });
  describe("3차: 막는 이벤트 판정기", () => {
    it("모든 칸에서 이벤트별 원본 질의와 같은 답을 낸다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const pageOf = (id: string, priority: "same" | "below") => ({
        id, name: id, conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority,
        movement: { type: "fixed" as const, speed: 3, frequency: 3 }, commands: [],
      });
      map.events = [
        { id: "wall", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [pageOf("wall_p", "same")] },
        { id: "floor", x: 4, y: 3, trigger: { kind: "action" }, commands: [], pages: [pageOf("floor_p", "below")] },
        { id: "self", x: 5, y: 5, trigger: { kind: "action" }, commands: [], pages: [pageOf("self_p", "same")] },
        { id: "golem", x: 8, y: 8, trigger: { kind: "action" }, commands: [], pages: [{ ...pageOf("golem_p", "same"), footprint: { width: 3, height: 3 }, passRows: 1 }] },
      ] as never;
      const session = startSession(project);
      const positions = initialRuntimeEventPositions(map.events);
      const query = createBlockingEventQuery(project, map, session, positions, "self");
      for (let y = 0; y < 12; y += 1) {
        for (let x = 0; x < 12; x += 1) {
          const rect = footprintBounds(x, y, { width: 1, height: 1 });
          expect(query(rect), `${x},${y}`).toBe(!!findBlockingEventOverlappingRect(project, map, session, positions, rect, "self"));
        }
      }
    });
  });
  describe("3차: 전투 적 맞춤", () => {
    it("배율이 1 이하면 필드 크기를 읽지 않는다", () => {
      let reads = 0;
      const field = { get clientWidth() { reads += 1; return 320; }, get clientHeight() { reads += 1; return 160; } } as unknown as HTMLElement;
      const node = { dataset: { pixelEnemyCell: "96" }, style: { getPropertyValue: () => "1" } } as unknown as HTMLElement;
      expect(fitBattleEnemy(field, node, { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
      expect(reads).toBe(0);
    });

    it("칸 128 이상 도트 시트는 배율 1 에서도 필드 크기를 잰다", () => {
      let reads = 0;
      const field = { get clientWidth() { reads += 1; return 0; }, get clientHeight() { reads += 1; return 0; } } as unknown as HTMLElement;
      const node = { dataset: { pixelEnemyCell: "128" }, style: { getPropertyValue: () => "1" } } as unknown as HTMLElement;
      expect(fitBattleEnemy(field, node, { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
      expect(reads).toBeGreaterThan(0);
    });
  });
  describe("3차: 안개 프레임 예산", () => {
    it("같은 프레임의 두 번째 호출은 굽지 않는다", () => {
      stubCanvas();
      const shared = fakeTextures();
      const reference = fakeTextures();
      expect(ensureFogTexture(shared.textures, "fog", 64, 1)).toBeNull();
      expect(ensureFogTexture(shared.textures, "fog", 64, 1)).toBeNull();
      expect(ensureFogTexture(reference.textures, "fog", 64, 1)).toBeNull();
      // 둘 다 한 프레임에 64줄씩만 진행했으므로 같은 프레임 수에 끝난다.
      let frame = 2;
      while (ensureFogTexture(shared.textures, "fog", 64, frame) === null) {
        ensureFogTexture(shared.textures, "fog", 64, frame);
        expect(ensureFogTexture(reference.textures, "fog", 64, frame)).toBeNull();
        frame += 1;
      }
      expect(frame).toBe(4);
      expect(ensureFogTexture(reference.textures, "fog", 64, frame)).toBe("fog");
    });
  });
  describe("3차: 분위기 소리 합성 예산", () => {
    it("여러 소리가 한꺼번에 굽혀도 update 한 번의 합성 표본은 예산을 넘지 않는다", () => {
      const created: FakeBuffer[] = [];
      vi.stubGlobal("AudioContext", fakeAudioContext(44100, created));
      const audio = new AtmosphereAudio();
      const effects = [
        { kind: "fireflies", amount: 1, volume: 0.5, sound: "fire" },
        { kind: "fireflies", amount: 1, volume: 0.5, sound: "whisper" },
        { kind: "fireflies", amount: 1, volume: 0.5, sound: "breeze" },
      ] as never;
      const baking = () => (audio as unknown as { baking: Map<string, { channels: { index: number }[] }> }).baking;
      const progress = () => [...baking().values()].reduce((sum, bake) => sum + bake.channels.reduce((s, c) => s + c.index, 0), 0);
      audio.update(effects, true);
      expect(progress()).toBeLessThanOrEqual(100_000);
      expect(baking().size).toBe(1);
      audio.stop();
    });
  });
  describe("4차: 지형 성분 색인은 해시 충돌에 속지 않는다", () => {
    it("32비트 해시가 같던 두 통행 배열에서도 열린 길을 도달 불가로 막지 않는다", () => {
      // 무작위 퍼징 반례(시드 0xf1a62026). 예전 FNV 지문은 두 배열에 같은 값(1204537343)을 냈다.
      const before = [3, 14, 0, 3, 6, 11, 0, 1, 3];
      const after = [3, 3, 3, 15, 14, 7, 7, 8, 15];
      const flags = (n: number) => ({ up: !!(n & 1), down: !!(n & 2), left: !!(n & 4), right: !!(n & 8) });
      const tileset = { passability: before.map(flags), priority: Array(9).fill("lower") } as unknown as TilesetDef;
      const map = { id: "m", width: 3, height: 3, tilesetId: "t", lowerTiles: [0, 1, 2, 3, 4, 5, 6, 7, 8], upperTiles: Array(9).fill(-1) } as unknown as GameMap;
      const project = { maps: { m: map }, tilesets: { t: tileset } } as unknown as Project;
      armTerrainComponents(project, map);
      after.forEach((n, index) => Object.assign(tileset.passability[index]!, flags(n)));
      expect(terrainMayReach(project, map, 0, 0, 2, 2)).toBe(true);
      expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 2, y: 2 }).length).toBeGreaterThan(0);
    });
  });
  describe("4차: 지형이 바뀌면 생활 NPC 는 남은 경로를 다시 짠다", () => {
    it("changeTile 로 길이 막히면 막힌 경로를 재사용하지 않고 우회한다", () => {
      const project = createBlankProject();
      const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
      project.tilesets.t = { ...base, id: "t", count: 2,
        passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
        priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
      const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
        movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 2, y: 0 }], repeat: false } } };
      const map = { ...createBlankMap("m", 3, 2, "t"), id: "m", lowerTiles: [0, 0, 0, 0, 0, 0], upperTiles: Array(6).fill(-1),
        events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
      project.maps = { m: map };
      project.startMapId = "m";
      store.replace(project);
      const live = store.getCurrent().maps.m!;
      const session = startSession(store.getCurrent());
      session.currentMapId = "m";
      const movers = new Map<string, { moves: unknown[]; step: number }>();
      const scene = {
        map: live, session, eventPositions: { npc: { x: 0, y: 0 } },
        pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
        autonomousNPCs: movers,
        getMapId: () => "m",
        registerAutonomousMover(id: string, moves: unknown[], repeat: boolean) {
          movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 } as never);
        },
      };
      registerPageMoveRoutes(scene as never);
      expect(movers.get("npc")?.moves).toEqual([{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }]);
      applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 1, y: 0, tile: 1 } as never);
      registerPageMoveRoutes(scene as never);
      expect(movers.get("npc")?.moves.map((move) => (move as { dir: string }).dir)).toEqual(["down", "right", "right", "up"]);
    });
  });
  describe("4차: 칸 격자 막힘 판정기", () => {
    it("무작위 몸 크기·위치에서 모든 질의 사각이 원본 질의와 같다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      let seed = 0x5eed4;
      const rand = () => { seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
      map.events = Array.from({ length: 40 }, (_, index) => ({
        id: "e" + index, x: Math.floor(rand() * 14) - 1, y: Math.floor(rand() * 14) - 1, trigger: { kind: "action" }, commands: [],
        pages: [{ id: "p" + index, name: "p", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: rand() < 0.7 ? "same" : "below",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
          footprint: { width: 1 + Math.floor(rand() * 4), height: 1 + Math.floor(rand() * 4) }, passRows: 1 + Math.floor(rand() * 3) }],
      })) as never;
      const session = startSession(project);
      const positions = initialRuntimeEventPositions(map.events);
      const query = createBlockingEventQuery(project, map, session, positions, "e3");
      for (let trial = 0; trial < 600; trial += 1) {
        const x = Math.floor(rand() * 16) - 2;
        const y = Math.floor(rand() * 16) - 2;
        const rect = footprintBounds(x, y, { width: 1 + Math.floor(rand() * 3), height: 1 + Math.floor(rand() * 3) });
        expect(query(rect), JSON.stringify(rect)).toBe(!!findBlockingEventOverlappingRect(project, map, session, positions, rect, "e3"));
      }
    });
  });
  describe("4차 리뷰 반례", () => {
    it("소수 좌표 이벤트도 칸 격자 판정기가 놓치지 않는다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.events = [{ id: "half", x: 1.5, y: 1, trigger: { kind: "action" }, commands: [],
        pages: [{ id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [], footprint: { width: 2, height: 1 } }] }] as never;
      const session = startSession(project);
      const positions = initialRuntimeEventPositions(map.events);
      const query = createBlockingEventQuery(project, map, session, positions);
      for (const rect of [pointRect(2, 1), pointRect(1, 1), pointRect(3, 1), pointRect(2, 2)]) {
        expect(query(rect), JSON.stringify(rect)).toBe(!!findBlockingEventOverlappingRect(project, map, session, positions, rect));
      }
    });

    it("같은 길이의 우회로도 지형이 바뀐 뒤에는 새로 깐다", () => {
      const project = createBlankProject();
      const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
      project.tilesets.t = { ...base, id: "t", count: 2,
        passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
        priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
      const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
        movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 2, y: 2 }], repeat: false } } };
      const map = { ...createBlankMap("m", 3, 3, "t"), id: "m", lowerTiles: Array(9).fill(0), upperTiles: Array(9).fill(-1),
        events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
      project.maps = { m: map };
      project.startMapId = "m";
      store.replace(project);
      const session = startSession(store.getCurrent());
      session.currentMapId = "m";
      const movers = new Map<string, { moves: { dir: string }[] }>();
      const scene = {
        map: store.getCurrent().maps.m!, session, eventPositions: { npc: { x: 0, y: 0 } },
        pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
        autonomousNPCs: movers, getMapId: () => "m",
        registerAutonomousMover(id: string, moves: { dir: string }[], repeat: boolean) {
          movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 } as never);
        },
      };
      registerPageMoveRoutes(scene as never);
      const first = movers.get("npc")!.moves.map((move) => move.dir);
      expect(first).toEqual(["down", "down", "right", "right"]);
      applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 0, y: 1, tile: 1 } as never);
      registerPageMoveRoutes(scene as never);
      expect(movers.get("npc")!.moves.map((move) => move.dir)).toEqual(["right", "down", "down", "right"]);
    });

    it("맵 id 에 구분자가 있어도 연결 기억이 제자리 편집을 놓치지 않는다", () => {
      const connection = { id: "c", from: { mapId: "a|b", x: 1, y: 1 }, to: { mapId: "c", x: 0, y: 0, direction: "down" }, npcEnabled: true, playerEnabled: true };
      const connections = [connection] as never as MapConnection[];
      expect(firstConnectionToward(connections, "a|b", "c")?.first).toBe(connection);
      connection.from.mapId = "a";
      connection.to.mapId = "b|c";
      expect(firstConnectionToward(connections, "a", "b|c")?.first).toBe(connection);
      expect(firstConnectionToward(connections, "a|b", "c")).toBeNull();
    });
  });
  describe("4차 2차 리뷰 반례", () => {
    it("지형이 바뀌어 경로를 다시 짜도 진행 중인 걸음과 방향은 그대로다", () => {
      const project = createBlankProject();
      const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
      project.tilesets.t = { ...base, id: "t", count: 2,
        passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
        priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
      const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
        movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 4, y: 0 }], repeat: false } } };
      const map = { ...createBlankMap("m", 5, 2, "t"), id: "m", lowerTiles: Array(10).fill(0), upperTiles: Array(10).fill(-1),
        events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
      project.maps = { m: map };
      project.startMapId = "m";
      store.replace(project);
      const session = startSession(store.getCurrent());
      session.currentMapId = "m";
      const movers = new Map<string, Record<string, unknown>>();
      const scene = {
        map: store.getCurrent().maps.m!, session, eventPositions: { npc: { x: 0, y: 0 } },
        pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
        autonomousNPCs: movers, getMapId: () => "m",
        registerAutonomousMover(id: string, moves: unknown[], repeat: boolean) {
          movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 });
        },
      };
      registerPageMoveRoutes(scene as never);
      const mover = movers.get("npc")!;
      // 한 칸 걷는 중: 논리 위치는 이미 (1,0), 보간은 반쯤.
      const walking = { fromX: 0, fromY: 0, toX: 1, toY: 0, elapsedMs: 100, durationMs: 400 };
      mover.activeMove = walking;
      mover.facing = "right";
      mover.step = 1;
      mover.timer = 55;
      scene.eventPositions.npc = { x: 1, y: 0 };
      applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 3, y: 0, tile: 1 } as never);
      registerPageMoveRoutes(scene as never);
      const after = movers.get("npc")!;
      expect(after).toBe(mover);
      expect(after.activeMove).toBe(walking);
      expect(after.facing).toBe("right");
      expect(after.timer).toBe(55);
      expect(after.step).toBe(0);
      expect((after.moves as { dir: string }[]).map((move) => move.dir)).toEqual(["down", "right", "right", "right", "up"]);
    });
  });
  describe("5차: 단건 이벤트 조회 색인", () => {
    it("무작위 제자리 편집 뒤에도 패스 안팎에서 전체 순회의 첫 항목과 같고, 패스는 invalidate 뒤 새 배열을 본다", () => {
      const { project, map, session, positions } = (() => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const session = startSession(project);
        return { project, map, session, positions: {} as Record<string, { x: number; y: number }> };
      })();
      let seed = 0x5a5a;
      const rand = () => { seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
      const make = (id: string) => ({ id, x: Math.floor(rand() * 10), y: Math.floor(rand() * 10), trigger: { kind: "action" }, commands: [],
        pages: [{ id: id + "_p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] }] }) as never as GameEvent;
      map.events = Array.from({ length: 12 }, (_, i) => make("e" + i));
      const ids = () => ["e0", "e3", "e7", "e11", "dup", "zz", "e5"];
      for (let step = 0; step < 400; step += 1) {
        const op = Math.floor(rand() * 5);
        if (op === 0) map.events.push(make(rand() < 0.3 ? "dup" : "e" + Math.floor(rand() * 14)));
        if (op === 1 && map.events.length > 1) map.events.splice(Math.floor(rand() * map.events.length), 1);
        if (op === 2 && map.events.length) map.events[Math.floor(rand() * map.events.length)] = make("e" + Math.floor(rand() * 14));
        if (op === 3 && map.events.length) (map.events[Math.floor(rand() * map.events.length)] as { id: string }).id = rand() < 0.5 ? "dup" : "e" + Math.floor(rand() * 14);
        for (const id of ids()) {
          const expected = runtimeEventViewsForMap(project, map, session, positions).find((view) => view.event.id === id);
          expect(runtimeEventViewById(project, map, session, positions, id)?.event, `step ${step} id ${id}`).toBe(expected?.event);
          // 패스 안에서도 같다(패스 동안에는 배열을 바꾸지 않는다).
          expect(withEventIdIndexPass(() => runtimeEventViewById(project, map, session, positions, id))?.event).toBe(expected?.event);
        }
      }
      withEventIdIndexPass(() => {
        const before = runtimeEventViewById(project, map, session, positions, "late");
        expect(before).toBeUndefined();
        map.events.unshift(make("late"));
        invalidateEventIdIndexPass();
        expect(runtimeEventViewById(project, map, session, positions, "late")?.event.id).toBe("late");
      });
    });
  });
  describe("5차: 병렬 이벤트 16단계 상한", () => {
    // dialogueHost 가 instanceof 로만 본다. 노드 환경에는 DOM 이 없다.
    afterEach(() => { vi.unstubAllGlobals(); });
    const parallelScene = (commands: unknown[]) => {
      vi.stubGlobal("HTMLElement", class {});
      const project = createBlankProject();
      project.commonEvents = [{ id: "burst", name: "Burst", trigger: "parallel", commands }] as never;
      store.replace(project);
      const session = startSession(store.getCurrent());
      session.commonEvents = store.getCurrent().commonEvents;
      const tiles: number[] = [];
      const scene = {
        map: store.getCurrent().maps[project.startMapId]!, session, eventPositions: {},
        parallelProcesses: new Map(), game: { registry: { get: () => undefined } },
        activeRuntimeEvents: () => [],
        applyChangeTileStep: (step: { x: number }) => { tiles.push(step.x); },
        refreshRuntimeSurfaces: () => undefined,
      };
      return { scene, tiles, session };
    };
    const tile = (x: number) => ({ kind: "changeTile", mapId: "", layer: "lower", x, y: 0, tile: 1 });

    it("한 프레임 상한에 걸린 17번째 명령을 다음 프레임에 실행한다", () => {
      const { scene, tiles, session } = parallelScene([...Array.from({ length: 17 }, (_, i) => tile(i)), { kind: "setSwitch", switchId: "sw_done", value: true }]);
      updateParallelEvents(scene as never, 16);
      expect(tiles).toHaveLength(16);
      updateParallelEvents(scene as never, 16);
      expect(tiles).toEqual(Array.from({ length: 17 }, (_, i) => i));
      expect(session.switches.sw_done).toBe(true);
    });

    it("상한 바로 뒤의 대기를 건너뛰지 않는다", () => {
      const { scene, tiles, session } = parallelScene([...Array.from({ length: 16 }, (_, i) => tile(i)), { kind: "wait", ms: 500 }, { kind: "setSwitch", switchId: "sw_done", value: true }]);
      updateParallelEvents(scene as never, 16);
      updateParallelEvents(scene as never, 16);
      expect(tiles).toHaveLength(16);
      expect(session.switches.sw_done).not.toBe(true);
      updateParallelEvents(scene as never, 600);
      expect(session.switches.sw_done).toBe(true);
    });
  });
  const blockedMidStep = () => {
    const project = createBlankProject();
    const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
    project.tilesets.t = { ...base, id: "t", count: 2,
      passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
      priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
    const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
      movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 2, y: 0 }], repeat: false } } };
    const map = { ...createBlankMap("m", 3, 1, "t"), id: "m", lowerTiles: Array(3).fill(0), upperTiles: Array(3).fill(-1),
      events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
    project.maps = { m: map };
    project.startMapId = "m";
    store.replace(project);
    const session = startSession(store.getCurrent());
    session.currentMapId = "m";
    const movers = new Map<string, Record<string, unknown>>();
    const scene = {
      map: store.getCurrent().maps.m!, session, eventPositions: { npc: { x: 0, y: 0 } },
      pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
      autonomousNPCs: movers, getMapId: () => "m",
      registerAutonomousMover(id: string, moves: unknown[], repeat: boolean) {
        movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 });
      },
    };
    registerPageMoveRoutes(scene as never);
    const mover = movers.get("npc")!;
    const walking = { fromX: 0, fromY: 0, toX: 1, toY: 0, elapsedMs: 100, durationMs: 400 };
    mover.activeMove = walking;
    mover.step = 1;
    scene.eventPositions.npc = { x: 1, y: 0 };
    // 걷는 도중 목적지를 막고 표면을 다시 맞춘다.
    const block = () => {
      applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 2, y: 0, tile: 1 } as never);
      registerPageMoveRoutes(scene as never);
    };
    return { scene, movers, mover, walking, block };
  };
  describe("5차: 걷는 중 길이 막힘", () => {
    it("걸음 도중 목적지가 막혀도 무버와 진행 중인 걸음을 지우지 않고 남은 걸음만 비운다", () => {
      const { scene, movers, mover, walking, block } = blockedMidStep();
      block();
      expect(movers.get("npc")).toBe(mover);
      expect(mover.activeMove).toBe(walking);
      expect(mover.moves).toEqual([]);
      expect(scene.pageMoveRouteEventIds.has("npc")).toBe(true);
      expect([...scene.pageMoveRouteKeys].some((key) => key.startsWith("living:npc:"))).toBe(true);
    });

    it("다른 페이지(추격 등)에서 넘어온 무버는 남기지 않는다", () => {
      // 추격 페이지의 키로 걷던 무버(페이지 전환 직후)를 흉내 낸다.
      const { scene, movers, mover, block } = blockedMidStep();
      scene.pageMoveRouteKeys.clear();
      scene.pageMoveRouteKeys.add("npc:p_chase");
      mover.strategy = "chase";
      block();
      expect(movers.has("npc")).toBe(false);
      expect(scene.pageMoveRouteEventIds.has("npc")).toBe(false);
    });
  });
  describe("5차: 조건 분기의 소셜 host 탐색", () => {
    it("호감도 조건은 중첩돼도 이벤트의 characterId 로 읽고, 다른 조건은 맵을 뒤지지 않는다", async () => {
      const { createInterpreter } = await import("@/player/interpreter");
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.events.push({ id: "npc", x: 1, y: 1, characterId: "char_mina", trigger: { kind: "action" }, commands: [], pages: [] } as never);
      const session = startSession(project);
      session.friendship = { char_mina: 5 };
      session.switches.gate = true;
      let mapScans = 0;
      const counted = { ...project, maps: new Proxy(project.maps, { ownKeys(target) { mapScans += 1; return Reflect.ownKeys(target); } }) };
      const fork = (condition: unknown) => ({ kind: "fork", condition, then: [{ kind: "setVariable", variableId: "hit", op: "+=", value: 1 }], else: [] });
      const run = (commands: unknown[]) => {
        session.variables.hit = 0;
        const interpreter = createInterpreter(commands as never, session, counted as never, { currentEventId: "npc" });
        let step = interpreter.start();
        for (let i = 0; i < 50 && step.kind !== "done"; i++) step = interpreter.resume(undefined);
        return session.variables.hit;
      };
      expect(run([fork({ kind: "not", condition: { kind: "all", conditions: [{ kind: "friendshipAtLeast", value: 5 }] } })])).toBe(0);
      expect(run([fork({ kind: "friendshipAtLeast", value: 5 })])).toBe(1);
      expect(run([fork({ kind: "friendshipAtLeast", value: 6 })])).toBe(0);
      const scansBefore = mapScans;
      expect(scansBefore).toBeGreaterThan(0);
      expect(run(Array.from({ length: 20 }, () => fork({ kind: "all", conditions: [{ kind: "switch", switchId: "gate", value: true }, { kind: "selfSwitch", key: "A", value: false }] })))).toBe(20);
      expect(mapScans).toBe(scansBefore);
    });
  });
});

describe("runtimeNpcLivingPathRegression", () => {
  isolateTimers();
  describe('7차 생활 NPC 길찾기',()=>{
   for(const [name,run] of Object.entries(livingPathCases)) it(name,()=>runLivingPathCase(run));
  });
});

describe("runtimeQa", () => {
  isolateTimers();
  describe("runtimeQaAudioContract", () => {
    isolateTimers();
    describe("runtime audio QA contract", () => {
      it("accepts an audio action when a scenario requests real playback evidence", () => {
        // Given
        const op = {
          kind: "audioAction", action: "start", resourceId: "fixture-bgm",
          sourcePath: "/fixture.mp3", loop: true, timeoutMs: 1000,
        } as const;
        // When
        const scenario = normalizeScenario({ id: "audio", beats: [{ id: "start", ops: [op] }] });
        // Then
        expect(scenario.beats[0]?.ops).toEqual([op]);
      });

      it("ships machine-readable evidence when rendering the summary", () => {
        // Given
        const audio = [{
          action: "start",
          resourceId: "fixture-bgm",
          sourcePath: "/fixture.mp3",
          loop: true,
          error: null,
          playing: {
            trusted: true, sourcePath: "/fixture.mp3", paused: false,
            ended: false, readyState: 4, currentTime: 0, loop: true,
            volume: 0, muted: false, playbackRate: 1,
          },
          snapshot: {
            volume: { bgm: 0.7, se: 0.8 }, playbackRate: 1, pan: 0, fadeInMs: 600,
          },
        }] as const;
        const actions = [{
          kind: "audioAction", action: "start", resourceId: "fixture-bgm",
          sourcePath: "/fixture.mp3", loop: true,
        }] as const;
        const report = {
          scenarioId: "audio", projectPath: "fixture.json", seed: 1,
          viewport: { width: 1024, height: 768 }, errors: [],
          beats: [{
            index: 0, id: "start", shot: "01-start.png",
            failures: [], state: null, actions, audio,
          }],
        };
        // When
        const summary = renderSummary(report);
        const block = /```json\n([\s\S]*?)\n```/.exec(summary)?.[1];
        // Then: parse the machine-readable payload; do not pin report prose.
        expect(block).toBeDefined();
        if (block === undefined) throw new TypeError("Missing audio evidence JSON");
        expect(JSON.parse(block)).toEqual([{
          id: "start", actions, state: null, audio,
        }]);
      });
    });
  });
  describe("runtimeQaGate", () => {
    isolateTimers();
    const observed = {
      state: { currentMapId: "map_town", x: 3, y: 2, gold: 100, switches: {}, variables: {} },
      testids: ["runtime-state-json", "dialogue-window"],
      playerSpriteResourceId: "charset_hero",
      playerSpriteTextureKey: "tex_easyrpg_charset_people1",
    };
    describe("evaluateExpect", () => {
      it("checks each requested reward count without treating missing observations as zero", () => {
        const expected = { inventoryCounts: { item_capture_orb: 5 }, ownedMonsterCounts: { species_leafling: 1 } };
        const rewarded = { ...observed, state: { ...observed.state, ...expected } };
        expect(evaluateExpect(expected, rewarded)).toEqual([]);
        const failures = evaluateExpect({
          inventoryCounts: { item_capture_orb: 10 }, ownedMonsterCounts: { species_leafling: 2 },
        }, rewarded);
        expect(failures).toHaveLength(2);
        expect(failures[0]).toContain("inventoryCounts[item_capture_orb]");
        expect(failures[1]).toContain("ownedMonsterCounts[species_leafling]");
      });

      it.each([null, observed.state])("rejects zero reward expectations when counts are unavailable: %j", (state) => {
        const zero = { inventoryCounts: { item_capture_orb: 0 }, ownedMonsterCounts: { species_leafling: 0 } };
        expect(evaluateExpect(zero, { ...observed, state })).toHaveLength(2);
      });

      it("preserves existing behavior without reward expectations", () => {
        expect(evaluateExpect({}, { ...observed, state: null })).toEqual([]);
        expect(evaluateExpect({ x: 3 }, observed)).toEqual([]);
      });

      it("emote expectations require a visible sprite on the requested target", () => {
        const expected = { emoteTargets: [{ target: "npc", frame: 0 }] };
        expect(evaluateExpect(expected, { ...observed, emotes: [{ target: "npc", frame: "0", alpha: 1 }] })).toEqual([]);
        expect(evaluateExpect(expected, { ...observed, emotes: [{ target: "npc", frame: "0", alpha: 0 }] })).not.toEqual([]);
        expect(evaluateExpect(expected, observed)).not.toEqual([]);
        expect(evaluateExpect(expected, { ...observed, emotes: [{ target: "player", frame: "0", alpha: 1 }] })).not.toEqual([]);
      });

      it("맵 ID 가 다르면 실패 사유를 낸다", () => {
        const failures = evaluateExpect({ mapId: "map_dungeon" }, observed);

        expect(failures).toEqual(["mapId: 기대 map_dungeon, 실제 map_town"]);
      });

      it("기대치가 전부 맞으면 빈 배열을 낸다", () => {
        const failures = evaluateExpect(
          { mapId: "map_town", x: 3, y: 2, gold: 100, testidPresent: ["dialogue-window"] },
          observed,
        );

        expect(failures).toEqual([]);
      });

      it("좌표가 다르면 x·y 를 각각 보고한다", () => {
        const failures = evaluateExpect({ x: 9, y: 8 }, observed);

        expect(failures).toEqual(["x: 기대 9, 실제 3", "y: 기대 8, 실제 2"]);
      });

      it("골드가 다르면 실패 사유를 낸다", () => {
        const failures = evaluateExpect({ gold: 250 }, observed);

        expect(failures).toEqual(["gold: 기대 250, 실제 100"]);
      });

      it("있어야 할 testid 가 없으면 보고한다", () => {
        const failures = evaluateExpect({ testidPresent: ["battle-command", "shop-window"] }, observed);

        expect(failures).toEqual(["testid 누락: battle-command", "testid 누락: shop-window"]);
      });

      it("없어야 할 testid 가 있으면 보고한다", () => {
        const failures = evaluateExpect({ testidAbsent: ["dialogue-window"] }, observed);

        expect(failures).toEqual(["testid 잔존: dialogue-window"]);
      });

      it("audioObservedIncludes: 재생 지시가 기록된 리소스는 통과, 없는 리소스는 보고한다", () => {
        const withAudio = { ...observed, audioObserved: ["cc0-bgm-town", "cc0-se-osx-wooded-box-open"] };

        expect(evaluateExpect({ audioObservedIncludes: ["cc0-se-osx-wooded-box-open"] }, withAudio)).toEqual([]);
        expect(evaluateExpect({ audioObservedIncludes: ["cc0-se-orp-inventory-coin"] }, withAudio)).toEqual([
          "audio 미재생: cc0-se-orp-inventory-coin (관측: cc0-bgm-town, cc0-se-osx-wooded-box-open)",
        ]);
      });

      it("audioObservedIncludes: 관측 배열이 없으면 조용히 통과시키지 않는다", () => {
        const failures = evaluateExpect({ audioObservedIncludes: ["cc0-se-orp-inventory-coin"] }, observed);

        expect(failures).toEqual(["audio 미재생: cc0-se-orp-inventory-coin (관측: 없음)"]);
      });

      it("플레이어 스프라이트 리소스가 비면 보고한다", () => {
        const failures = evaluateExpect(
          { playerSpriteResourceNonEmpty: true },
          { ...observed, playerSpriteResourceId: "" },
        );

        expect(failures).toEqual(["playerSprite: 리소스 ID 가 비어 있다(스프라이트 누락)"]);
      });

      it("스프라이트 훅이 null 을 주면 누락으로 본다", () => {
        const failures = evaluateExpect(
          { playerSpriteResourceNonEmpty: true },
          { ...observed, playerSpriteResourceId: null },
        );

        expect(failures).toEqual(["playerSprite: 리소스 ID 가 비어 있다(스프라이트 누락)"]);
      });

      // resourceId 만 보면 "스프라이트 있음"으로 통과하지만 Phaser 는 __MISSING
      // 플레이스홀더(초록 와이어프레임)를 그린다. 실측으로 겪은 오탐이라 별도 축으로 잡는다.
      it("텍스처가 __MISSING 이면 resourceId 가 있어도 실패로 잡는다", () => {
        const failures = evaluateExpect(
          { playerSpriteTextureLoaded: true },
          { ...observed, playerSpriteTextureKey: "__MISSING" },
        );

        expect(failures).toEqual([
          "playerSprite: 텍스처가 로드되지 않았다(__MISSING) — resourceId=charset_hero",
        ]);
      });

      it("텍스처가 로드돼 있으면 통과한다", () => {
        expect(evaluateExpect({ playerSpriteTextureLoaded: true }, observed)).toEqual([]);
      });

      it("텍스처 키가 없으면 실패로 잡는다", () => {
        const failures = evaluateExpect(
          { playerSpriteTextureLoaded: true },
          { ...observed, playerSpriteTextureKey: null },
        );

        expect(failures).toEqual([
          "playerSprite: 텍스처가 로드되지 않았다(없음) — resourceId=charset_hero",
        ]);
      });

      it("훅이 없어 상태를 못 읽으면 조용히 통과시키지 않는다", () => {
        const failures = evaluateExpect({ mapId: "map_town" }, { ...observed, state: null });

        expect(failures).toEqual(["런타임 훅 없음 — 상태를 읽을 수 없다(mapId 확인 불가)"]);
      });

      it("상태를 못 읽어도 DOM 기대치는 그대로 판정한다", () => {
        const failures = evaluateExpect(
          { testidPresent: ["title-screen"] },
          { ...observed, state: null },
        );

        expect(failures).toEqual(["testid 누락: title-screen"]);
      });

      it("실패가 여러 축이면 모두 누적한다", () => {
        const failures = evaluateExpect({ mapId: "map_x", gold: 1 }, observed);

        expect(failures).toEqual(["mapId: 기대 map_x, 실제 map_town", "gold: 기대 1, 실제 100"]);
      });

      // 부등 기대치 — 대조군을 자동 단정으로 바꾸는 축. "안 움직였다" 만 검사하면 입력이 죽어도
      // 통과하므로, 골렘 없는 런에서 "움직였다" 를 단정할 수단이 필요하다.
      describe("부등 기대치(xNot/yNot)", () => {
        it("x 가 금지값과 같으면 실패로 잡는다", () => {
          expect(evaluateExpect({ xNot: 3 }, observed)).toEqual(["xNot: 기대 ≠ 3, 실제 3"]);
        });

        it("x 가 금지값과 다르면 통과한다", () => {
          expect(evaluateExpect({ xNot: 9 }, observed)).toEqual([]);
        });

        it("y 도 같은 방식으로 판정하고 x 와 함께 누적한다", () => {
          expect(evaluateExpect({ xNot: 3, yNot: 2 }, observed)).toEqual([
            "xNot: 기대 ≠ 3, 실제 3",
            "yNot: 기대 ≠ 2, 실제 2",
          ]);
        });

        it("훅이 없으면 조용히 통과시키지 않는다", () => {
          expect(evaluateExpect({ xNot: 3 }, { ...observed, state: null })).toEqual([
            "런타임 훅 없음 — 상태를 읽을 수 없다(xNot 확인 불가)",
          ]);
        });

        // 0 은 falsy 다. `if (!expected[key])` 로 썼다면 "x 가 0 이면 안 된다" 가 조용히 사라진다.
        it("금지값 0 도 검사한다", () => {
          const atOrigin = { ...observed, state: { ...observed.state, x: 0 } };
          expect(evaluateExpect({ xNot: 0 }, atOrigin)).toEqual(["xNot: 기대 ≠ 0, 실제 0"]);
        });

        it("동등 기대치와 섞여도 서로 간섭하지 않는다", () => {
          expect(evaluateExpect({ x: 3, yNot: 5 }, observed)).toEqual([]);
        });
      });

      // 런타임이 계산한 발자국 사각을 직접 단정하는 축. 이동 좌표는 판정의 **결과**라
      // 우연히 맞을 수 있고, 이건 판정의 **입력**이다.
      describe("이벤트 사각 기대치(eventRects)", () => {
        const golem = {
          footprint: { width: 3, height: 3 },
          passRows: 1,
          bodyRect: { left: 14, right: 16, top: 16, bottom: 18 },
          passRect: { left: 14, right: 16, top: 18, bottom: 18 },
        };
        const withGolem = { ...observed, events: { ev_golem: golem } };

        it("사각이 전부 맞으면 통과한다", () => {
          expect(evaluateExpect({ eventRects: { ev_golem: golem } }, withGolem)).toEqual([]);
        });

        // 이게 이 축의 존재 이유다: passRows 를 무시하는 회귀가 나면 통행 사각이 몸 사각과 같아진다.
        it("통행 사각이 몸 사각으로 되돌아가면 잡는다", () => {
          const regressed = {
            ...withGolem,
            events: { ev_golem: { ...golem, passRect: { left: 14, right: 16, top: 16, bottom: 18 } } },
          };

          expect(evaluateExpect({ eventRects: { ev_golem: golem } }, regressed)).toEqual([
            'ev_golem.passRect: 기대 {"left":14,"right":16,"top":18,"bottom":18},'
              + ' 실제 {"left":14,"right":16,"top":16,"bottom":18}',
          ]);
        });

        it("스냅샷에 없는 이벤트는 조용히 통과시키지 않는다", () => {
          expect(evaluateExpect({ eventRects: { ev_missing: golem } }, withGolem)).toEqual([
            "이벤트 스냅샷 없음: ev_missing — 활성 페이지가 없거나 다른 맵이다",
          ]);
        });

        it("사각을 안 실어 온 런에서도 조용히 통과시키지 않는다", () => {
          expect(evaluateExpect({ eventRects: { ev_golem: golem } }, observed)).toEqual([
            "이벤트 스냅샷 없음: ev_golem — 활성 페이지가 없거나 다른 맵이다",
          ]);
        });

        // 키 순서에 의존하는 JSON.stringify 비교였다면 여기서 거짓 실패가 났다.
        it("사각의 키 순서가 달라도 통과한다", () => {
          const reordered = { top: 18, bottom: 18, right: 16, left: 14 };

          expect(evaluateExpect({ eventRects: { ev_golem: { passRect: reordered } } }, withGolem)).toEqual([]);
        });

        // 네 변 중 셋만 적으면 나머지 한 변이 조용히 통과한다 — 그걸 막는다.
        // 타입(RuntimeQaRect)이 이미 네 변을 요구하므로 캐스팅으로 뚫는다. 런타임 검사도 필요한
        // 이유: 시나리오는 .mjs 라 타입 검사를 받지 않는다.
        it("사각의 변이 빠지면 거부한다", () => {
          const partial = { left: 14, right: 16, top: 18 } as unknown as RuntimeQaFootprintRect;
          const failures = evaluateExpect({ eventRects: { ev_golem: { passRect: partial } } }, withGolem);

          expect(failures).toHaveLength(1);
          expect(failures[0]).toContain("ev_golem.passRect");
        });

        it("스칼라 필드(passRows)도 따로 판정한다", () => {
          expect(evaluateExpect({ eventRects: { ev_golem: { passRows: 3 } } }, withGolem)).toEqual([
            "ev_golem.passRows: 기대 3, 실제 1",
          ]);
        });

        // 발자국 저작이 없는 이벤트: 두 사각이 앵커 한 칸으로 같다 — 항등.
        it("1x1 이벤트의 두 사각이 같은 한 칸이면 통과한다", () => {
          const sign = {
            footprint: { width: 1, height: 1 },
            passRows: 1,
            bodyRect: { left: 4, right: 4, top: 6, bottom: 6 },
            passRect: { left: 4, right: 4, top: 6, bottom: 6 },
          };

          expect(evaluateExpect({ eventRects: { ev_sign: sign } }, { ...observed, events: { ev_sign: sign } })).toEqual([]);
        });

        it("eventRects 를 안 쓰면 아무 사유도 생기지 않는다 — 항등", () => {
          expect(evaluateExpect({ x: 3, y: 2 }, withGolem)).toEqual([]);
        });
      });
    });
    // 배틀러 배치 판정. 이 게이트가 조용히 통과하면 "몬스터가 필드 위로 잘려 나간" 상태가
    // 증거 없이 출하된다(실측: rm2000 앞줄 적 이미지 top=-13 vs field.top=24 → 37px 잘림).
    // CSS 레이아웃은 jsdom 이 계산하지 않으므로 실제 판정은 실브라우저 rect 로 하고,
    // 여기서는 그 rect 를 받아 사유를 만드는 순수 로직만 고정한다.
    describe("evaluateBattlerGeometry", () => {
      // 필드 0..400 → 지평선 132(33%).
      const field = { top: 0, bottom: 400, left: 0, right: 600, width: 600, height: 400 };
      /** 이미지 높이 100 + 이름표 20 의 표준 배틀러. bottom 이 곧 발 위치다. */
      const enemyAt = (id: string, bottom: number) => enemyBox(id, bottom - 100, bottom);
      /** 상자를 직접 지정하는 변형 — 발은 지면에 닿고 상단만 잘린 큰 스프라이트 등. */
      function enemyBox(id: string, top: number, bottom: number) {
        return {
          id,
          node: { top, bottom: bottom + 20, left: 100, right: 200, width: 100, height: bottom + 20 - top },
          image: { top, bottom, left: 100, right: 200, width: 100, height: bottom - top },
        };
      }
      const battlers = (enemies: readonly RuntimeQaBattler[]) => ({
        skin: "retro2003",
        directorStep: "command",
        field,
        enemies,
        allies: [],
      });

      it("필드 안 + 발이 지평선 아래면 통과한다", () => {
        expect(evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 240)]))).toEqual([]);
      });

      it("상단이 필드 밖으로 나가면 잘린 픽셀 수를 보고한다", () => {
        expect(evaluateBattlerGeometry({}, battlers([enemyBox("enemy-1", -13, 240)]))).toEqual([
          "battlerGeometry[enemy-1]: 필드 상단 밖으로 13px 잘렸다 (image.top=-13 < field.top=0)",
        ]);
      });

      it("발이 지평선 위에 떠 있으면 보고한다", () => {
        expect(evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 120)]))).toEqual([
          "battlerGeometry[enemy-1]: 발이 지평선 위에 떠 있다 (image.bottom=120 < 지평선=132, field=0..400)",
        ]);
      });

      // 지평선(33%) 축은 통과하지만 접지 띠(하위 40%) 축은 못 넘는 구간 — 실측으로 잡힌 진짜 결함 모양이다
      // (chrono 발 37%, mv 46%, vxace 57%: 전부 지평선 아래인데도 필드 하단 절반이 비고 몬스터가 떠 보였다).
      it("지평선은 넘었지만 접지 띠 위에 떠 있으면 보고한다", () => {
        expect(evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 200)]))).toEqual([
          "battlerGeometry[enemy-1]: 발이 접지 띠 위에 떠 있다 (image.bottom=200 < 하위 40% 시작=240, field=0..400)",
        ]);
      });

      it("접지 띠 시작선에 정확히 닿으면 통과한다", () => {
        expect(evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 240)]))).toEqual([]);
      });

      // 이미지는 필드 안이지만 **이름표/게이지 스택**이 밖으로 밀린 경우 — 발을 접지 띠까지 내리면
      // 실제로 생겼던 결함이다(rm2000 앞줄 node.bottom=464 > field.bottom=444).
      it("이름표/게이지가 필드 하단 밖으로 나가면 보고한다", () => {
        const enemy = enemyAt("enemy-1", 390);
        expect(evaluateBattlerGeometry({}, battlers([enemy]))).toEqual([
          "battlerGeometry[enemy-1]: 이름표/게이지가 필드 하단 밖으로 10px 잘렸다 (node.bottom=410 > field.bottom=400)",
        ]);
      });

      it("하단이 필드 밖으로 나가면 보고한다", () => {
        expect(evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 420)]))).toEqual([
          "battlerGeometry[enemy-1]: 필드 하단 밖으로 20px 잘렸다 (image.bottom=420 > field.bottom=400)",
          "battlerGeometry[enemy-1]: 이름표/게이지가 필드 하단 밖으로 40px 잘렸다 (node.bottom=440 > field.bottom=400)",
        ]);
      });

      it("적이 여러 마리면 마리마다 누적한다", () => {
        const reasons = evaluateBattlerGeometry(
          {},
          battlers([enemyBox("enemy-1", -13, 240), enemyAt("enemy-2", 340), enemyAt("enemy-3", 120)]),
        );

        expect(reasons).toHaveLength(2);
        expect(reasons[0]).toContain("enemy-1");
        expect(reasons[1]).toContain("enemy-3");
      });

      it("최소 적 수를 못 채우면 보고한다 — 트룹이 안 떴는데 통과하면 안 된다", () => {
        expect(evaluateBattlerGeometry({ minEnemies: 3 }, battlers([enemyAt("enemy-1", 240)]))).toEqual([
          "battlerGeometry: 적 노드 1개 — 최소 3개 기대",
        ]);
      });

      it("스프라이트 노드가 없으면 통과시키지 않는다", () => {
        const enemy = { ...enemyAt("enemy-1", 240), image: null };

        expect(evaluateBattlerGeometry({}, battlers([enemy]))).toEqual([
          "battlerGeometry[enemy-1]: .battle-enemy-image 노드가 없다",
        ]);
      });

      it("크기 0 스프라이트는 통과시키지 않는다 — 안 그려진 것과 잘 놓인 것은 다르다", () => {
        const enemy = enemyAt("enemy-1", 240);
        const zeroSized = { ...enemy, image: { ...enemy.image, height: 0, width: 0 } };

        expect(evaluateBattlerGeometry({}, battlers([zeroSized]))).toEqual([
          "battlerGeometry[enemy-1]: 스프라이트 크기가 0 (0×0)",
        ]);
      });

      // 담기·지평선 축만으로는 통과하지만 화면에는 한 마리로 보인다(실측: rm2000/dragonquest/mv
      // 가 3마리 트룹의 세 노드를 완전히 같은 rect 에 그리면서 게이트를 통과했다).
      it("여러 마리가 같은 점에 쌓이면 보고한다", () => {
        const reasons = evaluateBattlerGeometry(
          {},
          battlers([enemyAt("enemy-1", 240), enemyAt("enemy-2", 240), enemyAt("enemy-3", 240)]),
        );

        expect(reasons).toEqual([
          "battlerGeometry[enemy-1/enemy-2]: 두 적이 같은 자리에 겹쳐 있다 (중심 거리 0×0px, 최소 25×25px)",
          "battlerGeometry[enemy-1/enemy-3]: 두 적이 같은 자리에 겹쳐 있다 (중심 거리 0×0px, 최소 25×25px)",
          "battlerGeometry[enemy-2/enemy-3]: 두 적이 같은 자리에 겹쳐 있다 (중심 거리 0×0px, 최소 25×25px)",
        ]);
      });

      it("줄만 달라도 겹침이 아니다 — 같은 열의 앞줄·뒷줄은 정상 배치다", () => {
        expect(
          evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 260), enemyAt("enemy-2", 340)])),
        ).toEqual([]);
      });

      // 스프라이트 축과 독립이다: 간격이 넉넉해도 공용 이름표가 넓으면 글자만 겹친다
      // (실측: chrono 적 간격 38px 에 이름 18px 이 들어가 "슬라임동굴 박쥐슬라임" 으로 뭉개졌다).
      it("적 이름표 잉크 박스가 겹치면 보고한다 — 스프라이트가 안 겹쳐도 글자는 뭉개진다", () => {
        const withName = (id: string, centerX: number, nameLeft: number, nameRight: number) => ({
          ...enemyAt(id, centerX),
          name: { top: 300, bottom: 320, left: nameLeft, right: nameRight, width: nameRight - nameLeft, height: 20 },
        });

        const reasons = evaluateBattlerGeometry(
          {},
          battlers([withName("enemy-1", 260, 150, 260), withName("enemy-2", 340, 240, 350)]),
        );

        expect(reasons).toEqual([
          "battlerGeometry[enemy-1/enemy-2]: 적 이름표가 겹쳐 글자가 뭉개진다 (교차 20×20px)",
        ]);
      });

      it("이름표가 안 겹치면 통과한다 — 좁은 간격 자체는 결함이 아니다", () => {
        const withName = (id: string, centerX: number, nameLeft: number, nameRight: number) => ({
          ...enemyAt(id, centerX),
          name: { top: 300, bottom: 320, left: nameLeft, right: nameRight, width: nameRight - nameLeft, height: 20 },
        });

        expect(
          evaluateBattlerGeometry(
            {},
            battlers([withName("enemy-1", 260, 170, 230), withName("enemy-2", 340, 310, 370)]),
          ),
        ).toEqual([]);
      });

      // 적을 접지 띠까지 내리면 아군 진형 띠로 내려온다 — 실측으로 잡힌 결함(chrono y 86→48).
      it("적이 아군 스프라이트와 겹치면 보고한다", () => {
        const withAlly = {
          ...battlers([enemyAt("enemy-1", 300)]),
          allies: [{ id: "battle-actor-hero", image: { top: 250, bottom: 350, left: 150, right: 250, width: 100, height: 100 } }],
        };
        expect(evaluateBattlerGeometry({}, withAlly)).toEqual([
          "battlerGeometry[enemy-1/battle-actor-hero]: 적이 아군 스프라이트와 겹쳐 있다 (교차 50×50px)",
        ]);
      });

      it("적과 아군이 안 겹치면 통과한다", () => {
        const withAlly = {
          ...battlers([enemyAt("enemy-1", 300)]),
          allies: [{ id: "battle-actor-hero", image: { top: 250, bottom: 350, left: 300, right: 400, width: 100, height: 100 } }],
        };
        expect(evaluateBattlerGeometry({}, withAlly)).toEqual([]);
      });

      it("아군이 HUD 카드로만 표현되면(스프라이트 없음) 겹침을 보고하지 않는다", () => {
        const hudAlly = {
          ...battlers([enemyAt("enemy-1", 300)]),
          allies: [{ id: "battle-actor-hero", node: { top: 0, bottom: 400, left: 0, right: 600, width: 600, height: 400 } }],
        };
        expect(evaluateBattlerGeometry({}, hudAlly)).toEqual([]);
      });

      it("전투 화면이 아예 없으면 명시적으로 실패한다", () => {
        expect(evaluateBattlerGeometry({}, null)).toEqual([
          "battlerGeometry: 전투 화면(battle-scene/battle-field)이 없다 — 기하를 읽을 수 없다",
        ]);
      });

      it("expect 경유로도 같은 사유가 올라온다", () => {
        const reasons = evaluateExpect(
          { battlerGeometry: { minEnemies: 1 } },
          { ...observed, battlers: battlers([enemyBox("enemy-1", -13, 240)]) },
        );

        expect(reasons).toEqual([
          "battlerGeometry[enemy-1]: 필드 상단 밖으로 13px 잘렸다 (image.top=-13 < field.top=0)",
        ]);
      });
    });
  });
  describe("runtimeQaReport", () => {
    isolateTimers();
    const minimal = { id: "smoke", beats: [{ id: "start" }] };
    describe("normalizeScenario", () => {
      it("gate scenarios reject fixed waits", () => {
        expect(() => normalizeScenario({
          id: "fixed-wait",
          beats: [{ id: "start", ops: [{ kind: "wait", ms: 1 }] }],
        })).toThrow(/고정 wait op/);
      });

      it("생략된 값에 기본값을 채운다", () => {
        const normalized = normalizeScenario(minimal);

        expect(normalized.seed).toBe(1);
        expect(normalized.viewport).toEqual({ width: 1024, height: 768 });
        // 기본 픽스처는 캐릭셋 텍스처가 실제로 로드되는 것이어야 한다.
        // oprn-sample-v3 는 같은 resourceId 로도 __MISSING 이 나와(실측) 시각 검증을 오염시킨다.
        expect(normalized.projectFixture).toBe("test/fixtures/projects/editor-authored-demo-v3.json");
        expect(normalized.beats[0].shot).toBe(false);
      });

      it("명시한 값은 보존한다", () => {
        const normalized = normalizeScenario({
          ...minimal,
          seed: 42,
          viewport: { width: 640, height: 480 },
          projectFixture: "custom.json",
          beats: [{ id: "start", shot: true }],
        });

        expect(normalized.seed).toBe(42);
        expect(normalized.viewport).toEqual({ width: 640, height: 480 });
        expect(normalized.projectFixture).toBe("custom.json");
        expect(normalized.beats[0].shot).toBe(true);
      });

      it("비트가 없으면 거부한다", () => {
        expect(() => normalizeScenario({ id: "empty", beats: [] })).toThrow(/비트가 하나도 없다/);
      });

      it("비트 ID 가 중복되면 거부한다 — 샷 파일이 덮어써진다", () => {
        expect(() =>
          normalizeScenario({ id: "dup", beats: [{ id: "a" }, { id: "a" }] }),
        ).toThrow(/중복된 비트 ID: a/);
      });

      it("비트 ID 가 kebab-case 가 아니면 거부한다 — 파일명에 쓰인다", () => {
        expect(() => normalizeScenario({ id: "bad", beats: [{ id: "Start Beat" }] })).toThrow(
          /비트 ID 는 kebab-case: Start Beat/,
        );
      });

      it("조건 대기 op 을 받아들인다 — 고정 sleep 은 flaky 의 근원이다", () => {
        const normalized = normalizeScenario({
          id: "waits",
          beats: [
            {
              id: "a",
              ops: [
                { kind: "waitFor", testid: "dialogue-box", state: "absent" },
                { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent" },
              ],
            },
          ],
        });

        expect(normalized.beats[0].ops).toHaveLength(2);
      });

      it("모르는 op 종류는 거부한다 — 조용히 무시하면 게이트가 거짓말한다", () => {
        // 타입에 없는 op 을 일부러 넣는다. 시나리오는 런타임에 .mjs 로도 작성되므로
        // 타입 검사만으로는 막히지 않는다 — 정규화 단계의 런타임 거부가 필요하다.
        const rogue = { kind: "levitate" } as unknown as RuntimeQaOp;

        expect(() => normalizeScenario({ id: "x", beats: [{ id: "a", ops: [rogue] }] })).toThrow(
          /알 수 없는 op: levitate/,
        );
      });
    });
    describe("shouldCaptureShot", () => {
      it("옵트인한 비트는 샷을 남긴다", () => {
        expect(shouldCaptureShot({ shot: true }, [])).toBe(true);
      });

      it("옵트인 안 한 통과 비트는 샷을 남기지 않는다", () => {
        expect(shouldCaptureShot({ shot: false }, [])).toBe(false);
      });

      it("실패한 비트는 옵트인 안 했어도 샷을 남긴다 — 비전이 볼 것이 없으면 안 된다", () => {
        expect(shouldCaptureShot({ shot: false }, ["testid 잔존: dialogue-box"])).toBe(true);
      });
    });
    describe("shotFileName", () => {
      it("1-based 2자리 접두사를 붙인다", () => {
        expect(shotFileName(0, "title")).toBe("01-title.png");
        expect(shotFileName(11, "after-battle")).toBe("12-after-battle.png");
      });
    });
    describe("renderSummary", () => {
      const state = { currentMapId: "map_town", x: 0, y: 1, gold: 0 };
      const report: RuntimeQaReport = {
        scenarioId: "smoke",
        projectPath: "test/fixtures/projects/oprn-sample-v3.json",
        seed: 1,
        viewport: { width: 1024, height: 768 },
        errors: [],
        beats: [
          { index: 0, id: "title", note: "타이틀 진입", shot: "01-title.png", failures: [], state: null },
          { index: 1, id: "walk", note: "우로 이동", shot: null, failures: [], state },
          {
            index: 2,
            id: "shop",
            note: "상점 창",
            shot: "03-shop.png",
            failures: ["testid 누락: shop-window"],
            state,
          },
        ],
      };

      it("먼저 텍스트를 읽으라는 규칙을 맨 위에 박는다", () => {
        expect(renderSummary(report)).toMatch(/이 파일을 먼저 읽어라/);
      });

      it("게이트 실패를 헤드라인에 낸다", () => {
        const summary = renderSummary(report);

        expect(summary).toMatch(/게이트: 실패/);
        expect(summary).toMatch(/열어야 할 샷: 1개/);
      });

      it("실패한 비트의 샷만 즉시 확인 대상으로 표시한다", () => {
        const summary = renderSummary(report);

        expect(summary).toMatch(/03-shop\.png.*게이트 실패 — 즉시 확인/);
        expect(summary).toMatch(/01-title\.png.*시각 확인 대기/);
      });

      it("샷이 없는 비트는 볼 이유를 비운다", () => {
        expect(renderSummary(report)).toMatch(/\| walk \|[^\n]*\| — \| — \|/);
      });

      it("전부 통과하면 게이트 통과로 낸다", () => {
        const summary = renderSummary({
          ...report,
          beats: [
            { index: 0, id: "title", note: "타이틀", shot: "01-title.png", failures: [], state: null },
          ],
        });

        expect(summary).toMatch(/게이트: 통과/);
        expect(summary).toMatch(/열어야 할 샷: 0개/);
      });

      it("런타임 에러는 별도로 드러낸다", () => {
        const summary = renderSummary({ ...report, errors: ["TypeError: x is not a function"] });

        expect(summary).toMatch(/런타임 에러 1건/);
        expect(summary).toMatch(/TypeError: x is not a function/);
      });
    });
  });
});
