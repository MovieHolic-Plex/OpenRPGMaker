// J69: 맵마다 기본 카메라 배율(set_map_properties zoom) · J70: 타이틀 메뉴 글자 크기(set_title_screen menuFontPx).
import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { resolveMapCameraZoom } from "@/project/cameraZoom";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import type { GameEvent } from "@/project/types";

describe("맵 카메라 배율", () => {
  it("set_map_properties zoom 이 맵에 남고 런타임 배율이 그것을 먼저 본다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    getTool("set_map_properties")!.run(project, { mapId, zoom: 1.5 });
    expect(project.maps[mapId]!.cameraZoom).toBe(1.5);
    expect(resolveMapCameraZoom(project.system, project.maps[mapId])).toBe(1.5);
    getTool("set_map_properties")!.run(project, { mapId, zoom: 1 });
    expect(project.maps[mapId]!.cameraZoom).toBeUndefined();
    expect(resolveMapCameraZoom({ cameraZoom: 2 }, project.maps[mapId])).toBe(2);
  });

  it("끝맺음 검사가 배율만 거는 자동 이벤트를 짚는다", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    after.maps[after.startMapId]!.events.push({ id: "ev_zoom", name: "줌", x: 0, y: 0, pages: [{ conditions: [], trigger: { kind: "auto" }, commands: [{ kind: "m2Command", commandId: "m2-201-camera-control", fields: { mode: "follow", zoom: "2" } }, { kind: "eraseEvent" }] }] } as unknown as GameEvent);
    expect(gameContentProblems(before, after, "이 방은 가까이 보이게").join(" ")).toContain("set_map_properties");
  });
});

describe("타이틀 메뉴 글자 크기", () => {
  it("menuFontPx 를 10~24 로 잘라 저장하고 0 이면 지운다", () => {
    const project = createBlankProject();
    getTool("set_title_screen")!.run(project, { menuFontPx: 30 });
    expect(project.system.titleScreen?.menuFontPx).toBe(24);
    getTool("set_title_screen")!.run(project, { menuFontPx: 0 });
    expect(project.system.titleScreen?.menuFontPx).toBeUndefined();
  });
});
