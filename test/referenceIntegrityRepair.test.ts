import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import { projectLint } from "@/project/lint/projectLint";

describe("project reference integrity", () => {
  it("deserialize는 dangling mapTree 참조를 안전하게 제거한다", () => {
    const project = createBlankProject();
    const obj = JSON.parse(serialize(project));
    obj.mapTree.children.push({ mapId: "map_ember_village", children: [] });

    const restored = deserialize(JSON.stringify(obj));

    expect(JSON.stringify(restored.mapTree)).not.toContain("map_ember_village");
    expect(restored.mapTree.mapId).toBe(project.startMapId);
  });

  it("projectLint는 참조 오류를 한 번에 여러 건 보고한다", () => {
    const project = createBlankProject();
    project.database.actors[0].unarmedAnimationId = "anim_missing";
    project.database.classes[0].animationId = "anim_missing_class";
    project.database.items[0].healStateIds = ["state_missing"];

    const errors = projectLint(project).filter((issue) => issue.code === "reference-validation");

    expect(errors.map((issue) => issue.message).join("\n")).toContain("unarmedAnimationId");
    expect(errors.map((issue) => issue.message).join("\n")).toContain("class");
    expect(errors.map((issue) => issue.message).join("\n")).toContain("healState");
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it("deserialize는 안전하게 지울 수 있는 dangling DB 참조를 복구한다", () => {
    const project = createBlankProject();
    const obj = JSON.parse(serialize(project));
    obj.database.actors[0].unarmedAnimationId = "anim_missing";
    obj.database.classes[0].animationId = "anim_missing_class";
    obj.commonEvents = [{ id: "ce_live", name: "Live", trigger: "none", commands: [{ kind: "callCommonEvent", commonEventId: "ce_missing" }] }];

    const restored = deserialize(JSON.stringify(obj));

    expect(restored.database.actors[0].unarmedAnimationId).toBeUndefined();
    expect(restored.database.classes[0].animationId).toBeUndefined();
    expect(restored.commonEvents[0].commands).toEqual([]);
  });
});
