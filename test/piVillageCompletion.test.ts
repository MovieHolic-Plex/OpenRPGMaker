import { describe, expect, it } from "vitest";
import { authoredVillageMapId, inspectPiVillageCompletion, piVillageRepairPrompt } from "@/ai/piAgent/villageCompletion";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent } from "@/project/types";
import { asVillageDesign } from "@/project/villageDesign";
import { evaluateVillageLook } from "@/editor/tools/villageEvaluate";

function resident(id: string): GameEvent {
  return { id, x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [{
    id: `${id}_page`, name: id, conditions: [], graphic: {}, trigger: { kind: "action" },
    priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
  }] };
}

describe("Pi 마을 완료 검사", () => {
  it("성공한 마을 시공 결과만 검사 대상으로 등록한다", () => {
    const record = { name: "author_village", args: {}, result: { ok: true, summary: "built", data: { village: { exteriorMapId: "village" } } } };
    expect(authoredVillageMapId(record)).toBe("village");
    expect(authoredVillageMapId({ ...record, result: { ...record.result, ok: false } })).toBeUndefined();
    expect(authoredVillageMapId({ ...record, name: "get_map_region" })).toBeUndefined();
  });

  it("기존 무언 주민은 보존하고 이번에 추가한 주민의 실제 페이지를 보충 대상으로 보낸다", () => {
    const base = createBlankProject();
    const id = base.startMapId;
    base.maps[id]!.events.push(resident("user_silent"));
    const project = structuredClone(base);
    project.maps[id]!.events.push(resident("ev_village_new_resident"), resident("visible_house_door"));
    const before = JSON.stringify(project);
    const report = inspectPiVillageCompletion(project, base, [id]);
    expect(report.issues.join("\n")).toContain("ev_village_new_resident_page");
    expect(report.issues.join("\n")).not.toContain("user_silent");
    expect(report.issues.join("\n")).not.toContain("visible_house_door");
    expect(piVillageRepairPrompt(project, base, report)).toContain('"pageId":"ev_village_new_resident_page"');
    expect(JSON.stringify(project)).toBe(before);
    project.maps[id]!.events.find(e => e.id === "ev_village_new_resident")!.pages![0]!.commands.push({ kind: "text", body: "오늘 강물이 불었어요." });
    expect(inspectPiVillageCompletion(project, base, [id]).issues.join("\n")).not.toContain("대사 없는 페이지");
  });

  it("다른 맵·비마을 턴은 검사하지 않고 삭제된 시공 대상은 미완료로 남긴다", () => {
    const base = createBlankProject();
    expect(inspectPiVillageCompletion(base, base, []).issues).toEqual([]);
    expect(inspectPiVillageCompletion(base, base, ["deleted"]).issues.join("\n")).toContain("맵을 찾을 수 없다");
  });

  it("과거 평가가 통과했더라도 마지막 맵이 집 없는 상태면 통과하지 않는다", () => {
    const base = createBlankProject();
    const report = inspectPiVillageCompletion(base, base, [base.startMapId]);
    expect(report.issues.join("\n")).toContain("문 앞 좌표가 0개");
  });

  it("저장된 숲 없음·주민 0명 설계서를 평가 때문에 무시하지 않는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.layoutPlan = { kind: "village-harness-natural-v2", regions: [], roadAnchors: [] } as typeof map.layoutPlan;
    const preset = asVillageDesign({ id: "quiet", name: "고요한 마을", houseCount: 4, npcCount: 0 });
    map.villageDesignSource = { preset, seed: 7, houseCount: 4 };
    const report = evaluateVillageLook({ project, mapId: map.id });
    expect(report.issues.join("\n")).not.toMatch(/수종|수목|외곽 나무|시간표가 있는 주민이 부족/);
    expect(report.ok).toBe(false); // Missing houses still fail structural QA.
  });
});
