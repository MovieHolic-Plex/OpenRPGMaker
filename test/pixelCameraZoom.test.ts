// 도트 게임 정수 배율(2026-10-30): 1 이상 소수 저작 배율은 표시만 정수로 맞추고, 저작 도구는 경고만 한다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyStoredCameraState } from "@/player/playSceneCamera";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { pixelSnappedCameraZoom, pixelZoomWarning } from "@/project/cameraZoom";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { getTool } from "@/editor/tools";
import { openingCameraZoomWarning } from "@/editor/tools/openingAnimaticTools";
import type { Project } from "@/project/types";

describe("pixelSnappedCameraZoom", () => {
  it("1 이상 소수는 가장 가까운 정수로, 정수·1 미만은 그대로", () => {
    const system = { playResolution: { width: 480, height: 270 } };
    expect(pixelSnappedCameraZoom(1.5, system)).toBe(2);
    expect(pixelSnappedCameraZoom(1.18, system)).toBe(1);
    expect(pixelSnappedCameraZoom(1.25, system)).toBe(1);
    expect(pixelSnappedCameraZoom(2.6, system)).toBe(3);
    expect(pixelSnappedCameraZoom(2, system)).toBe(2);
    expect(pixelSnappedCameraZoom(0.5, system)).toBe(0.5);
    expect(pixelSnappedCameraZoom(0.75, system)).toBe(0.75);
  });

  it("양쪽 전신 대화창(3.2배)과 고해상도 화면(1440×1080 + 4.5배)은 소수 그대로", () => {
    expect(pixelSnappedCameraZoom(3.2, { dialogueStyle: "dual-fullbody-veil" })).toBe(3.2);
    expect(pixelSnappedCameraZoom(4.5, { playResolution: { width: 1440, height: 1080 } })).toBe(4.5);
  });

  it("경고는 표시 배율이 달라질 때만", () => {
    expect(pixelZoomWarning(1.5, {})).toContain("2배");
    expect(pixelZoomWarning(2, {})).toBeNull();
    expect(pixelZoomWarning(0.5, {})).toBeNull();
  });
});

describe("런타임 카메라는 정수 배율로 보인다", () => {
  afterEach(() => vi.restoreAllMocks());

  function scene(project: Project, mapZoom: number | undefined) {
    const map = { ...project.maps[project.startMapId]!, cameraZoom: mapZoom };
    vi.spyOn(store, "getCurrent").mockReturnValue(project);
    const camera = {
      width: 480, height: 270, zoom: 1, zoomX: 1, zoomY: 1,
      setZoom(value: number) { this.zoom = value; this.zoomX = value; this.zoomY = value; },
      setBounds() { return undefined; },
      startFollow() { return undefined; },
      stopFollow() { return undefined; },
      centerOn() { return undefined; },
    };
    const session = startSession(project);
    const context = {
      cameras: { main: camera }, player: { x: 0, y: 0 }, eventSprites: new Map(), session, map,
      eventPositions: {}, syncRuntimeState: () => undefined,
    } as unknown as PlaySceneContext;
    return { context, camera };
  }

  it("맵 배율 1.5 는 2 로, 0.5 는 0.5 로 — 저장값은 그대로", () => {
    const project = createBlankProject();
    project.system.playResolution = { width: 480, height: 270 };
    const zoomed = scene(project, 1.5);
    applyStoredCameraState(zoomed.context);
    expect(zoomed.camera.zoom).toBe(2);
    expect((zoomed.context.map as { cameraZoom?: number }).cameraZoom).toBe(1.5);

    const far = scene(project, 0.5);
    applyStoredCameraState(far.context);
    expect(far.camera.zoom).toBe(0.5);
  });
});

describe("저작 도구 경고", () => {
  it("set_map_properties 는 소수 배율을 저장하고 경고한다", () => {
    const project = createBlankProject();
    const result = getTool("set_map_properties")!.run(project, { mapId: project.startMapId, zoom: 1.5 });
    expect(project.maps[project.startMapId]!.cameraZoom).toBe(1.5);
    expect(result.warnings?.join(" ")).toContain("2배");
    const clean = getTool("set_map_properties")!.run(project, { mapId: project.startMapId, zoom: 2 });
    expect(clean.warnings ?? []).toEqual([]);
  });

  it("set_project_settings 는 소수 배율을 저장하고 경고한다", () => {
    const project = createBlankProject();
    const result = getTool("set_project_settings")!.run(project, { cameraZoom: 1.25 });
    expect(project.system.cameraZoom).toBe(1.25);
    expect(result.warnings?.join(" ")).toContain("1배");
  });

  it("오프닝 카메라 줌 키가 소수면 경고한다", () => {
    expect(openingCameraZoomWarning({ zoom: 1, keys: { zoom: [{ atMs: 0, value: 1 }, { atMs: 1000, value: 1.18 }] } })).toContain("1.18");
    expect(openingCameraZoomWarning({ zoom: 1, keys: { zoom: [{ atMs: 0, value: 1 }, { atMs: 1000, value: 2 }] } })).toBeNull();
    expect(openingCameraZoomWarning(undefined)).toBeNull();
  });
});
