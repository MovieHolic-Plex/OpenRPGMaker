// 작은 맵 화면 채우기(system.smallMapFill) — 2026-11-04 오너 결정 「모든 게임 기본값을 끄기로 해」.
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyStoredCameraState, smallMapFillZoom } from "@/player/playSceneCamera";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { smallMapFillDensity, smallMapFitScale } from "@/project/mapViewScale";
import { startSession } from "@/project/session";
import { SMALL_MAP_FILL_DEFAULT, resolveSmallMapFill } from "@/project/smallMapFill";
import { store } from "@/project/store";
import { getTool } from "@/editor/tools";
import type { GameMap, Project } from "@/project/types";

function room(project: Project, width: number, height: number): GameMap {
  return { ...structuredClone(project.maps[project.startMapId]!), id: "room", width, height };
}

function scene(project: Project, map: GameMap, density: number, width = 480, height = 270) {
  vi.spyOn(store, "getCurrent").mockReturnValue(project);
  const camera = {
    width: width * density, height: height * density, zoom: 1, zoomX: 1, zoomY: 1,
    setZoom(value: number) { this.zoom = value; this.zoomX = value; this.zoomY = value; },
    setBounds() { return undefined; },
    startFollow() { return undefined; },
    stopFollow() { return undefined; },
    centerOn() { return undefined; },
  };
  const context = {
    cameras: { main: camera }, player: { x: 0, y: 0 }, eventSprites: new Map(), session: startSession(project), map,
    eventPositions: {}, syncRuntimeState: () => undefined,
    game: { registry: { get: (key: string) => (key === "playPixelDensity" ? density : undefined) } },
  } as unknown as PlaySceneContext;
  return { context, camera };
}

describe("smallMapFill 기본값", () => {
  afterEach(() => vi.restoreAllMocks());

  it("기본은 끔이고 저작값이 이긴다", () => {
    expect(SMALL_MAP_FILL_DEFAULT).toBe(false);
    const project = createBlankProject();
    expect(resolveSmallMapFill(project)).toBe(false);
    project.system.smallMapFill = true;
    expect(resolveSmallMapFill(project)).toBe(true);
  });

  it("끄면 작은 방도 1배 그대로 — 캔버스 밀도도 1", () => {
    const project = createBlankProject();
    project.system.playResolution = { width: 320, height: 240 };
    const small = room(project, 8, 9);
    project.maps = { ...project.maps, room: small };
    const { context, camera } = scene(project, small, 1, 320, 240);
    applyStoredCameraState(context);
    expect(camera.zoom).toBe(1);
  });

  it("켜면 예전처럼 작은 방을 채운다", () => {
    const project = createBlankProject();
    project.system.smallMapFill = true;
    const small = room(project, 8, 9);
    project.maps = { ...project.maps, room: small };
    const { context, camera } = scene(project, small, 3, 320, 240);
    applyStoredCameraState(context);
    expect(camera.zoom).toBeGreaterThan(3);
  });

  it("저장 정규화를 지나도 값이 남는다", () => {
    expect(normalizeSystemRecords({ smallMapFill: true } as never).smallMapFill).toBe(true);
    expect(normalizeSystemRecords({ smallMapFill: false } as never).smallMapFill).toBe(false);
    expect(normalizeSystemRecords({ smallMapFill: "yes" } as never).smallMapFill).toBeUndefined();
  });

  it("set_project_settings 는 기본과 같은 값을 지우고 다른 값만 남긴다", () => {
    const project = createBlankProject();
    getTool("set_project_settings")!.run(project, { smallMapFill: true });
    expect(project.system.smallMapFill).toBe(true);
    getTool("set_project_settings")!.run(project, { smallMapFill: false });
    expect(project.system.smallMapFill).toBeUndefined();
  });
});

describe("1배에 들어가는 방은 반 칸 여백 때문에 키우지 않는다", () => {
  afterEach(() => vi.restoreAllMocks());

  it("smallMapFitScale: 맵이 들어가면 한 축 채우기 없음", () => {
    expect(smallMapFitScale(1.4, 0.94, true)).toBe(1);
    expect(smallMapFitScale(1.4, 0.94, false)).toBe(1.4);
  });

  it("20×16 방(320×256)은 480×270 에서 1배 — 켜도 1.333배가 아니다", () => {
    const project = createBlankProject();
    project.system.smallMapFill = true;
    project.system.playResolution = { width: 480, height: 270 };
    const sg = room(project, 20, 16);
    expect(smallMapFillZoom({ width: 480 * 3, height: 270 * 3 }, sg, { integer: true, base: 3 })).toBe(3);
    project.maps = { [sg.id]: sg };
    expect(smallMapFillDensity(project, { width: 480, height: 270 })).toBe(1);
  });
});
