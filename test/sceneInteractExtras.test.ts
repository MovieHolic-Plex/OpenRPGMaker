// 2026-09-24 헤드리스 「등대지기의 겨울」 두 판: run_scene_test 의 interact 에 adjacent·to·dir(walk·face 의 필드)를
// 붙여 거부됐다. 거부는 유지하되(바라보기 실패는 검증 계약이다) 어느 스텝으로 옮길지 알려 준다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { runSceneTest } from "@/testing/sceneTestRunner";
import type { Project } from "@/project/types";

function withTalker(): { project: Project; mapId: string } {
  const ctx: { project: Project } = { project: createBlankProject() };
  const mapId = ctx.project.startMapId;
  const result = runTool(ctx, "upsert_event", { mapId, event: {
    id: "ev_kai", x: 5, y: 3, trigger: { kind: "action" }, commands: [],
    pages: [{ id: "p0", name: "카이", conditions: [], trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 0 },
      commands: [{ kind: "setSwitch", switchId: "sw_0001", value: true }] }],
  } });
  expect(result.ok, result.summary).toBe(true);
  return { project: ctx.project, mapId };
}

describe("scene test interact extras", () => {
  it("the hinted path works: walk adjacent to the event, then interact", () => {
    const { project, mapId } = withTalker();
    const result = runSceneTest(project, {
      mapId, start: { x: 2, y: 5 },
      steps: [{ kind: "walk", to: { x: 5, y: 3 }, adjacent: true }, { kind: "interact", eventId: "ev_kai" }, { kind: "expect", switchOn: "sw_0001" }],
    });
    expect(result.ok, result.failureReason).toBe(true);
  });

  it("names walk/face for interact extras", () => {
    const { project, mapId } = withTalker();
    const result = runTool({ project }, "run_scene_test", { mapId, start: { x: 4, y: 3 }, steps: [{ kind: "interact", eventId: "ev_kai", adjacent: true, to: { x: 4, y: 3 } }] });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("walk");
  });
});

describe("find_tools exact name ignores a wrong domain", () => {
  it("returns the named tool even when domain does not list it", () => {
    const result = runTool({ project: createBlankProject() }, "find_tools", { query: "evaluate_village_look", domain: "map" });
    expect((result.data as { matches: { name: string }[] }).matches.map(match => match.name)).toEqual(["evaluate_village_look"]);
  });
});
