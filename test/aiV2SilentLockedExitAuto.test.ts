// 저절로 도는 컷신(엔진 무대 오프닝)은 «조건부 출구» 가 아니다 — 막힘 한 줄을 붙이면 조건 없는 자동 페이지가 되어 그 맵에 들어올 때마다 저절로 뜬다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";
import { silentLockedExits } from "@/ai/v2/judge/shipChecks";
import { applyShipDefaults } from "@/ai/v2/story/shipDefaults";

const page = (trigger: string, conditions: unknown[]) => ({
  id: `p_${trigger}`, name: "", conditions, graphic: { transparent: true }, trigger: { kind: trigger }, priority: "below",
  commands: [{ kind: "transfer", mapId: "", x: 3, y: 3, direction: "down" }],
});

function withEvent(trigger: string): { project: Project; event: GameEvent } {
  const project = createBlankProject() as Project;
  const map = project.maps[project.startMapId!]!;
  const event = { id: "ev_probe", name: "", x: 4, y: 4, pages: [page(trigger, [{ kind: "selfSwitch", key: "A", value: false }])] } as unknown as GameEvent;
  (event.pages![0] as unknown as { commands: { mapId: string }[] }).commands[0]!.mapId = map.id;
  map.events = [...(map.events ?? []), event];
  return { project, event };
}

describe("silentLockedExits", () => {
  it("still flags a walk-in exit that only moves when a condition holds", () => {
    const { project } = withEvent("playerTouch");
    expect(silentLockedExits(project).map((hit) => hit.eventId)).toContain("ev_probe");
  });

  it("does not flag an auto-running cutscene, so ship defaults add no self-running text page to it", () => {
    const { project, event } = withEvent("auto");
    expect(silentLockedExits(project).map((hit) => hit.eventId)).not.toContain("ev_probe");
    applyShipDefaults(project, "");
    expect(event.pages).toHaveLength(1);
  });
});
