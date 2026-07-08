import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import {
  advanceLightingAmbientTransition,
  deterministicFlickerFactor,
  lightAtTile,
  lightingGradientParams,
} from "@/player/lighting";
import { runSceneTest } from "@/testing/sceneTestRunner";
import {
  createHorrorPhase6aFixture,
  createHorrorPhase6bFixture,
  PHASE6A_FLASHLIGHT_ID,
  PHASE6A_MAP_ID,
  PHASE6B_MAP_ID,
} from "./fixtures/horrorPhase6aFixture";

describe("runtime lighting helpers", () => {
  it("광원을 radial gradient 입력값으로 변환한다", () => {
    const params = lightingGradientParams(
      {
        ambient: 0.8,
        color: "#010203",
        sources: [{ id: "lamp", at: { x: 2, y: 3 }, radius: 4, intensity: 0.6 }],
      },
      {
        viewportWidth: 320,
        viewportHeight: 240,
        tileSize: 16,
        cameraX: 0,
        cameraY: 0,
        zoom: 1,
        timeMs: 0,
        resolveAnchor: (anchor) => (anchor === "player" || "eventId" in anchor ? undefined : anchor),
      }
    );

    expect(params).toMatchObject({ ambient: 0.8, color: "#010203", width: 320, height: 240 });
    expect(params.gradients).toEqual([
      { id: "lamp", centerX: 40, centerY: 56, radiusPx: 64, intensity: 0.6, color: undefined, flicker: 1 },
    ]);
  });

  it("ambient 전환은 고정 tick 누적으로 보간된다", () => {
    const transition = { fromAmbient: 0, toAmbient: 1, durationMs: 64, elapsedMs: 0 };

    const first = advanceLightingAmbientTransition(transition, 16);
    const second = advanceLightingAmbientTransition(transition, 16);
    const final = advanceLightingAmbientTransition(transition, 64);

    expect(first).toEqual({ ambient: 0.25, color: undefined, done: false });
    expect(second).toEqual({ ambient: 0.5, color: undefined, done: false });
    expect(final).toEqual({ ambient: 1, color: undefined, done: true });
  });

  it("eventId/player 부착 광원은 resolver의 현재 위치를 따라간다", () => {
    let eventX = 1;
    const lighting = {
      ambient: 0.9,
      sources: [{ id: "eye", at: { eventId: "ev_eye" }, radius: 1.5 }],
    };
    const resolver = () => ({ x: eventX, y: 2 });

    expect(lightAtTile(lighting, 1, 2, resolver)).toBe(true);
    eventX = 5;
    expect(lightAtTile(lighting, 1, 2, resolver)).toBe(false);
    expect(lightAtTile(lighting, 5, 2, resolver)).toBe(true);
  });

  it("flicker는 같은 id/time에서 결정론적이고 tick에 따라 변한다", () => {
    const seriesA = [0, 16, 32, 48].map((timeMs) => deterministicFlickerFactor("lamp", timeMs));
    const seriesB = [0, 16, 32, 48].map((timeMs) => deterministicFlickerFactor("lamp", timeMs));

    expect(seriesA).toEqual(seriesB);
    expect(new Set(seriesA).size).toBeGreaterThan(1);
  });

  it("세이브/로드 왕복으로 lighting이 보존된다", () => {
    const project = createHorrorPhase6aFixture();
    const session = startSession(project);
    session.lighting = {
      ambient: 0.7,
      color: "#050505",
      sources: [{ id: "flash", at: "player", radius: 4, intensity: 0.9, flicker: true }],
    };

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));

    expect(restored.lighting).toEqual(session.lighting);
  });
});

describe("set_lighting_volume tool", () => {
  it("map applyMode는 defaultLighting을 설정한다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;

    const result = runTool(ctx, "set_lighting_volume", {
      mapId,
      ambient: 0.85,
      color: "#000000",
      sources: [{ id: "flashlight", at: "player", radius: 4, intensity: 1 }],
      applyMode: "map",
    });

    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[mapId].defaultLighting).toEqual({
      ambient: 0.85,
      color: "#000000",
      sources: [{ id: "flashlight", at: "player", radius: 4, intensity: 1 }],
    });
  });

  it("event applyMode는 영역 playerTouch 조명 트리거를 생성한다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;

    const result = runTool(ctx, "set_lighting_volume", {
      mapId,
      ambient: 0.6,
      sources: [{ id: "lamp", at: { x: 2, y: 2 }, radius: 2 }],
      applyMode: "event",
      area: { x: 1, y: 1, w: 2, h: 1 },
    });

    expect(result.ok, result.summary).toBe(true);
    const created = ctx.project.maps[mapId].events.filter((event) => event.id.startsWith("ev_light_volume"));
    expect(created).toHaveLength(2);
    expect(created[0]?.pages?.[0]?.trigger).toEqual({ kind: "playerTouch" });
    expect(created[0]?.pages?.[0]?.commands).toEqual([
      { kind: "setLighting", ambient: 0.6 },
      { kind: "addLight", source: { id: "lamp", at: { x: 2, y: 2 }, radius: 2 } },
    ]);
  });
});

describe("set_scene_mood tool", () => {
  it("weather와 lighting 인자를 playerTouch 분위기 이벤트 명령으로 합성한다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;

    const result = runTool(ctx, "set_scene_mood", {
      mapId,
      weather: { kind: "fog", intensity: 0.45, transitionMs: 200 },
      lighting: {
        ambient: 0.75,
        color: "#05070a",
        sources: [{ id: "lamp", at: { x: 2, y: 2 }, radius: 3, intensity: 0.8 }],
        area: { x: 1, y: 1, w: 1, h: 1 },
      },
      applyMode: "event",
    });

    expect(result.ok, result.summary).toBe(true);
    const created = ctx.project.maps[mapId].events.filter((event) => event.id.startsWith("ev_scene_mood"));
    expect(created).toHaveLength(1);
    expect(created[0]?.pages?.[0]?.commands).toEqual([
      { kind: "setWeather", weather: "fog", intensity: 0.45, transitionMs: 200 },
      { kind: "setLighting", ambient: 0.75, color: "#05070a" },
      { kind: "addLight", source: { id: "lamp", at: { x: 2, y: 2 }, radius: 3, intensity: 0.8 } },
    ]);
  });
});

describe("run_scene_test lighting integration", () => {
  it("어두운 복도에서 player 부착 손전등이 이동 좌표를 따라간다", () => {
    const result = runSceneTest(createHorrorPhase6aFixture(), {
      mapId: PHASE6A_MAP_ID,
      start: { x: 1, y: 3 },
      steps: [
        { kind: "expect", lightingAmbient: 0.85, lightCount: 3, lightAt: { x: 1, y: 3 } },
        { kind: "move", to: { x: 5, y: 3 } },
        { kind: "expect", lightAt: { x: 1, y: 3, expected: false } },
        { kind: "expect", lightAt: { x: 5, y: 3 } },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
    expect(result.session.lighting?.sources.some((source) => source.id === PHASE6A_FLASHLIGHT_ID)).toBe(true);
  });

  it("setLighting transition 후 ambient 기대값을 만족한다", () => {
    const result = runSceneTest(createHorrorPhase6aFixture(), {
      mapId: PHASE6A_MAP_ID,
      start: { x: 1, y: 3 },
      steps: [
        { kind: "interact" },
        { kind: "expect", lightingAmbient: { value: 0.45, tolerance: 0.001 } },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
  });

  it("removeLight all 후 광원 수와 lightAt 기대값을 갱신한다", () => {
    const result = runSceneTest(createHorrorPhase6aFixture(), {
      mapId: PHASE6A_MAP_ID,
      start: { x: 2, y: 3 },
      steps: [
        { kind: "interact" },
        { kind: "expect", lightCount: 0, lightAt: { x: 2, y: 3, expected: false } },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
    expect(result.finalState.lightCount).toBe(0);
  });

  it("Phase 6b 데모 복도는 자동으로 storm 날씨를 적용한다", () => {
    const result = runSceneTest(createHorrorPhase6bFixture(), {
      mapId: PHASE6B_MAP_ID,
      start: { x: 1, y: 3 },
      steps: [
        { kind: "expect", weatherKind: "storm", lightingAmbient: 0.85 },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
    expect(result.finalState.weatherKind).toBe("storm");
  });

  it("showAnimation wait 중에는 다음 커맨드 진행이 보류되고 완료 후 진행된다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const switchId = project.switches[0]?.id ?? "sw_show_animation_done";
    if (!project.switches.some((entry) => entry.id === switchId)) {
      project.switches.push({ id: switchId, name: "애니메이션 완료" });
    }
    project.maps[mapId].events.push({
      id: "ev_show_animation_wait",
      x: 1,
      y: 2,
      trigger: { kind: "action" },
      commands: [
        { kind: "showAnimation", target: "player", animationId: "anim_hit", wait: true },
        { kind: "setSwitch", switchId, value: true },
      ],
    });

    const result = runSceneTest(project, {
      mapId,
      start: { x: 1, y: 1 },
      steps: [
        { kind: "interact" },
        { kind: "expect", animationPlaying: true, switchOff: switchId },
        { kind: "wait", ticks: 30 },
        { kind: "expect", animationPlaying: false, switchOn: switchId },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
  });

  it("Phase 6b 조명 전환 이벤트는 fog와 6a 라이팅을 동시에 적용한다", () => {
    const result = runSceneTest(createHorrorPhase6bFixture(), {
      mapId: PHASE6B_MAP_ID,
      start: { x: 1, y: 3 },
      steps: [
        { kind: "interact" },
        { kind: "expect", weatherKind: "fog", lightingAmbient: { value: 0.45, tolerance: 0.001 } },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
  });
});
