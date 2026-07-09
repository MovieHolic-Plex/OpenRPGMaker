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

  // 2026-07-08 사고 회귀: 존재하지 않는 맵(map_dry_mine 등)으로의 transfer가 저장본에 남아
  // 프로젝트 전체가 로드 불가(벽돌)였다. 로드는 깨진 이동 명령을 정리하고 성공해야 한다.
  it("deserialize는 존재하지 않는 맵으로의 transfer/changeTile을 정리하고 로드한다", () => {
    const project = createBlankProject();
    const obj = JSON.parse(serialize(project));
    const mapId = Object.keys(obj.maps)[0];
    obj.maps[mapId].events = [
      {
        id: "ev_broken",
        name: "부서진 문",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [
          { kind: "text", text: "안녕" },
          { kind: "transfer", mapId: "map_dry_mine", x: 2, y: 3 },
          {
            kind: "choices",
            options: [
              { text: "간다", branch: [{ kind: "transfer", mapId: "map_ember_village", x: 0, y: 0 }] },
              { text: "안 간다", branch: [] },
            ],
          },
          { kind: "changeTile", mapId: "map_dry_mine", x: 0, y: 0, layer: "lower", tile: 1 },
        ],
      },
    ];

    const restored = deserialize(JSON.stringify(obj));

    const commands = restored.maps[mapId].events[0].commands;
    expect(JSON.stringify(commands)).not.toContain("map_dry_mine");
    expect(JSON.stringify(commands)).not.toContain("map_ember_village");
    expect(commands[0]).toMatchObject({ kind: "text", text: "안녕" });
    // 정상 명령/분기 구조는 보존된다.
    expect(commands.some((command) => command.kind === "choices")).toBe(true);
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

// 2026-07-09 사고 회귀: 타입 상성(9b)이 skill.elementId 존재 검증을 추가하면서, 존재하지 않는
// 속성을 가리키는 기존 저장본 스킬(skill_leaf)이 프로젝트 전체 로드 실패(벽돌)를 일으켰다.
// 로드는 깨진 elementId를 제거하고 성공해야 한다.
describe("skill elementId 로드 복구", () => {
  it("deserialize는 존재하지 않는 elementId를 가진 스킬을 정리하고 로드한다", () => {
    const project = createBlankProject();
    const obj = JSON.parse(serialize(project));
    obj.database.skills[0].elementId = "element_missing";

    const restored = deserialize(JSON.stringify(obj));

    expect(restored.database.skills[0].elementId).toBeUndefined();
  });
});
