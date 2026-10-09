// "이벤트에서 접촉"(eventTouch) 은 RM2K3 계약대로 양방향 충돌에서 발동해야 한다.
// 이벤트가 플레이어에게 걸어오는 쪽만 발동하면, 이동 유형이 정지인 이벤트는 무버가
// 없어서 영원히 발동하지 않는다 — 저작은 되지만 절대 실행되지 않는 트리거가 된다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runSceneTest } from "@/testing/sceneTestRunner";
import type { EventPage, Project, Trigger } from "@/project/types";

const SWITCH_ID = "sw_touched";

function projectWithTouchEvent(options: {
  readonly trigger: Trigger;
  readonly priority: EventPage["priority"];
  readonly overlapForbidden: boolean;
}): Project {
  const project = createBlankProject();
  project.switches = [...project.switches, { id: SWITCH_ID, name: "접촉됨" }];
  const map = project.maps[project.startMapId]!;
  map.events = [
    {
      id: "ev_touch",
      x: 3,
      y: 2,
      trigger: options.trigger,
      commands: [],
      pages: [
        {
          id: "p1",
          name: "접촉",
          conditions: [],
          graphic: {},
          trigger: options.trigger,
          priority: options.priority,
          overlapForbidden: options.overlapForbidden,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "setSwitch", switchId: SWITCH_ID, value: true }],
        },
      ],
    },
  ];
  return project;
}

function walkRight(project: Project) {
  return runSceneTest(project, {
    mapId: project.startMapId,
    start: { x: 2, y: 2 },
    steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOn: SWITCH_ID }],
  });
}

describe("eventTouch: 플레이어가 부딪히는 방향", () => {
  it("막는 eventTouch 이벤트에 걸어들어가면 발동한다", () => {
    const result = walkRight(projectWithTouchEvent({
      trigger: { kind: "eventTouch" },
      priority: "same",
      overlapForbidden: true,
    }));
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("통행 가능한 eventTouch 이벤트 칸을 밟으면 발동한다", () => {
    const result = walkRight(projectWithTouchEvent({
      trigger: { kind: "eventTouch" },
      priority: "below",
      overlapForbidden: false,
    }));
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("조사 트리거는 걸어들어가도 발동하지 않는다", () => {
    const result = walkRight(projectWithTouchEvent({
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
    }));
    expect(result.ok).toBe(false);
  });
});
