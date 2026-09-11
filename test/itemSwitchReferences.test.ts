import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { collectProjectReferenceIssues, repairProjectReferences } from "@/project/io/references";

function firstSwitchItem(project: ReturnType<typeof createBlankProject>) {
  const item = project.database.items.find((entry) => entry.type === "switch" && entry.switchId);
  if (!item) throw new Error("default catalog must ship a switch item");
  return item;
}

describe("item switchId reference integrity", () => {
  it("스위치 아이템이 선언되지 않은 스위치를 가리키면 참조 오류로 보고한다", () => {
    const project = createBlankProject();
    const item = firstSwitchItem(project);
    item.switchId = "sw_never_declared";

    const issues = collectProjectReferenceIssues(project);

    expect(issues.some((issue) => issue.includes(item.id) && issue.includes("switchId"))).toBe(true);
  });

  it("repairProjectReferences는 아이템이 켜는 스위치 정의를 자동 선언한다", () => {
    const project = createBlankProject();
    const item = firstSwitchItem(project);
    const switchId = item.switchId!;
    project.switches = project.switches.filter((entry) => entry.id !== switchId);
    delete project.session.switches[switchId];

    repairProjectReferences(project);

    expect(project.switches.some((entry) => entry.id === switchId)).toBe(true);
    expect(project.session.switches[switchId]).toBe(false);
    expect(collectProjectReferenceIssues(project).filter((issue) => issue.includes("switchId"))).toEqual([]);
  });

  it("deserialize는 아이템 스위치 정의가 빠진 저장본을 복구해 로드한다", () => {
    const project = createBlankProject();
    const item = firstSwitchItem(project);
    const switchId = item.switchId!;
    const obj = JSON.parse(serialize(project)) as {
      switches: { id: string }[];
      session: { switches: Record<string, boolean> };
    };
    obj.switches = obj.switches.filter((entry) => entry.id !== switchId);
    delete obj.session.switches[switchId];

    const restored = deserialize(JSON.stringify(obj));

    expect(restored.switches.some((entry) => entry.id === switchId)).toBe(true);
  });
});
