import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { collectProjectReferenceIssues, repairProjectReferences } from "@/project/io/references";
import { runTool } from "@/editor/tools";
import type { Project } from "@/project/types";

function firstSwitchItem(project: Project) {
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

// 2026-09-24 감성 스토리 r3: rename_switch 가 to 로 id 를 바꾸면 item.switchId 등 DB 참조를
// 함께 치환하지 않아 무결성 검증이 커밋을 거부했다(같은 인자로 11회 반복 실패 — item_gen2_*_relay).
describe("rename_switch DB 스위치 참조 치환", () => {
  it("id 치환은 item.switchId 까지 옮겨 커밋을 통과한다", () => {
    const project = createBlankProject();
    const item = firstSwitchItem(project);
    const oldId = item.switchId!;
    const ctx = { project };

    const result = runTool(ctx, "rename_switch", { fromId: oldId, to: "sw_story_memento_done" }, { dryRun: false });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const moved = ctx.project.database.items.find((entry) => entry.id === item.id);
    expect(moved?.switchId).toBe("sw_story_memento_done");
    expect(collectProjectReferenceIssues(ctx.project).filter((issue) => issue.includes("switchId"))).toEqual([]);
  });

  it("모델이 자주 보내는 {id, name} 을 대상 별칭으로 받는다", () => {
    const project = createBlankProject();
    const item = firstSwitchItem(project);
    const oldId = item.switchId!;
    const ctx = { project };

    const result = runTool(ctx, "rename_switch", { id: oldId, name: "자장가 열쇠" }, { dryRun: false });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(ctx.project.switches.find((entry) => entry.id === oldId)?.name).toBe("자장가 열쇠");
  });
});
