/** @vitest-environment happy-dom */
// 명령 요약은 이벤트 ID 가 아니라 이름을 말한다(2026-09-03 제안서 §6 — 「이동 경로 설정: ev_ux_stress (4개)」).
import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { commandSummary, eventNameForSummary } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";

function page(id: string, name: string): EventPage {
  return { id, name, conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] };
}
function event(id: string, pageName: string): GameEvent {
  return { id, x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page(`${id}-p1`, pageName)] };
}

describe("eventNameForSummary", () => {
  let mapId: string;
  beforeEach(() => {
    const project = createBlankProject();
    mapId = project.startMapId;
    project.maps[mapId]!.events = [event("ev_smith", "대장장이 하몬")];
    const otherId = "map_other_probe";
    project.maps[otherId] = { ...structuredClone(project.maps[mapId]!), id: otherId, name: "다른 맵", events: [event("ev_far", "먼 곳의 상인")] };
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventId: null, selectedEventPageId: null });
  });

  it("현재 맵의 이벤트는 표시 이름으로, 빈 ID 는 이 이벤트로", () => {
    expect(eventNameForSummary("ev_smith")).toBe("대장장이 하몬");
    expect(eventNameForSummary("")).toBe("이 이벤트");
  });

  it("다른 맵의 이벤트도 찾고, 없는 ID 는 끊어진 참조임을 드러낸다", () => {
    expect(eventNameForSummary("ev_far")).toBe("먼 곳의 상인");
    expect(eventNameForSummary("ev_ghost")).toBe("ev_ghost (없음)");
  });

  it("이동 경로·모습 바꾸기 요약에 원시 ID 가 남지 않는다", () => {
    const route = commandSummary({ kind: "moveEvent", eventId: "ev_smith", route: { moves: [{ kind: "move", dir: "left" }], repeat: false } });
    expect(route).toContain("대장장이 하몬");
    expect(route).not.toContain("ev_smith");
    expect(commandSummary({ kind: "moveEvent", eventId: PLAYER_MOVE_TARGET, route: { moves: [], repeat: false } })).toContain("주인공");
    const pattern = commandSummary({ kind: "setEventGraphicPattern", eventId: "ev_smith", pattern: 1 });
    expect(pattern).toContain("대장장이 하몬");
    expect(pattern).not.toContain("ev_smith");
  });
});
