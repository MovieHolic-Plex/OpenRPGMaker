import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { initialGameTime } from "@/project/gameTime";
import { npcScheduleTargetForEvent } from "@/project/npcSchedule";
import type { GameEvent } from "@/project/types";

// 2026-09-23 추리 도그푸딩: 마을 주민을 경찰로 바꿔 move_event 로 옮겼지만 시간표 아침 칸이 옛 자리에
// 남아, 끝에 시간 시스템이 켜지자 NPC 가 옛 자리로 돌아가 지목 대화를 찾을 수 없었다.
function fixture() {
  const ctx = { project: createBlankProject() };
  const mapId = ctx.project.startMapId;
  const map = ctx.project.maps[mapId];
  assert(map);
  const npc: GameEvent = {
    id: "ev_police", name: "경찰", x: 5, y: 5, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: "p", name: "경찰", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "지목" }],
    }],
    schedule: [
      { when: { timePhase: "morning" }, at: { mapId, x: 5, y: 5 }, facing: "down", activity: "아침 집안일" },
      { when: { timePhase: "day" }, at: { mapId, x: 9, y: 3 }, facing: "left", activity: "창문 닦기" },
    ],
  };
  map.events.push(npc);
  return { ctx, mapId, map };
}

describe("NPC 시간표와 배치 동기화", () => {
  it("move_event 는 옛 자리에 있던 시간표 칸을 새 자리로 옮기고 남은 칸을 알린다", () => {
    const { ctx, mapId } = fixture();
    const result = runTool(ctx, "move_event", { mapId, eventId: "ev_police", x: 7, y: 6 });
    assert(result.ok, result.summary);
    const event = ctx.project.maps[mapId]?.events.find((entry) => entry.id === "ev_police");
    assert(event?.schedule);
    expect({ x: event.x, y: event.y }).not.toEqual({ x: 5, y: 5 });
    expect(event.schedule[0]?.at).toEqual({ mapId, x: event.x, y: event.y });
    expect(event.schedule[1]?.at).toEqual({ mapId, x: 9, y: 3 });
    const warnings = result.diff?.warnings.join("\n") ?? "";
    expect(warnings).toMatch(/시간표/);
    expect(warnings).toMatch(/창문 닦기/);
  });

  it("configure_time_system 은 켜는 순간 시간표 위치로 끌려갈 NPC 를 알린다", () => {
    const { ctx, map } = fixture();
    const event = map.events.find((entry) => entry.id === "ev_police");
    assert(event);
    event.x = 2;
    event.y = 2;
    const result = runTool(ctx, "configure_time_system", { enabled: true });
    assert(result.ok, result.summary);
    const system = ctx.project.system.timeSystem;
    const target = npcScheduleTargetForEvent(map.id, event, initialGameTime(system));
    expect(target).toMatchObject({ x: 5, y: 5, matched: true });
    const warnings = result.diff?.warnings.join("\n") ?? "";
    expect(warnings).toMatch(/경찰/);
    expect(warnings).toMatch(/\(2, 2\).*\(5, 5\)/);
  });

  it("configure_time_system 은 시간표와 배치가 맞으면 조용하다", () => {
    const { ctx } = fixture();
    const result = runTool(ctx, "configure_time_system", { enabled: true });
    assert(result.ok, result.summary);
    expect(result.diff?.warnings ?? []).toEqual([]);
  });
});
