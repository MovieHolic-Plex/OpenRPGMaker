import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { getTool } from "@/editor/tools/toolRegistry";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import { projectCanLoseHp } from "@/project/fieldHud";
import type { GameEvent, Project } from "@/project/types";

// 2026-10-25 심사 J67: 피해가 없는 공포 탐험에 set_field_hud{theme:'horror'} 가 꽃잎 생명(체력)을 말없이 켰다.
function withTrap(project: Project): Project {
  const map = Object.values(project.maps)[0]!;
  map.events = [...(map.events ?? []), { id: "ev_trap", name: "가시 함정", x: 2, y: 2, trigger: "touch",
    pages: [{ id: "p1", name: "", conditions: [], trigger: "touch", priority: "same", commands: [{ kind: "changeActorHp", actorId: "actor_hero", op: "-=", amount: 5 }] }] } as unknown as GameEvent];
  return project;
}

describe("horror life HUD only when HP can drop (J67)", () => {
  it("theme horror alone does not show the petals in a damageless game", () => {
    const project = createBlankProject() as Project;
    expect(projectCanLoseHp(project)).toBe(false);
    getTool("set_field_hud")!.run(project, { theme: "horror" });
    expect(project.system.fieldHud?.vitals).toBe(false);
  });

  it("keeps the petals when something can hurt the player, or when vitals is asked for", () => {
    const hurt = withTrap(createBlankProject() as Project);
    getTool("set_field_hud")!.run(hurt, { theme: "horror" });
    expect(hurt.system.fieldHud?.vitals).toBe(true);
    const asked = createBlankProject() as Project;
    getTool("set_field_hud")!.run(asked, { theme: "horror", vitals: true });
    expect(asked.system.fieldHud?.vitals).toBe(true);
  });

  it("the finish check flags a life HUD in a game where HP never drops", () => {
    const before = createBlankProject() as Project;
    const after = structuredClone(before);
    after.system.fieldHud = { theme: "horror", vitals: true, clock: false, tools: false, objective: false, hideEmpty: true };
    expect(gameContentProblems(before, after, "공포 탐험 게임").some((line) => line.includes("[게임 검사 HUD]"))).toBe(true);
  });
});
