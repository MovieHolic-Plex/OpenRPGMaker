import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import type { NpcScheduleEntry } from "@/project/types";

describe("NPC 스케줄 에디터 (task 1: 타입 확인)", () => {
  it("NpcScheduleEntry 타입이 GameEvent.schedule에 존재한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    // schedule 필드가 선택적으로 존재함을 확인
    map.events.push({
      id: "ev_npc_test",
      x: 5, y: 5,
      trigger: { kind: "action" },
      commands: [],
      schedule: [
        {
          when: { timePhase: "day", season: "spring" },
          at: { mapId: map.id, x: 10, y: 10 },
          facing: "down",
          activity: "work",
        },
      ],
    });
    const event = map.events[0];
    expect(event.schedule).toBeDefined();
    expect(event.schedule!.length).toBe(1);
    expect(event.schedule![0].when.season).toBe("spring");
  });
});
