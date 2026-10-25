import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { oversizedSprites } from "@/ai/v2/lookChecks";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import type { GameEvent, Project } from "@/project/types";

function withEvent(project: Project, event: Partial<GameEvent> & { id: string }, scale?: number): Project {
  const p = structuredClone(project);
  const map = Object.values(p.maps)[0]!;
  map.events = [...(map.events ?? []), {
    x: 3, y: 3, trigger: "action", ...event,
    pages: [{ id: "p1", name: "", conditions: [], trigger: "action", priority: "same", commands: [],
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster5" }, direction: "down", pattern: 28, ...(scale !== undefined ? { scale, scaleMode: "auto" as const } : {}) } }],
  } as unknown as GameEvent];
  return p;
}

describe("v2 look checks: oversized sprites (J23)", () => {
  const before = createBlankProject() as Project;

  it("flags a non-boss charset drawn 2x next to the party", () => {
    const after = withEvent(before, { id: "ev_cave_guardian", name: "석상 수호병" }, 2);
    const problems = oversizedSprites(before, after);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("석상 수호병");
    expect(problems[0]).toContain("2.0배");
    // 끝맺음 관문(게임 검사)에도 올라간다.
    expect(gameContentProblems(before, after, "동굴에 수문장을 둬 줘").some((p) => p.includes("[게임 검사 크기]"))).toBe(true);
  });

  it("leaves bosses and party-size sprites alone", () => {
    expect(oversizedSprites(before, withEvent(before, { id: "ev_floor2_boss", name: "붉은 용" }, 2.5))).toEqual([]);
    expect(oversizedSprites(before, withEvent(before, { id: "ev_x", name: "마왕" }, 2.5))).toEqual([]);
    expect(oversizedSprites(before, withEvent(before, { id: "ev_npc", name: "병정" }))).toEqual([]);
    expect(oversizedSprites(before, withEvent(before, { id: "ev_npc", name: "병정" }, 1.25))).toEqual([]);
  });

  it("only looks at events this run created or changed", () => {
    const already = withEvent(before, { id: "ev_old_statue", name: "거대 석상" }, 2);
    expect(oversizedSprites(already, already)).toEqual([]);
  });
});
